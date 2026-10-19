// src/pages/lab/lessons/widgets.jsx
// أدوات التدريب العملي. كل أداة تصف: نص المهمة، ومكان الإجابة، والتحقق، والتلميح،
// والحل — ويتولى PracticeStation العدّ والتصحيح الفوري ونسبة الإتقان.
import { normalize } from "./parts.jsx";

const BASE_NAME = { 2: "الثنائي", 10: "العشري", 16: "الستة عشري" };
const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];
const toBase = (n, b) => n.toString(b).toUpperCase();
// معادلة بأرقام داخل جملة عربية: تُعزل باتجاه LTR فلا تختلط أرقامها بما حولها
const eq = (s) => `\u2066${s}\u2069`;

/* خطوات التحويل للتلميح، محسوبة من المهمة نفسها */
function convertSteps(t) {
  const n = parseInt(t.value, t.from);
  if (t.from === 10) {
    const lines = [];
    let x = n;
    do { lines.push(`${eq(`${x} ÷ ${t.to} = ${Math.floor(x / t.to)}`)}، والباقي ${eq(toBase(x % t.to, t.to))}`); x = Math.floor(x / t.to); } while (x > 0);
    return [...lines, `نقرأ البواقي من الأسفل إلى الأعلى: ${toBase(n, t.to)}`];
  }
  if (t.from === 2 && t.to === 16) {
    const bits = t.value.padStart(Math.ceil(t.value.length / 4) * 4, "0").match(/.{4}/g);
    return [`نقسم البتات أربعًا أربعًا: ${eq(bits.join(" "))}`, `كل مجموعة رمز: ${eq(bits.map((b) => toBase(parseInt(b, 2), 16)).join(" "))}`];
  }
  if (t.from === 16 && t.to === 2) {
    return [...t.value.toUpperCase()].map((d) => eq(`${d} = ${parseInt(d, 16).toString(2).padStart(4, "0")}`));
  }
  // إلى العشري: مجموع (الرمز × قيمة الخانة)
  const digits = [...t.value.toUpperCase()];
  const terms = digits.map((d, i) => [parseInt(d, t.from), t.from ** (digits.length - 1 - i)]).filter(([d]) => d);
  return [eq(terms.map(([d, p]) => `${d}×${p}`).join(" + ") + ` = ${n}`)];
}

export const WIDGETS = {
  /* التحويل بين الأنظمة: { value, from, to } */
  convert: {
    prompt: (t) => <>حوّل <bdi dir="ltr" className="num font-bold text-mint-deep">{t.value}</bdi> من {BASE_NAME[t.from]} إلى {BASE_NAME[t.to]}</>,
    initial: () => "",
    Input: ({ value, setValue, disabled }) => (
      <input dir="ltr" autoFocus className="field num max-w-[16rem] text-center text-lg tracking-widest" value={value} disabled={disabled}
             placeholder="الناتج" onChange={(e) => setValue(e.target.value)} />
    ),
    check: (t, v) => normalize(v) === toBase(parseInt(t.value, t.from), t.to),
    hint: (t) => convertSteps(t),
    solve: (t) => toBase(parseInt(t.value, t.from), t.to),
  },

  /* تكوين عدد بالبتات: { target } */
  bits: {
    prompt: (t) => <>كوّن العدد <bdi className="num font-bold text-mint-deep">{t.target}</bdi> بالبتات الثمانية</>,
    initial: () => [0, 0, 0, 0, 0, 0, 0, 0],
    Input: ({ value, setValue, disabled }) => {
      const sum = value.reduce((s, b, i) => s + b * PLACES[i], 0);
      return (
        <div className="space-y-2" dir="ltr">
          <div className="grid grid-cols-8 gap-1 sm:gap-2">
            {PLACES.map((p, i) => (
              <button key={p} type="button" disabled={disabled}
                      onClick={() => setValue(value.map((b, k) => (k === i ? 1 - b : b)))}
                      className={`flex flex-col items-center rounded-sm2 border py-2 transition-colors ${
                        value[i] ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-ink hover:bg-canvas"}`}>
                <span className="num text-xl font-bold">{value[i]}</span>
                <span className={`num text-[10px] ${value[i] ? "text-white/80" : "text-muted"}`}>{p}</span>
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted" dir="rtl">المجموع الآن: <bdi className="num font-bold text-ink">{sum}</bdi></p>
        </div>
      );
    },
    check: (t, v) => v.reduce((s, b, i) => s + b * PLACES[i], 0) === t.target,
    hint: (t) => [`ابدأ من أكبر قيمة لا تتجاوز ${t.target}، ثم أكمل الباقي بالقيم الأصغر.`,
      eq(`${t.target} = ${PLACES.filter((p, i) => (t.target >> (7 - i)) & 1).join(" + ") || 0}`)],
    solve: (t) => PLACES.map((_, i) => (t.target >> (7 - i)) & 1),
  },

  /* ترميز ASCII: { char } ← الرقم، أو { code } ← الحرف */
  ascii: {
    prompt: (t) => (t.char != null
      ? <>ما رمز ASCII للحرف <bdi dir="ltr" className="num rounded bg-canvas px-2 font-bold text-mint-deep">{t.char}</bdi>؟</>
      : <>أي حرف رمزه في ASCII هو <bdi className="num font-bold text-mint-deep">{t.code}</bdi>؟</>),
    initial: () => "",
    Input: ({ value, setValue, disabled }) => (
      <input dir="ltr" autoFocus className="field num max-w-[10rem] text-center text-lg" value={value} disabled={disabled} maxLength={4}
             placeholder="الإجابة" onChange={(e) => setValue(e.target.value)} />
    ),
    check: (t, v) => (t.char != null ? normalize(v) === String(t.char.charCodeAt(0)) : String(v).trim() === String.fromCharCode(t.code)),
    hint: (t) => ["A = 65 ثم B = 66 وهكذا · a = 97 ثم b = 98 · 0 = 48 ثم 1 = 49",
      t.char != null ? `عُدّ من أول المجموعة حتى ${t.char}` : `${t.code} يقع بعد ${t.code >= 97 ? "a = 97" : t.code >= 65 ? "A = 65" : "0 = 48"}`],
    solve: (t) => (t.char != null ? String(t.char.charCodeAt(0)) : String.fromCharCode(t.code)),
  },

  /* مزج الألوان: { name, rgb: [r, g, b] } — مقبول بفارق 24 لكل لون */
  rgb: {
    prompt: (t) => <>كوّن اللون <b className="text-ink">{t.name}</b></>,
    initial: () => [0, 0, 0],
    Input: ({ value, setValue, disabled, task }) => (
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-2" dir="ltr">
          {[["R", "accent-[#d33]"], ["G", "accent-[#2a2]"], ["B", "accent-[#36c]"]].map(([c, accent], i) => (
            <label key={c} className="flex items-center gap-2">
              <span className="num w-4 font-bold text-ink">{c}</span>
              <input type="range" min={0} max={255} value={value[i]} disabled={disabled} className={`flex-1 ${accent}`}
                     onChange={(e) => setValue(value.map((x, k) => (k === i ? Number(e.target.value) : x)))} />
              <span className="num w-9 text-end text-sm text-ink">{value[i]}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-[11px] text-muted">
          <div><div className="mb-1 h-16 rounded-sm2 border border-line" style={{ background: `rgb(${task.rgb.join(",")})` }} />المطلوب</div>
          <div><div className="mb-1 h-16 rounded-sm2 border border-line" style={{ background: `rgb(${value.join(",")})` }} />لونك</div>
        </div>
      </div>
    ),
    check: (t, v) => v.every((x, i) => Math.abs(x - t.rgb[i]) <= 24),
    hint: (t) => [`الألوان الأساسية تمزج بالضوء: الأحمر والأخضر معًا يعطيان الأصفر، والأحمر والأزرق يعطيان الأرجواني.`,
      `القيم المطلوبة تقريبًا: R ${t.rgb[0]} · G ${t.rgb[1]} · B ${t.rgb[2]}`],
    solve: (t) => [...t.rgb],
  },
};
