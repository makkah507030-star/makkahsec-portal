// src/components/Layout.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { RIGHTS_LINE } from "../lib/legal";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession, ROLE_LABEL, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { useMyDepartment, headLabel } from "../lib/plc";
import { useTeacherHiddenTabs } from "../lib/useTeacherHiddenTabs.js";
import { useTeacherGrantedTabs } from "../lib/useTeacherGrantedTabs.js";
import logoIcon from "../assets/icon-mint.png";
import TrialBanner from "./TrialBanner.jsx";
import { STUDENT_FILE_ROLES } from "./StudentFileLink.jsx";
import { NavContext } from "../lib/navContext.js";
import NotificationBell from "./NotificationBell.jsx";
import AnnouncementModal from "./AnnouncementModal.jsx";
import IdleLogout from "./IdleLogout.jsx";
import QuickNote from "./QuickNote.jsx";
import { loadPrincipalSignature } from "../lib/principalSignature.js";
import { loadSigners } from "../lib/signers.js";
import { useNavBadges, refreshNavBadges } from "../lib/navBadges.js";
import { useBackSteps, goBack } from "../lib/backStep.js";
import { savedTheme, saveTheme, applyTheme } from "../lib/theme.js";

/* =====================================================================
   القائمة الجانبية — مرتبة من العمل اليومي إلى الإعدادات، وفي أسفلها
   روابط الحساب والمساعدة (FOOTER). عناصرها:
     to, label, icon        الرابط ونصه وأيقونته
     kw                     كلمات إضافية للبحث في القائمة
     also                   مسارات أخرى يُعدّ الرابط نشطًا فيها
     perm / anyPerm / roles / hideForRoles / techOnly / manageForms   (الإدارة)
     tabKey / extraTabKey   (المعلم) تبويب يمكن إخفاؤه / تبويب يُمنح بصلاحية
   ===================================================================== */

const COUNSEL = ["principal", "tech_support", "deputy_students", "counselor_1", "counselor_2", "counselor_3"];

const ADMIN_GROUPS = [
  {
    title: null,
    items: [
      { to: "/", label: "الرئيسية", icon: "home" },
      // شاشة المتابعة — الوضع اليومي في شاشة كاملة (أرقام بلا أسماء طلاب، تصلح للعرض أمام الضيوف)
      { to: "/monitor", label: "شاشة المتابعة", roles: ["principal", "deputy_students", "deputy_academic", "tech_support"], icon: "monitor", kw: "داشبورد لوحة الوضع اليومي حضور تلفزيون عرض" },
      { to: "/school-report", label: "التقرير الشهري للمدرسة", roles: ["principal", "tech_support"], icon: "chart", kw: "تقرير شهري خلاصة" },
    ],
  },
  {
    title: "شؤون الطلاب",
    items: [
      { to: "/students",    label: "كشوف الطلاب",    perm: "students",    icon: "users" },
      // ملف الطالب الشامل — والموجه يرى طلاب صفه وحده (sf_can)
      { to: "/student-file", label: "ملف الطالب", roles: STUDENT_FILE_ROLES, icon: "idcard", kw: "ملف شامل سجل الطالب غياب سلوك إحالات درجات شهادات" },
      { to: "/student-admission", label: "قبول طالب", roles: ["principal", "tech_support"], icon: "userPlus" },
      // الترشيحات — لكل إداري ومن له دور إداري؛ يدير كلٌّ إعلاناته (supabase/nominations_1.sql)
      { to: "/nominations", label: "الترشيحات", icon: "megaphone", kw: "تقديم انضمام لجنة اعلامية كشافة مقابلة مرشحين اعلان" },
      { to: "/student-certificate", label: "تعريف طالب منتظم", perm: "students", icon: "idcard" },
      { to: "/permissions", label: "الاستئذان", perm: "permissions", icon: "ticket", kw: "خروج" },
      { to: "/dropouts", label: "الطلاب المنقطعون", roles: ["principal", "deputy_students", "tech_support"], icon: "userX", kw: "انقطاع طي قيد سفر" },
      { to: "/student-notes", label: "ملاحظات الطلاب", roles: [...COUNSEL, "health_counselor"], icon: "heart", kw: "صحية" },
      { to: "/results-admin", label: "نتائج الطلاب", perm: "results", icon: "award", kw: "درجات" },
      { to: "/exams-admin", label: "جداول الاختبارات", perm: "students", icon: "calendar" },
    ],
  },
  {
    title: "السلوك والمواظبة",
    items: [
      { to: "/referrals", label: "إحالة طالب", roles: COUNSEL, icon: "send", kw: "موجه" },
      { to: "/behavior", label: "نماذج السلوك والمواظبة", roles: COUNSEL, icon: "flag", kw: "مخالفات غياب" },
      { to: "/student-affairs", label: "تقارير شؤون الطلاب", perm: "reports", icon: "chart", kw: "غياب" },
    ],
  },
  {
    // كل صف لموجهه؛ والوكيل والمدير والدعم الفني يرون الصفوف كلها (supabase/guidance_1.sql)
    title: "التوجيه الطلابي",
    items: [
      { to: "/guidance", label: "الإنذار المبكر والحالات", roles: ["principal", "deputy_students", "tech_support", "counselor_1", "counselor_2", "counselor_3"], icon: "heart", kw: "موجه حالة إرشادية جلسة" },
    ],
  },
  {
    title: "الشؤون التعليمية",
    items: [
      { to: "/general-schedule",  label: "الجدول العام",          anyPerm: ["import", "schedules"], icon: "table" }, // جدول شامل بالفصول والمعلمين معًا
      { to: "/teacher-schedules", label: "جداول المعلمين",        anyPerm: ["import", "schedules"], icon: "chalk" },
      { to: "/student-schedules", label: "جداول الطلاب",          anyPerm: ["import", "schedules"], icon: "grid" },
      { to: "/schedule-import",   label: "استيراد الجدول الذكي", perm: "import", icon: "upload" },
      { to: "/substitute-report", label: "تقرير حصص الانتظار", anyPerm: ["import", "reports"], icon: "swap" },
      { to: "/noor-grades",       label: "متابعة رصد الدرجات", roles: ["principal", "deputy_academic", "tech_support"], icon: "clipboard", kw: "نور الفترات" },
      { to: "/qbank",             label: "بنك الأسئلة", roles: ["principal", "deputy_academic", "tech_support"], icon: "database", kw: "اسئلة مشاركة اختبار مواد" },
      { to: "/quiz-cycles",       label: "متابعة دورات الاختبار", roles: ["principal", "deputy_academic", "tech_support"], icon: "refresh", kw: "الدورات غير المكتملة اختبارات خطة علاجية" },
      { to: "/duty",              label: "المناوبة والإشراف",  perm: "staff",  icon: "whistle" },
      { to: "/ethics-report", label: "ميثاق أخلاقيات المهنة", roles: ["principal", "deputy_academic", "tech_support"], icon: "shield", kw: "مدونة السلوك الوظيفي اقرار" },
      { to: "/plc-departments", label: "رؤساء الأقسام", roles: ["principal", "deputy_academic", "tech_support"], icon: "users", kw: "الأقسام وأعضاؤها" },
      { to: "/activities", label: "بنك الأنشطة", roles: ["deputy_academic", "principal", "tech_support"], icon: "sparkles", kw: "حقيبة حصص الانتظار الأنشطة الصفية العاب" },
      { to: "/qudrat/admin", label: "متابعة التدريب (القدرات)", roles: ["principal", "deputy_academic", "tech_support"], icon: "target", kw: "قياس قدرات تحصيلي تدريب اسئلة مركز تقرير", also: ["/qudrat"] },
    ],
  },
  {
    // تظهر لمن يُسمح له بأحد معاملها فقط (المجموعة الفارغة تُخفى)
    title: "المعامل والمختبرات",
    items: [
      { to: "/lab", label: "معمل الحاسب الآلي", roles: ["computer_lab", "principal", "tech_support"], icon: "monitor", kw: "حجز اجهزة اعطال" },
    ],
  },
  {
    title: "النماذج",
    items: [
      { to: "/forms",        label: "إصدار النماذج", icon: "certificate", kw: "شهادات" },
      { to: "/forms-review", label: "الاعتماد والمتابعة", icon: "inbox" },
      { to: "/my-documents", label: "نماذجي", icon: "folder" },
      { to: "/plc",          label: "التطوير المهني", roles: ["principal", "deputy_academic", "tech_support"], icon: "users", kw: "مجتمع التعلم" },
      { to: "/forms-admin",  label: "إدارة النماذج", manageForms: true, icon: "sliders" },
    ],
  },
  {
    title: "الأداء الوظيفي",
    items: [
      { to: "/performance",  label: "تقييم الأداء الوظيفي", roles: ["principal", "tech_support"], icon: "award", kw: "شواهد تقييم أداء" },
      { to: "/improve",      label: "خطط التطوير", icon: "target", kw: "حلقة التحسين توصيات متابعة أثر زيارة دعم" },
      { to: "/dfiles-admin", label: "ملفات المعلمين الرقمية", roles: ["tech_support"], icon: "idcard", kw: "ملف رقمي إيقاف نقل تقاعد رمز" },
      { to: "/dfile-opinions", label: "رأي الإدارة في ملفات المعلمين", roles: ["principal", "deputy_academic"], icon: "edit", kw: "ملف رقمي رأي توصية المعلم" },
    ],
  },
  {
    title: "التواصل والمحتوى",
    items: [
      { to: "/notifications",  label: "الإشعارات", perm: "notifications", icon: "bell", kw: "رسائل" },
      { to: "/notifications-review", label: "اعتماد الإشعارات", techOnly: true, icon: "check" },
      { to: "/announcements",  label: "رسالة الدخول", perm: "notifications", icon: "megaphone" },
      { to: "/news-admin",     label: "الأخبار والمقالات",   perm: "news",     icon: "news" },
      { to: "/guides-admin",   label: "الأدلة",    perm: "guides",   icon: "book" },
      { to: "/events",         label: "الأحداث والمناسبات", icon: "sparkles" },
      { to: "/events-reports", label: "تقارير الأحداث",     icon: "pie" },
      { to: "/scouts",         label: "الفريق الكشفي", perm: "scouts", icon: "flag", kw: "كشافة اعضاء" },
      { to: "/studio",         label: "استوديو البوابة", icon: "palette", kw: "تصميم" },
    ],
  },
  {
    title: "إعدادات المدرسة",
    items: [
      { to: "/accounts",       label: "الحسابات",            perm: "accounts",       icon: "key" },
      { to: "/staff",          label: "الإدارة",             perm: "staff",          icon: "briefcase", kw: "منسوبين" },
      { to: "/teacher-permissions", label: "صلاحيات المعلمين", perm: "staff",       icon: "shield" },
      { to: "/calendar-admin", label: "التقويم والإجازات",   perm: "calendar",       icon: "calendar" },
      { to: "/season",         label: "التوقيت الزمني",       perm: "import",         icon: "clock", kw: "حصص" },
      { to: "/import",         label: "الاستيراد",           perm: "import",         icon: "database", kw: "نور" },
      { to: "/records-manual", label: "تعديل السجلات", perm: "records", icon: "edit" },
      { to: "/password-reset", label: "استعادة كلمة المرور", perm: "password_reset", icon: "lock" },
    ],
  },
  {
    title: "الدعم الفني",
    items: [
      { to: "/feedback-admin", label: "مركز الدعم والمساندة", perm: "feedback", icon: "chat" },
      { to: "/support-report", label: "تقرير ومتابعة الدعم", perm: "feedback", icon: "chart" },
      { to: "/login-log", label: "سجل الدخول والخروج", perm: "login_log", icon: "door" },
      { to: "/site-metrics", label: "مؤشرات الموقع", techOnly: true, icon: "eye" },
      { to: "/usage-report", label: "إحصائية الاستخدام", techOnly: true, icon: "trend" },
      { to: "/audit-log", label: "سجل العمليات", techOnly: true, icon: "list" },
      { to: "/quizzes", label: "اختبارات المعلمين", techOnly: true, icon: "quiz", kw: "اطلاع اختبارات اسئلة المعلمين" },
      { to: "/quiz-marks", label: "التصحيح والدرجات", techOnly: true, icon: "target", kw: "اطلاع درجات اختبارات المعلمين" },
      { to: "/quiz-analytics", label: "تحليل النتائج", techOnly: true, icon: "pie", kw: "احصاء اختبارات" },
      { to: "/maintenance", label: "وضع الصيانة", techOnly: true, icon: "wrench" },
    ],
  },
];

/* الأقسام العامة لقائمة الإدارة: كل قسم يجمع أقسامًا من ADMIN_GROUPS بعناوينها، ويفتح
   صفحة بطاقاتها (/s/:key، pages/SectionHub.jsx). القسم الذي يبقى فيه رابط واحد للمستخدم
   يفتح الرابط مباشرة. أي قسم جديد في ADMIN_GROUPS يُضاف عنوانه هنا. */
const SECTIONS = [
  { key: "students", title: "الطلاب", icon: "users", hint: "شؤون الطلاب والسلوك والمواظبة والتوجيه",
    groups: ["شؤون الطلاب", "السلوك والمواظبة", "التوجيه الطلابي"] },
  { key: "academic", title: "الشؤون التعليمية", icon: "book", hint: "الجداول والرصد والاختبارات والأنشطة والمعامل",
    groups: ["الشؤون التعليمية", "المعامل والمختبرات"] },
  { key: "forms", title: "النماذج والأداء", icon: "certificate", hint: "النماذج والشهادات والأداء الوظيفي والتطوير المهني",
    groups: ["النماذج", "الأداء الوظيفي"] },
  { key: "comms", title: "التواصل والفعاليات", icon: "megaphone", hint: "الإشعارات والأخبار والأدلة والأحداث",
    groups: ["التواصل والمحتوى"] },
  { key: "settings", title: "الإعدادات والدعم الفني", icon: "sliders", hint: "الحسابات والصلاحيات والتقويم والاستيراد والدعم",
    groups: ["إعدادات المدرسة", "الدعم الفني"] },
];

const TEACHER_GROUPS = [
  {
    title: null,
    items: [
      { to: "/", label: "الرئيسية", icon: "home", kw: "يومي" },
    ],
  },
  {
    title: "المهام اليومية",
    items: [
      { to: "/attendance",  label: "الحضور والغياب اليومي", tabKey: "attendance", icon: "userCheck", kw: "تحضير" },
      { to: "/substitute",  label: "حصص الانتظار",          tabKey: "substitute", icon: "swap" },
      { to: "/activities",  label: "الأنشطة والألعاب",       icon: "sparkles", kw: "حقيبة الانتظار الأنشطة الصفية دوري المادة كأس حروف مسابقة مؤقت" },
      { to: "/schedule",    label: "جدولي",                 tabKey: "schedule",   icon: "grid" },
      { to: "/permissions", label: "الاستئذان",             extraTabKey: "permissions", icon: "ticket", kw: "خروج" },
    ],
  },
  {
    title: "المعامل والمختبرات",
    items: [
      { to: "/lab",         label: "معمل الحاسب الآلي",     extraTabKey: "computer_lab", icon: "monitor", kw: "حجز اجهزة تقنية رقمية" },
    ],
  },
  {
    title: "طلابي",
    items: [
      { to: "/records",    label: "السجلات",                tabKey: "records", icon: "layers" },
      { to: "/follow-up",  label: "سجل المتابعة الإلكتروني", also: ["/follow-up-2", "/follow-up-3"], icon: "clipboard", kw: "مهام ادائية مشاركة" },
      { to: "/my-absence", label: "تقرير غياب مادتي",       icon: "trend" },
      { to: "/referrals",  label: "إحالة طالب",             icon: "send", kw: "موجه" },
      { to: "/dropouts",   label: "الإبلاغ عن طالب منقطع",  icon: "userX", kw: "انقطاع سفر غياب" },
      { to: "/reports",    label: "التقارير",               tabKey: "reports", icon: "chart" },
    ],
  },
  {
    title: "الاختبارات",
    items: [
      { to: "/exams",          label: "جداول الاختبارات", icon: "calendar" },
      { to: "/quizzes",        label: "اختباراتي",         icon: "quiz" },
      // بنك الأسئلة — أسئلة المعلم تدخله تلقائيًا، ويشاركها مع المعلمين (supabase/qbank_1.sql)
      { to: "/qbank",          label: "بنك الأسئلة",       icon: "database", kw: "اسئلة مشاركة اختبار مواد" },
      { to: "/quiz-marks",     label: "التصحيح والدرجات",  icon: "target", kw: "تصحيح الي" },
      { to: "/quiz-analytics", label: "تحليل النتائج",     icon: "pie" },
      { to: "/qudrat",         label: "مركز التدريب",      icon: "target", exact: true, kw: "قياس قدرات تحصيلي تدريب اسئلة" },
      { to: "/qudrat/asks",    label: "أسئلة الطلاب (القدرات)", icon: "chat", kw: "قدرات استفسار طالب" },
    ],
  },
  {
    title: "النماذج",
    items: [
      { to: "/forms",        label: "النماذج والشهادات",  icon: "certificate" },
      { to: "/forms-review", label: "الاعتماد والمتابعة", icon: "inbox" },
      { to: "/my-documents", label: "نماذجي",             icon: "folder" },
      { to: "/plc",          label: "التطوير المهني",     icon: "users", kw: "مجتمع التعلم المهني" },
    ],
  },
  {
    title: "الأداء الوظيفي",
    items: [
      { to: "/my-performance", label: "شواهد الأداء الوظيفي", icon: "award", kw: "شواهد تقييم أداء" },
      { to: "/improve",        label: "خطط التطوير",         icon: "target", kw: "حلقة التحسين توصيات متابعة أثر زيارة دعم" },
      { to: "/my-dfile",       label: "ملف المعلم الرقمي",   icon: "idcard", kw: "ملف رقمي رمز qr زائر مشرف تقرير" },
      { to: "/ethics",         label: "ميثاق أخلاقيات المهنة", icon: "shield", kw: "مدونة السلوك الوظيفي اقرار" },
    ],
  },
  {
    title: "التواصل والمحتوى",
    items: [
      { to: "/notify",     label: "الإشعارات",          tabKey: "notify", icon: "bell", kw: "رسائل" },
      { to: "/news-admin", label: "الأخبار والمقالات",  extraTabKey: "news", icon: "news" },
      { to: "/events",     label: "الأحداث والمناسبات", icon: "sparkles" },
      { to: "/studio",     label: "استوديو البوابة",    icon: "palette", kw: "تصميم" },
    ],
  },
];

const BASIC_GROUPS = [
  {
    title: null,
    items: [
      { to: "/", label: "الرئيسية", icon: "home" },
      { to: "/exams", label: "جداول الاختبارات", icon: "calendar" },
      // مركز التدريب (القدرات) — للطالب وحده من هذه القائمة، لا لولي الأمر
      { to: "/qudrat", label: "مركز التدريب", icon: "target", studentOnly: true, kw: "قياس قدرات تحصيلي" },
      { to: "/my-documents", label: "نماذجي", icon: "folder" },
      // فرص المشاركة — للطالب التقديم على لجان المدرسة وفرقها، ولولي الأمر متابعة طلبات أبنائه
      { to: "/opportunities", label: "فرص المشاركة", icon: "megaphone", kw: "ترشيح تقديم لجنة كشافة انضمام" },
    ],
  },
];

// أسفل القائمة: الحساب والمساعدة
const FOOTER = [
  { to: "/notebook", label: "مفكرتي", icon: "edit", staffOnly: true, kw: "ملاحظات مهام تذكير" },
  { to: "/my-signature", label: "توقيعي", icon: "signature", staffOnly: true },
  { to: "/help", label: "دليل الاستخدام", icon: "help" },
  { to: "/contact", label: "الدعم الفني", icon: "chat", hideForRoles: ["tech_support", "principal"] },
];

// الشريط السفلي في الجوال: أهم أربع صفحات بحسب الدور (ما يظهر منها فقط)، ثم «المزيد»
const BOTTOM = {
  admin:    ["/", "/students", "/permissions", "/forms", "/forms-review", "/my-documents"],
  teacher:  ["/", "/attendance", "/records", "/forms", "/quizzes", "/my-documents"],
  student:  ["/", "/qudrat", "/exams", "/my-documents"],
  guardian: ["/", "/exams", "/my-documents"],
};
const BOTTOM_LABEL = {
  "/students": "الطلاب", "/permissions": "الاستئذان", "/forms": "النماذج", "/forms-review": "الاعتماد",
  "/records": "السجلات", "/attendance": "التحضير", "/quizzes": "اختباراتي", "/exams": "الاختبارات", "/my-documents": "نماذجي", "/qudrat": "التدريب",
};

/* البحث: توحيد الهمزات والتاء المربوطة والألف المقصورة وحذف التشكيل */
const norm = (s) => String(s ?? "")
  .replace(/[ً-ْـ]/g, "")
  .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .toLowerCase();

// قراءة/كتابة تفضيلات العرض في المتصفح — تُتجاهل إن تعذّر التخزين
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* لا شيء */ } },
};

/* أيقونات خطّية بسيطة — يستعملها صندوق «بانتظار إجرائك» أيضًا */
export function Icon({ name, className = "h-[18px] w-[18px]" }) {
  const p = {
    home:   "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
    users:  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9",
    userPlus:  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
    userCheck: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M16 11l2 2 4-4",
    userX:  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 8l5 5M22 8l-5 5",
    idcard: "M3 5h18v14H3zM7 10a2 2 0 1 0 4 0 2 2 0 0 0-4 0M5.5 16c.5-1.4 1.8-2 3.5-2s3 .6 3.5 2M15 9h3M15 13h3",
    chart:  "M3 3v18h18M7 15V9m5 6V5m5 10v-4",
    trend:  "M3 3v18h18M7 14l4-4 3 3 6-7",
    pie:    "M21 12A9 9 0 1 1 12 3v9ZM15 3.5A9 9 0 0 1 20.5 9H15Z",
    ticket: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z",
    news:   "M4 5h12v14H4zM16 8h4v9a2 2 0 0 1-4 0zM7 9h6M7 12h6M7 15h4",
    chat:   "M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z",
    upload: "M12 16V4m-5 5 5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
    monitor: "M3 4h18v12H3zM8 21h8M12 16v5",
    grid:   "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    table:  "M3 4h18v16H3zM3 9h18M3 14.5h18M9 4v16",
    chalk:  "M4 19v-3l11-11 3 3-11 11H4ZM14 6l3 3",
    clock:  "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    swap:   "M8 3 4 7l4 4M4 7h13M16 21l4-4-4-4M20 17H7",
    refresh: "M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5",
    whistle: "M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6zM9 12l2 2 4-4",
    key:    "M14 7a4 4 0 1 1-5.6 5.6L3 18v3h3l5.4-5.4A4 4 0 0 1 14 7Z",
    shield: "M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z",
    lock:   "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
    book:   "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z",
    help:   "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17.5h.01",
    bell:   "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
    check:  "M20 6 9 17l-5-5",
    megaphone: "M3 11v2a2 2 0 0 0 2 2h1l2 6h2l-1.5-6H10l9 4V5l-9 4H5a2 2 0 0 0-2 2Zm7-2v6",
    wrench: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2Z",
    edit:   "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
    award:  "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.2 13.5 6 21l6-3 6 3-2.2-7.5",
    calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
    certificate: "M6 3h12v13l-6 5-6-5zM9 8h6M9 11h6",
    inbox:  "M4 13h4l1.5 3h5l1.5-3h4M4 13l2-8h12l2 8v6H4z",
    folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
    signature: "M3 17c3-1 4-9 6-9s-1 9 1 9 3-4 4-4 1 3 3 3h4M3 21h18",
    sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
    palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.8-.4-1.1.4-2.2 1.6-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 11.5h.01M10 7.5h.01M14 7.5h.01M16.5 11h.01",
    heart:  "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z",
    send:   "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
    flag:   "M5 22V4M5 4h12l-2.5 4L17 12H5",
    layers: "M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5l10 5 10-5",
    clipboard: "M9 3h6v3H9zM9 4.5H6V21h12V4.5h-3M9 13l2 2 4-4",
    quiz:   "M7 3h10a2 2 0 0 1 2 2v16l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21V5a2 2 0 0 1 2-2ZM9 8h6M9 12h6M9 16h3",
    target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    sparkles: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8ZM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z",
    briefcase: "M3 8h18v12H3zM8 8V5h8v3M3 13h18",
    database: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3ZM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
    door:   "M14 3h5v18h-5M10 17l5-5-5-5M15 12H3",
    eye:    "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    list:   "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
    more:   "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    panel:  "M3 4h18v16H3zM15 4v16M10 9l-3 3 3 3",
    panelOpen: "M3 4h18v16H3zM15 4v16M7 9l3 3-3 3",
  }[name];

  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} shrink-0`}
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}

const Badge = ({ n, dot, at = "-top-0.5 -left-1" }) => (n > 0
  ? dot
    ? <span className={`absolute ${at} h-2 w-2 rounded-full bg-absent ring-2 ring-white`} />
    : <span className="num ms-auto shrink-0 rounded-full bg-absent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{n}</span>
  : null);

export default function Layout({ children }) {
  const { session, profile, adminRoles, signOut, can, effectiveRole, views, switchView } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [open, setOpen] = useState(false);

  // إغلاق قائمة الجوال عند الانتقال لأي صفحة
  useEffect(() => { setOpen(false); }, [path]);

  // الوضع الداكن للطالب وحده (lib/theme.js)، ويزول عند الخروج أو لغير الطالب
  const isStudentView = effectiveRole === "student";
  const [dark, setDark] = useState(() => savedTheme() === "dark");
  useEffect(() => {
    applyTheme(isStudentView && dark);
    return () => applyTheme(false);
  }, [isStudentView, dark]);

  // تحميل توقيع المدير المعتمد وأسماء الموقّعين مسبقًا — لتظهر في التقارير المطبوعة فورًا
  useEffect(() => { if (session) { loadPrincipalSignature(); loadSigners(); } }, [session]);

  // عدادات «بانتظار إجرائك» على روابط القائمة (lib/navBadges.js) — أدوار الإدارة تُحتسب في واجهتها فقط
  const badges = useNavBadges(session?.user?.id, effectiveRole === "admin" ? adminRoles : [], effectiveRole);
  useEffect(() => { refreshNavBadges(); }, [path]);
  const badgeOf = (to) => (to.startsWith("_") ? 0 : badges[to] ?? 0);

  const isAdmin = effectiveRole === "admin";
  const isStaff = isAdmin || effectiveRole === "teacher";
  const { hidden: hiddenTabs } = useTeacherHiddenTabs();
  const { granted: grantedTabs } = useTeacherGrantedTabs();

  // هل يظهر الرابط لهذا المستخدم؟
  const visible = (i) => {
    if (i.staffOnly && !isStaff) return false;
    if (i.studentOnly && effectiveRole !== "student") return false;
    if (isAdmin) {
      if (i.hideForRoles?.some((r) => adminRoles.includes(r))) return false;
      if (i.roles && !i.roles.some((r) => adminRoles.includes(r))) return false;
      if (i.manageForms) return adminRoles.includes("tech_support") || adminRoles.includes("principal");
      if (i.techOnly) return adminRoles.includes("tech_support");
      // anyPerm: يظهر العنصر لمن يملك أيًّا من الصلاحيات المذكورة
      return i.anyPerm ? i.anyPerm.some((p) => can(p)) : !i.perm || can(i.perm);
    }
    if (i.extraTabKey) return grantedTabs.has(i.extraTabKey);
    return !i.tabKey || !hiddenTabs.has(i.tabKey);
  };

  const groups = useMemo(() => {
    const src = isAdmin ? ADMIN_GROUPS : effectiveRole === "teacher" ? TEACHER_GROUPS : BASIC_GROUPS;
    return src.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, effectiveRole, adminRoles, can, grantedTabs, hiddenTabs]);
  const footer = FOOTER.filter(visible);

  // الأقسام العامة للإدارة بما يراه المستخدم منها فقط (القسم بلا روابط له لا يظهر)
  const sections = useMemo(() => (!isAdmin ? [] : SECTIONS
    .map((x) => ({ ...x, groups: groups.filter((g) => x.groups.includes(g.title)) }))
    .map((x) => ({ ...x, items: x.groups.flatMap((g) => g.items) }))
    .filter((x) => x.items.length)), [isAdmin, groups]);
  const topItems = isAdmin ? groups.find((g) => !g.title)?.items ?? [] : [];

  const isActive = (i) =>
    i.to === "/" || i.exact
      ? path === i.to
      : [i.to, ...(i.also ?? [])].some((t) => path === t || path.startsWith(t + "/"));

  /* ---------- «الأكثر استخدامًا» (الإدارة): أكثر خمس صفحات يفتحها المستخدم ----------
     تُعدّ في متصفحه وحده، وتظهر الصفحة بعد فتحها مرتين. */
  const usageKey = `nav.usage.${effectiveRole}`;
  const [usage, setUsage] = useState(() => store.get(usageKey, {}));
  const sectionItems = sections.flatMap((x) => x.items);
  useEffect(() => {
    const hit = sectionItems.find(isActive);
    if (!hit) return;
    setUsage((u) => { const n = { ...u, [hit.to]: (u[hit.to] ?? 0) + 1 }; store.set(usageKey, n); return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, sections.length]);
  const frequent = Object.entries(usage).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1])
    .map(([to]) => sectionItems.find((i) => i.to === to)).filter(Boolean).slice(0, 5);
  const sectionTo = (x) => (x.items.length === 1 ? x.items[0].to : `/s/${x.key}`);
  const sectionNav = (x, iconOnly) => navItem({ to: sectionTo(x), label: x.title, icon: x.icon }, {
    iconOnly, active: path === `/s/${x.key}` || x.items.some(isActive),
    badge: x.items.reduce((a, i) => a + badgeOf(i.to), 0),
  });

  /* ---------- أقسام القائمة: قسم واحد مفتوح في كل مرة ----------
     الانتقال إلى صفحة في قسم آخر يفتح قسمها ويطوي الباقي تلقائيًا، وفتح قسم
     باليد يطوي غيره. ويُتذكّر القسم المفتوح. */
  const groupsKey = `nav.groups.${effectiveRole}`;
  const activeGroupTitle = groups.find((g) => g.title && g.items.some(isActive))?.title ?? null;
  const [openGroups, setOpenGroups] = useState(() => new Set(store.get(groupsKey, []).slice(0, 1)));
  const saveGroups = (n) => { store.set(groupsKey, [...n]); return n; };
  useEffect(() => { setOpenGroups(new Set(store.get(groupsKey, []).slice(0, 1))); }, [groupsKey]);
  useEffect(() => {
    if (activeGroupTitle) setOpenGroups(saveGroups(new Set([activeGroupTitle])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupTitle, groupsKey]);
  const toggleGroup = (title) => setOpenGroups((s) => saveGroups(s.has(title) ? new Set() : new Set([title])));

  /* ---------- الضغط على صفحة القسم وأنت فيها يعيدها إلى بدايتها ----------
     بعض الصفحات تفتح تفاصيلها داخلها (اختبار، نموذج…) دون تغيّر الرابط، فيعيد
     الضغط على اسمها في القائمة بناءها من جديد بدل زر الرجوع أعلى الصفحة. */
  const [pageKey, setPageKey] = useState(0);
  const reopenPage = (i) => {
    if (path !== i.to) return;
    setPageKey((k) => k + 1);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };

  /* زر الرجوع العائم (الجوال) ظاهر في كل الصفحات عدا الرئيسية:
     داخل تفاصيل الصفحة (lib/backStep.js) يغلقها ويحمل اسم الصفحة، وإلا يعود للصفحة
     السابقة، أو للرئيسية إن فُتحت الصفحة مباشرة من رابط أو إشعار ولا سابق لها. */
  const steps = useBackSteps();
  // صفحة أداء الاختبار الإلكتروني لها شريط «تسليم» مثبّت أسفل الشاشة: يُخفى فيها شريط
  // التنقل السفلي وزر الرجوع العائم، فقد كانا يغطيان زر التسليم على الجوال ويُخرجان الطالب
  const inQuiz = path.startsWith("/quiz/");
  const showBack = !inQuiz && (steps.length > 0 || path !== "/");
  const onBack = () => {
    if (steps.length) goBack();
    else if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/");
  };

  /* ---------- طيّ القائمة إلى أيقونات (سطح المكتب) ---------- */
  const [collapsed, setCollapsed] = useState(() => store.get("nav.collapsed", false));
  const setCollapsedSaved = (v) => { setCollapsed(v); store.set("nav.collapsed", v); };

  /* ---------- البحث في القائمة (Ctrl+K) ---------- */
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  useEffect(() => { setQuery(""); }, [path]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.code === "KeyK")) {
        e.preventDefault();
        if (window.innerWidth < 1024) { setOpen(true); return; }
        setCollapsedSaved(false);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const results = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    const all = [
      ...groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))),
      ...footer.map((i) => ({ ...i, group: null })),
    ];
    return all.filter((i) => {
      const hay = norm(`${i.label} ${i.group ?? ""} ${i.kw ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [query, groups, footer]);

  /* ---------- الشريط السفلي (الجوال) ---------- */
  const allVisible = [...groups.flatMap((g) => g.items), ...footer];
  const bottomItems = (inQuiz ? [] : BOTTOM[effectiveRole] ?? [])
    .map((to) => allVisible.find((i) => i.to === to))
    .filter(Boolean)
    .slice(0, 4);

  // تخصص المعلم — يظهر بجانب كلمة «معلم» في الشريط العلوي
  const [spec, setSpec] = useState("");
  useEffect(() => {
    if (effectiveRole !== "teacher" || !session?.user?.id) { setSpec(""); return; }
    (async () => {
      const { data } = await supabase
        .from("teachers").select("specialization").eq("user_id", session.user.id).maybeSingle();
      setSpec(data?.specialization ?? "");
    })();
  }, [effectiveRole, session]);

  // وسم «رئيس قسم …» بجانب الاسم (supabase/plc_1_departments.sql)
  const dept = useMyDepartment();

  const subtitle =
    isAdmin && adminRoles.length
      ? adminRoles.map((r) => ADMIN_ROLE_LABEL[r] ?? r).join(" · ")
      : effectiveRole === "teacher" && spec
      ? `معلم · ${spec}`
      : ROLE_LABEL[effectiveRole] ?? "";

  // التبديل بين واجهات الحساب: الإدارة والمعلم و«أبنائي» — يظهر لمن له أكثر من واجهة.
  // بواجهتين زر واحد ينقل إلى الأخرى، وبثلاث قائمة مختصرة
  const VIEW_LABEL = { admin: "واجهة الإدارة", teacher: "واجهة المعلم", guardian: "أبنائي" };
  const ViewSwitch = () => {
    if (!views || views.length < 2) return null;
    const go = (v) => { switchView(v); navigate("/"); };
    const cls = "flex shrink-0 items-center gap-1.5 rounded-pill border border-mint-deep bg-mint-tint px-3 py-1.5 text-xs font-semibold text-mint-deep transition-colors hover:bg-mint-light sm:px-3.5";
    if (views.length === 2) {
      const other = views.find((v) => v !== effectiveRole) ?? views[0];
      return (
        <button onClick={() => go(other)} title="التبديل بين واجهات حسابك" className={cls}>
          <Icon name="swap" className="h-4 w-4" />
          <span className="hidden sm:inline">{VIEW_LABEL[other]}</span>
        </button>
      );
    }
    return (
      <label className={`${cls} cursor-pointer`} title="التبديل بين واجهات حسابك">
        <Icon name="swap" className="h-4 w-4" />
        <select value={effectiveRole} onChange={(e) => go(e.target.value)}
                className="max-w-[7.5rem] cursor-pointer bg-transparent text-xs font-semibold text-mint-deep outline-none">
          {views.map((v) => <option key={v} value={v}>{VIEW_LABEL[v]}</option>)}
        </select>
      </label>
    );
  };

  const Brand = ({ compact, iconOnly }) => (
    <NavLink to="/" end className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80">
      <img src={logoIcon} alt="" className="h-9 w-9 shrink-0 object-contain" />
      {!iconOnly && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-ink">
            بوابة مكة الثانوية
          </p>
          {!compact && <p className="truncate text-xs text-muted">مدرسة مكة الثانوية</p>}
        </div>
      )}
    </NavLink>
  );

  const Actions = () => (
    <div className="flex shrink-0 items-center gap-2">
      <ViewSwitch />
      {isStudentView && <ThemeToggle />}
      <Refresh />
      <PreviewSite />
      <NotificationBell />
      <SignOut />
    </div>
  );

  // الوضع الداكن — للطلاب
  const ThemeToggle = () => (
    <button
      type="button"
      onClick={() => { const next = !dark; saveTheme(next ? "dark" : "light"); setDark(next); }}
      title={dark ? "الوضع الفاتح" : "الوضع الداكن"}
      aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}
      aria-pressed={dark}
      className="flex shrink-0 items-center gap-1.5 rounded-pill border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-mint-light hover:bg-mint-tint hover:text-mint-deep sm:px-3.5"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark
          ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
          : <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />}
      </svg>
      <span className="hidden sm:inline">{dark ? "فاتح" : "داكن"}</span>
    </button>
  );

  // تحديث الصفحة — بديل زر التحديث في المتصفح، وتطبيق الجوال المثبّت لا يظهر فيه شريط المتصفح
  const Refresh = () => (
    <button
      type="button"
      onClick={() => window.location.reload()}
      title="تحديث الصفحة"
      aria-label="تحديث الصفحة"
      className="flex shrink-0 items-center gap-1.5 rounded-pill border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-mint-light hover:bg-mint-tint hover:text-mint-deep sm:px-3.5"
    >
      <Icon name="refresh" className="h-4 w-4" />
      <span className="hidden sm:inline">تحديث</span>
    </button>
  );

  // معاينة سريعة للصفحة الرئيسية العامة (الموقع المنشور) في تبويب جديد — للوصول السريع بعد أي تعديل
  // يستخدم مسار /home المخصص كي يعرض الصفحة العامة فعليًا حتى وأنت مسجّل الدخول،
  // بدل "/" التي تُحوّلك تلقائيًا للوحة التحكم
  const PreviewSite = () => (
    <a
      href="/home"
      target="_blank"
      rel="noopener noreferrer"
      title="الصفحة الرئيسية للبوابة"
      className="flex shrink-0 items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-mint-light hover:bg-mint-tint hover:text-mint-deep sm:px-3.5"
    >
      <Icon name="home" className="h-4 w-4" />
      <span className="hidden sm:inline">الصفحة الرئيسية للبوابة</span>
      <svg viewBox="0 0 24 24" className="hidden h-3 w-3 shrink-0 sm:block" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );

  // الاسم والدور — نسخة مدمجة للشريط العلوي
  const UserInline = () => (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint-tint">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-mint-deep"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-ink">
          {profile?.full_name ?? profile?.username ?? "—"}
        </p>
        <p className="truncate text-[11px] leading-tight text-muted">{subtitle}</p>
        {dept?.is_head && (
          <span className="mt-0.5 inline-block rounded-pill bg-mint-light px-2 py-px text-[10.5px] font-semibold text-mint-deep">
            {headLabel(dept)}
          </span>
        )}
      </div>
    </div>
  );

  const SignOut = () => (
    <button
      onClick={async () => { await signOut(); navigate("/login"); }}
      className="shrink-0 rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted transition-colors hover:border-mint-light hover:bg-mint-tint hover:text-mint-deep"
    >
      خروج
    </button>
  );

  /* ---------- رابط في القائمة ---------- */
  const navItem = (i, { iconOnly, sub, active: act, badge } = {}) => {
    const active = act ?? isActive(i);
    const n = badge ?? badgeOf(i.to);
    return (
      <NavLink
        key={i.to}
        to={i.to}
        end={i.to === "/"}
        onClick={() => reopenPage(i)}
        title={iconOnly ? i.label : undefined}
        aria-label={iconOnly ? i.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-sm2 text-[13.5px] transition-colors ${
          iconOnly ? "justify-center px-0 py-2.5" : "px-3 py-2"
        } ${
          active
            ? "bg-mint-tint font-semibold text-mint-deep before:absolute before:inset-y-1.5 before:right-0 before:w-[3px] before:rounded-full before:bg-mint-deep"
            : "font-medium text-muted hover:bg-canvas hover:text-ink"
        }`}
      >
        <Icon name={i.icon} className={`h-[18px] w-[18px] ${active ? "" : "text-faint"}`} />
        {!iconOnly && (
          <span className="min-w-0 flex-1">
            <span className="block truncate">{i.label}</span>
            {sub && <span className="block truncate text-[11px] font-normal text-faint">{sub}</span>}
          </span>
        )}
        <Badge n={n} dot={iconOnly} at="top-1.5 left-4" />
      </NavLink>
    );
  };

  /* ---------- القائمة نفسها: للمكتب (قابلة للطي) وللجوال ---------- */
  const sideNav = (desktop = false) => {
    const iconOnly = desktop && collapsed;
    return (
      <>
        {/* البحث */}
        <div className={`border-b border-line ${iconOnly ? "px-3 py-3" : "px-3 py-3"}`}>
          {iconOnly ? (
            <button type="button" title="بحث في القائمة (Ctrl+K)"
                    onClick={() => { setCollapsedSaved(false); setTimeout(() => searchRef.current?.focus(), 0); }}
                    className="grid h-9 w-full place-items-center rounded-sm2 text-muted hover:bg-canvas hover:text-ink">
              <Icon name="search" />
            </button>
          ) : (
            <label className="flex h-9 items-center gap-2 rounded-sm2 border border-line bg-canvas/60 px-2.5 text-muted focus-within:border-mint-deep focus-within:bg-white">
              <Icon name="search" className="h-4 w-4" />
              <input
                ref={desktop ? searchRef : undefined}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                  if (e.key === "Enter" && results?.length) navigate(results[0].to);
                }}
                placeholder="ابحث في القائمة…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
              />
              {desktop && !query && (
                <kbd className="num shrink-0 rounded border border-line bg-white px-1.5 text-[10px] font-medium text-faint" dir="ltr">
                  Ctrl K
                </kbd>
              )}
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث"
                        className="shrink-0 text-faint hover:text-ink">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              )}
            </label>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto py-3 ${iconOnly ? "px-2" : "px-3"}`}>
          {results ? (
            results.length ? (
              <div className="space-y-0.5">
                {results.map((i) => navItem(i, { sub: i.group }))}
              </div>
            ) : (
              <p className="px-3 py-6 text-center text-[13px] text-muted">لا توجد صفحة بهذا الاسم</p>
            )
          ) : isAdmin ? (
            <>
              <div className="space-y-0.5">{topItems.map((i) => navItem(i, { iconOnly }))}</div>
              <div className={iconOnly ? "mt-2 border-t border-line pt-2" : "mt-3"}>
                {!iconOnly && <p className="mb-1 px-3 py-1.5 text-[12px] font-bold text-muted">الأقسام</p>}
                <div className="space-y-0.5">{sections.map((x) => sectionNav(x, iconOnly))}</div>
              </div>
              {/* «الأكثر استخدامًا» بعد الأقسام، في صندوق بلون ذهبي يميّزه عنها */}
              {frequent.length > 0 && (
                <div className={`mt-3 rounded-card border border-[#EADFBF] bg-[#FCF5E6] ${iconOnly ? "p-1" : "p-1.5"}`}>
                  {!iconOnly && <p className="mb-1 px-3 py-1 text-[12px] font-bold text-[#8A6A1F]">الأكثر استخدامًا</p>}
                  <div className="space-y-0.5">{frequent.map((i) => navItem(i, { iconOnly }))}</div>
                </div>
              )}
            </>
          ) : (
            groups.map((g, gi) => {
              const isOpen = !g.title || openGroups.has(g.title);
              return (
                <div key={g.title ?? gi} className={gi ? (iconOnly ? "mt-2 border-t border-line pt-2" : "mt-3") : ""}>
                  {g.title && !iconOnly && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.title)}
                      aria-expanded={isOpen}
                      className="mb-1 flex w-full items-center gap-2 rounded-sm2 px-3 py-1.5 text-[12px] font-bold text-muted hover:text-ink"
                    >
                      <span className="flex-1 text-right">{g.title}</span>
                      {!isOpen && g.items.some((i) => badgeOf(i.to) > 0) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-absent" />
                      )}
                      <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "" : "rotate-90"}`}
                           fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  )}
                  {(isOpen || iconOnly) && (
                    <div className="space-y-0.5">
                      {g.items.map((i) => navItem(i, { iconOnly }))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* أسفل القائمة: الحساب والمساعدة — صف أيقونات واحد يظهر اسم كلٍّ منها عند الوقوف عليه،
            وفي القائمة المطوية عمود أيقونات كما هي */}
        <div className={`border-t border-line py-2 ${iconOnly ? "space-y-0.5 px-2" : "flex items-center gap-1 px-3"}`}>
          {footer.map((i) => iconOnly ? navItem(i, { iconOnly }) : (
            <div key={i.to} className="min-w-0 flex-1">{navItem(i, { iconOnly: true })}</div>
          ))}
          {desktop && (
            <button type="button" onClick={() => setCollapsedSaved(!collapsed)}
                    title={collapsed ? "توسيع القائمة" : "طيّ القائمة"} aria-label={collapsed ? "توسيع القائمة" : "طيّ القائمة"}
                    className={`flex items-center justify-center rounded-sm2 py-2.5 text-faint hover:bg-canvas hover:text-ink ${
                      iconOnly ? "w-full" : "min-w-0 flex-1"
                    }`}>
              <Icon name={collapsed ? "panelOpen" : "panel"} className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-tint">
      <AnnouncementModal />
      <IdleLogout />
      <TrialBanner />

      {/* شريط علوي للجوال */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        {/* زر القائمة العلوي يُستغنى عنه بزر «المزيد» في الشريط السفلي — يبقى فقط إن لم يظهر الشريط */}
        {bottomItems.length === 0 && (
          <button onClick={() => setOpen(true)} aria-label="القائمة"
                  className="rounded-sm2 border border-line p-2 text-muted hover:bg-canvas">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        )}
        <UserInline />
        <Actions />
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* القائمة الجانبية — سطح المكتب */}
        <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-l border-line bg-white transition-[width] duration-200 lg:flex print:hidden ${
          collapsed ? "w-[72px]" : "w-64"
        }`}>
          <div className={`flex h-[4.5rem] items-center border-b border-line ${collapsed ? "justify-center px-2" : "px-4"}`}>
            <Brand iconOnly={collapsed} />
          </div>
          {sideNav(true)}
        </aside>

        {/* القائمة المنسدلة — الجوال */}
        <div className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-200 lg:hidden ${
               open ? "opacity-100" : "pointer-events-none opacity-0"}`}
             onClick={() => setOpen(false)} />
        <aside aria-hidden={!open}
               className={`fixed inset-y-0 right-0 z-50 flex w-[19rem] max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-200 lg:hidden ${
                 open ? "translate-x-0" : "invisible translate-x-full"}`}>
          <div className="border-b border-line px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <Brand compact />
              <button onClick={() => setOpen(false)} aria-label="إغلاق"
                      className="rounded-sm2 p-1.5 text-muted hover:bg-canvas">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>
          {sideNav()}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* شريط علوي — سطح المكتب */}
          <header className="sticky top-0 z-20 hidden h-[4.5rem] border-b border-line bg-white/95 backdrop-blur lg:block print:hidden">
            <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-3 px-6">
              <UserInline />
              <Actions />
            </div>
          </header>

          {/* الزر العائم فوق الشريط السفلي: مسافة إضافية أسفل الصفحة كي لا يغطي آخر المحتوى */}
          <main className={`min-w-0 flex-1 px-4 pt-5 sm:px-6 lg:pb-5 ${showBack ? "pb-36" : "pb-24"}`}>
            <NavContext.Provider value={{ sections, badgeOf }}>
              <div key={pageKey} className="mx-auto max-w-5xl">{children}</div>
            </NavContext.Provider>
            {/* سطر الحقوق أسفل كل صفحة، بعيدًا عن أزرار القائمة */}
            <footer className="mx-auto mt-10 max-w-5xl border-t border-line pt-3 text-center text-[11px] leading-relaxed text-faint print:hidden">
              {RIGHTS_LINE} · <Link to="/terms" className="hover:text-mint-deep">الشروط</Link> · <Link to="/privacy" className="hover:text-mint-deep">الخصوصية</Link>
            </footer>
          </main>
          {isStaff && <QuickNote />}
        </div>
      </div>

      {/* زر رجوع عائم — الجوال: قريبًا من الإبهام */}
      {showBack && (
        <button type="button" onClick={onBack}
                className={`fixed right-4 z-30 flex items-center gap-1.5 rounded-pill bg-mint-deep py-2.5 pl-4 pr-3 text-sm font-semibold text-white shadow-lg hover:bg-mint-hover lg:hidden print:hidden ${
                  bottomItems.length > 0 ? "bottom-[calc(5rem+env(safe-area-inset-bottom))]" : "bottom-6"}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span className="max-w-[11rem] truncate">{steps.at(-1)?.label ?? "رجوع"}</span>
        </button>
      )}

      {/* الشريط السفلي — الجوال: أهم الصفحات و«المزيد» يفتح القائمة كاملة */}
      {bottomItems.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
          <div className="mx-auto flex max-w-lg">
            {bottomItems.map((i) => {
              const active = isActive(i);
              return (
                <NavLink key={i.to} to={i.to} end={i.to === "/"}
                         className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10.5px] ${
                           active ? "font-bold text-mint-deep" : "font-medium text-muted"}`}>
                  {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-mint-deep" />}
                  <span className="relative">
                    <Icon name={i.to === "/" && !isStaff ? "home" : i.icon} className="h-[22px] w-[22px]" />
                    <Badge n={badgeOf(i.to)} dot />
                  </span>
                  <span className="max-w-full truncate px-1">
                    {i.to === "/" ? "الرئيسية" : BOTTOM_LABEL[i.to] ?? i.label}
                  </span>
                </NavLink>
              );
            })}
            <button type="button" onClick={() => setOpen(true)}
                    className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10.5px] ${
                      open ? "font-bold text-mint-deep" : "font-medium text-muted"}`}>
              <span className="relative">
                <Icon name="more" className="h-[22px] w-[22px]" />
                {/* تنبيه على صفحة داخل القائمة لا تظهر في الشريط */}
                <Badge n={allVisible.filter((i) => !bottomItems.includes(i)).reduce((a, i) => a + badgeOf(i.to), 0)} dot />
              </span>
              <span>المزيد</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
