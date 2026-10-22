// src/pages/circulars/Circulars.jsx
/* =====================================================================
   التعاميم (/circulars) — لمن له صلاحية «التعاميم» مع المدير والدعم الفني (supabase/circulars_*.sql):
   • تعميم جديد: وارد (من الإدارة العامة للتعليم أو الوزارة) أو داخلي، برقمه وتاريخه وجهته وموضوعه
     وتصنيفه وأهميته والمطلوب وآخر موعد وملفه، ثم المستفيدون: المنسوبون (الكل أو فئة أو أدوار أو
     أشخاص) وأولياء الأمور (الكل أو صفوف أو فصول). يصل كلَّ مستفيد إشعار برابط التعميم.
   • الأرشيف: كل التعاميم برقم قيدها في السنة، بحث وتصفية، ونسبة الاطلاع لكلٍّ منها.
   • التقرير: ملخص الفترة، والتصنيفات، والتزام كل مستفيد بالاطلاع؛ طباعة بهوية البوابة وExcel.
   متابعة التعميم الواحد (المستفيدون والتذكير وكشف الاطلاع) في صفحته /circulars/:id.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { ADMIN_ROLE_LABEL, ASSIGNABLE_ROLES } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import { GRADE_NAMES, todayISO } from "../../lib/schoolTime";
import { printReport, exportStyledExcel, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { countAr } from "../../lib/arabicCount.js";
import { byName } from "../../lib/sortAr.js";
import Loader from "../../components/Loader.jsx";
import PresetChips from "../../components/PresetChips.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import {
  CIRC_BUCKET, DIRECTION, PRIORITY, CATEGORIES, SOURCES, STAFF_SCOPES, GUARDIAN_SCOPES,
  circStats, circNo, setupMsg, isSetupErr,
} from "../../lib/circulars.js";

const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
const chip = (on) => `rounded-pill border px-3 py-1 text-xs transition-colors ${
  on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted hover:bg-canvas"}`;
const toggle = (set, v) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };

export default function Circulars() {
  const [params, setParams] = useSearchParams();
  const tab = ["new", "archive", "report"].includes(params.get("tab")) ? params.get("tab") : "archive";
  const [year, setYear] = useState("");
  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "active_year").maybeSingle().then(({ data }) => setYear(data?.value ?? ""));
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">التعاميم</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          التعاميم الواردة من الإدارة العامة للتعليم والوزارة، والتعاميم الداخلية للمدرسة: تُرسل للمنسوبين وأولياء
          الأمور، ويُتابع اطلاع كل مستفيد وإقراره، ويُذكَّر من تأخر، وتُحفظ في الأرشيف برقم قيدها.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className={pill(tab === "new")} onClick={() => setParams({ tab: "new" })}>+ تعميم جديد</button>
        <button className={pill(tab === "archive")} onClick={() => setParams({ tab: "archive" })}>الأرشيف</button>
        <button className={pill(tab === "report")} onClick={() => setParams({ tab: "report" })}>التقرير</button>
      </div>
      {tab === "new" && <NewCircular year={year} />}
      {tab === "archive" && <Archive year={year} />}
      {tab === "report" && <Report year={year} />}
    </div>
  );
}

/* ------------------------- المستفيدون (مشترك مع إضافة مستفيدين) ------------------------- */
export function useStaffList() {
  const [list, setList] = useState(null);
  useEffect(() => {
    supabase.from("users").select("id, full_name, role").in("role", ["admin", "teacher"]).eq("is_active", true)
      .then(({ data }) => setList((data ?? []).sort(byName())));
  }, []);
  return list;
}

export function Audience({ value, onChange }) {
  const staff = useStaffList();
  const [q, setQ] = useState("");
  const [classes, setClasses] = useState([]);
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });
  useEffect(() => {
    supabase.from("classes").select("class_no, grade").order("class_no").then(({ data }) => setClasses(data ?? []));
  }, []);
  const roles = ASSIGNABLE_ROLES.filter((r) => ADMIN_ROLE_LABEL[r]);
  const hits = q.trim().length >= 2 ? (staff ?? []).filter((u) => u.full_name.includes(q.trim())).slice(0, 12) : [];
  const picked = (staff ?? []).filter((u) => v.users.has(u.id));
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink">المنسوبون</p>
        <div className="flex flex-wrap gap-1.5">
          {STAFF_SCOPES.map(([k, t]) => <button key={k} type="button" className={chip(v.staff === k)} onClick={() => set({ staff: k })}>{t}</button>)}
        </div>
      </div>
      <details className="rounded-sm2 border border-line bg-canvas/40 px-3 py-2" open={v.roles.size > 0}>
        <summary className="cursor-pointer text-xs font-semibold text-ink">أدوار إدارية بعينها {v.roles.size > 0 && <span className="num text-mint-deep">({v.roles.size})</span>}</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {roles.map((r) => <button key={r} type="button" className={chip(v.roles.has(r))} onClick={() => set({ roles: toggle(v.roles, r) })}>{ADMIN_ROLE_LABEL[r]}</button>)}
        </div>
      </details>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink">أشخاص بأسمائهم {picked.length > 0 && <span className="num text-mint-deep">({picked.length})</span>}</p>
        <input className="field w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المعلم أو الإداري" />
        {hits.length > 0 && (
          <div className="mt-1 max-h-48 divide-y divide-line overflow-y-auto rounded-sm2 border border-line">
            {hits.map((u) => (
              <button key={u.id} type="button" onClick={() => { set({ users: toggle(v.users, u.id) }); setQ(""); }}
                      className="flex w-full items-center justify-between px-3 py-2 text-right text-sm hover:bg-canvas">
                <span className="text-ink">{u.full_name}</span><span className="text-[11px] text-muted">{u.role === "teacher" ? "معلم" : "إداري"}</span>
              </button>
            ))}
          </div>
        )}
        {picked.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {picked.map((u) => (
              <span key={u.id} className="chip gap-1 bg-mint-tint text-mint-deep">{u.full_name}
                <button type="button" aria-label="إزالة" onClick={() => set({ users: toggle(v.users, u.id) })}>×</button></span>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink">أولياء الأمور</p>
        <div className="flex flex-wrap gap-1.5">
          {GUARDIAN_SCOPES.map(([k, t]) => <button key={k} type="button" className={chip(v.guardians === k)} onClick={() => set({ guardians: k })}>{t}</button>)}
        </div>
        {v.guardians === "grades" && (
          <div className="mt-2 space-y-2 rounded-sm2 border border-line bg-canvas/40 p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3].map((g) => <button key={g} type="button" className={chip(v.grades.has(g))}
                onClick={() => set({ grades: toggle(v.grades, g), classes: new Set([...v.classes].filter((c) => classes.find((x) => x.class_no === c)?.grade !== g || !v.grades.has(g))) })}>{GRADE_NAMES[g]}</button>)}
            </div>
            {v.grades.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-muted">فصول بعينها (اختياري):</span>
                {classes.filter((c) => v.grades.has(c.grade)).map((c) => (
                  <button key={c.class_no} type="button" className={chip(v.classes.has(c.class_no))}
                          onClick={() => set({ classes: toggle(v.classes, c.class_no) })}><span className="num">{c.class_no}</span></button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const emptyAudience = () => ({ staff: "all", roles: new Set(), users: new Set(), guardians: "none", grades: new Set(), classes: new Set() });
export const audienceEmpty = (a) => a.staff === "none" && !a.roles.size && !a.users.size
  && (a.guardians === "none" || (a.guardians === "grades" && !a.grades.size));
/* وصف المستفيدين للأرشيف */
export function audienceText(a) {
  const parts = [];
  if (a.staff !== "none") parts.push(STAFF_SCOPES.find(([k]) => k === a.staff)?.[1]);
  if (a.roles.size) parts.push([...a.roles].map((r) => ADMIN_ROLE_LABEL[r] ?? r).join("، "));
  if (a.users.size) parts.push(countAr(a.users.size, "person"));
  if (a.guardians === "all") parts.push("كل أولياء الأمور");
  if (a.guardians === "grades" && a.grades.size) {
    parts.push(`أولياء أمور ${[...a.grades].map((g) => GRADE_NAMES[g]).join("، ")}${a.classes.size ? ` (الفصول ${[...a.classes].join("، ")})` : ""}`);
  }
  return parts.filter(Boolean).join(" · ");
}
export const sendAudience = (id, a) => supabase.rpc("circular_send", {
  p_id: id, p_staff: a.staff, p_roles: [...a.roles], p_users: [...a.users],
  p_guardians: a.guardians, p_grades: [...a.grades], p_classes: [...a.classes],
});

/* ------------------------------ تعميم جديد ------------------------------ */
function NewCircular({ year }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ direction: "incoming", ref_no: "", ref_date: "", source: SOURCES[0], subject: "", body: "",
    category: "", priority: "normal", action_required: "", due_date: "", needs_ack: true });
  const [file, setFile] = useState(null);
  const [aud, setAud] = useState(emptyAudience);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const send = async () => {
    if (!f.subject.trim()) { setErr("اكتب موضوع التعميم."); return; }
    if (audienceEmpty(aud)) { setErr("حدّد المستفيدين."); return; }
    if (file && file.size > 15 * 1048576) { setErr("الملف أكبر من 15 ميجابايت."); return; }
    setBusy(true); setErr("");
    try {
      const row = { ...f, subject: f.subject.trim(), body: f.body.trim() || null, ref_no: f.ref_no.trim() || null,
        ref_date: f.ref_date.trim() || null, source: f.source.trim() || null, category: f.category || null,
        action_required: f.action_required.trim() || null, due_date: f.due_date || null,
        academic_year: year || null, audience: { text: audienceText(aud) } };
      const { data: c, error } = await supabase.from("circulars").insert(row).select("id").single();
      if (error) throw error;
      if (file) {
        const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
        const path = `${c.id}/circular${ext}`;
        const up = await supabase.storage.from(CIRC_BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (up.error) throw up.error;
        await supabase.from("circulars").update({ file_path: path, file_name: file.name }).eq("id", c.id);
      }
      const { error: se } = await sendAudience(c.id, aud);
      if (se) throw se;
      navigate(`/circulars/${c.id}?sent=1`);
    } catch (e) { setErr(isSetupErr(e) ? setupMsg : e.message ?? String(e)); }
    setBusy(false);
  };

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(DIRECTION).map((k) => (
          <button key={k} type="button" className={pill(f.direction === k)}
                  onClick={() => set({ direction: k, source: k === "internal" ? "إدارة المدرسة" : SOURCES[0] })}>
            {k === "incoming" ? "تعميم وارد" : "تعميم داخلي"}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">رقم التعميم{f.direction === "incoming" ? " في الأصل" : " (اختياري)"}
          <input className="field mt-1 w-full" value={f.ref_no} onChange={(e) => set({ ref_no: e.target.value })} /></label>
        <label className="text-xs text-muted">تاريخه
          <input className="field mt-1 w-full" value={f.ref_date} placeholder="مثل 1448/05/11" onChange={(e) => set({ ref_date: e.target.value })} /></label>
        <label className="text-xs text-muted">التصنيف
          <select className="field mt-1 w-full" value={f.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">—</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
      </div>
      <label className="block text-xs text-muted">الجهة المصدرة
        <input className="field mt-1 w-full" value={f.source} onChange={(e) => set({ source: e.target.value })} />
        <PresetChips items={SOURCES} value={f.source} replace onChange={(t) => set({ source: t })} /></label>
      <label className="block text-xs text-muted">الموضوع <span className="text-absent">*</span>
        <input className="field mt-1 w-full" value={f.subject} onChange={(e) => set({ subject: e.target.value })} /></label>
      <label className="block text-xs text-muted">ملخص التعميم أو نصه
        <textarea className="field mt-1 w-full" rows={4} value={f.body} onChange={(e) => set({ body: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="text-xs text-muted">المطلوب من المستفيد (اختياري)
          <input className="field mt-1 w-full" value={f.action_required} placeholder="مثل: تعبئة النموذج المرفق وتسليمه للوكيل"
                 onChange={(e) => set({ action_required: e.target.value })} /></label>
        <label className="text-xs text-muted">آخر موعد (اختياري)
          <input type="date" className="field mt-1 w-full" value={f.due_date} min={todayISO()} onChange={(e) => set({ due_date: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">الأهمية:</span>
          {Object.entries(PRIORITY).map(([k, p]) => <button key={k} type="button" className={chip(f.priority === k)} onClick={() => set({ priority: k })}>{p.t}</button>)}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink">
          <input type="checkbox" checked={f.needs_ack} onChange={(e) => set({ needs_ack: e.target.checked })} />
          يتطلب الإقرار بالاطلاع («اطّلعت»)</label>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-dashed border-line bg-canvas px-4 py-5 text-center hover:border-mint-deep">
        <span className="text-sm font-semibold text-ink">{file ? file.name : "إرفاق ملف التعميم (PDF أو صورة)"}</span>
        <span className="text-[11px] text-muted">{file ? "اضغط لتغييره" : "حتى 15 ميجابايت؛ يفتحه المستفيدون وحدهم"}</span>
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="rounded-card border border-line p-3">
        <p className="mb-2 text-sm font-bold text-ink">المستفيدون</p>
        <Audience value={aud} onChange={setAud} />
        {!audienceEmpty(aud) && <p className="mt-2 text-[11px] text-mint-deep">{audienceText(aud)}</p>}
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <button className="btn-primary w-full" disabled={busy} onClick={send}>{busy ? "جارٍ الإرسال…" : "حفظ التعميم وإرساله"}</button>
      <p className="text-[11px] leading-relaxed text-muted">يصل كلَّ مستفيد إشعار على الجرس والجوال برابط التعميم، ويُسجَّل وقت فتحه وإقراره.
        ويُحفظ في الأرشيف برقم قيده في السنة.</p>
    </section>
  );
}

/* ------------------------------ تحميل التعاميم وإحصاءاتها ------------------------------ */
function useCirculars(year) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("circulars").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) { setErr(isSetupErr(error) ? setupMsg : error.message); setRows([]); return; }
      const ids = (data ?? []).map((c) => c.id);
      const recs = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data: r } = await supabase.from("circular_recipients")
          .select("circular_id, user_id, kind, name, read_at, ack_at, remind_count").in("circular_id", ids.slice(i, i + 100));
        recs.push(...(r ?? []));
      }
      const by = new Map();
      recs.forEach((r) => { if (!by.has(r.circular_id)) by.set(r.circular_id, []); by.get(r.circular_id).push(r); });
      setRows((data ?? []).map((c) => ({ ...c, recs: by.get(c.id) ?? [] })));
    })();
  }, [year]);
  return { rows, err };
}
const isOverdue = (c) => c.due_date && !c.closed_at && c.due_date < todayISO() && circStats(c.recs, c.needs_ack).pending > 0;

/* ------------------------------ الأرشيف ------------------------------ */
function Archive({ year }) {
  const { rows, err } = useCirculars(year);
  const [q, setQ] = useState("");
  const [yr, setYr] = useState("");
  const [dir, setDir] = useState("");
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");
  useEffect(() => { if (year && !yr) setYr(year); }, [year]);   // eslint-disable-line react-hooks/exhaustive-deps
  const years = useMemo(() => [...new Set((rows ?? []).map((c) => c.academic_year).filter(Boolean))].sort().reverse(), [rows]);
  const shown = (rows ?? []).filter((c) => {
    if (yr && c.academic_year !== yr) return false;
    if (dir && c.direction !== dir) return false;
    if (cat && c.category !== cat) return false;
    const s = circStats(c.recs, c.needs_ack);
    if (st === "open" && (c.closed_at || !s.pending)) return false;
    if (st === "done" && s.pending && !c.closed_at) return false;
    if (st === "late" && !isOverdue(c)) return false;
    const t = q.trim();
    return !t || [c.subject, c.ref_no, c.source, c.body, String(c.seq)].some((x) => String(x ?? "").includes(t));
  });

  if (!rows) return <Loader />;
  if (err) return <p className="card px-4 py-5 text-sm text-absent">{err}</p>;
  return (
    <div className="space-y-3">
      <section className="card grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="field lg:col-span-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالموضوع أو الرقم أو الجهة" />
        <select className="field" value={yr} onChange={(e) => setYr(e.target.value)}>
          <option value="">كل السنوات</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="field" value={dir} onChange={(e) => setDir(e.target.value)}>
          <option value="">الوارد والداخلي</option><option value="incoming">الوارد</option><option value="internal">الداخلي</option>
        </select>
        <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">كل التصنيفات</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5 sm:col-span-2 lg:col-span-5">
          {[["", "الكل"], ["open", "متابعة مفتوحة"], ["late", "تجاوزت موعدها"], ["done", "مكتملة أو مغلقة"]].map(([k, t]) => (
            <button key={k} className={chip(st === k)} onClick={() => setSt(k)}>{t}</button>
          ))}
          <span className="mr-auto self-center text-[11px] text-muted">{countAr(shown.length, "circular")}</span>
        </div>
      </section>
      {shown.length === 0 ? <p className="card px-4 py-6 text-sm text-muted">لا تعاميم بهذه التصفية.</p> : (
        <div className="space-y-2">
          {shown.map((c) => {
            const s = circStats(c.recs, c.needs_ack);
            return (
              <Link key={c.id} to={`/circulars/${c.id}`} className="card block p-3 transition hover:border-mint-light">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num rounded-sm2 bg-canvas px-2 py-0.5 text-xs font-bold text-ink">{circNo(c)}</span>
                  <span className={`chip ${DIRECTION[c.direction]?.c}`}>{DIRECTION[c.direction]?.t}</span>
                  {c.priority !== "normal" && <span className={`chip ${PRIORITY[c.priority].c}`}>{PRIORITY[c.priority].t}</span>}
                  {c.category && <span className="chip bg-canvas text-muted">{c.category}</span>}
                  {c.closed_at && <span className="chip bg-canvas text-faint">أُغلقت متابعته</span>}
                  {isOverdue(c) && <span className="chip bg-absent/10 text-absent">تجاوز موعده</span>}
                  <span className="mr-auto text-[11px] text-muted">{fmtDate(c.sent_at ?? c.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-ink">{c.subject}</p>
                <p className="text-[11px] text-muted">{[c.source, c.ref_no && `رقم ${c.ref_no}`, c.audience?.text].filter(Boolean).join(" · ")}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-canvas">
                    <div className={`h-full rounded-pill ${s.pct >= 90 ? "bg-present" : s.pct >= 60 ? "bg-late" : "bg-absent"}`} style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="num shrink-0 text-[11px] text-muted">{c.needs_ack ? "أقرّ" : "اطّلع"} {s.done}/{s.total} · {s.pct}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ التقرير ------------------------------ */
function Report({ year }) {
  const { rows, err } = useCirculars(year);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [kind, setKind] = useState("staff");
  const list = (rows ?? []).filter((c) => c.sent_at && (!from || c.sent_at.slice(0, 10) >= from) && (!to || c.sent_at.slice(0, 10) <= to));
  const all = list.flatMap((c) => c.recs.map((r) => ({ ...r, c })));
  const done = (r) => (r.c.needs_ack ? r.ack_at : r.read_at);
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const overall = pct(all.filter(done).length, all.length);
  const hours = (r) => (done(r) ? (new Date(done(r)) - new Date(r.c.sent_at)) / 36e5 : null);
  const cats = useMemo(() => {
    const m = new Map();
    list.forEach((c) => { const k = c.category || "غير مصنّف"; m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [list]);
  const people = useMemo(() => {
    const m = new Map();
    all.filter((r) => r.kind === kind).forEach((r) => {
      const x = m.get(r.user_id) ?? { name: r.name ?? "—", n: 0, d: 0, hs: [], rem: 0 };
      x.n++; if (done(r)) { x.d++; x.hs.push(hours(r)); } x.rem += r.remind_count ?? 0;
      m.set(r.user_id, x);
    });
    return [...m.values()].map((x) => ({ ...x, pct: pct(x.d, x.n),
      avg: x.hs.length ? Math.round(x.hs.reduce((a, b) => a + b, 0) / x.hs.length) : null }))
      .sort((a, b) => a.pct - b.pct || b.n - a.n);
  }, [all, kind]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows) return <Loader />;
  if (err) return <p className="card px-4 py-5 text-sm text-absent">{err}</p>;
  const kpis = [["التعاميم", list.length], ["الوارد", list.filter((c) => c.direction === "incoming").length],
    ["الداخلي", list.filter((c) => c.direction === "internal").length], ["نسبة الاطلاع", `${overall}%`],
    ["تجاوزت موعدها", list.filter(isOverdue).length]];
  const period = `${from ? fmtDate(from) : "بداية السجل"} — ${fmtDate(to)}`;
  const HEAD = ["م", "الاسم", "وصله", "اطّلع", "النسبة", "متوسط الاستجابة (ساعة)", "تذكيرات"];
  const line = (p, i) => [i + 1, p.name, p.n, p.d, `${p.pct}%`, p.avg ?? "—", p.rem];
  const print = () => printReport({
    title: "تقرير التعاميم", subtitle: period,
    logoUrl: new URL(logoIcon, window.location.origin).href, moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    sections: [
      { title: "الملخص", headerRows: [kpis.map((k) => k[0])], rows: [kpis.map((k) => k[1])] },
      { title: "التعاميم", headerRows: [["رقم القيد", "النوع", "الموضوع", "الجهة", "التاريخ", "الاطلاع"]],
        rows: list.map((c) => { const s = circStats(c.recs, c.needs_ack); return [circNo(c), DIRECTION[c.direction]?.t, c.subject, c.source ?? "", fmtDate(c.sent_at), `${s.done}/${s.total} (${s.pct}%)`]; }) },
      { title: kind === "staff" ? "التزام المنسوبين بالاطلاع" : "اطلاع أولياء الأمور", headerRows: [HEAD], rows: people.map(line) },
    ],
    signatures: [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }], signOnLastPageOnly: true,
  });
  const excel = () => exportStyledExcel({ title: "تقرير التعاميم", subtitle: period, headers: HEAD, rows: people.map(line),
    fileName: "تقرير-التعاميم", sheetName: "الاطلاع" });

  return (
    <div className="space-y-3">
      <section className="card flex flex-wrap items-end gap-2 p-3">
        <label className="text-xs text-muted">من<input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted">إلى<input type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="flex gap-1.5">
          <button className={chip(kind === "staff")} onClick={() => setKind("staff")}>المنسوبون</button>
          <button className={chip(kind === "guardian")} onClick={() => setKind("guardian")}>أولياء الأمور</button>
        </div>
        <button className="btn-primary mr-auto" disabled={!list.length} onClick={print}>طباعة التقرير</button>
        <button className="btn-ghost" disabled={!people.length} onClick={excel}>Excel</button>
      </section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kpis.map(([t, v]) => (
          <div key={t} className="rounded-card border border-line bg-white px-3 py-2.5 text-center">
            <p className="num text-xl font-bold leading-none text-ink">{v}</p><p className="mt-1 text-[11px] text-muted">{t}</p>
          </div>
        ))}
      </div>
      {cats.length > 0 && (
        <section className="card p-3">
          <p className="mb-2 text-xs font-semibold text-ink">حسب التصنيف</p>
          <div className="flex flex-wrap gap-1.5">{cats.map(([k, n]) => <span key={k} className="chip gap-1 bg-canvas text-ink">{k} <span className="num font-bold">{n}</span></span>)}</div>
        </section>
      )}
      <section className="card overflow-hidden">
        <p className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
          {kind === "staff" ? "التزام المنسوبين بالاطلاع" : "اطلاع أولياء الأمور"} <span className="text-[11px] font-normal text-muted">الأقل اطلاعًا أولًا</span></p>
        {people.length === 0 ? <p className="px-4 py-5 text-sm text-muted">لا بيانات في هذه الفترة.</p> : (
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-canvas text-[11px] text-muted">
                <tr>{HEAD.map((h) => <th key={h} className="px-3 py-2 text-right font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {people.map((p, i) => (
                  <tr key={i}>{line(p, i).map((v, k) => (
                    <td key={k} className={`px-3 py-1.5 ${k === 1 ? "text-ink" : "num text-muted"} ${k === 4 ? (p.pct < 60 ? "font-bold text-absent" : p.pct < 90 ? "text-warning" : "text-success") : ""}`}>{v}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
