// src/lab-player/Player.jsx
// ملف المعمل على جهاز الطالب (يعمل دون إنترنت): يختار الطالب رقم جهازه من خلفية سطح
// المكتب، فتظهر أسماء الجالسين عليه من خريطة الجلوس، ثم يؤدّي الدرس، وفي النهاية يعرض
// رمز QR بدرجته موقّعًا بمفتاح الحصة، فيمسحه المعلم من البوابة.
// التقدم محفوظ على الجهاز (localStorage) لكل حصة وجهاز وطلاب، فلا يضيع بإعادة الفتح.
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { lessonById } from "../lab-content/index.js";
import LessonPlayer, { lessonScore } from "../pages/lab/lessons/LessonPlayer.jsx";
import { resultCode } from "../lib/labSign.js";
import logoIcon from "../assets/icon-mint.png";

const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } },
};
const pc = (n) => `PC-${String(n).padStart(2, "0")}`;

export default function Player({ data }) {
  const lesson = lessonById(data.lesson);
  const whoKey = `mkl:${data.code}:who`;
  const [who, setWho] = useState(() => store.get(whoKey, null));   // { seat, students: [idx] }
  const saveWho = (w) => { store.set(whoKey, w); setWho(w); };

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 p-4 sm:p-6">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <img src={logoIcon} alt="" className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">مدرسة مكة الثانوية · معمل الحاسب الآلي</p>
          <p className="truncate text-base font-bold text-ink">{lesson ? `${lesson.lesson.title}` : "درس غير معروف"}</p>
        </div>
        <span className="chip gap-1 bg-mint-tint text-mint-deep">فصل <bdi className="num">{data.class_no}</bdi></span>
      </header>
      {!lesson ? <p className="text-absent">هذا الملف لا يحتوي الدرس المطلوب. اطلب من معلمك ملفًا جديدًا.</p>
        : !who ? <Start data={data} onStart={saveWho} />
          : <Lesson data={data} lesson={lesson} who={who} onSwitch={() => { if (window.confirm("تبديل الطالب؟ يبقى تقدّمك محفوظًا على هذا الجهاز.")) saveWho(null); }} />}
    </div>
  );
}

/* اختيار الجهاز ثم الطلاب */
function Start({ data, onStart }) {
  const [seat, setSeat] = useState(() => store.get(`mkl:${data.code}:seat`, null));
  const [picked, setPicked] = useState([]);
  const [all, setAll] = useState(false);
  const roster = data.roster.map((r, i) => ({ ...r, i }));
  const here = roster.filter((r) => r.s === seat);

  const choose = (n) => {
    setSeat(n); store.set(`mkl:${data.code}:seat`, n);
    setPicked(roster.filter((r) => r.s === n).map((r) => r.i)); setAll(false);
  };
  const toggle = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <p className="font-bold text-ink">١. اختر رقم جهازك <span className="text-sm font-normal text-muted">(مكتوب على خلفية سطح المكتب)</span></p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8" dir="ltr">
          {Array.from({ length: data.device_count || 24 }, (_, k) => k + 1).map((n) => (
            <button key={n} type="button" onClick={() => choose(n)}
                    className={`num rounded-sm2 border py-2 text-sm font-semibold transition-colors ${
                      seat === n ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-ink hover:bg-canvas"}`}>
              {pc(n)}
            </button>
          ))}
        </div>
      </div>

      {seat != null && (
        <div className="card space-y-3 p-4">
          <p className="font-bold text-ink">٢. من يجلس على الجهاز <bdi className="num">{pc(seat)}</bdi>؟</p>
          {(all ? roster : here).length === 0 && <p className="text-sm text-muted">لا أحد على هذا الجهاز في خريطة الجلوس.</p>}
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(all ? roster : here).map((r) => (
              <label key={r.i} className={`flex cursor-pointer items-center gap-2 rounded-card border px-3 py-2 text-sm ${
                picked.includes(r.i) ? "border-mint-deep bg-mint-tint" : "border-line bg-paper"}`}>
                <input type="checkbox" checked={picked.includes(r.i)} onChange={() => toggle(r.i)} className="accent-[#3E6350]" />
                <span className="flex-1 text-ink">{r.n}</span>
                {all && r.s != null && <span className="num text-[11px] text-muted">{pc(r.s)}</span>}
              </label>
            ))}
          </div>
          {!all && <button type="button" className="text-xs text-mint-deep underline" onClick={() => setAll(true)}>اسمي غير موجود — اختر من كل الفصل</button>}
          <button type="button" className="btn-primary w-full" disabled={!picked.length}
                  onClick={() => onStart({ seat, students: [...picked].sort((a, b) => a - b) })}>
            ابدأ الدرس
          </button>
        </div>
      )}
    </div>
  );
}

function Lesson({ data, lesson, who, onSwitch }) {
  const key = `mkl:${data.code}:${who.seat}:${who.students.join("-")}`;
  const [progress, setProgress] = useState(() => store.get(key, {}));
  const [showCode, setShowCode] = useState(false);
  const onProgress = (sid, score) => setProgress((p) => { const n = { ...p, [sid]: score }; store.set(key, n); return n; });
  const names = who.students.map((i) => data.roster[i]?.n).filter(Boolean);
  const sum = lessonScore(lesson, progress);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-card bg-canvas px-3 py-2 text-sm">
        <span className="num chip bg-paper text-ink">{pc(who.seat)}</span>
        <span className="flex-1 font-semibold text-ink">{names.join("، ")}</span>
        <button type="button" className="text-xs text-muted underline" onClick={onSwitch}>تبديل الطالب</button>
      </div>
      <LessonPlayer lesson={lesson} progress={progress} onProgress={onProgress}
                    footer={<button type="button" className="btn-primary w-full" onClick={() => setShowCode(true)}>إظهار رمز الدرجة للمعلم</button>} />
      {sum.quiz != null && !showCode && (
        <button type="button" onClick={() => setShowCode(true)}
                className="btn-primary fixed bottom-4 left-4 z-30 shadow-lg">رمز الدرجة</button>
      )}
      {showCode && <ResultCode data={data} who={who} names={names} sum={sum} onClose={() => setShowCode(false)} />}
    </div>
  );
}

function ResultCode({ data, who, names, sum, onClose }) {
  const text = useMemo(() => resultCode({
    origin: data.origin, code: data.code, secret: data.secret, seat: who.seat, students: who.students,
    quiz: sum.quiz, mastery: sum.mastery, done: sum.done, total: sum.total,
  }), [data, who, sum]);
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: "M" }).then(setSrc); }, [text]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm space-y-3 p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-bold text-ink">رمز الدرجة</p>
        <p className="text-sm text-ink">{names.join("، ")} · <bdi className="num">{pc(who.seat)}</bdi></p>
        {src && <img src={src} alt="رمز الدرجة" className="mx-auto w-64 max-w-full" />}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="الاختبار" value={sum.quiz != null ? `${sum.quiz}%` : "—"} />
          <Stat label="الإتقان" value={sum.mastery != null ? `${sum.mastery}%` : "—"} />
          <Stat label="المحطات" value={`${sum.done}/${sum.total}`} />
        </div>
        {sum.quiz == null && <p className="rounded-card bg-warning-light px-3 py-2 text-xs text-late">لم تؤدِّ اختبار الدرس بعد — أكمله قبل أن يمسح المعلم الرمز.</p>}
        <p className="text-xs text-muted">اعرض الرمز على معلمك ليمسحه. يُرصد أول مسح فقط.</p>
        <button type="button" className="btn-ghost w-full" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-card bg-canvas p-2"><p className="num text-lg font-bold text-ink">{value}</p><p className="text-[11px] text-muted">{label}</p></div>
);
