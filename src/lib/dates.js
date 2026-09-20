/**
 * تنسيق موحّد للتواريخ والأوقات في كل النظام.
 * الأرقام لاتينية (إنجليزية) في كل الصيغ.
 *
 *   الميلادي : 14/09/2026
 *   الهجري   : 1448/03/03هـ
 *   المدموج  : 14/09/2026 · 1448/03/03هـ
 *   الوقت    : 7:12 ص
 *
 * ملاحظة مهمة (اتجاه النص - Bidi):
 * أي تاريخ (هجري أو ميلادي مع حرفه اللاحق هـ/م) يُعرض بجانب نص عربي آخر
 * في نفس السطر يجب أن يُغلَّف بمكوّن <BidiDate> (من
 * "../components/BidiDate.jsx"). بدون هذا يقوم المتصفح بنقل الحرف
 * اللاحق إلى بداية الرقم بدل نهايته — تم التأكد من الحل فعليًا بمتصفح
 * Chromium بعد تجربة أكثر من 15 طريقة. مثال:
 *
 *   import BidiDate from "../components/BidiDate.jsx";
 *   import { fmtHijri, fmtGreg } from "../lib/dates";
 *   ...
 *   الأحد الموافق <BidiDate value={fmtHijri(date, false)} suffix="هـ" />
 *   <BidiDate value={fmtGreg(date)} suffix="م" />
 *
 * (لا حاجة لهذا في سطر مستقل لا يوجد قبله نص عربي — كما في القوائم.)
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

// 1448/03/03هـ
export function fmtHijri(v, withSuffix = true) {
  const d = toDate(v);
  if (!d) return "";

  const parts = hijriFmt.formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year").replace(/\D/g, "");
  const m = get("month").padStart(2, "0");
  const day = get("day").padStart(2, "0");

  return `${y}/${m}/${day}${withSuffix ? "هـ" : ""}`;
}

/* ---------------- المدموج ---------------- */

// 14/09/2026 · 1448/03/03هـ
export function fmtBoth(v) {
  const d = toDate(v);
  if (!d) return "";
  return `${fmtGreg(d)} · ${fmtHijri(d)}`;
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

// 14/09/2026 · 7:12 ص
export function fmtDateTime(v) {
  const d = toDate(v);
  if (!d) return "";
  return `${fmtGreg(d)} · ${fmtTime12(d)}`;
}
