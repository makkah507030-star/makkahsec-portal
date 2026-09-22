import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDateTime, fmtGreg } from "../../lib/dates";

/* ---------- أدوات تنسيق ---------- */
function fmtBytes(n) {
  if (n == null || isNaN(n)) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = Number(n);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
const todayStartISO = () => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); };
const daysAgoISO = (n) => { const d = new Date(); d.setDate(d.getDate()-n); d.setHours(0,0,0,0); return d.toISOString(); };
const cnt = (r) => (r && typeof r.count === "number" ? r.count : null);
const localDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const HISTORY_DAYS = 30;

/* ---------- عناصر واجهة ---------- */
function Stat({ label, value, sub }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-4">
      <p className="num text-2xl font-bold leading-none text-mint-deep">{value == null ? "—" : value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

const STATUS_TONE = {
  none:        { c: "bg-present/10 text-present",  t: "تعمل بشكل طبيعي" },
  minor:       { c: "bg-warning/10 text-warning",  t: "اضطراب بسيط" },
  major:       { c: "bg-absent/10 text-absent",    t: "اضطراب كبير" },
  critical:    { c: "bg-absent/10 text-absent",    t: "عطل حرج" },
  maintenance: { c: "bg-excused/10 text-excused",  t: "صيانة" },
  unknown:     { c: "bg-ink/5 text-muted",         t: "غير معروف" },
};
function StatusBadge({ name, ind, desc }) {
  const s = STATUS_TONE[ind] ?? STATUS_TONE.unknown;
  return (
    <div className="flex items-center justify-between rounded-card border border-line bg-white px-4 py-3">
      <span className="text-sm font-semibold text-ink">{name}</span>
      <span className={`chip ${s.c}`}>{desc || s.t}</span>
    </div>
  );
}
function Bar({ used, total }) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const tone = pct >= 90 ? "bg-absent" : pct >= 70 ? "bg-warning" : "bg-mint-deep";
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        <span className="num">{fmtBytes(used)}</span> من <span className="num">{fmtBytes(total)}</span>
        {" "}(<span className="num">{pct}%</span>)
      </p>
    </div>
  );
}
function NotConfigured({ what }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-canvas px-4 py-5 text-center">
      <p className="text-sm font-medium text-muted">بحاجة لإعداد مفتاح {what}</p>
      <p className="mt-1 text-xs text-faint">أضف متغيّرات البيئة في Netlify ثم أعِد التحميل.</p>
    </div>
  );
}

/* ---------- رسم دخول آخر ٧ أيام ---------- */
function LoginsChart({ rows }) {
  if (!rows?.length) return null;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-muted">عمليات الدخول — آخر ٧ أيام</h3>
      <div className="mt-3 flex items-end justify-between gap-2" style={{ height: 96 }}>
        {rows.map((r) => (
          <div key={r.day} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="num text-[11px] font-bold text-mint-deep">{r.count}</span>
            <div className="w-full rounded-t-md bg-mint-deep"
                 style={{ height: `${Math.max(4, (r.count / max) * 72)}px` }}
                 title={`${r.day}: ${r.count}`} />
            <span className="num text-[10px] text-faint">{r.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- حساب ملخّص الحالة (أمني + تقني) ---------- */
const SEV_RANK = { ok: 0, info: 1, warn: 2, crit: 3 };
function worst(a, b) { return SEV_RANK[a] >= SEV_RANK[b] ? a : b; }

function computeHealth(app, plat) {
  const checks = [];

  // تقني: حالة الخدمات
  const indMap = { none: "ok", minor: "warn", major: "crit", critical: "crit", maintenance: "info" };
  const nfInd = plat?.status?.netlify?.indicator, sbInd = plat?.status?.supabase?.indicator;
  if (nfInd || sbInd) {
    const sev = worst(indMap[nfInd] ?? "info", indMap[sbInd] ?? "info");
    checks.push({ area: "تقني", label: "حالة الخدمات الداعمة",
      sev, detail: `Netlify: ${plat?.status?.netlify?.description ?? "—"} · Supabase: ${plat?.status?.supabase?.description ?? "—"}` });
  }

  // تقني: آخر نشر
  if (plat?.netlify?.configured && plat.netlify.published_deploy) {
    const ready = plat.netlify.published_deploy.state === "ready";
    checks.push({ area: "تقني", label: "آخر عملية نشر",
      sev: ready ? "ok" : "warn",
      detail: ready ? "اكتمل النشر بنجاح" : `الحالة: ${plat.netlify.published_deploy.state}` });
  }

  // تقني/سعة: النطاق الترددي
  if (plat?.netlify?.bandwidth?.included) {
    const { used, included } = plat.netlify.bandwidth;
    const pct = Math.round((used / included) * 100);
    checks.push({ area: "سعة", label: "استهلاك النطاق الترددي",
      sev: pct >= 90 ? "crit" : pct >= 75 ? "warn" : "ok",
      detail: `${pct}% من الحصة الشهرية` });
  }

  // أمني: كلمات المرور الافتراضية
  if (app?.pendingPw != null) {
    const ratio = app.usersTotal ? app.pendingPw / app.usersTotal : 0;
    checks.push({ area: "أمني", label: "حسابات بكلمة المرور الافتراضية",
      sev: app.pendingPw === 0 ? "ok" : ratio > 0.2 ? "warn" : "info",
      detail: `${app.pendingPw} حساب لم يغيّر كلمة المرور بعد` });
  }

  // أمني: محاولات دخول فاشلة اليوم
  if (app?.failedToday != null) {
    checks.push({ area: "أمني", label: "محاولات دخول فاشلة اليوم",
      sev: app.failedToday >= 30 ? "crit" : app.failedToday >= 10 ? "warn" : "ok",
      detail: `${app.failedToday} محاولة فاشلة` });
  }

  // حوكمة: إشعارات بانتظار الاعتماد
  if (app?.drafts != null && app.drafts > 0) {
    checks.push({ area: "تقني", label: "إشعارات بانتظار الاعتماد",
      sev: "info", detail: `${app.drafts} بانتظار المراجعة` });
  }

  const verdict = checks.reduce((v, c) => worst(v, c.sev), "ok");
  return { verdict, checks };
}

const VERDICT = {
  ok:   { c: "border-present/30 bg-present/5",  chip: "bg-present/10 text-present", t: "سليم", msg: "جميع المؤشرات ضمن الوضع الطبيعي." },
  info: { c: "border-excused/30 bg-excused/5",  chip: "bg-excused/10 text-excused", t: "ملاحظات", msg: "لا مشاكل، مع نقاط للاطّلاع." },
  warn: { c: "border-warning/40 bg-warning/5",  chip: "bg-warning/10 text-warning", t: "تنبيه", msg: "توجد نقاط تحتاج انتباهك." },
  crit: { c: "border-absent/40 bg-absent/5",    chip: "bg-absent/10 text-absent",   t: "حرج", msg: "توجد مشكلة حرجة تتطلب تدخّلًا عاجلًا." },
};
const SEV_CHIP = {
  ok:   "bg-present/10 text-present",
  info: "bg-excused/10 text-excused",
  warn: "bg-warning/10 text-warning",
  crit: "bg-absent/10 text-absent",
};
const SEV_LABEL = { ok: "سليم", info: "للاطّلاع", warn: "تنبيه", crit: "حرج" };

function HealthSummary({ health, ready }) {
  const v = VERDICT[health.verdict] ?? VERDICT.info;
  return (
    <section className={`rounded-card border ${v.c} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">ملخّص حالة الموقع</h2>
          <p className="text-xs text-muted">الحالة الأمنية والتقنية · {fmtGreg(new Date().toISOString())}</p>
        </div>
        <span className={`chip ${v.chip} text-sm`}>{ready ? v.t : "…"}</span>
      </div>
      {ready && <p className="mt-2 text-sm text-ink">{v.msg}</p>}
      <div className="mt-3 space-y-1.5">
        {!ready ? (
          <p className="text-sm text-muted">جارٍ تقييم الحالة…</p>
        ) : health.checks.length === 0 ? (
          <p className="text-sm text-muted">لا توجد مؤشرات كافية للتقييم بعد.</p>
        ) : (
          health.checks.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-card bg-white/60 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  <span className="text-[11px] text-faint">[{c.area}]</span> {c.label}
                </p>
                <p className="truncate text-xs text-muted">{c.detail}</p>
              </div>
              <span className={`chip shrink-0 ${SEV_CHIP[c.sev]}`}>{SEV_LABEL[c.sev]}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ---------- سجل الحالة اليومي (آخر ٣٠ يومًا) ---------- */
const CELL_TONE = {
  ok: "bg-present text-white",
  info: "bg-excused text-white",
  warn: "bg-warning text-white",
  crit: "bg-absent text-white",
};

function StatusHistory({ rows, error, onSnapshot, busy, msg }) {
  const byDay = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.day, r])), [rows]);
  const days = useMemo(() => {
    const out = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); out.push(localDay(d));
    }
    return out;
  }, [rows]);
  const [sel, setSel] = useState(null);

  const latestDay = [...days].reverse().find((d) => byDay[d]) ?? null;
  const shownDay = sel ?? latestDay;
  const shown = shownDay ? byDay[shownDay] : null;

  const tally = days.reduce((t, d) => {
    const v = byDay[d]?.verdict ?? "none"; t[v] = (t[v] || 0) + 1; return t;
  }, {});

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">سجل الحالة اليومي</h2>
          <p className="text-xs text-muted">
            لقطة تُحفظ تلقائيًا نهاية كل يوم — آخر {HISTORY_DAYS} يومًا
          </p>
        </div>
        <button onClick={onSnapshot} disabled={busy}
                className="shrink-0 rounded-pill border border-line px-3 py-1.5 text-xs text-mint-deep hover:bg-canvas disabled:opacity-50">
          {busy ? "جارٍ الحفظ…" : "حفظ لقطة اليوم الآن"}
        </button>
      </div>

      {error ? (
        <p className="rounded-card bg-warning/10 px-4 py-3 text-xs text-warning">
          تعذّر تحميل السجل: {error}
        </p>
      ) : (
        <div className="card space-y-3 p-4">
          <div className="grid grid-cols-10 gap-1 sm:grid-cols-[repeat(30,minmax(0,1fr))]">
            {days.map((d) => {
              const r = byDay[d];
              const active = d === shownDay;
              return (
                <button key={d} type="button" onClick={() => r && setSel(d)} disabled={!r}
                        title={r ? `${d}: ${SEV_LABEL[r.verdict]}` : `${d}: لا توجد لقطة`}
                        aria-label={r ? `${d} ${SEV_LABEL[r.verdict]}` : `${d} لا توجد لقطة`}
                        className={`num flex h-8 items-center justify-center rounded-md text-[10px] font-semibold
                          ${r ? CELL_TONE[r.verdict] : "bg-line/60 text-faint"}
                          ${active ? "ring-2 ring-ink ring-offset-1" : ""}
                          ${r ? "cursor-pointer" : "cursor-default"}`}>
                  {d.slice(8)}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted">
            <span className="num">{tally.ok || 0}</span> سليم،{" "}
            <span className="num">{tally.info || 0}</span> ملاحظات،{" "}
            <span className="num">{tally.warn || 0}</span> تنبيه،{" "}
            <span className="num">{tally.crit || 0}</span> حرج،{" "}
            <span className="num">{tally.none || 0}</span> بلا لقطة
          </p>

          {!shown ? (
            <p className="rounded-card bg-canvas px-4 py-4 text-center text-sm text-muted">
              لا توجد لقطات محفوظة بعد. ستُحفظ أول لقطة تلقائيًا الليلة، أو اضغط «حفظ لقطة اليوم الآن».
            </p>
          ) : (
            <div className="space-y-2 border-t border-line pt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">{fmtGreg(`${shown.day}T12:00:00`)}</p>
                  <p className="text-[11px] text-faint">
                    {shown.source === "manual" ? "لقطة يدوية" : "لقطة تلقائية"}
                    {shown.created_at && <> · {fmtDateTime(shown.created_at)}</>}
                  </p>
                </div>
                <span className={`chip ${VERDICT[shown.verdict]?.chip ?? SEV_CHIP.info}`}>
                  {VERDICT[shown.verdict]?.t ?? "—"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="دخول ذلك اليوم" value={shown.metrics?.loginsToday} />
                <Stat label="محاولات فاشلة" value={shown.metrics?.failedToday} />
                <Stat label="بكلمة المرور الافتراضية" value={shown.metrics?.pendingPw} />
                <Stat label="النطاق الترددي"
                      value={shown.metrics?.bandwidth_pct != null ? `${shown.metrics.bandwidth_pct}%` : "—"} />
              </div>

              <div className="space-y-1.5">
                {(shown.checks || []).map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-card bg-canvas px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        <span className="text-[11px] text-faint">[{c.area}]</span> {c.label}
                      </p>
                      <p className="truncate text-xs text-muted">{c.detail}</p>
                    </div>
                    <span className={`chip shrink-0 ${SEV_CHIP[c.sev]}`}>{SEV_LABEL[c.sev]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {msg && (
        <p className={`rounded-card px-4 py-2.5 text-xs ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

/* ---------- الصفحة ---------- */
export default function SiteMetrics() {
  const [app, setApp] = useState(null);
  const [db, setDb] = useState(null);
  const [plat, setPlat] = useState(null);
  const [logins, setLogins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [at, setAt] = useState(null);
  const [platErr, setPlatErr] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyErr, setHistoryErr] = useState(null);
  const [snapBusy, setSnapBusy] = useState(false);
  const [snapMsg, setSnapMsg] = useState(null);

  const loadHistory = async () => {
    const from = new Date(); from.setDate(from.getDate() - (HISTORY_DAYS - 1));
    const { data, error } = await supabase
      .from("site_status_snapshots")
      .select("day, verdict, checks, metrics, source, created_at")
      .gte("day", localDay(from))
      .order("day", { ascending: true });
    if (error) { setHistoryErr(error.message); setHistory(null); }
    else { setHistoryErr(null); setHistory(data ?? []); }
  };

  const saveSnapshot = async () => {
    setSnapBusy(true); setSnapMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/site-metrics", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "snapshot" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "تعذّر حفظ اللقطة");
      setSnapMsg({ ok: true, text: `حُفظت لقطة اليوم (${SEV_LABEL[j.snapshot?.verdict] ?? "—"}).` });
      await loadHistory();
    } catch (e) {
      setSnapMsg({ ok: false, text: String(e?.message || e) });
    } finally {
      setSnapBusy(false);
    }
  };

  const load = async () => {
    setLoading(true); setPlatErr(null);
    const C = (q) => q.then((r) => cnt(r)).catch(() => null);
    const head = { count: "exact", head: true };
    const [
      usersTotal, students, teachers, admins, guardians, active, pendingPw,
      loginsToday, logins7, failedToday, notifs, drafts, tickets,
    ] = await Promise.all([
      C(supabase.from("users").select("id", head)),
      C(supabase.from("users").select("id", head).eq("role", "student")),
      C(supabase.from("users").select("id", head).eq("role", "teacher")),
      C(supabase.from("users").select("id", head).eq("role", "admin")),
      C(supabase.from("users").select("id", head).eq("role", "guardian")),
      C(supabase.from("users").select("id", head).eq("is_active", true)),
      C(supabase.from("users").select("id", head).eq("must_change_pw", true)),
      C(supabase.from("login_log").select("id", head).eq("event_type", "login").eq("success", true).gte("created_at", todayStartISO())),
      C(supabase.from("login_log").select("id", head).eq("event_type", "login").eq("success", true).gte("created_at", daysAgoISO(7))),
      C(supabase.from("login_log").select("id", head).eq("event_type", "login").eq("success", false).gte("created_at", todayStartISO())),
      C(supabase.from("notifications").select("id", head)),
      C(supabase.from("notification_drafts").select("id", head).eq("status", "pending")),
      C(supabase.from("support_tickets").select("id", head).neq("status", "closed")),
    ]);
    setApp({ usersTotal, students, teachers, admins, guardians, active, pendingPw,
             loginsToday, logins7, failedToday, notifs, drafts, tickets });

    try { const { data } = await supabase.rpc("admin_db_stats"); setDb(data ?? null); } catch { setDb(null); }
    try { const { data } = await supabase.rpc("admin_logins_by_day", { days: 7 }); setLogins(data ?? null); } catch { setLogins(null); }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/site-metrics", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const j = await res.json();
      if (!res.ok) { setPlatErr(j?.error || "تعذّر جلب مؤشرات المنصّات"); setPlat(null); }
      else setPlat(j);
    } catch (e) { setPlatErr(String(e?.message || e)); setPlat(null); }

    await loadHistory().catch((e) => setHistoryErr(String(e?.message || e)));

    setAt(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const health = useMemo(() => computeHealth(app, plat), [app, plat]);
  const ready = Boolean(app);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">مؤشرات الموقع</h1>
          <p className="mt-1 text-sm text-muted">
            متابعة صحة البوابة والجهات الداعمة لها — للدعم الفني.
            {at && <span className="text-faint"> · آخر تحديث {fmtDateTime(at.toISOString())}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading}
                className="shrink-0 rounded-pill border border-line px-4 py-2 text-sm text-mint-deep hover:bg-canvas disabled:opacity-50">
          {loading ? "جارٍ…" : "تحديث"}
        </button>
      </div>

      {/* ملخّص الحالة الأمنية والتقنية */}
      <HealthSummary health={health} ready={ready} />

      {/* سجل اللقطات اليومية */}
      <StatusHistory rows={history} error={historyErr}
                     onSnapshot={saveSnapshot} busy={snapBusy} msg={snapMsg} />

      {/* حالة الخدمات */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">حالة الخدمات</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <StatusBadge name="Netlify (الاستضافة)"
            ind={plat?.status?.netlify?.indicator ?? "unknown"} desc={plat?.status?.netlify?.description} />
          <StatusBadge name="Supabase (قاعدة البيانات)"
            ind={plat?.status?.supabase?.indicator ?? "unknown"} desc={plat?.status?.supabase?.description} />
        </div>
      </section>

      {/* استخدام التطبيق */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">استخدام التطبيق</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="إجمالي المستخدمين" value={app?.usersTotal} sub={app ? `مفعّل: ${app.active ?? "—"}` : null} />
          <Stat label="الطلاب" value={app?.students} />
          <Stat label="المعلمون" value={app?.teachers} />
          <Stat label="أولياء الأمور" value={app?.guardians} />
          <Stat label="الحسابات الإدارية" value={app?.admins} />
          <Stat label="بانتظار تغيير كلمة المرور" value={app?.pendingPw} />
          <Stat label="دخول اليوم" value={app?.loginsToday} sub={app ? `آخر ٧ أيام: ${app.logins7 ?? "—"}` : null} />
          <Stat label="محاولات فاشلة اليوم" value={app?.failedToday} />
          <Stat label="إشعارات بانتظار الاعتماد" value={app?.drafts} />
          <Stat label="إجمالي الإشعارات" value={app?.notifs} />
          <Stat label="تذاكر دعم مفتوحة" value={app?.tickets} />
        </div>
        {logins?.length > 0 && <LoginsChart rows={logins} />}
      </section>

      {/* قاعدة البيانات والتخزين */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">قاعدة البيانات والتخزين</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="حجم قاعدة البيانات" value={db ? fmtBytes(db.db_bytes) : "—"} />
          <Stat label="التخزين المستخدم" value={db ? fmtBytes(db.storage_bytes) : "—"} />
          <Stat label="عدد الملفات المخزّنة" value={db?.storage_objects} />
        </div>
        {db?.top_tables?.length > 0 && (
          <div className="card overflow-hidden">
            <h3 className="border-b border-line px-4 py-2.5 text-xs font-semibold text-muted">أكبر الجداول</h3>
            {db.top_tables.map((t) => (
              <div key={t.name} className="flex items-center justify-between border-b border-line px-4 py-2 text-sm last:border-0">
                <span className="text-ink" dir="ltr">{t.name}</span>
                <span className="num text-muted">{fmtBytes(t.bytes)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Netlify */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Netlify — النشر والنطاق</h2>
        {!plat?.netlify ? (
          <p className="text-sm text-muted">جارٍ التحميل…</p>
        ) : plat.netlify.configured === false ? (
          <NotConfigured what="Netlify" />
        ) : plat.netlify.error ? (
          <p className="rounded-card bg-absent/10 px-4 py-3 text-sm text-absent">{plat.netlify.error}</p>
        ) : (
          <div className="card space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="حالة آخر نشر" value={plat.netlify.published_deploy?.state ?? "—"} />
              <Stat label="وقت النشر"
                    value={plat.netlify.published_deploy?.published_at ? fmtDateTime(plat.netlify.published_deploy.published_at) : "—"} />
              <Stat label="مدة البناء"
                    value={plat.netlify.published_deploy?.deploy_time ? `${plat.netlify.published_deploy.deploy_time}s` : "—"} />
            </div>
            {plat.netlify.bandwidth && (
              <div>
                <p className="text-xs font-semibold text-muted">النطاق الترددي (هذه الدورة)</p>
                <Bar used={plat.netlify.bandwidth.used} total={plat.netlify.bandwidth.included} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Supabase المنصّة */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Supabase — المشروع والاشتراك</h2>
        {!plat?.supabase ? (
          <p className="text-sm text-muted">جارٍ التحميل…</p>
        ) : plat.supabase.configured === false ? (
          <NotConfigured what="Supabase" />
        ) : plat.supabase.error ? (
          <p className="rounded-card bg-absent/10 px-4 py-3 text-sm text-absent">{plat.supabase.error}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="حالة المشروع" value={plat.supabase.status ?? "—"} />
            <Stat label="الخطة" value={plat.supabase.plan ?? "—"} />
            <Stat label="المنطقة" value={plat.supabase.region ?? "—"} />
            <Stat label="تاريخ الإنشاء"
                  value={plat.supabase.created_at ? fmtDateTime(plat.supabase.created_at) : "—"} />
          </div>
        )}
      </section>

      {platErr && (
        <p className="rounded-card bg-warning/10 px-4 py-3 text-xs text-warning">ملاحظة: {platErr}</p>
      )}
    </div>
  );
}
