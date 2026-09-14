import { supabase } from "./supabase";

/**
 * التوقيت الزمني للحصص (صيفي / شتوي)
 * يُقرأ مرة واحدة ويُخزّن مؤقتًا لتفادي تكرار الاستعلام.
 */

let cache = null;        // { season, rows }
let inflight = null;     // وعد الطلب الجاري

export async function loadPeriodTimes() {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data: st } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "active_season")
      .maybeSingle();

    const season = st?.value ?? "summer";

    const { data } = await supabase
      .from("period_times")
      .select("kind, period_no, label, start_time, end_time, sort_order")
      .eq("season", season)
      .order("sort_order");

    cache = { season, rows: data ?? [] };
    inflight = null;
    return cache;
  })();

  return inflight;
}

export function clearPeriodTimesCache() {
  cache = null;
}

/* ---------------- أدوات الوقت ---------------- */

// "07:50:00" → دقائق منذ منتصف الليل
export function toMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

// "07:50:00" → "7:50"
export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  return `${Number(h)}:${m}`;
}

// "7:00 — 7:50"
export function fmtRange(row) {
  if (!row) return "";
  return `${fmtTime(row.start_time)} — ${fmtTime(row.end_time)}`;
}

/* ---------------- استعلامات ---------------- */

// خريطة رقم الحصة → صف التوقيت
export function byPeriodNo(rows) {
  const m = {};
  (rows ?? []).forEach((r) => {
    if (r.kind === "period" && r.period_no != null) m[r.period_no] = r;
  });
  return m;
}

/**
 * الفعالية الجارية الآن (حصة أو فسحة أو اصطفاف).
 * ترجع null خارج الدوام.
 */
export function currentSlot(rows, at = new Date()) {
  const now = nowMinutes(at);
  return (
    (rows ?? []).find((r) => {
      const s = toMinutes(r.start_time);
      const e = toMinutes(r.end_time);
      return s != null && e != null && now >= s && now <= e;
    }) ?? null
  );
}

// رقم الحصة الجارية الآن، أو null
export function currentPeriodNo(rows, at = new Date()) {
  const slot = currentSlot(rows, at);
  return slot && slot.kind === "period" ? slot.period_no : null;
}

/**
 * أقرب حصة لهذه اللحظة — تُستخدم لاختيار الحصة الافتراضية
 * في شاشة التحضير حتى لو كنا في فسحة أو بعد الدوام.
 */
export function nearestPeriodNo(rows, at = new Date()) {
  const now = nowMinutes(at);
  const periods = (rows ?? []).filter(
    (r) => r.kind === "period" && r.period_no != null
  );
  if (!periods.length) return null;

  const inside = periods.find(
    (r) => now >= toMinutes(r.start_time) && now <= toMinutes(r.end_time)
  );
  if (inside) return inside.period_no;

  // أول حصة لم تبدأ بعد
  const upcoming = periods.find((r) => toMinutes(r.start_time) > now);
  if (upcoming) return upcoming.period_no;

  // انتهى الدوام: آخر حصة
  return periods[periods.length - 1].period_no;
}

/* ---------------- التأخر الصباحي ---------------- */

/**
 * هل البصمة متأخرة؟
 * المرجع: بداية الحصة الأولى (أو نهاية الاصطفاف إن وُجد).
 * graceMinutes: مهلة سماح بالدقائق.
 */
export function lateInfo(rows, punchTime, graceMinutes = 0) {
  if (!punchTime) return null;

  const first = (rows ?? []).find(
    (r) => r.kind === "period" && r.period_no === 1
  );
  if (!first) return null;

  const d = new Date(punchTime);
  const punch = d.getHours() * 60 + d.getMinutes();
  const deadline = toMinutes(first.start_time) + graceMinutes;

  return {
    isLate: punch > deadline,
    minutes: Math.max(0, punch - deadline),
    deadline: fmtTime(first.start_time),
  };
}
