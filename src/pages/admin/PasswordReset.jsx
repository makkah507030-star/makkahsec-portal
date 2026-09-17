import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ROLE_LABEL } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDateTime } from "../../lib/dates";
import { printReport, exportStyledExcel, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const ROLES = ["admin", "teacher", "student", "guardian"];

export default function PasswordReset() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(null); // صف المستخدم
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) {
      setMsg({ ok: false, text: "اكتب ٣ أحرف أو أرقام على الأقل." });
      return;
    }
    setSearching(true);
    setMsg(null);
    setConfirming(null);

    const { data, error } = await supabase
      .from("users")
      .select("id, username, full_name, role, is_active, must_change_pw")
      .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
      .limit(25);

    setSearching(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setResults(data ?? []);
  };

  const reset = async (u) => {
    setBusy(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: u.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMsg({
        ok: true,
        text: `أُعيدت كلمة مرور ${data.full_name} إلى: ${data.username} — سيُطلب تغييرها عند أول دخول.`,
      });
      setConfirming(null);
      await search();
    } catch (e) {
      setMsg({ ok: false, text: e.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">استعادة كلمة المرور</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          تُعاد كلمة المرور إلى اسم المستخدم نفسه (رقم الهوية أو الجوال)،
          ويُطلب من المستخدم تغييرها عند أول دخول.
        </p>
      </div>

      <UnactivatedBoxes />

      <section className="card p-4">
        <label className="text-xs text-muted">بحث بالاسم أو رقم الهوية / الجوال</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            className="field flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="مثال: 1012345678 أو أحمد"
          />
          <button className="btn-primary" onClick={search} disabled={searching}>
            {searching ? "جارٍ البحث…" : "بحث"}
          </button>
        </div>
      </section>

      {msg && (
        <p className={`rounded-card px-4 py-3 text-sm leading-relaxed ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {results && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            النتائج <span className="num text-muted">({results.length})</span>
          </h2>

          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">لا نتائج مطابقة.</p>
          ) : (
            <div className="divide-y divide-line">
              {results.map((u) => (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {u.full_name ?? u.username}
                      </p>
                      <p className="num text-xs text-muted">{u.username}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <span className="chip bg-mint-tint text-mint-deep">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                      {!u.is_active && (
                        <span className="chip bg-absent/10 text-absent">معطّل</span>
                      )}
                      {u.must_change_pw && (
                        <span className="chip bg-warning-light text-warning">
                          بانتظار تغيير كلمة المرور
                        </span>
                      )}
                    </div>

                    {confirming?.id !== u.id && (
                      <button
                        onClick={() => { setConfirming(u); setMsg(null); }}
                        className="shrink-0 rounded-sm2 border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep"
                      >
                        إعادة تعيين
                      </button>
                    )}
                  </div>

                  {confirming?.id === u.id && (
                    <div className="mt-3 rounded-sm2 bg-warning-light/60 p-3">
                      <p className="text-sm leading-relaxed text-ink">
                        ستُعاد كلمة مرور <b>{u.full_name ?? u.username}</b> إلى{" "}
                        <b className="num">{u.username}</b>. هل تريد المتابعة؟
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button className="btn-primary" onClick={() => reset(u)} disabled={busy}>
                          {busy ? "جارٍ التنفيذ…" : "نعم، أعد التعيين"}
                        </button>
                        <button className="btn-ghost" onClick={() => setConfirming(null)}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ActivationLog />
    </div>
  );
}

/* ==================== الحسابات غير المفعَّلة ==================== */

const ROLE_META = {
  admin:    { label: "الإدارة",        icon: "🛡" },
  teacher:  { label: "المعلمون",       icon: "📘" },
  student:  { label: "الطلاب",         icon: "🎓" },
  guardian: { label: "أولياء الأمور",  icon: "👪" },
};

function UnactivatedBoxes() {
  const [stats, setStats] = useState(null);
  const [openRole, setOpenRole] = useState(null);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("activation_stats");
    if (error) { console.error(error); setStats({}); return; }
    const m = Object.fromEntries(
      (data ?? []).map((r) => [r.role, {
        total: Number(r.total),
        activated: Number(r.activated),
        unactivated: Number(r.unactivated),
      }])
    );
    setStats(m);
  };

  useEffect(() => { load(); }, []);

  const openBox = async (role) => {
    if (openRole === role) { setOpenRole(null); return; }
    setOpenRole(role);
    setList(null);
    const { data, error } = await supabase
      .from("users")
      .select("id, username, full_name, role")
      .eq("role", role)
      .eq("must_change_pw", true)
      .eq("is_active", true)
      .order("full_name");
    if (error) { console.error(error); setList([]); return; }
    setList(data ?? []);
  };

  /* ---------- تصدير عادي (إدارة / معلمون) ---------- */
  const exportSimple = async (role, kind) => {
    setBusy(true);
    const { data } = await supabase
      .from("users")
      .select("username, full_name")
      .eq("role", role).eq("must_change_pw", true).eq("is_active", true)
      .order("full_name");

    const headers = ["م", "الاسم", "اسم المستخدم"];
    const rows = (data ?? []).map((u, i) => [i + 1, u.full_name ?? "", u.username]);
    const label = ROLE_META[role]?.label ?? role;

    if (kind === "pdf") {
      printReport({
        title: `الحسابات غير المفعَّلة — ${label}`,
        subtitle: `${rows.length} حساب`,
        headers, rows,
        logoUrl: new URL(logoIcon, window.location.origin).href,
        moeLogoUrl: new URL(moeLogo, window.location.origin).href,
        signatures: [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }],
      });
    } else {
      exportStyledExcel({
        title: `الحسابات غير المفعَّلة — ${label}`,
        subtitle: `${rows.length} حساب`,
        headers, rows,
        fileName: `غير-مفعّلة-${role}`,
        sheetName: label,
        signatures: [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }],
      });
    }
    setBusy(false);
  };

  /* ---------- تصدير الطلاب وأولياء أمورهم مجمَّعًا بالفصول ---------- */
  const exportByClass = async (kind) => {
    setBusy(true);

    const { data: students } = await supabase
      .from("users")
      .select("id, username, full_name, must_change_pw, students(id)")
      .eq("role", "student").eq("is_active", true);

    const { data: guardians } = await supabase
      .from("users")
      .select("id, username, full_name, must_change_pw, guardians(id, guardian_student(student_id))")
      .eq("role", "guardian").eq("is_active", true);

    const { data: enroll } = await supabase
      .from("v_active_students")
      .select("student_id, full_name, class_no, grade");

    const classOf = Object.fromEntries(
      (enroll ?? []).map((e) => [e.student_id, { class_no: e.class_no, grade: e.grade }])
    );

    const rows = [];

    (students ?? [])
      .filter((u) => u.must_change_pw)
      .forEach((u) => {
        const sid = u.students?.[0]?.id ?? u.students?.id;
        const cl = classOf[sid];
        rows.push({
          name: u.full_name ?? "", username: u.username, role: "طالب",
          class_no: cl?.class_no ?? "", grade: cl?.grade ? GRADE_NAMES[cl.grade] : "",
        });
      });

    (guardians ?? [])
      .filter((u) => u.must_change_pw)
      .forEach((u) => {
        const links = u.guardians?.guardian_student ?? u.guardians?.[0]?.guardian_student ?? [];
        const first = Array.isArray(links) ? links[0] : null;
        const cl = first ? classOf[first.student_id] : null;
        rows.push({
          name: u.full_name ?? "", username: u.username, role: "ولي أمر",
          class_no: cl?.class_no ?? "", grade: cl?.grade ? GRADE_NAMES[cl.grade] : "",
        });
      });

    rows.sort((a, b) =>
      (a.class_no || 999) - (b.class_no || 999) || a.name.localeCompare(b.name, "ar")
    );

    const headers = ["م", "الاسم", "الصفة", "اسم المستخدم", "الصف", "الفصل"];
    const table = rows.map((r, i) => [i + 1, r.name, r.role, r.username, r.grade, r.class_no]);

    if (kind === "pdf") {
      printReport({
        title: "الحسابات غير المفعَّلة — الطلاب وأولياء الأمور",
        subtitle: `مرتّبة بالفصول · ${table.length} حساب`,
        headers, rows: table,
        logoUrl: new URL(logoIcon, window.location.origin).href,
        moeLogoUrl: new URL(moeLogo, window.location.origin).href,
        signatures: [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }],
      });
    } else {
      exportStyledExcel({
        title: "الحسابات غير المفعَّلة — الطلاب وأولياء الأمور",
        subtitle: `مرتّبة بالفصول · ${table.length} حساب`,
        headers, rows: table,
        fileName: "غير-مفعّلة-الطلاب-وأولياء-الأمور",
        sheetName: "غير مفعَّلة",
        signatures: [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }],
      });
    }
    setBusy(false);
  };

  if (!stats) return null;
  const totalUnactivated = ROLES.reduce((n, r) => n + (stats[r]?.unactivated ?? 0), 0);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">تفعيل الحسابات</h2>
        <span className="num chip bg-warning-light text-warning">{totalUnactivated} غير مفعَّل</span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {ROLES.map((r) => {
          const s = stats[r] ?? { total: 0, activated: 0, unactivated: 0 };
          const pct = s.total ? Math.round((s.activated / s.total) * 100) : 0;
          return (
            <button key={r} onClick={() => openBox(r)}
              className={`rounded-card border p-3 text-right transition-colors ${
                openRole === r ? "border-mint-deep bg-mint-tint" : "border-line bg-white hover:border-[#CCF2DB] hover:bg-canvas"}`}>
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-ink">{ROLE_META[r].label}</p>
                <span className="num text-[11px] text-faint">{s.total}</span>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-gray-tint">
                <div className="h-full rounded-pill bg-present transition-all" style={{ width: `${pct}%` }} />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="num font-semibold text-present">{s.activated} مفعَّل</span>
                <span className="num font-semibold text-warning">{s.unactivated} غير مفعَّل</span>
              </div>
            </button>
          );
        })}
      </div>

      {openRole && (
        <div className="border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-tint px-4 py-2.5">
            <p className="text-xs font-medium text-muted">
              {ROLE_META[openRole].label} — <span className="num">{list?.length ?? "…"}</span> حساب
            </p>
            <div className="flex gap-2">
              {openRole === "student" || openRole === "guardian" ? (
                <>
                  <button onClick={() => exportByClass("pdf")} disabled={busy}
                    className="rounded-sm2 border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-40">
                    الطلاب وأولياء الأمور بالفصول — PDF
                  </button>
                  <button onClick={() => exportByClass("excel")} disabled={busy}
                    className="rounded-sm2 border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-40">
                    Excel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => exportSimple(openRole, "pdf")} disabled={busy}
                    className="rounded-sm2 border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-40">
                    PDF
                  </button>
                  <button onClick={() => exportSimple(openRole, "excel")} disabled={busy}
                    className="rounded-sm2 border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-40">
                    Excel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {!list ? (
              <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>
            ) : list.length === 0 ? (
              <p className="px-4 py-6 text-sm text-present">لا حسابات غير مفعَّلة في هذه الفئة.</p>
            ) : (
              <div className="divide-y divide-line">
                {list.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <p className="truncate text-sm text-ink">{u.full_name ?? u.username}</p>
                    <span className="num text-xs text-faint">{u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ==================== سجل التفعيل ==================== */

function ActivationLog() {
  const [rows, setRows] = useState(null);
  const [role, setRole] = useState(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, full_name, role, activated_at")
        .not("activated_at", "is", null)
        .order("activated_at", { ascending: false })
        .limit(100);
      if (error) { console.error(error); setRows([]); return; }
      setRows(data ?? []);
    })();
  }, []);

  const filtered = useMemo(
    () => (role ? (rows ?? []).filter((r) => r.role === role) : rows ?? []),
    [rows, role]
  );

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">سجل التفعيل</h2>
        <p className="text-xs text-muted">آخر ١٠٠ عملية</p>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        <Pill on={!role} onClick={() => setRole(0)}>الكل</Pill>
        {ROLES.map((r) => (
          <Pill key={r} on={role === r} onClick={() => setRole(r)}>{ROLE_META[r].label}</Pill>
        ))}
      </div>

      {!rows && <p className="px-4 pb-4 text-sm text-muted">جارٍ التحميل…</p>}
      {rows && filtered.length === 0 && (
        <p className="px-4 pb-6 text-sm text-muted">لا عمليات تفعيل مسجّلة بعد.</p>
      )}

      {filtered.length > 0 && (
        <div className="divide-y divide-line">
          {filtered.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{u.full_name ?? u.username}</p>
                <p className="num text-xs text-muted">{u.username}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="chip bg-mint-tint text-mint-deep">{ROLE_META[u.role]?.label ?? u.role}</span>
                <span className="text-xs text-faint">{fmtDateTime(u.activated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}
