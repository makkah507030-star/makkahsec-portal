// src/lib/banners.js
/* =====================================================================
   إعلانات الرئيسية (supabase/home_banners.sql): ثوابت مشتركة بين البطاقات في الرئيسية
   (HomeBanners.jsx) وصفحة إدارتها (pages/banners/BannersAdmin.jsx).
   ===================================================================== */
import { supabase } from "./supabase";

export const BANNER_BUCKET = "home-banners";
export const BANNER_KIND = {
  opportunity: { t: "فرصة",   c: "bg-[#B8912F]" },
  event:       { t: "مناسبة", c: "bg-[#3F6B99]" },
  general:     { t: "إعلان",  c: "bg-mint-deep" },
};
export const AUDIENCE = [["student", "الطلاب"], ["guardian", "أولياء الأمور"], ["staff", "المنسوبون"]];

// صفحات البوابة الجاهزة للرابط (يظهر لكل مستفيد ما يخصه منها)
export const LINK_PAGES = [
  ["/opportunities", "فرص المشاركة"],
  ["/exams", "جداول الاختبارات"],
  ["/my-week", "الجدول الأسبوعي"],
  ["/qudrat", "مركز التدريب"],
  ["/my-documents", "نماذجي"],
  ["/my-circulars", "التعاميم"],
  ["/news", "الأخبار والمقالات"],
];

export const bannerImage = (path) => (path ? supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl : null);
export const isExternal = (link) => /^https?:\/\//i.test(link ?? "");
export const bannersSetupMsg = "إعلانات الرئيسية تحتاج تشغيل supabase/home_banners.sql في Supabase ← SQL Editor.";

// مقاس صورة الإعلان الإلزامي: عرضية 2:1، تُضبط على 1200 × 600 بالضبط قبل الرفع
export const BANNER_W = 1200, BANNER_H = 600;
const imageSize = (file) => new Promise((ok) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { ok({ w: img.width, h: img.height }); URL.revokeObjectURL(url); };
  img.onerror = () => { ok(null); URL.revokeObjectURL(url); };
  img.src = url;
});
// يُقبل ما قارب المقاس (نسبة 1.6 إلى 2.5 وعرض 900 فأكثر) ويُضبط عليه؛ وغيره يُرفض برسالة
export async function checkBanner(file) {
  const s = await imageSize(file);
  if (!s) return "تعذّرت قراءة الصورة؛ اختر صورة JPG أو PNG.";
  const r = s.w / s.h;
  if (r < 1.6 || r > 2.5) return `الصورة ليست بالمقاس المطلوب (عرضها ${s.w} وارتفاعها ${s.h}). صمّمها بعرض ${BANNER_W} وارتفاع ${BANNER_H} بكسل.`;
  if (s.w < 900) return `الصورة صغيرة (عرضها ${s.w} بكسل) فتظهر باهتة. صمّمها بعرض ${BANNER_W} وارتفاع ${BANNER_H} بكسل.`;
  return null;
}
