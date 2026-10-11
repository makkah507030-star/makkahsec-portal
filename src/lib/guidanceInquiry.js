// src/lib/guidanceInquiry.js
/* =====================================================================
   استمارة توضيح مستوى الطالب التحصيلي والسلوكي (supabase/guidance_inquiry_1..3.sql).
   المراحل: المعلمون يعبّئون ← الموجه برأيه ← الوكيل برأيه ← الموجه يرسل نسخة لولي الأمر.
   ===================================================================== */

export const LEVELS = [
  { k: "excellent", t: "ممتاز" },
  { k: "good", t: "جيد" },
  { k: "weak", t: "ضعيف" },
];
export const levelLabel = (k) => LEVELS.find((l) => l.k === k)?.t ?? "";

// ملصق الاستمارة يحدده الموجه عند الإرسال، ويظهر في «بانتظار إجرائك» وفي القوائم
export const FLAGS = {
  urgent:       { t: "عاجل",               c: "bg-absent text-white" },
  confidential: { t: "سري",                c: "bg-ink text-white" },
  info:         { t: "للاطلاع والتوجيه",   c: "bg-excused text-white" },
};
// الأشد أولًا: العاجل يتقدّم القوائم
export const FLAG_ORDER = ["urgent", "confidential", "info"];

export const STATUS = {
  teachers:  { t: "عند المعلمين",       c: "bg-warning-light text-warning" },
  deputy:    { t: "عند الوكيل",         c: "bg-excused/10 text-excused" },
  counselor: { t: "عادت للموجه",        c: "bg-mint-light text-mint-deep" },
  sent:      { t: "أُرسلت لولي الأمر",  c: "bg-present/10 text-present" },
};

export const setupMsg = "لم تُفعَّل استمارة المستوى بعد: يلزم تشغيل ملفات supabase/guidance_inquiry_1.sql و2 و3 في Supabase.";
export const isSetupErr = (e) => /guidance_inquir|schema cache|function .* does not exist/i.test(e?.message ?? "");
