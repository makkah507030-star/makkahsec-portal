// src/lib/globe.js
/* =====================================================================
   برنامج جلوب البيئي العالمي: مجالاته الأربعة وبروتوكولات الرصد في كل
   مجال، وأنواع برامج خطته. تستعملها صفحة البرنامج (pages/globe) وبطاقته
   في الاستوديو (studio/templates.js).
   ===================================================================== */

// ميادين البحث الخمسة في برنامج GLOBE (نشرة البرنامج بالعربية)، و short اسمها المختصر في البطاقة
export const GLOBE_SPHERES = [
  { k: "all", t: "كل المجالات", short: "الكل", color: "#D9B45A" },
  { k: "atmo", t: "الجو والمناخ", short: "الجو", color: "#5BB8E8" },
  { k: "hydro", t: "الماء", short: "الماء", color: "#2F7FD6" },
  { k: "pedo", t: "التربة", short: "التربة", color: "#B8794A" },
  { k: "bio", t: "سطح الأرض والأحياء", short: "الأحياء", color: "#4CAF6A" },
  { k: "pheno", t: "الفينولوجيا", short: "الفينولوجيا", color: "#C76B98" },
];
export const sphereOf = (k) => GLOBE_SPHERES.find((s) => s.k === k) ?? GLOBE_SPHERES[0];

// صفات الطالب في فريق البرنامج (globe_members.role، supabase/globe_3.sql) يختارها المشرف،
// وهي نفسها في بطاقته بالاستوديو؛ بترتيب الهيكل من الأعلى
export const GLOBE_MEMBER_ROLES = [
  { k: "lead", t: "مشرف عام" },
  { k: "deputy", t: "نائب المشرف العام" },
  { k: "monitor", t: "مشرف رصد" },
  { k: "member", t: "عضو" },
];
export const memberRole = (k) => GLOBE_MEMBER_ROLES.find((r) => r.k === k) ?? GLOBE_MEMBER_ROLES[3];
export const GLOBE_ROLES = GLOBE_MEMBER_ROLES.map((r) => r.t);

// بروتوكولات الرصد العشرة المعتمدة في البرنامج، موزعة على مجالاتها
export const GLOBE_PROTOCOLS = {
  atmo: ["الغيوم", "التحضير", "الغلاف الجوي اليومي", "الغلاف الجوي الأسبوعي"],
  hydro: ["الماء"],
  pedo: ["تسلل التربة", "درجة حرارة التربة", "رطوبة التربة ووزنها"],
  bio: ["الغطاء الأرضي", "الحدائق"],
  pheno: [],
};
export const ALL_PROTOCOLS = Object.values(GLOBE_PROTOCOLS).flat();

// مصدر الأوسمة: لوحة شرف العلوم في GLOBE لمدرستنا
export const HONOR_ROLL_URL = "https://www.globe.gov/globe-data/science-honor-roll/honor-roll-recognition?organizationId=14608";
export const YT_ID = (url) => String(url ?? "").match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)?.[1] ?? null;

// أنواع برامج الخطة
export const GLOBE_KIND = { awareness: "توعوي", training: "تدريبي", field: "ميداني", research: "بحثي" };
export const GLOBE_PRESETS = [
  ["التعريف ببرنامج جلوب للطلاب الجدد", "awareness"],
  ["تدريب الطلاب على بروتوكولات الرصد", "training"],
  ["تدريب على تطبيق GLOBE Observer ورفع البيانات", "training"],
  ["رحلة رصد ميدانية", "field"],
  ["اليوم العالمي للبيئة", "awareness"],
  ["يوم الأرض", "awareness"],
  ["مشروع بحثي بيئي للمسابقات", "research"],
  ["عرض نتائج الرصد في معرض المدرسة", "research"],
];

export const GLOBE_BUCKET = "globe-files";
