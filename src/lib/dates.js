/**
 * تنسيق موحّد للتواريخ والأوقات في كل النظام.
 * الأرقام لاتينية (إنجليزية)، ولا يُلحق بالتاريخ حرف «هـ» ولا «م».
 *
 *   التاريخ (المعتمد في كل البوابة): 03/03/1448 - 14/09/2026   (الهجري ثم الميلادي)
 *   الهجري وحده  : 03/03/1448
 *   الميلادي وحده: 14/09/2026
 *   الوقت        : 7:12 ص
 *
 * اتجاه النص (Bidi): fmtDate يغلّف كل تاريخ بعلامتي عزل (LRI…PDI) والسطر كله
 * بعلامة عزل يمينية (RLI…PDI)، فيظهر الهجري يمينًا والميلادي يسارًا أينما وُضع:
 * داخل نص عربي، أو داخل عنصر .num الاتجاه، أو في سطر مستقل — جُرّب في Chromium.
 */

const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/* ---------------- الميلادي ---------------- */

const TZ = "Asia/Riyadh";

const gregFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

// 14/09/2026
export function fmtGreg(v) {
  const d = toDate(v);
  return d ? gregFmt.format(d) : "";
}

/* ---------------- الهجري ---------------- */

const hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

// 03/03/1448 (المعامل الثاني بقي للتوافق ولا أثر له — لا يُلحق «هـ»)
export function fmtHijri(v) {
  const d = toDate(v);
  if (!d) return "";

  const parts = hijriFmt.formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year").replace(/\D/g, "");
  const m = get("month").padStart(2, "0");
  const day = get("day").padStart(2, "0");

  return `${day}/${m}/${y}`;
}

/* ---------------- التاريخ المعتمد (الهجري - الميلادي) ---------------- */

const LRI = "\u2066", RLI = "\u2067", PDI = "\u2069";

/** يحذف علامات العزل — لما يُصدَّر إلى Excel أو يُقارن نصًا */
export const stripBidi = (s) => String(s ?? "").replace(/[\u2066-\u2069]/g, "");

// 03/03/1448 - 14/09/2026
export function fmtDate(v) {
  const d = toDate(v);
  if (!d) return "";
  return `${RLI}${LRI}${fmtHijri(d)}${PDI} - ${LRI}${fmtGreg(d)}${PDI}${PDI}`;
}

// اسم قديم بقي للتوافق
export const fmtBoth = fmtDate;

/** يحذف «هـ» و«م» الملحقتين بالسنوات والتواريخ في نصوص محفوظة مسبقًا
 *  (مثل «1448 - 1449 هـ»)، ويقلب الهجري المكتوب سنة/شهر/يوم إلى يوم/شهر/سنة. */
export function noEra(s) {
  if (s == null) return s;
  return String(s)
    .replace(/(\d)\s*هـ?(?![\u0621-\u064A])/g, "$1")
    .replace(/(\d{4})\s*م(?![\u0621-\u064A])/g, "$1")
    .replace(/\b(1[34]\d\d)\/(\d{1,2})\/(\d{1,2})\b/g, (_, y, m, d) => `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`)
    .trim();
}

/* ---------------- الوقت ---------------- */

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
});

// 7:12 ص
export function fmtTime12(v) {
  const d = toDate(v);
  if (!d) return "";
  return timeFmt
    .format(d)
    .replace(/\s*AM$/i, " ص")
    .replace(/\s*PM$/i, " م");
}

// "07:50:00" (نص وقت بلا تاريخ) → "7:50 ص"
export function fmtClock(t) {
  if (!t) return "";
  const [hRaw, mRaw] = String(t).split(":");
  const h = Number(hRaw);
  const m = (mRaw ?? "00").padStart(2, "0");
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

// "7:00 ص — 7:50 ص"
export function fmtClockRange(row) {
  if (!row) return "";
  return `${fmtClock(row.start_time)} — ${fmtClock(row.end_time)}`;
}

/* ---------------- التاريخ والوقت معًا ---------------- */

// 03/03/1448 - 14/09/2026 · 7:12 ص
export function fmtDateTime(v) {
  const d = toDate(v);
  if (!d) return "";
  return `${RLI}${fmtDate(d)} · ${fmtTime12(d)}${PDI}`;
}
