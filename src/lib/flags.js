// src/lib/flags.js
/* =====================================================================
   ملصق النموذج — يحدده مرسله ليعرف المستلم أولويته: عاجل، سري، للاطلاع والتوجيه.
   يُحفظ في عمود flag (supabase/flags.sql وguidance_inquiry_1.sql)، ويظهر على
   بطاقة «بانتظار إجرائك» وعناصرها وفي القوائم، والعاجل أولًا.
   ===================================================================== */

export const FLAGS = {
  urgent:       { t: "عاجل",               c: "bg-absent text-white" },
  confidential: { t: "سري",                c: "bg-ink text-white" },
  info:         { t: "للاطلاع والتوجيه",   c: "bg-excused text-white" },
};

// الأشد أولًا
export const FLAG_ORDER = ["urgent", "confidential", "info"];
export const flagRank = (flag) => { const i = FLAG_ORDER.indexOf(flag); return i < 0 ? 9 : i; };

// بداية عنوان الإشعار للعاجل
export const urgentPrefix = (flag) => (flag === "urgent" ? "عاجل: " : "");
