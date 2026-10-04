// src/components/SymbolsToolbar.jsx
import { useEffect, useRef, useState } from "react";
import { insertAtCursor, replaceRange } from "../lib/textInsert.js";
import { formatChemText } from "../lib/scienceSymbols.js";

const RECENT_MAX = 14;

function loadRecent(lib) {
  try {
    const arr = JSON.parse(localStorage.getItem(lib.recentKey) ?? "[]");
    return Array.isArray(arr) ? arr.filter((s) => lib.symbols.has(s)).slice(0, RECENT_MAX) : [];
  } catch { return []; }
}
function saveRecent(lib, list) {
  try { localStorage.setItem(lib.recentKey, JSON.stringify(list.slice(0, RECENT_MAX))); } catch { /* تخزين محلي غير متاح */ }
}

const isTextField = (el) => {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return !["number", "checkbox", "radio", "file", "date", "time"].includes(el.type) && el.inputMode !== "decimal";
};

const PICK_FIELD = "انقر أولًا داخل حقل نص السؤال أو الخيارات، ثم اختر الرمز.";

/**
 * شريط رموز المادة (library من symbolLibraries.js) يُدرج الرمز في آخر حقل نصي
 * نُقر داخله ضمن containerRef. لا يغيّر أي من محرّرات الأسئلة — يتتبّع التركيز
 * عبر "focusin" على الحاوية فقط، فلا حاجة لمسّ كل حقل على حدة.
 */
export default function SymbolsToolbar({ library, containerRef }) {
  const fieldRef = useRef(null);
  const hintTimer = useRef(null);
  const [open, setOpen] = useState(true);
  const [groupIdx, setGroupIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(() => loadRecent(library));
  const [hint, setHint] = useState(null);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return undefined;
    const onFocusIn = (e) => { if (isTextField(e.target)) fieldRef.current = e.target; };
    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, [containerRef]);

  const flash = (text) => {
    setHint(text);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 3000);
  };
  const field = () => {
    const el = fieldRef.current;
    if (el && document.contains(el)) return el;
    flash(PICK_FIELD);
    return null;
  };

  const insert = (sym) => {
    const el = field();
    if (!el) return;
    // عزل يسار←يمين غير مرئي (LRI…PDI): في الحقول العربية تُقلب الأقواس وتُعكس < و≤
    // بدونه، فتظهر [f ∘ g](x) هكذا (x)[f ∘ g] — في الحقل والورقة المطبوعة وشاشة الطالب
    insertAtCursor(el, `⁦${sym}⁩`);
    setRecent((prev) => {
      const next = [sym, ...prev.filter((s) => s !== sym)].slice(0, RECENT_MAX);
      saveRecent(library, next);
      return next;
    });
  };

  // تنسيق الصيغ الكيميائية في الجزء المظلَّل، أو في الحقل كله إن لم يُظلَّل شيء
  const formatFormulas = () => {
    const el = field();
    if (!el) return;
    let start = el.selectionStart ?? 0, end = el.selectionEnd ?? 0;
    if (start === end) { start = 0; end = el.value.length; }
    const src = el.value.slice(start, end);
    const out = formatChemText(src);
    if (out === src) { flash("لا توجد صيغ تحتاج تنسيقًا. اكتب الصيغة مثل H2SO4 أو Fe3+ ثم اضغط الزر."); return; }
    replaceRange(el, start, end, out);
  };

  const q = query.trim();
  const results = q
    ? library.groups.flatMap((g) => g.items)
        .filter((it) => it.sym.includes(q) || it.label.includes(q))
        .filter((it, i, all) => all.findIndex((x) => x.sym === it.sym && x.label === it.label) === i)
    : null;
  const activeGroup = library.groups[groupIdx] ?? library.groups[0];

  return (
    <section className="card space-y-3 p-4" dir="rtl">
      <button type="button" onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-right">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-mint-deep text-sm font-bold text-white" dir="ltr">{library.icon}</span>
          <span className="text-sm font-bold text-ink">{library.title}</span>
          <span className="chip bg-mint-tint text-mint-deep">{library.audience}</span>
        </span>
        <span className="text-xs text-muted">{open ? "إخفاء ▲" : "إظهار ▼"}</span>
      </button>

      {open && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            انقر داخل نص السؤال أو الخيارات أو الإجابة النموذجية، ثم اضغط الرمز لإدراجه في موضع المؤشر مباشرة.
          </p>

          {library.formula && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm2 bg-mint-tint/60 px-3 py-2.5">
              <button type="button" className="btn-ghost shrink-0 text-xs"
                      onMouseDown={(e) => e.preventDefault()} onClick={formatFormulas}>
                تنسيق الصيغ الكيميائية
              </button>
              <p className="min-w-[200px] flex-1 text-xs leading-relaxed text-muted">
                اكتب الصيغة بلوحة المفاتيح العادية مثل <Ltr>H2SO4</Ltr> أو
                {" "}<Ltr>Fe3+</Ltr> أو
                {" "}<Ltr>2H2 + O2 -&gt; 2H2O</Ltr>، ثم اضغط الزر
                فتصير <Ltr>H₂SO₄</Ltr> و<Ltr>Fe³⁺</Ltr> و<Ltr>2H₂ + O₂ → 2H₂O</Ltr>.
                يُنسَّق الحقل كله، أو الجزء المظلَّل منه فقط.
              </p>
            </div>
          )}

          <input className="field" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder={`ابحث عن رمز بالاسم أو الشكل… ${library.searchHint}`} />

          {hint && <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">{hint}</p>}

          {!q && recent.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted">الأحدث استخدامًا</p>
              <SymbolGrid items={recent.map((s) => ({ sym: s, label: s }))} onPick={insert} />
            </div>
          )}

          {!q && (
            <div className="flex flex-wrap gap-1.5">
              {library.groups.map((g, i) => (
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

// مثال لاتيني داخل السطر العربي، معزول فلا ينقلب ترتيبه
const Ltr = ({ children }) => <bdi dir="ltr" className="whitespace-nowrap font-semibold text-ink">{children}</bdi>;

// الرموز الطويلة (الوحدات المركبة والثوابت) تأخذ عرض خانتين أو أكثر
const span = (sym) => {
  const n = [...sym].length;
  if (n > 12) return "col-span-5 text-sm sm:col-span-4 md:col-span-5";
  if (n > 5) return "col-span-2 text-sm";
  return "text-base";
};

function SymbolGrid({ items, onPick, empty }) {
  if (!items?.length) return <p className="text-xs text-faint">{empty ?? "لا رموز"}</p>;
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
      {items.map((it, i) => (
        <button key={`${it.sym}-${i}`} type="button" title={it.label} onClick={() => onPick(it.sym)}
                dir="ltr"
                className={`grid min-h-[40px] place-items-center rounded-sm2 border border-line bg-white px-1 font-semibold text-ink transition-colors hover:border-mint-deep hover:bg-mint-tint hover:text-mint-deep ${span(it.sym)}`}>
          {it.sym}
        </button>
      ))}
    </div>
  );
}
