// src/components/ViolationPicker.jsx
import { useMemo, useState } from "react";
import { DEGREES, TYPES, VIOLATIONS, typeLabel } from "../lib/behavior";

/* =====================================================================
   اختيار المخالفة السلوكية: بطاقات الدرجات الخمس، وشرائح الأنواع، وبحث،
   ثم قائمة المخالفات المطابقة. اختيار مخالفة يحدّد درجتها ونوعها تلقائيًا.
   value: { degree, type, text } أو null
   ===================================================================== */
export default function ViolationPicker({ value, onChange }) {
  const [degree, setDegree] = useState(value?.degree ?? 0);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

  const list = useMemo(() => VIOLATIONS.filter((v) =>
    (!degree || v.degree === degree) && (!type || v.type === type) &&
    (!q.trim() || v.text.includes(q.trim()))), [degree, type, q]);

  // الأنواع المتاحة في الدرجة المختارة فقط
  const types = useMemo(() => TYPES.filter((t) =>
    VIOLATIONS.some((v) => v.type === t.key && (!degree || v.degree === degree))), [degree]);

  const count = (n) => VIOLATIONS.filter((v) => v.degree === n && (!type || v.type === type)).length;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs text-muted">درجة المخالفة</p>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          <button type="button" onClick={() => setDegree(0)}
            className={`rounded-sm2 border px-2 py-2 text-center text-xs font-semibold transition-colors ${
              !degree ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-muted hover:bg-canvas"}`}>
            كل الدرجات
          </button>
          {DEGREES.map((d) => {
            const on = degree === d.n;
            return (
              <button key={d.n} type="button" onClick={() => { setDegree(d.n); if (type && !VIOLATIONS.some((v) => v.degree === d.n && v.type === type)) setType(""); }}
                className="rounded-sm2 border px-2 py-1.5 text-center transition-colors"
                style={on ? { background: d.tone, borderColor: d.tone, color: "#fff" }
                          : { background: d.bg, borderColor: `${d.tone}33`, color: d.tone }}>
                <span className="block text-[13px] font-bold">{d.name}</span>
                <span className="num block text-[10.5px] opacity-80">{count(d.n)} مخالفة</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted">نوع المخالفة</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setType("")}
            className={`rounded-pill px-3 py-1 text-xs font-medium ${
              !type ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            كل الأنواع
          </button>
          {types.map((t) => (
            <button key={t.key} type="button" onClick={() => setType(t.key)}
              className={`rounded-pill px-3 py-1 text-xs font-medium ${
                type === t.key ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <input className="field w-full" value={q} placeholder="ابحث في نص المخالفة…"
             onChange={(e) => setQ(e.target.value)} />

      <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-sm2 border border-line bg-canvas/40 p-1.5">
        {list.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">لا مخالفات مطابقة.</p>}
        {list.map((v) => {
          const d = DEGREES[v.degree - 1];
          const on = value?.text === v.text;
          return (
            <button key={v.id} type="button"
              onClick={() => onChange({ degree: v.degree, type: v.type, text: v.text })}
              className={`flex w-full items-start gap-2.5 rounded-sm2 border px-3 py-2 text-right transition-colors ${
                on ? "border-mint-deep bg-mint-tint" : "border-transparent bg-white hover:border-line"}`}>
              <span className="mt-0.5 shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-bold"
                    style={{ background: d.bg, color: d.tone }}>{d.name}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-relaxed text-ink">{v.text}</span>
                <span className="mt-0.5 block text-[10.5px] text-faint">{typeLabel(v.type)} · المادة {v.article}</span>
              </span>
              {on && <span className="shrink-0 text-mint-deep">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
