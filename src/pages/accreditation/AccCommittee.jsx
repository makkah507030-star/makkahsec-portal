// src/pages/accreditation/AccCommittee.jsx
import { countAr } from "../../lib/arabicCount.js";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { cmpAr } from "../../lib/sortAr.js";
import { confirmDanger } from "../../lib/danger";
import { DOMAINS, roleT } from "../../lib/accreditation.js";
import Loader from "../../components/Loader.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import { printThen } from "../../lib/print.js";
import moeLogo from "../../assets/moe-logo.png";
import logoIcon from "../../assets/icon-mint.png";

/* =====================================================================
   لجنة التميز (supabase/acc_1.sql، acc_3.sql): برئاسة مدير المدرسة، ومشرفها يوزّع العمل:
   يضيف الأعضاء ويسند لكل عضو مجالًا أو أكثر فيرى مؤشراته وبرامجه وشواهده وحدها.
   تعيين المشرف للمدير ووكيل الشؤون التعليمية والدعم الفني. ومحاضر اجتماعات اللجنة بقراراتها.
   ===================================================================== */

const today = () => new Date().toISOString().slice(0, 10);

export default function AccCommittee({ me, year, members, reload, go }) {
  const { profile } = useSession();
  const [, setMsg] = useNotice(null);
  const [meetings, setMeetings] = useState(null);
  const [edit, setEdit] = useState(null);
  const [printing, setPrinting] = useState(null);
  const loadM = () => supabase.from("acc_meetings").select("*").order("held_on", { ascending: false }).then(({ data }) => setMeetings(data ?? []));
  useEffect(() => { loadM(); }, []);
  if (!meetings) return <Loader />;
  const coord = members.find((m) => m.role === "coordinator");

  return (
    <div className="space-y-4">
      <Members me={me} members={members} reload={reload} setMsg={setMsg} by={profile?.full_name} />
      <section className="card p-4">
        <p className="mb-2 text-sm font-semibold text-ink">تقارير المجالات</p>
        <div className="flex flex-wrap gap-2">{me.coord && <button onClick={() => go("team", { report: "all" })} className="rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white">التقرير العام للجنة</button>}{Object.entries(DOMAINS).filter(([d]) => me.coord || me.domains.includes(+d)).map(([d, t]) => (
          <button key={d} onClick={() => go("team", { report: d })} className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs text-mint-deep hover:border-mint-light">تقرير مجال {t}</button>))}</div>
        <p className="mt-2 text-[11px] text-faint">لكل مجال تقرير بهوية التقارير الشهرية: المؤشرات، والبرامج وقياس نواتجها، والشواهد المرفوعة وغير المرفوعة، ومساهمة مشرف المجال، والاعتماد. والتقرير العام يجمع المجالات الأربعة ومساهمة كل مشرف.</p>
      </section>
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">محاضر الاجتماعات <span className="num text-muted">({meetings.length})</span></h2>
          {me.coord && !edit && <button className="ms-auto rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white"
            onClick={() => setEdit({ held_on: today(), title: `اجتماع لجنة التميز رقم ${meetings.length + 1}`, agenda: "", attendees: members.map((m) => m.user_id), decisions: [], notes: "" })}>+ محضر جديد</button>}
        </div>
        {edit && <MeetingEditor m={edit} members={members} year={year} by={profile?.full_name} setMsg={setMsg}
          onDone={(ok) => { setEdit(null); if (ok) { setMsg({ ok: true, text: "حُفظ المحضر." }); loadM(); } }} />}
        {meetings.length === 0 && !edit && <p className="px-4 py-6 text-sm text-muted">لا محاضر بعد.</p>}
        <div className="divide-y divide-line">{meetings.map((m) => (
          <Meeting key={m.id} m={m} members={members} canEdit={me.coord} onEdit={() => setEdit(m)} onChange={loadM} setMsg={setMsg}
            onPrint={() => { setPrinting(m); setTimeout(() => printThen(() => setPrinting(null)), 150); }} />
        ))}</div>
      </section>
      {printing && (
        <PrintPortal id="acc-minutes" margin="14mm 14mm">
          <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 12.5 }}>
            <div className="flex items-start justify-between">
              <div className="text-[11px] leading-[1.8]"><div>المملكة العربية السعودية · وزارة التعليم</div><div className="font-bold text-mint-deep">مدرسة مكة الثانوية · لجنة التميز</div></div>
              <div className="flex gap-3"><img src={moeLogo} alt="" className="h-9" /><img src={logoIcon} alt="" className="h-9" /></div>
            </div>
            <h1 className="mt-5 text-center text-[16px] font-bold text-mint-deep">محضر {printing.title}</h1>
            <p className="num mt-1 text-center text-[11.5px] text-muted">{fmtDate(printing.held_on)}</p>
            <MeetingBody m={printing} members={members} print />
            <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[12px]">
              {[["مشرف اللجنة", coord?.full_name], ["رئيس اللجنة · مدير المدرسة", null]].map(([r, n]) => (
                <div key={r}><p className="font-bold text-mint-deep">{r}</p><p className="mt-1">{n || "...................."}</p><p className="mt-5 text-faint">التوقيع: ..............</p></div>
              ))}
            </div>
          </div>
        </PrintPortal>
      )}
    </div>
  );
}

function Members({ me, members, reload, setMsg, by }) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState(null);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!open || staff) return;
    supabase.rpc("acc_staff").then(({ data }) => setStaff((data ?? []).sort((a, b) => cmpAr(a.full_name, b.full_name))));
  }, [open, staff]);
  const inSet = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const found = (staff ?? []).filter((u) => !inSet.has(u.id) && (!q.trim() || u.full_name.includes(q.trim()))).slice(0, 12);
  const run = async (p, ok) => { const { error } = await p; if (error) setMsg({ ok: false, text: error.message }); else { if (ok) setMsg({ ok: true, text: ok }); reload(); } };
  const add = (u) => run(supabase.from("acc_members").insert({ user_id: u.id, title: title.trim() || null, added_by_name: by ?? null }), `أُضيف ${u.full_name} إلى اللجنة. أسند له مجالاته.`);
  const toggleD = (m, d) => run(supabase.from("acc_members").update({ domains: m.domains.includes(d) ? m.domains.filter((x) => x !== d) : [...m.domains, d].sort() }).eq("user_id", m.user_id));
  const setRole = (m, role) => run(supabase.from("acc_members").update({ role }).eq("user_id", m.user_id));
  const setTitleOf = (m) => { const t = window.prompt("صفة العضو:", m.title ?? ""); if (t != null) run(supabase.from("acc_members").update({ title: t.trim() || null }).eq("user_id", m.user_id)); };
  const remove = async (m) => {
    if (!(await confirmDanger({ title: `إزالة ${m.full_name} من لجنة التميز`, impact: ["لا يرى القسم بعدها، وتبقى شواهده ومحاضر اللجنة كما هي."], confirmLabel: "إزالة" }))) return;
    run(supabase.from("acc_members").delete().eq("user_id", m.user_id));
  };
  const unassigned = Object.keys(DOMAINS).map(Number).filter((d) => !members.some((m) => m.role === "member" && m.domains.includes(d)));

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">أعضاء لجنة التميز <span className="num text-muted">({members.length})</span></h2>
        {me.coord && <button onClick={() => setOpen(!open)} className="ms-auto text-xs font-semibold text-mint-deep">{open ? "إغلاق" : "+ إضافة عضو"}</button>}
      </div>
      {me.coord && unassigned.length > 0 && members.length > 0 && <p className="border-b border-line bg-late/5 px-4 py-2 text-xs text-late">مجالات بلا عضو مسند: {unassigned.map((d) => DOMAINS[d]).join("، ")}</p>}
      {open && (
        <div className="space-y-2 border-b border-line bg-canvas/50 p-3">
          <div className="flex flex-wrap gap-2">
            <input className="field min-w-[180px] flex-1 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المعلم أو الإداري" />
            <input className="field w-48 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="الصفة: معلم متميز…" />
          </div>
          {!staff ? <Loader /> : <div className="flex flex-wrap gap-1.5">
            {found.map((u) => <button key={u.id} onClick={() => add(u)} className="rounded-pill border border-line bg-white px-3 py-1 text-xs text-ink hover:border-mint-light">+ {u.full_name}</button>)}
            {found.length === 0 && <span className="text-xs text-muted">لا نتائج.</span>}</div>}
        </div>
      )}
      <div className="divide-y divide-line">
        <div className="flex items-center gap-2 px-4 py-2.5"><span className="chip bg-mint-deep text-[11px] text-white">رئيس اللجنة</span><span className="text-sm font-medium text-ink">مدير المدرسة</span>
          <span className="text-[11px] text-faint">· ويرى القسم كله وكيل الشؤون التعليمية والدعم الفني</span></div>
        {members.map((m) => (
          <div key={m.user_id} className="space-y-1.5 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip text-[11px] ${m.role === "coordinator" ? "bg-mint-tint text-mint-deep" : "bg-canvas text-muted"}`}>{roleT(m)}</span>
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{m.full_name}{m.title && <span className="text-[12px] font-normal text-muted"> · {m.title}</span>}</span>
              {me.coord && <button onClick={() => setTitleOf(m)} className="text-[11px] text-muted hover:underline">الصفة</button>}
              {me.all && <button onClick={() => setRole(m, m.role === "coordinator" ? "member" : "coordinator")} className="text-[11px] text-mint-deep hover:underline">{m.role === "coordinator" ? "جعله عضوًا" : "جعله المشرف"}</button>}
              {me.coord && (m.role !== "coordinator" || me.all) && <button onClick={() => remove(m)} className="text-[11px] text-absent hover:underline">إزالة</button>}
            </div>
            {m.role === "coordinator" ? <p className="text-[11px] text-faint">يرى كل المجالات، ويوزّع العمل على الأعضاء.</p> : (
              <div className="flex flex-wrap gap-1.5">{Object.entries(DOMAINS).map(([d, t]) => {
                const on = m.domains.includes(+d);
                return <button key={d} disabled={!me.coord} onClick={() => toggleD(m, +d)} className={`rounded-pill border px-2.5 py-0.5 text-[11px] ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-faint"}`}>{on ? "✓ " : ""}{t}</button>;
              })}{!m.domains.length && <span className="text-[11px] text-late">لم يُسند له مجال بعد</span>}</div>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="px-4 py-4 text-sm text-muted">{me.all ? "أضف أعضاء اللجنة، ثم اجعل أحدهم مشرفها ليوزّع المجالات." : "لا أعضاء بعد."}</p>}
      </div>
    </section>
  );
}

function MeetingBody({ m, members, print }) {
  const names = new Map(members.map((x) => [x.user_id, x.full_name]));
  return (
    <div className={`space-y-3 text-[12.5px] ${print ? "mt-4" : ""}`}>
      <p><b className="text-mint-deep">الحاضرون: </b>{m.attendees.map((u) => names.get(u)).filter(Boolean).join("، ") || "—"}</p>
      {m.agenda && <div><b className="text-mint-deep">جدول الأعمال</b><p className="mt-1 whitespace-pre-line text-ink">{m.agenda}</p></div>}
      {m.decisions.length > 0 && (
        <div><b className="text-mint-deep">القرارات والتوصيات</b>
          <table className="mt-1 w-full border-collapse text-[12px]">
            <thead><tr className="bg-canvas text-muted">{["م", "القرار", "المسؤول", "الموعد", "الحالة"].map((h) => <th key={h} className="border border-line px-2 py-1 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{m.decisions.map((d, i) => (
              <tr key={i}><td className="num border border-line px-2 py-1">{i + 1}</td><td className="border border-line px-2 py-1 text-ink">{d.text}</td>
                <td className="border border-line px-2 py-1">{d.owner || "—"}</td><td className="num border border-line px-2 py-1">{d.due ? fmtDate(d.due) : "—"}</td>
                <td className={`border border-line px-2 py-1 ${d.done ? "text-present" : "text-muted"}`}>{d.done ? "✓ نُفّذ" : "قيد المتابعة"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {m.notes && <div><b className="text-mint-deep">ملاحظات</b><p className="mt-1 whitespace-pre-line text-ink">{m.notes}</p></div>}
    </div>
  );
}

function Meeting({ m, members, canEdit, onEdit, onPrint, onChange, setMsg }) {
  const [open, setOpen] = useState(false);
  const done = m.decisions.filter((d) => d.done).length;
  const toggle = async (i) => {
    const decisions = m.decisions.map((d, k) => (k === i ? { ...d, done: !d.done } : d));
    const { error } = await supabase.from("acc_meetings").update({ decisions, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  return (
    <div className="px-4 py-3">
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-2 text-start">
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{m.title}</span>
          <span className="num block text-[11.5px] text-muted">{fmtDate(m.held_on)} · {countAr(m.decisions.length, "decision")} · نُفّذ {done}</span></span>
        <span className="text-xs text-faint">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <MeetingBody m={m} members={members} />
          {canEdit && m.decisions.length > 0 && <div className="flex flex-wrap gap-1.5">{m.decisions.map((d, i) => (
            <button key={i} onClick={() => toggle(i)} className={`rounded-pill border px-2.5 py-1 text-[11px] ${d.done ? "border-present/40 bg-present/10 text-present" : "border-line bg-white text-muted"}`}>{d.done ? "✓" : "○"} القرار {i + 1}</button>))}</div>}
          <div className="flex gap-3"><button onClick={onPrint} className="text-xs font-semibold text-mint-deep">طباعة المحضر</button>
            {canEdit && <button onClick={onEdit} className="text-xs font-semibold text-muted">تعديل</button>}</div>
        </div>
      )}
    </div>
  );
}

function MeetingEditor({ m, members, year, by, onDone, setMsg }) {
  const [x, setX] = useState(m);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const setD = (i, k, v) => set("decisions", x.decisions.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const save = async () => {
    if (!x.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الاجتماع." }); return; }
    setBusy(true);
    const row = { held_on: x.held_on, title: x.title.trim(), agenda: x.agenda || null, attendees: x.attendees, notes: x.notes || null,
      decisions: x.decisions.filter((d) => d.text?.trim()), updated_at: new Date().toISOString() };
    const { error } = x.id ? await supabase.from("acc_meetings").update(row).eq("id", x.id)
      : await supabase.from("acc_meetings").insert({ ...row, academic_year: year, created_by_name: by ?? null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    onDone(true);
  };
  return (
    <div className="space-y-3 border-b border-line bg-canvas/40 p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="field text-sm" value={x.title} onChange={(e) => set("title", e.target.value)} placeholder="عنوان الاجتماع" />
        <input type="date" className="field text-sm" value={x.held_on} onChange={(e) => set("held_on", e.target.value)} />
      </div>
      <div><p className="mb-1 text-[11.5px] text-muted">الحاضرون</p>
        <div className="flex flex-wrap gap-1.5">{members.map((u) => {
          const on = x.attendees.includes(u.user_id);
          return <button key={u.user_id} type="button" onClick={() => set("attendees", on ? x.attendees.filter((a) => a !== u.user_id) : [...x.attendees, u.user_id])}
            className={`rounded-pill border px-2.5 py-1 text-[11px] ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-faint"}`}>{on ? "✓ " : ""}{u.full_name}</button>;
        })}</div></div>
      <textarea className="field min-h-[72px] w-full text-sm" value={x.agenda ?? ""} onChange={(e) => set("agenda", e.target.value)}
        placeholder="جدول الأعمال: مثل توزيع المجالات، ومتابعة برامج خطة التحسين، والاستعداد للتقويم الخارجي…" />
      <div className="space-y-2"><p className="text-[11.5px] text-muted">القرارات والتوصيات</p>
        {x.decisions.map((d, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_160px_150px_auto]">
            <input className="field text-sm" value={d.text} onChange={(e) => setD(i, "text", e.target.value)} placeholder={`القرار ${i + 1}`} />
            <input className="field text-sm" value={d.owner ?? ""} onChange={(e) => setD(i, "owner", e.target.value)} placeholder="المسؤول" />
            <input type="date" className="field text-sm" value={d.due ?? ""} onChange={(e) => setD(i, "due", e.target.value)} />
            <button onClick={() => set("decisions", x.decisions.filter((_, j) => j !== i))} className="text-xs text-absent">حذف</button>
          </div>
        ))}
        <button onClick={() => set("decisions", [...x.decisions, { text: "", owner: "", due: "", done: false }])} className="text-xs font-semibold text-mint-deep">+ قرار</button>
      </div>
      <textarea className="field min-h-[56px] w-full text-sm" value={x.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="ملاحظات (اختياري)" />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-pill bg-mint-deep px-4 py-2 text-xs font-semibold text-white">{busy ? "…" : "حفظ المحضر"}</button>
        <button onClick={() => onDone(false)} className="rounded-pill border border-line bg-white px-4 py-2 text-xs text-muted">إلغاء</button>
      </div>
    </div>
  );
}
