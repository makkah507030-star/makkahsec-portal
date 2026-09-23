// src/components/DateField.jsx
import { useMemo, useState } from "react";

/* =====================================================================
   حقول التاريخ والوقت — تصميم مضغوط في صف واحد.

   <DateField value onChange />              تاريخ واحد: هجري + ميلادي
   <DateField range value onChange />        من تاريخ إلى تاريخ
   <TimeField value onChange />              وقت واحد
   <TimeField range value onChange />        من الساعة إلى الساعة
   ===================================================================== */

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const pad = (n) => String(n).padStart(2, "0");

export function toHijri(date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric", month: "numeric", year: "numeric",
  }).formatToParts(date);
  const g = (t) => Number(String(parts.find((x) => x.type === t)?.value ?? "").replace(/\D/g, ""));
  return { d: g("day"), m: g("month"), y: g("year") };
}

export function fromHijri(hy, hm, hd) {
  const approxYear = Math.floor(hy * 0.970224 + 621.5);
  const base = new Date(Date.UTC(approxYear, 0, 1));
  for (let i = -420; i <= 420; i++) {
    const c = new Date(base.getTime() + i * 86400000);
    const h = toHijri(c);
    if (h.y === hy && h.m === hm && h.d === hd) return c;
  }
  return null;
}

export function formatBoth(date) {
  if (!date) return "";
  const h = toHijri(date);
  return `${pad(h.d)}/${pad(h.m)}/${h.y}هـ (${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}م)`;
}

function parseStored(value) {
  const m = String(value ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})م/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
}

const selCls =
  "h-9 min-w-0 rounded-sm2 border border-line bg-white px-1.5 text-[13px] text-ink focus:border-mint-deep focus:outline-none";

function OneDate({ value, onChange, label }) {
  const current = useMemo(() => parseStored(value), [value]);
  const today = toHijri(new Date());
  const h = current ? toHijri(current) : { d: "", m: "", y: today.y };
  const [year, setYear] = useState(h.y || today.y);
  const [greg, setGreg] = useState(false);

  const applyHijri = (d, m, y) => {
    if (!d || !m || !y) return;
    const g = fromHijri(Number(y), Number(m), Number(d));
    if (g) onChange(formatBoth(g));
  };

  const iso = current
    ? `${current.getUTCFullYear()}-${pad(current.getUTCMonth() + 1)}-${pad(current.getUTCDate())}`
    : "";

  return (
    <div className="flex items-start gap-2">
      {label && (
        <span className="mt-2 w-8 shrink-0 text-[12px] font-medium text-muted">{label}</span>
      )}

      <div className="min-w-0 flex-1">
        {/* صف واحد: يوم · شهر · سنة — بعرض متناسب لا يلتف */}
        <div className="grid grid-cols-[1fr_1.6fr_1.1fr] gap-1">
          <select className={`${selCls} num`} value={h.d || ""}
                  onChange={(e) => applyHijri(e.target.value, h.m || 1, h.y || year)}>
            <option value="">يوم</option>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select className={selCls} value={h.m || ""}
                  onChange={(e) => applyHijri(h.d || 1, e.target.value, h.y || year)}>
            <option value="">الشهر</option>
            {HIJRI_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>

          <select className={`${selCls} num`} value={h.y || year}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    if (h.d && h.m) applyHijri(h.d, h.m, e.target.value);
                  }}>
            {Array.from({ length: 12 }, (_, i) => today.y - 5 + i).map((y) => (
              <option key={y} value={y}>{y}هـ</option>
            ))}
          </select>
        </div>

        {/* الميلادي اختياري — يظهر بضغطة فلا يزحم الصندوق */}
        {greg || iso ? (
          <input type="date" className={`${selCls} num mt-1 w-full`} value={iso}
                 onChange={(e) => {
                   if (!e.target.value) { onChange(""); return; }
                   const [y, m, d] = e.target.value.split("-").map(Number);
                   onChange(formatBoth(new Date(Date.UTC(y, m - 1, d))));
                 }} />
        ) : (
          <button type="button" onClick={() => setGreg(true)}
                  className="mt-1 text-[11px] font-medium text-mint-deep hover:underline">
            أو اختر بالميلادي
          </button>
        )}
      </div>
    </div>
  );
}

/* عدد الأيام بين طرفي المدى، شاملًا اليومين */
export function rangeDays(value) {
  const parts = String(value ?? "").split(" إلى ");
  if (parts.length < 2) return null;
  const a = parseStored(parts[0]);
  const b = parseStored(parts[1]);
  if (!a || !b) return null;
  const n = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return n > 0 ? n : null;
}

export default function DateField({ value, onChange, range = false }) {
  if (!range) {
    return (
      <div className="rounded-sm2 border border-line bg-canvas/40 p-2">
        <OneDate value={value} onChange={onChange} />
        {value && <p className="num mt-1.5 text-[11px] leading-relaxed text-mint-deep">{value}</p>}
      </div>
    );
  }

  const [from, to] = String(value ?? "").split(" إلى ");
  const fromVal = (from ?? "").replace(/^من\s*/, "");
  const toVal = to ?? "";
  const build = (f, t) => (f || t ? `من ${f || "…"} إلى ${t || "…"}` : "");

  return (
    <div className="space-y-2 rounded-sm2 border border-line bg-canvas/40 p-2">
      <OneDate label="من" value={fromVal} onChange={(v) => onChange(build(v, toVal))} />
      <div className="h-px bg-line" />
      <OneDate label="إلى" value={toVal} onChange={(v) => onChange(build(fromVal, v))} />
      {value && <p className="num text-[11px] leading-relaxed text-mint-deep">{value}</p>}
      {rangeDays(value) && (
        <p className="rounded-sm2 bg-mint-tint px-2.5 py-1.5 text-[12px] font-semibold text-mint-deep">
          المدة: <span className="num">{rangeDays(value)}</span> يومًا
        </p>
      )}
    </div>
  );
}

/* ----------------------------- الوقت ----------------------------- */

const to12 = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "صباحًا" : "مساءً";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${period}`;
};

const parseTime = (label) => {
  const m = String(label ?? "").match(/(\d{1,2}):(\d{2})\s*(صباحًا|مساءً)/);
  if (!m) return "";
  let h = Number(m[1]) % 12;
  if (m[3] === "مساءً") h += 12;
  return `${pad(h)}:${m[2]}`;
};

function OneTime({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-8 shrink-0 text-[12px] font-medium text-muted">{label}</span>}
      <input type="time" className={`${selCls} num flex-1`} value={parseTime(value)}
             onChange={(e) => onChange(to12(e.target.value))} />
      {value && <span className="num shrink-0 text-[12px] text-mint-deep">{value}</span>}
    </div>
  );
}

export function TimeField({ value, onChange, range = false }) {
  if (!range) {
    return (
      <div className="rounded-sm2 border border-line bg-canvas/40 p-2">
        <OneTime value={value} onChange={onChange} />
      </div>
    );
  }

  const [from, to] = String(value ?? "").split(" إلى ");
  const fromVal = (from ?? "").replace(/^من\s*/, "");
  const toVal = to ?? "";
  const build = (f, t) => (f || t ? `من ${f || "…"} إلى ${t || "…"}` : "");

  return (
    <div className="space-y-1.5 rounded-sm2 border border-line bg-canvas/40 p-2">
      <OneTime label="من" value={fromVal} onChange={(v) => onChange(build(v, toVal))} />
      <OneTime label="إلى" value={toVal} onChange={(v) => onChange(build(fromVal, v))} />
    </div>
  );
}
