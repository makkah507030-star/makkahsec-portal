// src/lib/studentNotes.js
/* =====================================================================
   ملاحظات الطلاب — صحية وسلوكية ونفسية (جدول student_notes).
   يكتب كل الأنواع: الموجه الصحي والموجهون الطلابيون، والمدير ووكيل شؤون
   الطلاب والدعم الفني.
   ===================================================================== */

// كل الأنواع لكل الموجهين: الموجه الصحي والموجهون الطلابيون
const COUNSELORS = ["counselor", "counselor_1", "counselor_2", "counselor_3", "health_counselor"];

export const NOTE_KINDS = {
  health: {
    label: "صحية", chip: "bg-absent/10 text-absent border-absent/20",
    writers: COUNSELORS,
    presets: [
      "ربو: يُسمح له بالخروج فورًا عند ضيق التنفس، وبخّاخه معه.",
      "سكري: يُسمح له بتناول وجبة خفيفة أو الخروج للعيادة عند الشعور بالدوخة أو التعب.",
      "حساسية غذائية: لا يُقدَّم له طعام في الأنشطة قبل التأكد من مكوّناته.",
      "صرع: عند التشنّج يُبعَد ما حوله ويوضع على جنبه، ويُبلَّغ الموجه الصحي فورًا.",
      "ضعف نظر: يُجلس في الصفوف الأمامية.",
      "ضعف سمع: يُجلس قريبًا من المعلم ويُخاطَب مواجهةً.",
      "يُعفى من المجهود البدني الشاق في التربية البدنية.",
    ],
  },
  behavior: {
    label: "سلوكية", chip: "bg-warning-light text-warning border-warning/20",
    writers: COUNSELORS,
    presets: [
      "فرط حركة وتشتت انتباه: يُجلس في الصفوف الأمامية بعيدًا عن النوافذ، وتُقسَّم له المهام.",
      "يحتاج تعزيزًا إيجابيًا مستمرًا، ويُتجنَّب توبيخه أمام زملائه.",
      "صعوبات تعلّم: يُمنح وقتًا إضافيًا في الاختبارات والمهام.",
      "يُتابَع سلوكه بالتنسيق مع الموجه الطلابي، وتُرفع له أي ملاحظة فورًا.",
    ],
  },
  psych: {
    label: "نفسية", chip: "bg-excused/10 text-excused border-excused/20",
    writers: COUNSELORS,
    presets: [
      "يمرّ بظرف أسري: يُراعى في المتابعة والواجبات، دون الإشارة لذلك أمام زملائه.",
      "قلق الاختبارات: يُطمأن قبل الاختبار، ويُتاح له وقت إضافي عند الحاجة.",
      "خجل شديد: يُشرَك تدريجيًا، ولا يُجبَر على الحديث أمام الفصل.",
      "تُرفع للموجه الطلابي أي ملاحظة على تغيّر حالته أو انعزاله.",
    ],
  },
};

export const KIND_ORDER = ["health", "behavior", "psych"];
const ALL_KINDS = ["principal", "deputy_students", "tech_support"];

/** الأنواع التي يكتبها صاحب هذه الأدوار — مطابقة لـ sn_can_write في القاعدة */
export const writableKinds = (adminRoles = []) =>
  KIND_ORDER.filter((k) =>
    adminRoles.some((r) => ALL_KINDS.includes(r) || NOTE_KINDS[k].writers.includes(r)));

/** الأدوار التي تظهر لها صفحة إدارة الملاحظات */
export const NOTES_ROLES = [...ALL_KINDS, "health_counselor", "counselor", "counselor_1", "counselor_2", "counselor_3"];

/** هل انتهى تاريخ مراجعة الملاحظة؟ */
export const isExpired = (n) => !!n.review_until && n.review_until < new Date().toISOString().slice(0, 10);
