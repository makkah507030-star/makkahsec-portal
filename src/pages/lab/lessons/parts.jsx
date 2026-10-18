// src/pages/lab/lessons/parts.jsx
// أجزاء مشتركة لمشغّل الدروس: النص المنسّق، والأشكال، والأسئلة وتصحيحها.
// لا تعتمد على قاعدة البيانات، فتعمل في البوابة وفي ملف المعمل دون إنترنت.
import { useMemo } from "react";

/* **غامق** و`رمز` وسطر جديد — بلا HTML من البيانات */
export function Rich({ text, className = "" }) {
  return (
    <div className={`space-y-2 leading-loose ${className}`}>
      {String(text ?? "").split("\n").map((line, i) => (
        <p key={i}>
          {line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) =>
            part.startsWith("**") ? <b key={j} className="text-ink">{part.slice(2, -2)}</b>
              : part.startsWith("`") ? <code key={j} dir="ltr" className="num rounded bg-canvas px-1.5 py-0.5 text-[0.95em] text-mint-deep">{part.slice(1, -1)}</code>
                : part)}
        </p>
      ))}
    </div>
  );
}

export function Figure({ figure }) {
  if (!figure) return null;
  if (figure.type === "note") {
    return <p className="rounded-card border-r-4 border-mint-deep bg-mint-tint px-4 py-3 text-sm text-ink">{figure.text}</p>;
  }
  if (figure.type === "table") {
    // جداول الأرقام والرموز (قيم الخانات، الرموز الستة عشرية) تُقرأ من اليسار كالأعداد نفسها
    const ltr = figure.head.every((h) => /^[0-9A-F]+$/.test(String(h)));
    return (
      <div className="overflow-x-auto" dir={ltr ? "ltr" : undefined}>
        <table className="w-full border-collapse text-center text-sm">
          <thead>
            <tr>{figure.head.map((h, i) => <th key={i} className="num border border-line bg-mint-tint px-2 py-1.5 font-bold text-mint-deep">{h}</th>)}</tr>
          </thead>
          <tbody>
            {figure.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className="num border border-line px-2 py-1.5 text-ink">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

/* نص بلا حروف عربية (أرقام وقيم مثل «255, 0, 0») يُعزل باتجاه LTR داخل الواجهة العربية */
const iso = (t) => (/[\u0600-\u06FF]/.test(String(t)) ? t : `\u2066${t}\u2069`);

/* ترتيب ثابت لكل سؤال (لا يتغير بإعادة الرسم) */
export function shuffled(n, seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/* توحيد الإجابة المكتوبة: أحرف كبيرة، بلا مسافات، بلا أصفار بادئة، وأرقام عربية ← إنجليزية */
export const normalize = (v) => {
  const s = String(v ?? "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s+/g, "").toUpperCase();
  return /^[0-9A-F]+$/.test(s) ? s.replace(/^0+(?=.)/, "") : s;
};

export function isCorrect(q, v) {
  if (v == null || v === "") return false;
  if (q.kind === "mcq") return Number(v) === q.answer;
  if (q.kind === "tf") return v === q.answer;
  if (q.kind === "input") return q.answer.some((a) => normalize(a) === normalize(v));
  if (q.kind === "match") return q.pairs.every((_, i) => v[i] === i);
  return false;
}
export const isAnswered = (q, v) =>
  q.kind === "match" ? !!v && q.pairs.every((_, i) => v[i] != null) : v != null && v !== "";

/* سؤال واحد: اختيار من متعدد، صح وخطأ، إجابة مكتوبة، مزاوجة.
   reveal: بعد التصحيح يُلوَّن الصحيح والخطأ. */
export function Question({ q, value, onChange, reveal = false, seed = "" }) {
  const order = useMemo(() => shuffled(q.kind === "match" ? q.pairs.length : (q.options ?? []).length, `${seed}:${q.q}`),
    [q, seed]);
  const ok = reveal && isCorrect(q, value);
  const tone = (on, right) =>
    reveal && right ? "border-present bg-present/10 text-ink"
      : reveal && on && !right ? "border-absent bg-danger-light text-ink"
        : on ? "border-mint-deep bg-mint-tint text-ink" : "border-line bg-paper text-ink hover:bg-canvas";

  return (
    <div className="space-y-2">
      <p className="font-semibold leading-relaxed text-ink">{q.q}</p>
      {q.kind === "mcq" && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {order.map((k) => (
            <button key={k} type="button" disabled={reveal} onClick={() => onChange(k)}
                    className={`rounded-card border px-3 py-2 text-start text-sm transition-colors ${tone(value === k, k === q.answer)}`}>
              {iso(q.options[k])}
            </button>
          ))}
        </div>
      )}
      {q.kind === "tf" && (
        <div className="flex gap-2">
          {[[true, "صح"], [false, "خطأ"]].map(([v, label]) => (
            <button key={label} type="button" disabled={reveal} onClick={() => onChange(v)}
                    className={`flex-1 rounded-card border px-3 py-2 text-sm font-semibold ${tone(value === v, v === q.answer)}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {q.kind === "input" && (
        <div className="flex items-center gap-2">
          <input dir="ltr" className={`field num max-w-[14rem] text-center text-base ${reveal ? (ok ? "border-present" : "border-absent") : ""}`}
                 value={value ?? ""} disabled={reveal} placeholder="اكتب الإجابة"
                 onChange={(e) => onChange(e.target.value)} />
          {reveal && !ok && <span className="text-sm text-muted">الإجابة: <bdi dir="ltr" className="num font-bold text-present">{q.answer[0]}</bdi></span>}
        </div>
      )}
      {q.kind === "match" && (
        <div className="space-y-1.5">
          {q.pairs.map(([right], i) => {
            const cur = value?.[i];
            const good = reveal && cur === i;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 rounded-card bg-canvas px-3 py-2 text-sm text-ink">{right}</span>
                <select className={`field w-auto max-w-[55%] py-2 text-sm ${reveal ? (good ? "border-present" : "border-absent") : cur != null ? "border-mint-deep bg-mint-tint" : ""}`}
                        disabled={reveal} value={cur ?? ""}
                        onChange={(e) => onChange({ ...(value ?? {}), [i]: e.target.value === "" ? null : Number(e.target.value) })}>
                  <option value="">يقابله…</option>
                  {order.map((k) => <option key={k} value={k}>{iso(q.pairs[k][1])}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
