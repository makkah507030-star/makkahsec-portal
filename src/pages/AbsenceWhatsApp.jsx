// src/pages/AbsenceWhatsApp.jsx
// رسائل الغياب بواتساب (supabase/absence_whatsapp.sql): بعد اعتماد الغياب الرسمي تظهر قائمة الغائبين بلا عذر
// مع جوال ولي الأمر. زر واحد يفتح محادثة ولي الأمر برسالة جاهزة، فيضغط الموظف «إرسال» في واتساب، ثم يعود
// ويضغط «التالي» فتُفتح محادثة الطالب الذي بعده. الإرسال يدوي من جوال المدرسة فلا خطر حظر، ويُسجَّل من أرسل
// لكل طالب حتى لا تتكرر الرسالة. لشؤون الطلاب والكتّاب بالصفوف كلها، وللموجه الطلابي بصفه وحده.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { todayISO, DAY_NAMES, GRADE_NAMES } from "../lib/schoolTime";
import { useNotice } from "../lib/useNotice.js";
import { friendlyError } from "../lib/friendlyError.js";
import Loader from "../components/Loader.jsx";
import PageIntro from "../components/PageIntro.jsx";

const waNumber = (m) => { const d = String(m ?? "").replace(/\D/g, ""); return d.startsWith("05") ? `966${d.slice(1)}` : d.startsWith("5") ? `966${d}` : d; };
const validMobile = (m) => /^9665\d{8}$/.test(waNumber(m));
const dmy = (iso) => { const [y, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}/${y}`; };
const dayName = (iso) => DAY_NAMES[new Date(`${iso}T12:00:00`).getDay() + 1] ?? "";
const hhmm = (ts) => new Date(ts).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" });

export const absenceText = (r, date) => [
  "السلام عليكم ورحمة الله وبركاته",
  `ولي أمر الطالب/ ${r.full_name}`,
  `نفيدكم بغياب ابنكم عن المدرسة اليوم ${dayName(date)} ${dmy(date)}.`,
  "نأمل متابعته، وتزويد المدرسة بالعذر إن وُجد، فالمواظبة أساس تحصيله.",
  "مدرسة مكة الثانوية",
  "makkahsec.com",
].join("\n");
const waLink = (r, date) => `https://api.whatsapp.com/send?phone=${waNumber(r.mobile)}&text=${encodeURIComponent(absenceText(r, date))}`;

// سبب عدم دخول الطالب في طابور الإرسال
const blocker = (r) => (!r.mobile ? "لا جوال لولي الأمر" : !validMobile(r.mobile) ? "رقم الجوال غير صحيح" : !r.consent ? "ولي الأمر ألغى الموافقة على الرسائل" : null);

export default function AbsenceWhatsApp() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [approved, setApproved] = useState(true);
  const [grade, setGrade] = useState(0);
  const [hidePush, setHidePush] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const [msg, setMsg] = useNotice(null);

  const load = useCallback(async () => {
    setRows(null); setSkipped([]);
    const [{ data, error }, { data: day }] = await Promise.all([
      supabase.rpc("absence_wa_list", { p_date: date }),
      supabase.from("official_attendance_days").select("attend_date").eq("attend_date", date).maybeSingle(),
    ]);
    if (error) {
      setMsg({ ok: false, text: /absence_wa|schema cache|function/i.test(error.message) ? "نفّذ supabase/absence_whatsapp.sql في قاعدة البيانات أولًا." : friendlyError(error.message) });
      setRows([]); return;
    }
    setApproved(!!day);
    setRows(data ?? []);
  }, [date, setMsg]);
  useEffect(() => { load(); }, [load]);

  const grades = useMemo(() => [...new Set((rows ?? []).map((r) => r.grade))].sort(), [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => (!grade || r.grade === grade) && (!hidePush || !r.has_push)), [rows, grade, hidePush]);
  // الطابور: من لم تُرسل له رسالة وجواله صالح، ومن يصله إشعار البوابة في آخره، والمتخطّى بعد الجميع
  const queue = useMemo(() => {
    const q = shown.filter((r) => !r.sent_at && !blocker(r));
    const rank = (r) => (skipped.includes(r.student_id) ? 2 : r.has_push ? 1 : 0);
    return [...q].sort((a, b) => rank(a) - rank(b));
  }, [shown, skipped]);
  const cur = queue[0];
  const sentCount = shown.filter((r) => r.sent_at).length;
  const sendable = shown.filter((r) => !blocker(r)).length;

  const mark = async (r, undo = false) => {
    const { error } = await supabase.rpc("absence_wa_mark", { p_student: r.student_id, p_date: date, p_undo: undo });
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return false; }
    setRows((rs) => rs.map((x) => (x.student_id === r.student_id ? { ...x, sent_at: undo ? null : new Date().toISOString(), sent_by_name: undo ? null : "أنت" } : x)));
    return true;
  };
  // يفتح واتساب أولًا (داخل ضغطة المستخدم حتى لا يمنعه المتصفح) ثم يسجل الإرسال
  const send = (r) => {
    window.open(waLink(r, date), "_blank", "noopener");
    setSkipped((s) => s.filter((id) => id !== r.student_id));
    mark(r);
  };
  const skip = (r) => setSkipped((s) => [...s.filter((id) => id !== r.student_id), r.student_id]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">رسائل الغياب بواتساب</h1>
        <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
          بعد اعتماد الغياب الرسمي يظهر هنا الغائبون بلا عذر. اضغط «فتح واتساب» فتُفتح محادثة ولي الأمر برسالة جاهزة،
          اضغط «إرسال» في واتساب ثم عد إلى هنا واضغط «التالي». يُسجَّل من أرسل لكل طالب فلا تتكرر الرسالة.
          الأفضل أن يحفظ أولياء الأمور رقم المدرسة في جهات الاتصال.
        </PageIntro>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <label className="flex items-center gap-2 text-sm text-ink">اليوم
          <input type="date" className="field w-auto py-1 text-sm" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        {grades.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {[0, ...grades].map((g) => (
              <button key={g} type="button" onClick={() => setGrade(g)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${grade === g ? "bg-mint text-white" : "bg-canvas text-muted"}`}>
                {g ? GRADE_NAMES[g] : "الكل"}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={hidePush} onChange={(e) => setHidePush(e.target.checked)} />
          إخفاء من يصل وليَّ أمره إشعار البوابة
        </label>
      </div>

      {rows === null ? <Loader /> : !approved ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">لم يُعتمد الغياب الرسمي لهذا اليوم بعد. تظهر القائمة بعد اعتماده من تقارير شؤون الطلاب.</p>
      ) : !shown.length ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">لا غائبين بلا عذر في هذا اليوم.</p>
      ) : (
        <>
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">أُرسل <span className="num">{sentCount}</span> من <span className="num">{sendable}</span></span>
              <span className="text-xs text-muted">المتبقي <span className="num">{queue.length}</span></span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-present transition-all" style={{ width: `${sendable ? (sentCount / sendable) * 100 : 0}%` }} />
            </div>
            {cur ? (
              <div className="rounded-xl border border-line bg-canvas/50 p-3">
                <p className="text-xs text-muted">{sentCount ? "التالي" : "الأول"}: {GRADE_NAMES[cur.grade]} · فصل <span className="num">{cur.class_no}</span></p>
                <p className="mt-1 text-base font-bold text-ink">{cur.full_name}</p>
                <p className="mt-0.5 text-sm text-muted">ولي الأمر: {cur.guardian_name ?? "—"} · <span dir="ltr" className="num">{cur.mobile}</span>
                  {cur.has_push && <span className="ms-2 rounded-full bg-present/10 px-2 py-0.5 text-[11px] text-present">يصله إشعار البوابة</span>}</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2 font-sans text-xs leading-relaxed text-ink">{absenceText(cur, date)}</pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary flex-1" onClick={() => send(cur)}>
                    {sentCount ? "التالي ← فتح واتساب" : "فتح واتساب"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => skip(cur)} disabled={queue.length < 2}>تخطٍّ</button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-present/10 px-3 py-4 text-center text-sm font-semibold text-present">اكتمل الإرسال لكل الغائبين في هذه القائمة.</p>
            )}
          </div>

          <div className="card divide-y divide-line">
            {shown.map((r) => {
              const b = blocker(r);
              return (
                <div key={r.student_id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{r.full_name}</p>
                    <p className="text-xs text-muted">{GRADE_NAMES[r.grade]} · فصل <span className="num">{r.class_no}</span>
                      {r.has_push && " · يصله إشعار البوابة"}</p>
                  </div>
                  {r.sent_at ? (
                    <>
                      <span className="rounded-full bg-present/10 px-2 py-0.5 text-xs text-present">أُرسل · {r.sent_by_name} <span dir="rtl">{hhmm(r.sent_at)}</span></span>
                      <button type="button" className="text-xs text-muted underline" onClick={() => mark(r, true)}>تراجع</button>
                    </>
                  ) : b ? (
                    <span className="rounded-full bg-warning-light px-2 py-0.5 text-xs text-warning">{b}</span>
                  ) : (
                    <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => send(r)}>واتساب</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
