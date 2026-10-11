// src/lib/bootTrace.js
/* =====================================================================
   تتبّع خطوات فتح البوابة — لتشخيص «الاتصال أبطأ من المعتاد» في شاشة الفتح:
   كل خطوة تُسجَّل ببدايتها ونهايتها، وشاشة التحميل تعرض الخطوة العالقة
   ومدة انتظارها، ويُطبع ملخص الأزمنة في وحدة التحكم (Console) بعد الفتح.
   ===================================================================== */

const steps = [];   // [{ name, start, end }]

export async function traced(name, promise) {
  const s = { name, start: performance.now(), end: null };
  steps.push(s);
  try { return await promise; }
  finally { s.end = performance.now(); }
}

// أقدم خطوة لم تنتهِ بعد: { name, secs } أو null
export function pendingStep() {
  const s = steps.find((x) => x.end == null);
  return s ? { name: s.name, secs: Math.round((performance.now() - s.start) / 1000) } : null;
}

export function bootSummary() {
  return steps.map((x) => `${x.name}: ${x.end == null ? "لم تنتهِ" : `${Math.round(x.end - x.start)} ms`}`).join(" · ");
}
