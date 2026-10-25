// src/pages/achievement/Charts.jsx
/* =====================================================================
   رسوم مركز تحليل النتائج: SVG وHTML خفيفان بلا مكتبات. أعمدة رفيعة بنهايات مستديرة،
   وفجوة 2px بين المقاطع، وخط مرجعي رمادي، وتلميح عند المرور على كل عنصر.
   النصوص بألوان النص دائمًا، واللون للعلامة وحدها.
   ===================================================================== */
import { useState } from "react";
import { BANDS, WEAK } from "../../lib/achievement";

/* تلميح يتبع المؤشر */
export function useTip() {
  const [tip, setTip] = useState(null);
  const bind = (content) => ({
    onMouseMove: (e) => setTip({ x: e.clientX, y: e.clientY, content }),
    onMouseLeave: () => setTip(null),
    onFocus: (e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.top, content }); },
    onBlur: () => setTip(null),
    tabIndex: 0,
  });
  const node = tip && (
    <div className="pointer-events-none fixed z-50 max-w-[260px] rounded-sm2 border border-line bg-white px-3 py-2 text-[12px] leading-relaxed text-ink shadow-card"
         style={{ left: Math.min(tip.x + 12, window.innerWidth - 270), top: tip.y + 14 }}>
      {tip.content}
    </div>
  );
  return [bind, node];
}

export const pctTxt = (v) => (v == null ? "—" : `${v}%`);

/* توزيع التقديرات: شريط 100% بمقاطع الشرائح، ومفتاح بالأعداد */
export function DistStrip({ dist, n }) {
  const [bind, tip] = useTip();
  if (!n) return <p className="text-sm text-muted">لا درجات اختبارات مرصودة.</p>;
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-[4px]">
        {BANDS.map((b) => dist[b.k] > 0 && (
          <div key={b.k} {...bind(<><b>{b.t}</b><br />{dist[b.k]} من {n} ({Math.round((dist[b.k] / n) * 100)}%)</>)}
               className="h-full outline-none" style={{ width: `${(dist[b.k] / n) * 100}%`, background: b.color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {BANDS.map((b) => (
          <span key={b.k} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: b.color }} />
            <span className="text-ink">{b.t}</span>
            <span className="num">{dist[b.k]}</span>
            <span className="num text-faint">({n ? Math.round((dist[b.k] / n) * 100) : 0}%)</span>
          </span>
        ))}
      </div>
      {tip}
    </div>
  );
}

/* أعمدة أفقية: متوسط كل عنصر مع خط مرجعي عند حد الضعف */
export function HBars({ rows, refLine = WEAK, onPick, unit = "%", note }) {
  const [bind, tip] = useTip();
  if (!rows.length) return <p className="text-sm text-muted">لا بيانات.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <button key={r.key} type="button" onClick={onPick ? () => onPick(r) : undefined}
                {...bind(<><b>{r.label}</b><br />المتوسط {r.value}{unit}{r.tip ? <><br />{r.tip}</> : null}</>)}
                className={`grid w-full grid-cols-[minmax(84px,32%)_1fr_auto] items-center gap-2 text-start outline-none ${onPick ? "cursor-pointer" : "cursor-default"}`}>
          <span className="truncate text-[12.5px] text-ink">{r.label}</span>
          <span className="relative h-3.5 rounded-[4px] bg-canvas">
            <span className="absolute inset-y-0 start-0 rounded-e-[4px]"
                  style={{ width: `${Math.max(1, Math.min(100, r.value ?? 0))}%`, background: (r.value ?? 0) < refLine ? "#B4502A" : "#13606B" }} />
            <span className="absolute inset-y-[-3px] w-px bg-faint/70" style={{ insetInlineStart: `${refLine}%` }} />
          </span>
          <span className="num w-12 text-end text-[12px] font-semibold text-ink">{r.value ?? "—"}{r.value != null ? unit : ""}</span>
        </button>
      ))}
      <p className="pt-1 text-[11px] text-faint">{note ?? `الخط الرأسي: حد الضعف ${refLine}% · البرتقالي دونه`}</p>
      {tip}
    </div>
  );
}

/* مدرّج النسب: عدد الدرجات في كل عشر درجات */
export function Histogram({ values }) {
  const [bind, tip] = useTip();
  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, n: 0 }));
  values.forEach((v) => { bins[Math.min(9, Math.floor(v / 10))].n++; });
  const top = Math.max(1, ...bins.map((b) => b.n));
  const H = 140;
  return (
    <div>
      <div className="flex items-end gap-[6px] border-b border-line" style={{ height: H + 18 }}>
        {bins.map((b) => (
          <div key={b.from} className="flex h-full flex-1 flex-col items-center justify-end outline-none"
               {...bind(<><b>{b.from}–{b.to}%</b><br />{b.n} درجة</>)}>
            {b.n > 0 && <span className="num mb-0.5 text-[10.5px] text-muted">{b.n}</span>}
            <div className="w-full max-w-[24px] rounded-t-[4px]"
                 style={{ height: (b.n / top) * H, background: b.from < WEAK ? "#E2A35A" : "#4A97A0" }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[6px]">
        {bins.map((b) => <span key={b.from} className="num flex-1 text-center text-[10px] text-faint">{b.from}</span>)}
      </div>
      {tip}
    </div>
  );
}

/* خريطة حرارية: الفصول × المواد بمتوسط الاختبارات (درجة لون واحدة: الأغمق أعلى) */
const heat = (v) => {
  if (v == null) return { bg: "transparent", fg: "#9AA39E" };
  const t = Math.max(0, Math.min(1, (v - 40) / 60));
  const mix = (a, b) => Math.round(a + (b - a) * t);
  // من #EAF3F4 إلى #0F5560
  const bg = `rgb(${mix(234, 15)}, ${mix(243, 85)}, ${mix(244, 96)})`;
  return { bg, fg: t > 0.55 ? "#fff" : "#16302A" };
};

export function Heat({ rows, cols, get, onPick }) {
  const [bind, tip] = useTip();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate text-[12px]" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky start-0 z-10 bg-white px-2 py-1 text-start font-medium text-muted">الفصل</th>
            {cols.map((c) => <th key={c} className="min-w-[64px] px-1 py-1 text-center text-[11px] font-medium leading-tight text-muted">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="sticky start-0 z-10 whitespace-nowrap bg-white px-2 py-1 font-medium text-ink">{r.label}</td>
              {cols.map((c) => {
                const s = get(r, c);
                const { bg, fg } = heat(s?.avg);
                return (
                  <td key={c} onClick={s && onPick ? () => onPick(r, c) : undefined}
                      {...(s ? bind(<><b>{r.label} · {c}</b><br />متوسط الاختبارات {s.avg}%<br />دون {WEAK}%: {s.weak} من {s.n}</>) : {})}
                      className={`num rounded-[4px] px-1 py-1.5 text-center outline-none ${s && onPick ? "cursor-pointer" : ""}`}
                      style={{ background: bg, color: fg }}>
                    {s?.avg != null ? <>{s.avg}{s.avg < WEAK && <span aria-label="دون حد الضعف"> ▼</span>}</> : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
        <span>40%</span>
        <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(to left, #EAF3F4, #0F5560)" }} />
        <span>100%</span>
        <span className="ms-3">▼ دون {WEAK}%</span>
      </div>
      {tip}
    </div>
  );
}

/* بطاقة رقم */
export function Stat({ label, value, sub, tone }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "bad" ? "text-absent" : "text-ink"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-faint">{sub}</p>}
    </div>
  );
}
