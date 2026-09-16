/**
 * أدوات مشتركة لعرض الجداول الأسبوعية
 * (الجدول المدرسي، الجدول العام، جداول المعلمين، جداول الطلاب)
 */

export const DAY_NAMES = {
  1: "الأحد",
  2: "الاثنين",
  3: "الثلاثاء",
  4: "الأربعاء",
  5: "الخميس",
};

export const DAYS = [1, 2, 3, 4, 5];

/** "07:50:00" → "7:50 ص" */
export function fmtClock(t) {
  if (!t) return "";
  const [hRaw, mRaw] = String(t).split(":");
  const h = Number(hRaw);
  const m = (mRaw ?? "00").padStart(2, "0");
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/**
 * يبني فهرسًا: day_of_week -> period_no -> صف الجدول
 * لسرعة العرض دون بحث خطي متكرر.
 */
export function indexByDayPeriod(rows) {
  const idx = {};
  (rows ?? []).forEach((r) => {
    (idx[r.day_of_week] ??= {})[r.period_no] = r;
  });
  return idx;
}

/** أرقام الحصص الفعلية الموجودة في مجموعة صفوف (لتحديد أعمدة/صفوف الجدول) */
export function periodNumbers(rows) {
  return [...new Set((rows ?? []).map((r) => r.period_no))].sort((a, b) => a - b);
}

/**
 * يبني headerRows + rows جاهزة لدالة printReport لجدول أسبوعي فردي
 * (حصص أعمدة، أيام صفوف).
 */
export function buildWeeklyPrintTable(rows, cellText) {
  const idx = indexByDayPeriod(rows);
  const periods = periodNumbers(rows);

  const headers = ["اليوم", ...periods.map(String)];

  const body = DAYS.map((d) => [
    DAY_NAMES[d],
    ...periods.map((p) => {
      const r = idx[d]?.[p];
      return r ? cellText(r) : "—";
    }),
  ]);

  return { headers, rows: body };
}

/**
 * يبني headerRows + rows جاهزة لجدول شامل مطبوع (يوم واحد لكل قسم).
 */
export function buildMasterPrintSections(entities, rowsByEntity, cellText, entityHeader) {
  const allPeriods = new Set();
  entities.forEach((e) => periodNumbers(rowsByEntity.get(e.id) ?? []).forEach((p) => allPeriods.add(p)));
  const periods = [...allPeriods].sort((a, b) => a - b);

  const headers = [entityHeader, ...periods.map(String)];

  return DAYS.map((d) => ({
    title: DAY_NAMES[d],
    headers,
    rows: entities.map((e) => {
      const idx = indexByDayPeriod(rowsByEntity.get(e.id) ?? []);
      return [e.label, ...periods.map((p) => (idx[d]?.[p] ? cellText(idx[d][p]) : "—"))];
    }),
  }));
}
