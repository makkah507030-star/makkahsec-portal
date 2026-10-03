// src/components/MathSymbolsToolbar.jsx
import { useEffect, useRef, useState } from "react";
import { MATH_SYMBOL_GROUPS, MATH_SYMBOLS } from "../lib/mathSymbols.js";
import { insertAtCursor } from "../lib/textInsert.js";

const RECENT_KEY = "makkah_math_symbols_recent";
const RECENT_MAX = 14;

function loadRecent() {
  try {
    const arr = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(arr) ? arr.filter((s) => MATH_SYMBOLS.has(s)).slice(0, RECENT_MAX) : [];
  } catch { return []; }
}
function saveRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch { /* تخزين محلي غير متاح */ }
}

const isTextField = (el) => {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return !["number", "checkbox", "radio", "file", "date", "time"].includes(el.type) && el.inputMode !== "decimal";
};

/**
 * شريط رموز رياضية يُدرج الرمز في آخر حقل نصي نُقر داخله ضمن containerRef،
 * حصريًا لمعلمي الرياضيات. لا يغيّر أي من محرّرات الأسئلة — يتتبّع التركيز
 * عبر "focusin" على الحاوية فقط، فلا حاجة لمسّ كل حقل على حدة.
 */
export default function MathSymbolsToolbar({ containerRef }) {
  const fieldRef = useRef(null);
  const hintTimer = useRef(null);
  const [open, setOpen] = useState(true);
  const [groupIdx, setGroupIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(loadRecent);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return undefined;
    const onFocusIn = (e) => { if (isTextField(e.target)) fieldRef.current = e.target; };
    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, [containerRef]);

  const insert = (sym) => {
    const el = fieldRef.current;
    if (!el || !document.contains(el)) {
      setHint(true);
      window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setHint(false), 2500);
      return;
    }
    insertAtCursor(el, sym);
    setRecent((prev) => {
      const next = [sym, ...prev.filter((s) => s !== sym)].slice(0, RECENT_MAX);
      saveRecent(next);
      return next;
    });
  };

  const q = query.trim();
  const results = q
    ? MATH_SYMBOL_GROUPS.flatMap((g) => g.items)
        .filter((it) => it.sym.includes(q) || it.label.includes(q))
        .filter((it, i, all) => all.findIndex((x) => x.sym === it.sym && x.label === it.label) === i)
    : null;
  const activeGroup = MATH_SYMBOL_GROUPS[groupIdx] ?? MATH_SYMBOL_GROUPS[0];

  return (
    <section className="card space-y-3 p-4" dir="rtl">
      <button type="button" onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-right">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-mint-deep text-sm font-bold text-white" dir="ltr">Σ</span>
          <span className="text-sm font-bold text-ink">مكتبة الرموز الرياضية</span>
          <span className="chip bg-mint-tint text-mint-deep">لمعلمي الرياضيات</span>
        </span>
        <span className="text-xs text-muted">{open ? "إخفاء ▲" : "إظهار ▼"}</span>
      </button>

      {open && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            انقر داخل نص السؤال أو الخيارات أو الإجابة النموذجية، ثم اضغط الرمز لإدراجه في موضع المؤشر مباشرة.
          </p>

          <input className="field" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="ابحث عن رمز بالاسم أو الشكل… مثل: جذر، مثلث، تكامل، ≤" />

          {hint && (
            <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
              انقر أولًا داخل حقل نص السؤال أو الخيارات، ثم اختر الرمز.
            </p>
          )}

          {!q && recent.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted">الأحدث استخدامًا</p>
              <SymbolGrid items={recent.map((s) => ({ sym: s, label: s }))} onPick={insert} />
            </div>
          )}

          {!q && (
            <div className="flex flex-wrap gap-1.5">
              {MATH_SYMBOL_GROUPS.map((g, i) => (
                <button key={g.key} type="button" onClick={() => setGroupIdx(i)}
                        className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
                          i === groupIdx ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                  {g.title}
                </button>
              ))}
            </div>
          )}

          <SymbolGrid items={q ? results : activeGroup.items}
                      onPick={insert} empty={q ? "لا رموز مطابقة لبحثك" : null} />
        </div>
      )}
    </section>
  );
}

function SymbolGrid({ items, onPick, empty }) {
  if (!items?.length) return <p className="text-xs text-faint">{empty ?? "لا رموز"}</p>;
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
      {items.map((it, i) => (
        <button key={`${it.sym}-${i}`} type="button" title={it.label} onClick={() => onPick(it.sym)}
                dir="ltr"
                className="grid min-h-[40px] place-items-center rounded-sm2 border border-line bg-white px-1 text-base font-semibold text-ink transition-colors hover:border-mint-deep hover:bg-mint-tint hover:text-mint-deep">
          {it.sym}
        </button>
      ))}
    </div>
  );
}
