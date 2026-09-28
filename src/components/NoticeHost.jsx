// src/components/NoticeHost.jsx
// طبقة التنبيهات العامة — تُركَّب مرة واحدة في جذر التطبيق:
//  • بطاقات النجاح والخطأ أعلى الشاشة، تختفي وحدها (وتتوقف عند مرور المؤشر).
//  • بطاقة «جاري التنفيذ» وسط الشاشة إن طال حفظ أو حذف.
//  • شارة «جاري التحميل» صغيرة أسفل الشاشة إن طال تحميل ولا مؤشر في الصفحة.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { subscribe, getToasts, getActivity, dismiss } from "../lib/notice";
import { BrandMark, useWaitHint } from "./Loader.jsx";

const DURATION = { success: 3800, error: 7000 };

/** قيمة تصير true بعد أن تبقى الحالة صحيحة مدة delay، وتبقى ظاهرة minShow على الأقل */
function useSettled(on, delay, minShow = 450) {
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

  const working = useSettled(act.writes > 0, 400);
  const loading = useSettled(act.reads > 0 && act.writes === 0 && act.loaders === 0, 800, 300);
  const hint = useWaitHint(working);

  return (
    <div className="no-print print:hidden">
      {/* النتائج */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[1000] flex flex-col items-center gap-2 px-3"
           style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }} aria-live="polite">
        {toasts.map((t) => <Toast key={t.id} t={t} />)}
      </div>

      {/* جاري التنفيذ */}
      {working && (
        <div className="pointer-events-none fixed inset-0 z-[999] grid place-items-center px-6">
          <div className="nt-pop flex min-w-[220px] flex-col items-center gap-2.5 rounded-xl2 border border-mint-light bg-white/95 px-8 py-6 text-center shadow-[0_20px_60px_-20px_rgba(62,99,80,.45)] backdrop-blur"
               role="status">
            <BrandMark size={64} />
            <p className="text-sm font-semibold text-mint-deep">جاري التنفيذ<span className="ld-dots" /></p>
            {hint && <p className="max-w-[240px] text-xs text-muted">{hint}</p>}
          </div>
        </div>
      )}

      {/* تحميل في الخلفية */}
      {loading && !working && (
        <div className="pointer-events-none fixed inset-x-0 z-[998] flex justify-center"
             style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="nt-rise flex items-center gap-2 rounded-pill border border-mint-light bg-white/95 px-3.5 py-1.5 text-xs font-medium text-mint-deep shadow-card backdrop-blur"
               role="status">
            <BrandMark size={20} />
            جاري التحميل<span className="ld-dots" />
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ t }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const ok = t.kind !== "error";
  const ms = DURATION[t.kind] ?? DURATION.success;

  const close = () => { setLeaving(true); setTimeout(() => dismiss(t.id), 220); };

  // العدّ التنازلي يتوقف أثناء مرور المؤشر أو اللمس
  const left = useRef(ms);
  useEffect(() => {
    if (paused || leaving) return undefined;
    const start = Date.now();
    const id = setTimeout(close, left.current);
    return () => { clearTimeout(id); left.current -= Date.now() - start; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, leaving]);

  return (
    <div role={ok ? "status" : "alert"}
         onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
         onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}
         className={`${leaving ? "nt-out" : "nt-in"} pointer-events-auto relative w-full max-w-[440px] overflow-hidden rounded-card border bg-white shadow-[0_18px_50px_-18px_rgba(16,16,16,.35)] ${
           ok ? "border-mint-light" : "border-danger/25"}`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          ok ? "bg-mint-tint text-mint-deep" : "bg-danger-light text-danger"}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
               strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ok
              ? <path className="nt-draw" d="M5 12.5l4.2 4.2L19 7" />
              : <><path className="nt-draw" d="M12 7v6" /><path d="M12 17h.01" /></>}
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-semibold ${ok ? "text-mint-deep" : "text-danger"}`}>
            {ok ? "تم بنجاح" : "لم يكتمل الطلب"}
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed text-ink" style={{ unicodeBidi: "plaintext" }}>{t.text}</p>
        </div>
        <button onClick={close} aria-label="إغلاق"
                className="-m-1 rounded-full p-1.5 text-faint transition-colors hover:bg-canvas hover:text-ink">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <span className={`nt-bar absolute bottom-0 right-0 h-[3px] ${ok ? "bg-mint" : "bg-danger/70"}`}
            style={{ animationDuration: `${ms}ms`, animationPlayState: paused || leaving ? "paused" : "running" }} />
    </div>
  );
}
