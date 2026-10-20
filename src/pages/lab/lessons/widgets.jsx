// src/pages/lab/lessons/widgets.jsx
// أدوات التدريب العملي. كل أداة تصف: نص المهمة، ومكان الإجابة، والتحقق، والتلميح،
// والحل — ويتولى PracticeStation العدّ والتصحيح الفوري ونسبة الإتقان.
// الأدوات: التحويل، والبتات، وASCII، والألوان، وجدول الحقيقة، والترتيب، والتصنيف.
import { normalize, shuffled } from "./parts.jsx";

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

/* صفوف جدول الحقيقة بترتيب الكتاب: 0 0، 0 1، 1 0، 1 1 */
const truthRows = (n) => Array.from({ length: 2 ** n }, (_, r) => [...r.toString(2).padStart(n, "0")].map(Number));

/* ترتيب العناصر: يُعرض مخلوطًا خلطًا ثابتًا لا يبقى على الترتيب الصحيح */
const poolOrder = (t) => {
  const idx = shuffled(t.items.length, t.prompt ?? t.items.join("|"));
  return idx.every((x, k) => x === k) ? [...idx.slice(1), idx[0]] : idx;
};
const okCats = (item) => [].concat(item[1]);

Object.assign(WIDGETS, {
  /* جدول الحقيقة: { prompt, inputs: ["A","B"], outputs: [{ name, out: [0,1,…] }], hint?: [] } */
  truth: {
    prompt: (t) => t.prompt,
    initial: (t) => t.outputs.map(() => truthRows(t.inputs.length).map(() => null)),
    Input: ({ task, value, setValue, disabled }) => {
      const rows = truthRows(task.inputs.length);
      const flip = (o, r) => setValue(value.map((col, k) => (k !== o ? col : col.map((v, j) => (j !== r ? v : v === 1 ? 0 : 1)))));
      return (
        <div className="overflow-x-auto" dir="ltr">
          <table className="mx-auto border-collapse text-center text-base">
            <thead>
              <tr>
                {task.inputs.map((x) => <th key={x} className="num border border-line bg-canvas px-4 py-1.5">{x}</th>)}
                {task.outputs.map((o) => <th key={o.name} className="num border border-line bg-mint-tint px-4 py-1.5 text-mint-deep">{o.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, j) => (
                <tr key={j}>
                  {r.map((v, i) => <td key={i} className="num border border-line px-4 py-1.5 text-ink">{v}</td>)}
                  {task.outputs.map((o, k) => (
                    <td key={o.name} className="border border-line p-1">
                      <button type="button" disabled={disabled} onClick={() => flip(k, j)}
                              className={`num h-9 w-12 rounded-sm2 border text-lg font-bold ${value[k][j] == null
                                ? "border-dashed border-line text-faint" : "border-mint-deep bg-mint-tint text-mint-deep"}`}>
                        {value[k][j] ?? "?"}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-center text-[11px] text-muted" dir="rtl">اضغط الخانة لتبديلها بين 0 و1</p>
        </div>
      );
    },
    check: (t, v) => t.outputs.every((o, k) => o.out.every((x, j) => v[k][j] === x)),
    hint: (t) => t.hint ?? [],
    solve: (t) => t.outputs.map((o) => [...o.out]),
  },

  /* الترتيب: { prompt, items: [بالترتيب الصحيح], hint?: [] } — القيمة: أرقام العناصر بترتيب اختيارها */
  sequence: {
    prompt: (t) => t.prompt,
    initial: () => [],
    Input: ({ task, value, setValue, disabled }) => {
      const pool = poolOrder(task).filter((i) => !value.includes(i));
      return (
        <div className="space-y-3">
          <ol className="space-y-1.5">
            {value.map((i, k) => (
              <li key={i}>
                <button type="button" disabled={disabled} onClick={() => setValue(value.filter((x) => x !== i))}
                        className="flex w-full items-center gap-2 rounded-card border border-mint-deep bg-mint-tint px-3 py-2 text-start text-sm text-ink">
                  <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-deep text-xs font-bold text-white">{k + 1}</span>
                  <span className="flex-1">{task.items[i]}</span>
                  {!disabled && <span className="text-xs text-muted">✕</span>}
                </button>
              </li>
            ))}
            {value.length < task.items.length && (
              <li className="rounded-card border border-dashed border-line px-3 py-2 text-center text-xs text-faint">
                اختر العنصر رقم {value.length + 1} من القائمة
              </li>
            )}
          </ol>
          {pool.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pool.map((i) => (
                <button key={i} type="button" disabled={disabled} onClick={() => setValue([...value, i])}
                        className="rounded-pill border border-line bg-paper px-3 py-1.5 text-sm text-ink hover:bg-canvas">
                  {task.items[i]}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    },
    check: (t, v) => v.length === t.items.length && v.every((x, k) => x === k),
    hint: (t) => t.hint ?? [`يبدأ الترتيب بـ«${t.items[0]}»، ثم «${t.items[1]}».`],
    solve: (t) => t.items.map((_, k) => k),
  },

  /* التصنيف: { prompt, cats: [...], items: [[الاسم, رقم الفئة أو [أرقام مقبولة]]], hint?: [] } */
  classify: {
    prompt: (t) => t.prompt,
    initial: () => ({}),
    Input: ({ task, value, setValue, disabled }) => (
      <div className="space-y-1.5">
        {task.items.map(([name], i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-card border border-line/70 px-3 py-2">
            <span className="min-w-[8rem] flex-1 text-sm font-semibold text-ink">{name}</span>
            {task.cats.map((c, k) => (
              <button key={k} type="button" disabled={disabled} onClick={() => setValue({ ...value, [i]: k })}
                      className={`rounded-pill border px-2.5 py-1 text-xs transition-colors ${value[i] === k
                        ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-muted hover:bg-canvas"}`}>
                {c}
              </button>
            ))}
          </div>
        ))}
      </div>
    ),
    check: (t, v) => t.items.every((item, i) => okCats(item).includes(v[i])),
    hint: (t) => t.hint ?? [],
    solve: (t) => Object.fromEntries(t.items.map((item, i) => [i, okCats(item)[0]])),
  },
});
