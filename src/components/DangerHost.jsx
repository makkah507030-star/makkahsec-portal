// src/components/DangerHost.jsx
// نافذة تأكيد الإجراءات الحساسة (confirmDanger) — تُركَّب مرة واحدة في جذر التطبيق.
import { useEffect, useState, useSyncExternalStore } from "react";
import { CONFIRM_WORD, getDanger, isConfirmWord, subscribeDanger } from "../lib/danger";
import { IS_STAGING } from "./StagingBadge.jsx";

export default function DangerHost() {
  const d = useSyncExternalStore(subscribeDanger, getDanger);
  const [typed, setTyped] = useState("");
  const [shownFor, setShownFor] = useState(null);
  if (d !== shownFor) { setShownFor(d); setTyped(""); }

  useEffect(() => {
    if (!d) return undefined;
    const onKey = (e) => { if (e.key === "Escape") d.resolve(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d]);

  if (!d) return null;
  const high = d.level === "high";
  const ok = !high || isConfirmWord(typed);

  return (
    <div className="no-print fixed inset-0 z-[1000] grid place-items-center bg-ink/30 px-4 backdrop-blur-[1.5px]"
         onClick={() => d.resolve(false)}>
      <div role="alertdialog" aria-modal="true" dir="rtl" onClick={(e) => e.stopPropagation()}
           className="nt-pop w-full max-w-md overflow-hidden rounded-xl2 border border-absent/30 bg-white shadow-[0_24px_70px_-24px_rgba(162,59,59,.55)]">
        <div className="flex items-center gap-2.5 bg-absent px-5 py-3 text-white">
          <span className="text-lg leading-none" aria-hidden="true">⚠</span>
          <p className="text-sm font-bold">{high ? "إجراء حساس يؤثر على بيانات البوابة كلها" : "إجراء يؤثر على بيانات البوابة لكل المستخدمين"}</p>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-base font-bold text-ink">{d.title}</p>
          {d.impact.length > 0 && (
            <ul className="space-y-1.5 rounded-sm2 bg-absent/5 px-4 py-3 text-sm leading-relaxed text-ink">
              {d.impact.map((t, i) => <li key={i} className="flex gap-2"><span className="text-absent">•</span><span>{t}</span></li>)}
            </ul>
          )}
          {high && (
            <label className="block">
              <span className="text-xs text-muted">للمتابعة اكتب كلمة «<b className="text-absent">{CONFIRM_WORD}</b>»</span>
              <input className="field mt-1 text-center" value={typed} autoFocus
                     onChange={(e) => setTyped(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter" && ok) d.resolve(true); }} />
            </label>
          )}
          {!IS_STAGING && (
            <p className="text-[11px] leading-relaxed text-faint">
              للتجربة والتدريب استخدم النسخة التجريبية ببيانات وهمية: <span dir="ltr">makkahsec-staging.netlify.app</span>
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-line px-5 py-3">
          <button className="btn flex-1 bg-absent text-white hover:bg-absent/90" disabled={!ok}
                  autoFocus={!high} onClick={() => d.resolve(true)}>
            {d.confirmLabel}
          </button>
          <button className="btn-ghost flex-1" onClick={() => d.resolve(false)}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
