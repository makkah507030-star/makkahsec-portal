// src/components/NoticeHost.jsx
// طبقة التحميل والنتائج العامة — تُركَّب مرة واحدة في جذر التطبيق.
// كل ما يخص الانتظار يظهر في مكان واحد ثابت: صندوق وسط الشاشة، والصفحة
// خلفه محجوبة بتضليل خفيف يُظهر محتواها ويمنع الضغط المتكرر أثناء العمل.
//  • جاري التحميل: جزء من الصفحة يُحمَّل (<Loader />).
//  • جاري التنفيذ: حفظ أو حذف بدأه المستخدم.
//  • النتيجة: ✓ تم بنجاح (تختفي وحدها)، أو خطأ يبقى حتى «حسنًا».
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { subscribe, getToasts, getActivity, dismiss } from "../lib/notice";
import { BrandMark, useWaitHint } from "./Loader.jsx";

const SUCCESS_MS = 1900;
const ESCAPE_MS = 15000;   // تنفيذ عالق: يظهر زر لمتابعة التصفح

/** true بعد أن تبقى الحالة صحيحة مدة delay، ويبقى ظاهرًا minShow على الأقل — فلا وميض */
function useSettled(on, delay, minShow) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    let t;
    if (on && !shown) t = setTimeout(() => { since.current = Date.now(); setShown(true); }, delay);
    if (!on && shown) t = setTimeout(() => setShown(false), Math.max(0, minShow - (Date.now() - since.current)));
    return () => clearTimeout(t);
  }, [on, shown, delay, minShow]);
  return shown;
}

export default function NoticeHost() {
  const toasts = useSyncExternalStore(subscribe, getToasts);
  const act = useSyncExternalStore(subscribe, getActivity);

  const working = act.writes > 0;
  const busyOn = working || act.loaders > 0;
  const busy = useSettled(busyOn, 250, 450);
  const hint = useWaitHint(busy);

  // آخر عنوان يبقى أثناء الاختفاء
  const [label, setLabel] = useState("جاري التحميل");
  const want = working ? "جاري التنفيذ" : "جاري التحميل";
  if (busyOn && label !== want) setLabel(want);

  // تنفيذ عالق: بعد مدة يظهر زر يرفع الحجب حتى تنتهي هذه الموجة
  const [escape, setEscape] = useState(false);
  const [released, setReleased] = useState(false);
  if (!busyOn && (escape || released)) { setEscape(false); setReleased(false); }
  useEffect(() => {
    if (!busyOn) return undefined;
    const t = setTimeout(() => setEscape(true), ESCAPE_MS);
    return () => clearTimeout(t);
  }, [busyOn]);

  // النتيجة تنتظر انتهاء العمل، ثم تُعرض واحدة بعد أخرى
  const result = !busy ? toasts[0] : null;
  const showBusy = busy && !released;
  const open = showBusy || !!result;

  return (
    <div className="no-print print:hidden">
      {open && (
        <div className="nt-veil fixed inset-0 z-[999] grid place-items-center bg-white/35 px-6 backdrop-blur-[1.5px]"
             onClick={() => result && dismiss(result.id)}>
          {result
            ? <Result key={result.id} t={result} />
            : (
              <div className="nt-pop flex min-w-[230px] max-w-[300px] flex-col items-center gap-2.5 rounded-xl2 border border-mint-light bg-white px-8 py-7 text-center shadow-[0_24px_70px_-24px_rgba(62,99,80,.5)]"
                   role="status" aria-live="polite" onClick={(e) => e.stopPropagation()}>
                <BrandMark size={68} />
                <p className="text-[15px] font-semibold text-mint-deep">{label}<span className="ld-dots" /></p>
                <p className={`min-h-[1rem] text-xs leading-relaxed text-muted transition-opacity duration-500 ${hint ? "opacity-100" : "opacity-0"}`}>
                  {hint}
                </p>
                {escape && (
                  <button onClick={() => setReleased(true)}
                          className="mt-1 text-xs font-medium text-mint-deep underline-offset-4 hover:underline">
                    متابعة التصفح أثناء الانتظار
                  </button>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function Result({ t }) {
  const ok = t.kind !== "error";
  const [paused, setPaused] = useState(false);
  const btn = useRef(null);

  // النجاح يختفي وحده (ويتوقف عند مرور المؤشر)، والخطأ يبقى حتى «حسنًا»
  useEffect(() => {
    if (!ok || paused) return undefined;
    const id = setTimeout(() => dismiss(t.id), SUCCESS_MS);
    return () => clearTimeout(id);
  }, [ok, paused, t.id]);

  useEffect(() => {
    btn.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") dismiss(t.id); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [t.id]);

  return (
    <div role={ok ? "status" : "alertdialog"} aria-live="assertive"
         onClick={(e) => e.stopPropagation()}
         onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
         className={`nt-pop relative flex w-full max-w-[360px] flex-col items-center gap-2 overflow-hidden rounded-xl2 border bg-white px-7 pb-6 pt-7 text-center shadow-[0_24px_70px_-24px_rgba(16,16,16,.45)] ${
           ok ? "border-mint-light" : "border-danger/25"}`}>
      <span className={`nt-ring grid h-16 w-16 place-items-center rounded-full ${
        ok ? "bg-mint-tint text-mint-deep" : "bg-danger-light text-danger"}`}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ok
            ? <path className="nt-draw" d="M5 12.5l4.2 4.2L19 7" />
            : <><path className="nt-draw" d="M12 6.5v7" /><path d="M12 17.5h.01" /></>}
        </svg>
      </span>
      <p className={`mt-1 text-base font-bold ${ok ? "text-mint-deep" : "text-danger"}`}>
        {ok ? "تم بنجاح" : "لم يكتمل الطلب"}
      </p>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink" style={{ unicodeBidi: "plaintext" }}>
        {t.text}
      </p>
      {ok ? (
        <span className="nt-bar absolute bottom-0 right-0 h-[3px] bg-mint"
              style={{ animationDuration: `${SUCCESS_MS}ms`, animationPlayState: paused ? "paused" : "running" }} />
      ) : (
        <button ref={btn} onClick={() => dismiss(t.id)}
                className="mt-3 w-full rounded-sm2 bg-mint-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-mint-hover">
          حسنًا
        </button>
      )}
    </div>
  );
}
