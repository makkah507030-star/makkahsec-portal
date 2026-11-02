// src/pages/outreach/OutreachSend.jsx
// الإرسال والمشاركة: اختيار المستفيدين (الطلاب بصفوفهم وفصولهم أو بأسمائهم، وأولياء أمورهم،
// والموظفون)، ثم الإرسال بإشعار في الجرس والجوال؛ والمشاركة عبر واتساب برابط يُفتح بعد الدخول،
// ورمز QR يُعرض في الفصل أو يُطبع. الإرسال مرة أخرى يضيف الجدد فقط.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { notify } from "../../lib/notice";
import { GRADE_NAMES } from "../../lib/schoolTime";
import StudentPicker from "../../components/StudentPicker.jsx";
import { countAr } from "../../lib/arabicCount.js";
import { KIND, itemLink } from "../../lib/outreach.js";

const Seg = ({ value, onChange, opts }) => (
  <div className="flex flex-wrap gap-1.5">{opts.map(([k, t]) => (
    <button key={k} type="button" onClick={() => onChange(k)} className={`rounded-pill px-3.5 py-1.5 text-[13px] ${value === k ? "bg-mint-deep font-semibold text-white" : "border border-line bg-white text-muted"}`}>{t}</button>))}</div>
);

export default function OutreachSend({ item, onSent }) {
  const { adminRoles } = useSession();
  const myGrades = [1, 2, 3].filter((g) => adminRoles.includes(`counselor_${g}`));
  const [st, setSt] = useState(myGrades.length ? "grades" : "all");
  const [grades, setGrades] = useState(myGrades.length ? myGrades : [1, 2, 3]);
  const [classes, setClasses] = useState([]);
  const [picked, setPicked] = useState([]);
  const [gd, setGd] = useState("none");
  const [staff, setStaff] = useState("none");
  const [allClasses, setAllClasses] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from("v_active_students").select("grade, class_no").then(({ data }) =>
      setAllClasses([...new Set((data ?? []).map((r) => `${r.grade}-${r.class_no}`))].map((k) => k.split("-").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])));
  }, []);
  const classNos = [...new Set(allClasses.filter(([g]) => grades.includes(g)).map(([, c]) => c))].sort((a, b) => a - b);
  const toggle = (arr, v, setter) => setter(arr.includes(v) ? arr.filter((y) => y !== v) : [...arr, v].sort());

  const send = async () => {
    const students = st;
    if (students === "none" && !picked.length && gd === "none" && staff === "none") { notify({ ok: false, text: "اختر المستفيدين." }); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("outreach_send", { p_id: item.id, p_students: students, p_grades: grades, p_classes: classes,
      p_student_ids: picked.map((s) => s.student_id), p_guardians: gd, p_staff: staff, p_roles: [] });
    setBusy(false);
    if (error) { notify({ ok: false, text: error.message }); return; }
    const audience = { students: st === "all" ? "كل الطلاب" : st === "grades" ? grades.map((g) => GRADE_NAMES[g]).join(" و") + (classes.length ? ` (فصول ${classes.join("، ")})` : "") : null,
      picked: picked.length || null, guardians: gd === "none" ? null : gd === "all" ? "كل أولياء الأمور" : "أولياء أمور الصفوف المختارة",
      staff: { none: null, all: "كل الموظفين", teachers: "المعلمون", admins: "الإداريون" }[staff] };
    await supabase.from("outreach_items").update({ audience }).eq("id", item.id);
    notify({ ok: true, text: data ? `أُرسلت، ووصل الإشعار إلى ${countAr(data, "beneficiary", { acc: true })}.` : "لا مستفيدين جدد: كلهم وصلتهم من قبل." });
    onSent();
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-4">
        <div><h2 className="text-base font-bold text-ink">المستفيدون</h2>
          <p className="mt-0.5 text-sm text-muted">يصل كل مستفيد إشعار في الجرس والجوال، وتظهر في «النشرات والاستبانات» عنده. الإرسال مرة أخرى يضيف الجدد فقط.</p></div>
        <div className="space-y-2"><p className="text-[12.5px] font-semibold text-ink">الطلاب</p>
          <Seg value={st} onChange={setSt} opts={[["none", "لا أحد"], ["all", "كل الطلاب"], ["grades", "صفوف وفصول"]]} /></div>
        {(st === "grades" || gd === "grades") && (
          <div className="space-y-2 rounded-sm2 bg-canvas p-3">
            <div className="flex flex-wrap gap-1.5">{[1, 2, 3].map((g) => (
              <button key={g} type="button" onClick={() => toggle(grades, g, setGrades)} className={`chip border ${grades.includes(g) ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted"}`}>{grades.includes(g) ? "✓ " : ""}{GRADE_NAMES[g]}</button>))}</div>
            {classNos.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11.5px] text-muted">الفصول (اختياري، وإلا كل الفصول):</span>{classNos.map((c) => (
              <button key={c} type="button" onClick={() => toggle(classes, c, setClasses)} className={`num chip border ${classes.includes(c) ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted"}`}>{c}</button>))}</div>}
          </div>)}
        <div className="space-y-2"><p className="text-[12.5px] font-semibold text-ink">طلاب بأسمائهم <span className="font-normal text-muted">(إضافة على ما سبق)</span></p>
          {picked.length > 0 && <div className="flex flex-wrap gap-1.5">{picked.map((s) => (
            <span key={s.student_id} className="chip gap-1 border border-line bg-white text-ink">{s.full_name}<button className="text-danger" onClick={() => setPicked(picked.filter((y) => y.student_id !== s.student_id))}>✕</button></span>))}</div>}
          <StudentPicker value={null} onChange={(s) => s && !picked.some((y) => y.student_id === s.student_id) && setPicked([...picked, s])} grades={myGrades.length ? myGrades : undefined} />
        </div>
        <div className="space-y-2"><p className="text-[12.5px] font-semibold text-ink">أولياء الأمور</p>
          <Seg value={gd} onChange={setGd} opts={[["none", "لا أحد"], ["all", "كل أولياء الأمور"], ["grades", "أولياء أمور الصفوف المختارة"]]} /></div>
        <div className="space-y-2"><p className="text-[12.5px] font-semibold text-ink">الموظفون</p>
          <Seg value={staff} onChange={setStaff} opts={[["none", "لا أحد"], ["all", "الكل"], ["teachers", "المعلمون"], ["admins", "الإداريون"]]} /></div>
        <button className="btn-primary px-6" disabled={busy} onClick={send}>{busy ? "جارٍ الإرسال…" : item.sent_at ? "إرسال للإضافات" : `إرسال ${KIND[item.kind].t}`}</button>
      </section>
      {item.sent_at && <Share item={item} />}
    </div>
  );
}

/* المشاركة: رسالة واتساب جاهزة، ونسخ الرابط، ورمز QR للعرض والطباعة */
export function Share({ item }) {
  const link = itemLink(item.id);
  const [qr, setQr] = useState(null);
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 640, color: { dark: "#1F3A2D", light: "#FFFFFF" } }).then(setQr, () => {}); }, [link]);
  const survey = item.kind === "survey";
  const [msg, setMsg] = useState(() => [`*${item.title}*`, item.body ? item.body.split("\n")[0].slice(0, 220) : "",
    survey ? "شاركنا رأيك في الاستبانة عبر بوابة مكة الثانوية:" : "للاطلاع على النشرة كاملة في بوابة مكة الثانوية:", link,
    "تُفتح بعد الدخول إلى البوابة بحسابك."].filter(Boolean).join("\n\n"));
  const copy = async (t, ok) => { try { await navigator.clipboard.writeText(t); notify({ ok: true, text: ok }); } catch { notify({ ok: false, text: t }); } };
  const download = () => { const a = document.createElement("a"); a.href = qr; a.download = `رمز-${item.title}.png`; a.click(); };
  return (
    <section className="card space-y-3 p-4">
      <div><h2 className="text-base font-bold text-ink">المشاركة عبر واتساب ورمز QR</h2>
        <p className="mt-0.5 text-sm text-muted">لمجموعات واتساب الطلاب أو أولياء الأمور: الرابط يفتح {survey ? "الاستبانة" : "النشرة"} في البوابة بعد الدخول، فتُحتسب الإجابة والاطلاع في المتابعة. ويصل المستفيدين المرسل إليهم فقط.</p></div>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          <textarea className="field min-h-[150px] text-sm leading-relaxed" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" style={{ background: "#1FA855", borderColor: "#1FA855" }} href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">مشاركة عبر واتساب</a>
            <button className="btn-ghost" onClick={() => copy(msg, "نُسخت الرسالة.")}>نسخ الرسالة</button>
            <button className="btn-ghost" onClick={() => copy(link, "نُسخ الرابط.")}>نسخ الرابط</button>
          </div>
          <p className="font-mono text-xs text-muted" dir="ltr">{link.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="space-y-2 text-center">
          {qr && <img src={qr} alt="رمز QR" className="mx-auto w-48 rounded-sm2 border border-line" />}
          <button className="btn-ghost w-full" onClick={download} disabled={!qr}>تنزيل الرمز</button>
          <p className="text-[11px] text-muted">اعرضه على السبورة أو اطبعه في لوحة الإعلانات.</p>
        </div>
      </div>
    </section>
  );
}
