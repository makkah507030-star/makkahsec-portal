// src/pages/gifted/GiftedMembers.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession, ROLE_PERSON_NAME } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { cleanMobile } from "../../lib/importer";
import { byClassName } from "../../lib/sortAr.js";
import { confirmDanger } from "../../lib/danger";
import { printReport, escHtml as e, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { logos } from "../student-affairs/shared.jsx";
import Loader from "../../components/Loader.jsx";
import { GIFTED_DOMAINS, SOURCE, domainOf } from "../../lib/gifted.js";

/* =====================================================================
   الطلاب الموهوبون (supabase/gifted_2.sql) من كل الصفوف: من اكتُشف في مقياس موهبة
   (يُضاف تلقائيًا) ومن رشّحته المدرسة، بمجالات موهبتهم وجوالاتهم، والتواصل بالواتساب
   برسالة جاهزة، وطباعة الكشف. وفي بطاقة حساب الطالب وسم «موهوب».
   ===================================================================== */

const DOMAINS = GIFTED_DOMAINS.filter((d) => d.k !== "all");
const localMobile = (m) => (m?.startsWith("966") ? "0" + m.slice(3) : m ?? "");
const cls = (m) => (m.grade ? `${GRADE_NAMES[m.grade]?.replace(" الثانوي", "") ?? ""} / ${m.class_no}` : "—");
const WA = <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>;
const Wa = ({ mobile, text, label }) => mobile ? (
  <a href={`https://wa.me/${mobile}${text ? `?text=${encodeURIComponent(text)}` : ""}`} target="_blank" rel="noopener noreferrer"
     className="inline-flex items-center gap-1 rounded-pill bg-[#25D366]/12 px-2.5 py-1 text-[11px] font-semibold text-[#128C7E] hover:bg-[#25D366]/20">{WA}{label}</a>
) : <span className="text-[11px] text-faint">{label}: —</span>;

export default function GiftedMembers() {
  const { profile } = useSession();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [pool, setPool] = useState(null);
  const [busy, setBusy] = useState(null);
  const [q, setQ] = useState("");
  const [dom, setDom] = useState("all");
  const [waText, setWaText] = useState("");
  const [edit, setEdit] = useState(null);         // { id, domains, mobile, note }

  const load = async () => {
    const [m, g] = await Promise.all([
      supabase.from("gifted_members").select("*, students(full_name, national_id, student_enrollment(status, classes(grade, class_no)))"),
      supabase.rpc("gifted_members_roster"),
    ]);
    if (m.error) setErr(/gifted_members|schema cache|relation/i.test(m.error.message) ? "الصفحة تحتاج تشغيل supabase/gifted_2.sql مرة واحدة في Supabase ← SQL Editor." : m.error.message);
    const G = Object.fromEntries((g.data ?? []).map((r) => [r.student_id, r.mobile]));
    setRows((m.data ?? []).map((r) => {
      const en = (r.students?.student_enrollment ?? []).find((x) => x.status === "active");
      return { ...r, id: r.student_id, full_name: r.students?.full_name ?? "", national_id: r.students?.national_id,
               grade: en?.classes?.grade, class_no: en?.classes?.class_no, guardian: G[r.student_id] ?? null };
    }).sort(byClassName()));
  };
  useEffect(() => {
    load();
    (async () => {
      const { data: st } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
      const { data } = await supabase.from("classes").select("id, grade, class_no").eq("academic_year", st?.value ?? "").eq("is_active", true);
      setClasses((data ?? []).sort((a, b) => a.grade - b.grade || a.class_no - b.class_no));
    })();
  }, []);
  useEffect(() => {
    setPool(null);
    if (!classId) return;
    supabase.from("student_enrollment").select("students(id, full_name)").eq("class_id", classId).eq("status", "active")
      .then(({ data }) => setPool((data ?? []).map((r) => r.students).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"))));
  }, [classId]);
  const inList = useMemo(() => new Set((rows ?? []).map((r) => r.id)), [rows]);
  if (!rows) return <Loader />;

  const add = async (s) => {
    setBusy(s.id);
    const { error } = await supabase.from("gifted_members").insert({ student_id: s.id, source: "school", added_by_name: profile?.full_name ?? null });
    setBusy(null);
    if (error) setErr(error.message); else load();
  };
  const remove = async (m) => {
    if (!(await confirmDanger({ title: `حذف ${m.full_name} من الطلاب الموهوبين`, impact: ["يُحذف من الكشف ويزول وسم «موهوب» من بطاقته.", "لا تتأثر متابعة مقياس موهبة."], confirmLabel: "حذف" }))) return;
    await supabase.from("gifted_members").delete().eq("student_id", m.id); load();
  };
  const saveEdit = async () => {
    const mobile = edit.mobile.trim() ? cleanMobile(edit.mobile.trim()) : null;
    if (edit.mobile.trim() && !mobile) { setErr("رقم الجوال غير صحيح؛ اكتبه بصيغة 05XXXXXXXX."); return; }
    setBusy(edit.id);
    const { error } = await supabase.from("gifted_members").update({ domains: edit.domains, student_mobile: mobile, note: edit.note.trim() || null }).eq("student_id", edit.id);
    setBusy(null);
    if (error) { setErr(error.message); return; }
    setEdit(null); setErr(""); load();
  };
  const print = () => {
    const body = rows.map((m, i) => `<tr><td>${i + 1}</td><td>${e(m.full_name)}</td><td>${e(cls(m))}</td><td>${e(SOURCE[m.source])}</td>
      <td>${e((m.domains ?? []).map((d) => domainOf(d).t).join("، ") || "—")}</td><td>${e(localMobile(m.student_mobile) || "—")}</td><td>${e(localMobile(m.guardian) || "—")}</td></tr>`).join("");
    printReport({ title: "كشف الطلاب الموهوبين", sections: [{ title: "كشف الطلاب الموهوبين", subtitle: `عدد الطلاب: ${rows.length}`,
      html: `<table><thead><tr><th>م</th><th>الطالب</th><th>الصف/الفصل</th><th>مصدر الاكتشاف</th><th>مجالات الموهبة</th><th>جوال الطالب</th><th>جوال ولي الأمر</th></tr></thead><tbody>${body}</tbody></table>` }],
      ...logos(), signatures: [{ title: "مسؤول برنامج الموهوبين", name: (ROLE_PERSON_NAME.gifted_program ?? "").replace(/^الأستاذ:\s*/, "") }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }] });
  };
  const shown = rows.filter((m) => (dom === "all" || (m.domains ?? []).includes(dom)) && (!q.trim() || m.full_name.includes(q.trim())));

  return (
    <div className="space-y-4">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">إضافة طالب موهوب <span className="text-xs font-normal text-muted">(من اكتُشف في مقياس موهبة يُضاف تلقائيًا)</span></p>
        <select className="field w-full" value={classId} onChange={(x) => setClassId(x.target.value)}>
          <option value="">اختر الفصل…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{GRADE_NAMES[c.grade]} · فصل {c.class_no}</option>)}
        </select>
        {classId && !pool && <Loader />}
        {pool?.length > 0 && (
          <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-sm2 border border-line">
            {pool.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm text-ink">{s.full_name}</p>
                {inList.has(s.id) ? <span className="chip bg-[#7A4FB5]/10 text-[#7A4FB5]">موهوب</span>
                  : <button disabled={busy === s.id} onClick={() => add(s)} className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">{busy === s.id ? "…" : "إضافة"}</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">الطلاب الموهوبون <span className="num text-muted">({rows.length})</span></h2>
          {rows.length > 0 && <button className="ms-auto text-xs font-semibold text-mint-deep" onClick={print}>طباعة الكشف</button>}
        </div>
        {rows.length > 0 && (
          <div className="space-y-2 border-b border-line p-3">
            <div className="flex flex-wrap gap-1.5">
              {GIFTED_DOMAINS.map((d) => {
                const n = d.k === "all" ? rows.length : rows.filter((m) => (m.domains ?? []).includes(d.k)).length;
                return (d.k === "all" || n > 0) && <button key={d.k} onClick={() => setDom(d.k)} className={`rounded-pill px-3 py-1 text-xs font-medium ${dom === d.k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{d.t} <span className="num">({n})</span></button>;
              })}
            </div>
            {rows.length > 5 && <input className="field w-full" value={q} onChange={(x) => setQ(x.target.value)} placeholder="بحث بالاسم" />}
            <textarea className="field min-h-[3rem] w-full text-sm" value={waText} onChange={(x) => setWaText(x.target.value)} placeholder="رسالة واتساب جاهزة (اختياري): يُفتح بها زر «واتساب» عند كل طالب وولي أمر" />
          </div>
        )}
        {!rows.length && <p className="px-4 py-6 text-sm text-muted">لا طلاب بعد. أضفهم من فصولهم، ومن تصير حالته «موهوب» في متابعة المقياس يُضاف تلقائيًا.</p>}
        <div className="divide-y divide-line">
          {shown.map((m) => (
            <div key={m.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.full_name} <span className="text-[11px] font-normal text-muted">· {cls(m)}</span></p>
                <span className={`chip ${m.source === "mawhiba" ? "bg-[#7A4FB5]/10 text-[#7A4FB5]" : "bg-canvas text-muted"}`}>{SOURCE[m.source]}{m.discovered_year ? ` ${m.discovered_year}` : ""}</span>
                <button className="text-xs font-semibold text-mint-deep underline" onClick={() => setEdit(edit?.id === m.id ? null : { id: m.id, domains: m.domains ?? [], mobile: localMobile(m.student_mobile), note: m.note ?? "" })}>{edit?.id === m.id ? "إغلاق" : "تعديل"}</button>
                <button className="text-xs text-absent" onClick={() => remove(m)}>حذف</button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {(m.domains ?? []).map((d) => <span key={d} className="rounded-pill px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${domainOf(d).color}1A`, color: domainOf(d).color }}>{domainOf(d).t}</span>)}
                <span className="flex-1" />
                <Wa mobile={m.student_mobile} text={waText} label="الطالب" />
                <Wa mobile={m.guardian} text={waText} label="ولي الأمر" />
              </div>
              {m.note && <p className="mt-1 text-xs text-muted">{m.note}</p>}
              {edit?.id === m.id && (
                <div className="mt-2 space-y-2 rounded-sm2 border border-line bg-canvas p-3">
                  <p className="text-[11px] text-muted">مجالات الموهبة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DOMAINS.map((d) => { const on = edit.domains.includes(d.k); return (
                      <button key={d.k} onClick={() => setEdit({ ...edit, domains: on ? edit.domains.filter((x) => x !== d.k) : [...edit.domains, d.k] })}
                              className="rounded-pill px-3 py-1 text-xs font-semibold" style={on ? { background: d.color, color: "#fff" } : { border: "1px solid #DCE4DF", color: "#6B7C73", background: "#fff" }}>{d.t}</button>
                    ); })}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input className="field num" dir="ltr" inputMode="tel" value={edit.mobile} placeholder="جوال الطالب 05XXXXXXXX" onChange={(x) => setEdit({ ...edit, mobile: x.target.value })} />
                    <input className="field sm:col-span-2" value={edit.note} placeholder="ملاحظة (مثل: فاز بالمركز الأول في أولمبياد إبداع)" onChange={(x) => setEdit({ ...edit, note: x.target.value })} />
                  </div>
                  <button className="btn-primary px-5 py-1.5 text-xs" disabled={busy === m.id} onClick={saveEdit}>حفظ</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
