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
