// src/components/DateField.jsx
import { useMemo, useState } from "react";

/* =====================================================================
   حقل تاريخ مدمج: هجري وميلادي معًا.
   يختار المستخدم من أيّهما شاء فيتحدّث الآخر فورًا، وتُحفظ القيمة نصًّا
   مثل: 12/03/1449هـ الموافق 23/09/2026م

   <DateField value={...} onChange={...} />            تاريخ واحد
   <DateField range value={...} onChange={...} />      من تاريخ إلى تاريخ
   ===================================================================== */

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const pad = (n) => String(n).padStart(2, "0");

/* ميلادي → هجري (أم القرى) */
export function toHijri(date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric", month: "numeric", year: "numeric",
  }).formatToParts(date);
  const g = (t) => Number(String(parts.find((x) => x.type === t)?.value ?? "").replace(/\D/g, ""));
  return { d: g("day"), m: g("month"), y: g("year") };
}

/* هجري → ميلادي: تقدير أولي ثم مسح الأيام المجاورة حتى المطابقة */
export function fromHijri(hy, hm, hd) {
  const approxYear = Math.floor(hy * 0.970224 + 621.5);
  let best = new Date(Date.UTC(approxYear, 0, 1));
  for (let i = -420; i <= 420; i++) {
    const c = new Date(best.getTime() + i * 86400000);
    const h = toHijri(c);
    if (h.y === hy && h.m === hm && h.d === hd) return c;
  }
  return null;
}

export function formatBoth(date) {
  if (!date) return "";
  const h = toHijri(date);
  return `${pad(h.d)}/${pad(h.m)}/${h.y}هـ الموافق ` +
         `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}م`;
}

/* يستخرج التاريخ الميلادي من نص محفوظ سابقًا */
function parseStored(value) {
  const m = String(value ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})م/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
}

function OneDate({ value, onChange, label }) {
  const current = useMemo(() => parseStored(value), [value]);
  const h = current ? toHijri(current) : toHijri(new Date());
  const [hy, setHy] = useState(h.y);

  const setGregorian = (iso) => {
    if (!iso) { onChange(""); return; }
    const [y, m, d] = iso.split("-").map(Number);
    onChange(formatBoth(new Date(Date.UTC(y, m - 1, d))));
  };

  const setHijri = (d, m, y) => {
    const g = fromHijri(y, m, d);
    if (g) onChange(formatBoth(g));
  };

  const isoValue = current
    ? `${current.getUTCFullYear()}-${pad(current.getUTCMonth() + 1)}-${pad(current.getUTCDate())}`
    : "";

  return (
    <div className="rounded-sm2 border border-line p-2">
      {label && <p className="mb-1.5 text-[11px] text-faint">{label}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted">هجري</span>
        <select className="field num w-16" value={current ? h.d : ""}
                onChange={(e) => setHijri(Number(e.target.value), current ? h.m : 1, current ? h.y : hy)}>
          <option value="">يوم</option>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className="field w-28" value={current ? h.m : ""}
                onChange={(e) => setHijri(current ? h.d : 1, Number(e.target.value), current ? h.y : hy)}>
          <option value="">الشهر</option>
          {HIJRI_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <select className="field num w-20" value={current ? h.y : hy}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setHy(y);
                  if (current) setHijri(h.d, h.m, y);
                }}>
          {Array.from({ length: 12 }, (_, i) => h.y - 5 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted">ميلادي</span>
        <input type="date" className="field num" value={isoValue}
               onChange={(e) => setGregorian(e.target.value)} />
      </div>

      {value && <p className="num mt-1.5 text-[11px] text-mint-deep">{value}</p>}
    </div>
  );
}

export default function DateField({ value, onChange, range = false }) {
  if (!range) return <OneDate value={value} onChange={onChange} />;

  // نص المدى: «من … إلى …» — نفصله ونعيد تركيبه
  const [from, to] = String(value ?? "").split(" إلى ");
  const fromVal = (from ?? "").replace(/^من\s*/, "");
  const build = (f, t) =>
    f || t ? `من ${f || "…"} إلى ${t || "…"}` : "";

  return (
    <div className="space-y-1.5">
      <OneDate label="من تاريخ" value={fromVal} onChange={(v) => onChange(build(v, to ?? ""))} />
      <OneDate label="إلى تاريخ" value={to ?? ""} onChange={(v) => onChange(build(fromVal, v))} />
    </div>
  );
}
