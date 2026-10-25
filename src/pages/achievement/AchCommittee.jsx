// src/pages/achievement/AchCommittee.jsx
/* =====================================================================
   لجنة التحصيل الدراسي (supabase/ach_committee.sql): برئاسة وكيل الشؤون التعليمية.
   • الأعضاء: يختارهم الوكيل (والمدير والدعم الفني) من المعلمين والإداريين بصفاتهم، ومنهم المقرر.
   • المحاضر: يكتبها المقرر أو الوكيل: الحضور وجدول الأعمال والقرارات بمسؤوليها ومواعيدها،
     وتُتابَع القرارات بعلامة «نُفّذ»، ويُطبع المحضر بالهوية الرسمية.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import { cmpAr } from "../../lib/sortAr.js";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { ACH_ALL, useAchMember } from "../../lib/achievement";
import Loader from "../../components/Loader.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import { printThen } from "../../lib/print.js";
import moeLogo from "../../assets/moe-logo.png";
import logoIcon from "../../assets/icon-mint.png";

const ROLE_T = { secretary: "مقرر اللجنة", member: "عضو" };
const setupMsg = "لجنة التحصيل تحتاج تشغيل supabase/ach_committee.sql في Supabase ← SQL Editor.";
const today = () => new Date().toISOString().slice(0, 10);

export default function AchCommittee() {
  const { profile, adminRoles = [] } = useSession();
  const member = useAchMember(profile?.id);
  const canManage = adminRoles.some((r) => ["principal", "deputy_academic", "tech_support"].includes(r));
  const sees = member || adminRoles.some((r) => ACH_ALL.includes(r));
  const [members, setMembers] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [year, setYear] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useNotice(null);
  const [edit, setEdit] = useState(null);       // محضر قيد التحرير
  const [printing, setPrinting] = useState(null);

  const mine = (members ?? []).find((m) => m.user_id === profile?.id);
  const canMinute = canManage || mine?.role === "secretary";

  const load = async () => {
    const [{ data: st }, { data: ms, error }, { data: mt }] = await Promise.all([
      supabase.from("settings").select("value").eq("key", "active_year").maybeSingle(),
      supabase.rpc("ach_committee_list"),
      supabase.from("ach_meetings").select("*").order("held_on", { ascending: false }),
    ]);
    if (error) { setErr(/ach_committee/.test(error.message) || /function/.test(error.message) ? setupMsg : error.message); setMembers([]); return; }
    setYear(st?.value ?? "");
    setMembers((ms ?? []).sort((a, b) => (a.role === "secretary" ? -1 : 0) - (b.role === "secretary" ? -1 : 0) || cmpAr(a.full_name, b.full_name)));
    setMeetings(mt ?? []);
  };
  useEffect(() => { load(); }, []);

  if (!sees) return <p className="card px-4 py-6 text-sm text-muted">صفحة لجنة التحصيل لأعضائها ولوكيل الشؤون التعليمية والمدير.</p>;
  if (!members) return <Loader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">لجنة التحصيل الدراسي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          برئاسة وكيل الشؤون التعليمية: تدرس نتائج مركز التحصيل وملاحظاته، وتتابع الخطط العلاجية ونتائج اختبارات قياس،
          وتوثّق اجتماعاتها وقراراتها هنا. يرى أعضاؤها المركز وتقاريره للاطلاع.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {!err && <Members members={members} canManage={canManage} onChange={load} setMsg={setMsg} me={profile?.full_name} />}

      {!err && (
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">محاضر الاجتماعات <span className="num text-muted">({meetings.length})</span></h2>
            {canMinute && !edit && (
              <button onClick={() => setEdit({ held_on: today(), title: `اجتماع لجنة التحصيل رقم ${meetings.length + 1}`, agenda: "", attendees: members.map((m) => m.user_id), decisions: [], notes: "" })}
                      className="ms-auto rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white">+ محضر جديد</button>
            )}
          </div>
          {edit && <MeetingEditor m={edit} members={members} year={year} me={profile?.full_name}
                                  onDone={(ok) => { setEdit(null); if (ok) { setMsg({ ok: true, text: "حُفظ المحضر." }); load(); } }} setMsg={setMsg} />}
          {meetings.length === 0 && !edit && <p className="px-4 py-6 text-sm text-muted">لا محاضر بعد.</p>}
          <div className="divide-y divide-line">
            {meetings.map((m) => (
              <Meeting key={m.id} m={m} members={members} canMinute={canMinute} onEdit={() => setEdit(m)}
                       onPrint={() => { setPrinting(m); setTimeout(() => printThen(() => setPrinting(null)), 150); }}
                       onChange={load} setMsg={setMsg} />
            ))}
          </div>
        </section>
      )}

      {printing && (
        <PrintPortal id="ach-minutes" margin="14mm 14mm">
          <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 12.5 }}>
            <div className="flex items-start justify-between">
              <div className="text-[11px] leading-[1.8]"><div>المملكة العربية السعودية · وزارة التعليم</div><div className="font-bold text-mint-deep">مدرسة مكة الثانوية · لجنة التحصيل الدراسي</div></div>
              <div className="flex gap-3"><img src={moeLogo} alt="" className="h-9" /><img src={logoIcon} alt="" className="h-9" /></div>
            </div>
            <h1 className="mt-5 text-center text-[16px] font-bold text-mint-deep">محضر {printing.title}</h1>
            <p className="num mt-1 text-center text-[11.5px] text-muted">{fmtDate(printing.held_on)}</p>
            <MeetingBody m={printing} members={members} print />
            <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[12px]">
              {[["مقرر اللجنة", members.find((x) => x.role === "secretary")?.full_name], ["رئيس اللجنة · وكيل الشؤون التعليمية", null]].map(([r, n]) => (
                <div key={r}><p className="font-bold text-mint-deep">{r}</p><p className="mt-1">{n || "...................."}</p><p className="mt-5 text-faint">التوقيع: ..............</p></div>
              ))}
            </div>
          </div>
        </PrintPortal>
      )}
    </div>
  );
}

/* الأعضاء: عرض، وللوكيل الإضافة والحذف */
function Members({ members, canManage, onChange, setMsg, me }) {
  const [staff, setStaff] = useState(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("member");
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || staff) return;
    supabase.from("users").select("id, full_name, role").in("role", ["teacher", "admin"]).eq("is_active", true)
      .then(({ data }) => setStaff((data ?? []).filter((u) => u.full_name).sort((a, b) => cmpAr(a.full_name, b.full_name))));
  }, [open, staff]);
  const inSet = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const found = (staff ?? []).filter((u) => !inSet.has(u.id) && (!q.trim() || u.full_name.includes(q.trim()))).slice(0, 12);

  const add = async (u) => {
    const { error } = await supabase.from("ach_committee").insert({ user_id: u.id, role, title: title.trim() || null, added_by_name: me ?? null });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `أُضيف ${u.full_name} إلى اللجنة.` }); setTitle(""); onChange();
  };
  const remove = async (m) => {
    if (!(await confirmDanger({ title: `إزالة ${m.full_name} من اللجنة`, impact: ["لا يرى المركز ولا المحاضر بعدها، وتبقى المحاضر السابقة كما هي."], confirmLabel: "إزالة" }))) return;
    const { error } = await supabase.from("ach_committee").delete().eq("user_id", m.user_id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    onChange();
  };
  const setR = async (m, r) => {
    const { error } = await supabase.from("ach_committee").update({ role: r }).eq("user_id", m.user_id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">أعضاء اللجنة <span className="num text-muted">({members.length + 1})</span></h2>
        {canManage && <button onClick={() => setOpen(!open)} className="ms-auto text-xs font-semibold text-mint-deep">{open ? "إغلاق" : "+ إضافة عضو"}</button>}
      </div>
      {open && (
        <div className="space-y-2 border-b border-line bg-canvas/50 p-3">
          <div className="flex flex-wrap gap-2">
            <input className="field min-w-[180px] flex-1 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المعلم أو الإداري" />
            <select className="field w-auto text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">عضو</option><option value="secretary">مقرر اللجنة</option>
            </select>
            <input className="field w-48 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="الصفة: معلم رياضيات…" />
          </div>
          {!staff ? <Loader /> : (
            <div className="flex flex-wrap gap-1.5">
              {found.map((u) => <button key={u.id} onClick={() => add(u)} className="rounded-pill border border-line bg-white px-3 py-1 text-xs text-ink hover:border-mint-light">+ {u.full_name}</button>)}
              {found.length === 0 && <span className="text-xs text-muted">لا نتائج.</span>}
            </div>
          )}
        </div>
      )}
      <div className="divide-y divide-line">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <span className="chip bg-mint-deep text-[11px] text-white">رئيس اللجنة</span>
          <span className="text-sm font-medium text-ink">وكيل الشؤون التعليمية</span>
        </div>
        {members.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <span className={`chip text-[11px] ${m.role === "secretary" ? "bg-mint-tint text-mint-deep" : "bg-canvas text-muted"}`}>{ROLE_T[m.role]}</span>
            <span className="min-w-0 flex-1 text-sm font-medium text-ink">{m.full_name}{m.title && <span className="text-[12px] font-normal text-muted"> · {m.title}</span>}</span>
            {canManage && (
              <>
                <button onClick={() => setR(m, m.role === "secretary" ? "member" : "secretary")} className="text-[11px] text-mint-deep hover:underline">
                  {m.role === "secretary" ? "جعله عضوًا" : "جعله مقررًا"}
                </button>
                <button onClick={() => remove(m)} className="text-[11px] text-absent hover:underline">إزالة</button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function MeetingBody({ m, members, print }) {
  const names = new Map(members.map((x) => [x.user_id, x.full_name]));
  return (
    <div className={`space-y-3 text-[12.5px] ${print ? "mt-4" : ""}`}>
      <p><b className="text-mint-deep">الحاضرون: </b>رئيس اللجنة{m.attendees.map((u) => names.get(u)).filter(Boolean).map((n) => `، ${n}`).join("")}</p>
      {m.agenda && <div><b className="text-mint-deep">جدول الأعمال</b><p className="mt-1 whitespace-pre-line text-ink">{m.agenda}</p></div>}
      {m.decisions.length > 0 && (
        <div>
          <b className="text-mint-deep">القرارات والتوصيات</b>
          <table className="mt-1 w-full border-collapse text-[12px]">
            <thead><tr className="bg-canvas text-muted">{["م", "القرار", "المسؤول", "الموعد", "الحالة"].map((h) => <th key={h} className="border border-line px-2 py-1 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {m.decisions.map((d, i) => (
                <tr key={i}>
                  <td className="num border border-line px-2 py-1">{i + 1}</td>
                  <td className="border border-line px-2 py-1 text-ink">{d.text}</td>
                  <td className="border border-line px-2 py-1">{d.owner || "—"}</td>
                  <td className="num border border-line px-2 py-1">{d.due ? fmtDate(d.due) : "—"}</td>
                  <td className={`border border-line px-2 py-1 ${d.done ? "text-present" : "text-muted"}`}>{d.done ? "✓ نُفّذ" : "قيد المتابعة"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.notes && <div><b className="text-mint-deep">ملاحظات</b><p className="mt-1 whitespace-pre-line text-ink">{m.notes}</p></div>}
    </div>
  );
}

function Meeting({ m, members, canMinute, onEdit, onPrint, onChange, setMsg }) {
  const [open, setOpen] = useState(false);
  const done = m.decisions.filter((d) => d.done).length;
  const toggle = async (i) => {
    const decisions = m.decisions.map((d, k) => (k === i ? { ...d, done: !d.done } : d));
    const { error } = await supabase.from("ach_meetings").update({ decisions, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  return (
    <div className="px-4 py-3">
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-2 text-start">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{m.title}</span>
          <span className="num block text-[11.5px] text-muted">{fmtDate(m.held_on)} · {m.decisions.length} قرارًا · نُفّذ {done}</span>
        </span>
        <span className="text-xs text-faint">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <MeetingBody m={m} members={members} />
          {canMinute && m.decisions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {m.decisions.map((d, i) => (
                <button key={i} onClick={() => toggle(i)} className={`rounded-pill border px-2.5 py-1 text-[11px] ${d.done ? "border-present/40 bg-present/10 text-present" : "border-line bg-white text-muted"}`}>
                  {d.done ? "✓" : "○"} القرار {i + 1}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onPrint} className="text-xs font-semibold text-mint-deep">طباعة المحضر</button>
            {canMinute && <button onClick={onEdit} className="text-xs font-semibold text-muted">تعديل</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingEditor({ m, members, year, me, onDone, setMsg }) {
  const [x, setX] = useState(m);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const setD = (i, k, v) => set("decisions", x.decisions.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const save = async () => {
    if (!x.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الاجتماع." }); return; }
    setBusy(true);
    const row = { held_on: x.held_on, title: x.title.trim(), agenda: x.agenda || null, attendees: x.attendees, notes: x.notes || null,
      decisions: x.decisions.filter((d) => d.text?.trim()), updated_at: new Date().toISOString() };
    const { error } = x.id ? await supabase.from("ach_meetings").update(row).eq("id", x.id)
      : await supabase.from("ach_meetings").insert({ ...row, academic_year: year, created_by_name: me ?? null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /ach_meetings/.test(error.message) ? setupMsg : error.message }); return; }
    onDone(true);
  };
  return (
    <div className="space-y-3 border-b border-line bg-canvas/40 p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="field text-sm" value={x.title} onChange={(e) => set("title", e.target.value)} placeholder="عنوان الاجتماع" />
        <input type="date" className="field text-sm" value={x.held_on} onChange={(e) => set("held_on", e.target.value)} />
      </div>
      <div>
        <p className="mb-1 text-[11.5px] text-muted">الحاضرون</p>
        <div className="flex flex-wrap gap-1.5">
          {members.map((u) => {
            const on = x.attendees.includes(u.user_id);
            return <button key={u.user_id} type="button" onClick={() => set("attendees", on ? x.attendees.filter((a) => a !== u.user_id) : [...x.attendees, u.user_id])}
                           className={`rounded-pill border px-2.5 py-1 text-[11px] ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-faint"}`}>{on ? "✓ " : ""}{u.full_name}</button>;
          })}
        </div>
      </div>
      <textarea className="field min-h-[72px] w-full text-sm" value={x.agenda ?? ""} onChange={(e) => set("agenda", e.target.value)}
                placeholder="جدول الأعمال: مثل دراسة نتائج الفترة الأولى، ومتابعة الخطط العلاجية، ونتائج القدرات…" />
      <div className="space-y-2">
        <p className="text-[11.5px] text-muted">القرارات والتوصيات</p>
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
