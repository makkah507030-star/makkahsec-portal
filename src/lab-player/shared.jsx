// src/lab-player/shared.jsx
// أجزاء مشتركة بين ملف الحصة (Player) والملف الدائم (InstallPlayer): التخزين على الجهاز،
// ورأس الصفحة، واختيار الجهاز والطلاب، وتشغيل الدرس، ورمز الدرجة.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import LessonPlayer, { lessonScore } from "../pages/lab/lessons/LessonPlayer.jsx";
import logoIcon from "../assets/icon-mint.png";

export const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* تجاهل */ } },
};
export const pc = (n) => `PC-${String(n).padStart(2, "0")}`;

export function Header({ title, chip }) {
  return (
    <header className="flex items-center gap-3 border-b border-line pb-3">
      <img src={logoIcon} alt="" className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">مدرسة مكة الثانوية · معمل الحاسب الآلي</p>
        <p className="truncate text-base font-bold text-ink">{title}</p>
      </div>
      {chip}
    </header>
  );
}

export function DeviceGrid({ count, seat, onPick }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8" dir="ltr">
      {Array.from({ length: count || 24 }, (_, k) => k + 1).map((n) => (
        <button key={n} type="button" onClick={() => onPick(n)}
                className={`num rounded-sm2 border py-2 text-sm font-semibold transition-colors ${
                  seat === n ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-ink hover:bg-canvas"}`}>
          {pc(n)}
        </button>
      ))}
    </div>
  );
}

/* الجالسون على الجهاز مختارون مسبقًا، و«اسمي غير موجود» يفتح الفصل كاملًا */
export function NamePicker({ roster, seat, onStart, step = "٢" }) {
  const list = roster.map((r, i) => ({ ...r, i }));
  const here = list.filter((r) => r.s === seat);
  const [picked, setPicked] = useState(() => here.map((r) => r.i));
  const [all, setAll] = useState(false);
  const toggle = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const shown = all ? list : here;

  return (
    <div className="card space-y-3 p-4">
      <p className="font-bold text-ink">{step}. من يجلس على الجهاز <bdi className="num">{pc(seat)}</bdi>؟</p>
      {shown.length === 0 && <p className="text-sm text-muted">لا أحد على هذا الجهاز في خريطة الجلوس.</p>}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {shown.map((r) => (
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
              onClick={() => onStart([...picked].sort((a, b) => a - b))}>
        ابدأ الدرس
      </button>
    </div>
  );
}

/* الدرس للطلاب المختارين: التقدم محفوظ بمفتاحه، ورمز الدرجة من codeOf(sum) */
export function LessonRun({ lesson, progressKey, seat, names, codeOf, onSwitch }) {
  const [progress, setProgress] = useState(() => store.get(progressKey, {}));
  const [showCode, setShowCode] = useState(false);
  const onProgress = (sid, score) => setProgress((p) => { const n = { ...p, [sid]: score }; store.set(progressKey, n); return n; });
  const sum = lessonScore(lesson, progress);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-card bg-canvas px-3 py-2 text-sm">
        <span className="num chip bg-paper text-ink">{pc(seat)}</span>
        <span className="flex-1 font-semibold text-ink">{names.join("، ")}</span>
        <button type="button" className="text-xs text-muted underline" onClick={onSwitch}>تبديل الطالب</button>
      </div>
      <LessonPlayer lesson={lesson} progress={progress} onProgress={onProgress}
                    footer={<button type="button" className="btn-primary w-full" onClick={() => setShowCode(true)}>إظهار رمز الدرجة للمعلم</button>} />
      {sum.quiz != null && !showCode && (
        <button type="button" onClick={() => setShowCode(true)} className="btn-primary fixed bottom-4 left-4 z-30 shadow-lg">رمز الدرجة</button>
      )}
      {showCode && <ResultCode text={codeOf(sum)} names={names} seat={seat} sum={sum} onClose={() => setShowCode(false)} />}
    </div>
  );
}

function ResultCode({ text, names, seat, sum, onClose }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: "M" }).then(setSrc); }, [text]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm space-y-3 p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-bold text-ink">رمز الدرجة</p>
        <p className="text-sm text-ink">{names.join("، ")} · <bdi className="num">{pc(seat)}</bdi></p>
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
