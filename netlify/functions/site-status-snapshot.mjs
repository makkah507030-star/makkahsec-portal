// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  Netlify Scheduled Function: site-status-snapshot
//  يحفظ لقطة ملخّص حالة الموقع (أمني + تقني) مرة يوميًا في
//  جدول site_status_snapshots لبناء السجل التاريخي.
//
//  التوقيت: 20:55 UTC = 11:55 مساءً بتوقيت السعودية (نهاية اليوم).
//  المنطق كله في site-metrics.js (buildSnapshot) — مصدر واحد للقواعد.
//  يمكن تشغيلها فورًا من لوحة Netlify: Functions ← site-status-snapshot ← Run now.
// =====================================================================

import siteMetrics from "./site-metrics.js";

export default async () => {
  try {
    const row = await siteMetrics.buildSnapshot(siteMetrics.adminClient(), "scheduled");
    console.log(`[snapshot] ${row.day} → ${row.verdict} (${row.checks.length} فحص)`);
  } catch (e) {
    console.error("[snapshot] فشل الحفظ:", e?.message || e);
  }
};

export const config = { schedule: "55 20 * * *" };
