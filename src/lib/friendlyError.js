// src/lib/friendlyError.js
// =====================================================================
//  رسائل الخطأ بلغة يفهمها المستخدم: أخطاء قاعدة البيانات والشبكة والجلسة (بالإنجليزية)
//  تصير جملة عربية تقول ماذا حدث وماذا يفعل. ورسائل الإعداد («نفّذ supabase/….sql»)
//  يراها الدعم الفني ومدير المدرسة كما هي ليعرفوا الملف، ويرى غيرهما «قيد التفعيل».
//  الرسائل العربية التي يكتبها الخادم (raise exception) تبقى كما هي.
//  تمر بها كل رسالة خطأ في notify() وuseNotice، ومواضع العرض المباشر لـ error.message.
// =====================================================================

let technical = false;   // الدعم الفني ومدير المدرسة: يرون تفاصيل الإعداد (يضبطها session.jsx)
export const setTechnicalAudience = (v) => { technical = !!v; };

const SETUP = "هذه الخاصية قيد التفعيل في البوابة. أبلغ الدعم الفني إن احتجتها الآن.";

// [النمط، الرسالة] بالترتيب: الأدق أولًا
const RULES = [
  [/JWT expired|invalid JWT|refresh token|session (?:not found|expired)|Auth session missing/i,
    "انتهت جلستك. سجّل الدخول من جديد ثم أعد المحاولة."],
  [/Failed to fetch|NetworkError|Load failed|network request failed|ERR_INTERNET|ECONNRESET|fetch failed/i,
    "تعذّر الاتصال بالبوابة. تحقق من الإنترنت ثم أعد المحاولة."],
  [/timeout|canceling statement|504|Gateway/i, "استغرق الطلب وقتًا أطول من المعتاد. أعد المحاولة بعد قليل."],
  [/row-level security|permission denied|not authorized|insufficient_privilege|42501|403/i,
    "لا تملك صلاحية هذا الإجراء. إن كنت تحتاجها فتواصل مع الدعم الفني."],
  [/duplicate key|already exists|23505|unique constraint/i, "هذا السجل موجود من قبل، فلا يُضاف مرة أخرى."],
  [/foreign key|23503/i, "لا يمكن تنفيذ الإجراء لأن السجل مرتبط ببيانات أخرى في البوابة."],
  [/not-null|null value in column|23502/i, "بعض الحقول المطلوبة فارغة. أكملها ثم أعد المحاولة."],
  [/check constraint|23514|invalid input (?:syntax|value)|22P02|out of range/i, "إحدى القيم المدخلة غير مقبولة. راجع الحقول ثم أعد المحاولة."],
  [/Payload too large|exceeded the maximum|too large|413/i, "حجم الملف أكبر من المسموح. صغّره ثم أعد الرفع."],
  [/mime type|invalid file|not supported/i, "نوع الملف غير مدعوم هنا."],
  [/rate limit|too many requests|429/i, "محاولات كثيرة في وقت قصير. انتظر دقيقة ثم أعد المحاولة."],
  [/Invalid login credentials/i, "اسم المستخدم أو كلمة المرور غير صحيحة."],
];
// خاصية لم تُفعَّل بعد في قاعدة البيانات (دالة أو جدول أو عمود غير موجود)
const MISSING = /does not exist|schema cache|Could not find the (?:function|table)|PGRST20[0-9]|42P01|42883|42703/i;

const arabic = (s) => /[؀-ۿ]/.test(s);

/** نص الخطأ للعرض. err: نص أو كائن خطأ. */
export function friendlyError(err) {
  const raw = String((err && typeof err === "object" ? err.message ?? err.error ?? String(err) : err) ?? "").trim();
  if (!raw) return raw;
  // رسائل الإعداد المكتوبة في البوابة (نفّذ/شغّل supabase/….sql)
  if (/\.sql\b/.test(raw)) return technical ? raw : SETUP;
  if (MISSING.test(raw) && !arabic(raw)) return technical ? `${SETUP} (${raw})` : SETUP;
  // رسالة عربية من الخادم أو الصفحة: تبقى كما هي
  if (arabic(raw)) return raw;
  for (const [re, t] of RULES) if (re.test(raw)) return technical ? `${t} (${raw})` : t;
  return technical ? `تعذّر تنفيذ الإجراء (${raw})` : "تعذّر تنفيذ الإجراء. أعد المحاولة، وإن تكرر فأبلغ الدعم الفني.";
}
