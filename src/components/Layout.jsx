// src/components/Layout.jsx
import { useState, useEffect, useMemo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession, ROLE_LABEL, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { useTeacherHiddenTabs } from "../lib/useTeacherHiddenTabs.js";
import { useTeacherGrantedTabs } from "../lib/useTeacherGrantedTabs.js";
import logoIcon from "../assets/icon-mint.png";
import TrialBanner from "./TrialBanner.jsx";
import NotificationBell from "./NotificationBell.jsx";
import AnnouncementModal from "./AnnouncementModal.jsx";

/* أقسام قائمة الإدارة — مجمّعة منطقيًا */
const ADMIN_GROUPS = [
  {
    title: null,
    items: [
      { to: "/", label: "الرئيسية", perm: null, icon: "home" },
      // لا يظهر لمشرف الدعم الفني ولا لمدير المدرسة — هما لا يرفعان طلب دعم لأنفسهما
      { to: "/help", label: "دليل الاستخدام", perm: null, icon: "book" },
      { to: "/contact", label: "الدعم الفني", perm: null, icon: "chat", hideForRoles: ["tech_support", "principal"] },
    ],
  },
  {
    title: "شؤون الطلاب",
    items: [
      { to: "/students",    label: "كشوف الطلاب",    perm: "students",    icon: "users" },
      { to: "/results-admin", label: "نتائج الطلاب", perm: "results", icon: "award" },
      { to: "/attendance-overview", label: "الحضور والغياب", perm: "reports", icon: "check" },
      { to: "/period-attendance", label: "تحضير الحصص اليومية", perm: "reports", icon: "clock" },
      { to: "/reports",     label: "التقارير",  perm: "reports",     icon: "chart" },
      { to: "/permissions", label: "الاستئذان", perm: "permissions", icon: "ticket" },
      { to: "/exams-admin", label: "جداول الاختبارات", perm: "students", icon: "calendar" },
    ],
  },
  {
    title: "الشؤون التعليمية",
    items: [
      { to: "/general-schedule",  label: "الجدول العام",          anyPerm: ["import", "schedules"], icon: "grid" }, // جدول شامل بالفصول والمعلمين معًا
      { to: "/teacher-schedules", label: "جداول المعلمين",        anyPerm: ["import", "schedules"], icon: "chalk" },
      { to: "/student-schedules", label: "جداول الطلاب",          anyPerm: ["import", "schedules"], icon: "users" },
      { to: "/schedule-import",   label: "استيراد الجدول الذكي", perm: "import", icon: "upload" },
      { to: "/teacher-permissions", label: "صلاحيات المعلمين",   perm: "staff",  icon: "shield" },
      { to: "/substitute-report", label: "تقرير حصص الانتظار", anyPerm: ["import", "reports"], icon: "chart" },
      { to: "/duty",              label: "المناوبة والإشراف",  perm: "staff",  icon: "calendar" },
    ],
  },
  {
    title: "المحتوى",
    items: [
      { to: "/news-admin",     label: "الأخبار والمقالات",   perm: "news",     icon: "news" },
      { to: "/notifications",  label: "الإشعارات", perm: "notifications", icon: "bell" },
      { to: "/notifications-review", label: "اعتماد الإشعارات", techOnly: true, icon: "check" },
      { to: "/announcements",  label: "رسالة الدخول", perm: "notifications", icon: "megaphone" },
      { to: "/guides-admin",   label: "الأدلة",    perm: "guides",   icon: "book" },
    ],
  },
  {
    title: "النماذج والشهادات",
    items: [
      { to: "/forms",        label: "إصدار النماذج", perm: null, icon: "certificate" },
      { to: "/forms-admin",  label: "إدارة النماذج", manageForms: true, icon: "shield" },
      { to: "/my-documents", label: "نماذجي",        perm: null, icon: "certificate" },
      { to: "/my-signature", label: "توقيعي",        perm: null, icon: "edit" },
    ],
  },
  {
    title: "الأحداث والمناسبات",
    items: [
      { to: "/events",         label: "الأحداث والمناسبات", perm: null, icon: "news" },
      { to: "/events-reports", label: "تقارير الأحداث",     perm: null, icon: "chart" },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { to: "/records-manual", label: "تعديل السجلات", perm: "records", icon: "edit" },
      { to: "/import",         label: "الاستيراد",           perm: "import",         icon: "upload" },
      { to: "/season",         label: "التوقيت الزمني",       perm: "import",         icon: "clock" },
      { to: "/accounts",       label: "الحسابات",            perm: "accounts",       icon: "key" },
      { to: "/staff",          label: "الإدارة",             perm: "staff",          icon: "shield" },
      { to: "/calendar-admin", label: "التقويم والإجازات",   perm: "calendar",       icon: "calendar" },
      { to: "/password-reset", label: "استعادة كلمة المرور", perm: "password_reset", icon: "lock" },
    ],
  },
  {
    title: "الدعم الفني",
    items: [
      { to: "/feedback-admin", label: "مركز الدعم والمساندة", perm: "feedback", icon: "chat" },
      { to: "/support-report", label: "تقرير ومتابعة الدعم", perm: "feedback", icon: "chart" },
      { to: "/login-log", label: "سجل الدخول والخروج", perm: "login_log", icon: "key" },
      { to: "/site-metrics", label: "مؤشرات الموقع", techOnly: true, icon: "chart" },
      { to: "/maintenance", label: "وضع الصيانة", techOnly: true, icon: "wrench" },
    ],
  },
];

const OTHER_NAV = {
  // قائمة المعلم مقسّمة بحسب طبيعة العمل — تُعرض مجموعاتٍ كلوحة الإدارة
  teacher: [
    { group: "المهام اليومية" },
    { to: "/",           label: "الحضور والغياب اليومي", tabKey: "attendance", icon: "home" },
    { to: "/substitute", label: "حصص الانتظار",          tabKey: "substitute", icon: "clock" },
    { to: "/schedule",   label: "جدولي",                 tabKey: "schedule",   icon: "grid" },
    { to: "/permissions", label: "الاستئذان",            extraTabKey: "permissions", icon: "ticket" },

    { group: "الطلاب" },
    { to: "/records",    label: "السجلات",               tabKey: "records",    icon: "users" },
    { to: "/follow-up",  label: "سجل المتابعة الإلكتروني", icon: "chalk" },
    { to: "/referrals",  label: "إحالة طالب",            icon: "shield" },
    { to: "/reports",    label: "التقارير",              tabKey: "reports",    icon: "chart" },

    { group: "الاختبارات والأنشطة" },
    { to: "/exams",      label: "جداول الاختبارات",       icon: "calendar" },
    { to: "/quizzes",    label: "اختباراتي",              icon: "edit" },
    { to: "/quiz-marks", label: "التصحيح والدرجات",       icon: "chart" },
    { to: "/events",     label: "الأحداث والمناسبات",     icon: "news" },

    { group: "النماذج" },
    { to: "/forms",        label: "النماذج والشهادات",   icon: "certificate" },
    { to: "/my-documents", label: "نماذجي",              icon: "certificate" },
    { to: "/my-signature", label: "توقيعي",              icon: "key" },
    { to: "/notify",       label: "الإشعارات",            tabKey: "notify",    icon: "chat" },
    { to: "/news-admin",   label: "الأخبار والمقالات",    extraTabKey: "news", icon: "news" },

    { group: "مركز الدعم والمساندة" },
    { to: "/help",     label: "دليل الاستخدام", icon: "book" },
    { to: "/contact",  label: "الدعم الفني",    icon: "chat" },
  ],
  student:  [
    { to: "/", label: "الرئيسية" },
    { to: "/exams", label: "جداول الاختبارات" },
    { to: "/my-documents", label: "نماذجي" },
    { to: "/help", label: "دليل الاستخدام" },
    { to: "/contact", label: "الدعم الفني" },
  ],
  guardian: [
    { to: "/", label: "الرئيسية" },
    { to: "/exams", label: "جداول الاختبارات" },
    { to: "/my-documents", label: "نماذجي" },
    { to: "/help", label: "دليل الاستخدام" },
    { to: "/contact", label: "الدعم الفني" },
  ],
};

/* أيقونات خطّية بسيطة */
function Icon({ name, className = "h-[18px] w-[18px]" }) {
  const p = {
    home:   "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
    users:  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9",
    chart:  "M3 3v18h18M7 15V9m5 6V5m5 10v-4",
    ticket: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z",
    news:   "M4 5h12v14H4zM16 8h4v9a2 2 0 0 1-4 0zM7 9h6M7 12h6M7 15h4",
    chat:   "M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z",
    upload: "M12 16V4m-5 5 5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
    grid:   "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    chalk:  "M4 19v-3l11-11 3 3-11 11H4ZM14 6l3 3",
    clock:  "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    key:    "M14 7a4 4 0 1 1-5.6 5.6L3 18v3h3l5.4-5.4A4 4 0 0 1 14 7Z",
    shield: "M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z",
    lock:   "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
    book:   "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z",
    bell:   "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
    check:  "M20 6 9 17l-5-5",
    megaphone: "M3 11v2a2 2 0 0 0 2 2h1l2 6h2l-1.5-6H10l9 4V5l-9 4H5a2 2 0 0 0-2 2Zm7-2v6",
    wrench: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2Z",
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
    award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.2 13.5 6 21l6-3 6 3-2.2-7.5",
    calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
    certificate: "M6 3h12v13l-6 5-6-5zM9 8h6M9 11h6",
  }[name];

  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} shrink-0`}
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}

export default function Layout({ children }) {
  const { session, profile, adminRoles, signOut, can, effectiveRole, dualRole, switchView } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // عدّاد الإشعارات المعلّقة بانتظار الاعتماد — للدعم الفني فقط
  const [pendingReview, setPendingReview] = useState(0);
  const isTech = (adminRoles ?? []).includes("tech_support");
  useEffect(() => {
    if (!isTech) return;
    let alive = true;
    const load = async () => {
      const { count } = await supabase
        .from("notification_drafts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (alive) setPendingReview(count ?? 0);
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [isTech, location.pathname]);

  // النماذج التي أعادها المدير لهذا المستخدم للتعديل
  const [returnedForms, setReturnedForms] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("form_documents")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "rejected");
      if (alive) setReturnedForms(count ?? 0);
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [location.pathname]);

  const isAdmin = effectiveRole === "admin";

  const groups = ADMIN_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (i.hideForRoles?.some((r) => adminRoles.includes(r))) return false;
        // anyPerm: يظهر العنصر لمن يملك أيًّا من الصلاحيات المذكورة
        const permOk = i.anyPerm
          ? i.anyPerm.some((p) => can(p))
          : !i.perm || can(i.perm);
        if (i.manageForms)
          return adminRoles.includes("tech_support") || adminRoles.includes("principal");
        return i.techOnly ? adminRoles.includes("tech_support") : permOk;
      }),
    }))
    .filter((g) => g.items.length);

  // طيّ أقسام القائمة الجانبية — يبقى مفتوحًا تلقائيًا القسم الذي يحوي الصفحة الحالية فقط
  const [openTitle, setOpenTitle] = useState(null); // null = استخدم القسم النشط تلقائيًا
  const activeGroupTitle =
    groups.find(
      (g) =>
        g.title &&
        g.items.some((i) => (i.to === "/" ? location.pathname === "/" : location.pathname.startsWith(i.to)))
    )?.title ?? null;
  const effectiveOpenTitle = openTitle !== null ? openTitle : activeGroupTitle;
  const toggleGroup = (title) => setOpenTitle(effectiveOpenTitle === title ? "" : title);

  const { hidden: hiddenTabs } = useTeacherHiddenTabs();
  const { granted: grantedTabs } = useTeacherGrantedTabs();
  const items = useMemo(() => {
    if (isAdmin) return [];
    const kept = (OTHER_NAV[effectiveRole] ?? []).filter((i) => {
      if (i.group) return true;
      if (i.extraTabKey) return grantedTabs.has(i.extraTabKey);
      return !i.tabKey || !hiddenTabs.has(i.tabKey);
    });
    // إسقاط عنوان أي مجموعة لم يبقَ تحتها رابط
    return kept.filter((i, idx) => {
      if (!i.group) return true;
      const next = kept[idx + 1];
      return next && !next.group;
    });
  }, [isAdmin, effectiveRole, grantedTabs, hiddenTabs]);

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

  const subtitle =
    isAdmin && adminRoles.length
      ? adminRoles.map((r) => ADMIN_ROLE_LABEL[r] ?? r).join(" · ")
      : effectiveRole === "teacher" && spec
      ? `معلم · ${spec}`
      : ROLE_LABEL[effectiveRole] ?? "";

  // زر التبديل بين واجهة الإدارة وواجهة المعلم — يظهر فقط لمن يجمع الدورين
  const ViewSwitch = () => {
    if (!dualRole) return null;
    const toTeacher = isAdmin; // في واجهة الإدارة → ننتقل لواجهة المعلم
    return (
      <button
        onClick={() => { switchView(toTeacher ? "teacher" : "admin"); navigate("/"); }}
        title="التبديل بين واجهة الإدارة وواجهة المعلم"
        className="flex shrink-0 items-center gap-1.5 rounded-pill border border-mint-deep bg-mint-tint px-3 py-1.5 text-xs font-semibold text-mint-deep transition-colors hover:bg-mint-light sm:px-3.5"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3 4 7l4 4M4 7h13M16 21l4-4-4-4M20 17H7" />
        </svg>
        <span className="hidden sm:inline">{toTeacher ? "واجهة المعلم" : "واجهة الإدارة"}</span>
      </button>
    );
  };

  const Brand = ({ compact }) => (
    <NavLink to="/" end className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80">
      <img src={logoIcon} alt="" className="h-9 w-9 shrink-0 object-contain" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-ink">
          بوابة مكة الثانوية
        </p>
        {!compact && <p className="truncate text-xs text-muted">مدرسة مكة الثانوية</p>}
      </div>
    </NavLink>
  );

  const Actions = () => (
    <div className="flex shrink-0 items-center gap-2">
      <ViewSwitch />
      <PreviewSite />
      <NotificationBell />
      <SignOut />
    </div>
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
      className="flex shrink-0 items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint hover:text-mint-deep sm:px-3.5"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none"
           stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
      </svg>
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
      </div>
    </div>
  );

  const SignOut = () => (
    <button
      onClick={async () => { await signOut(); navigate("/login"); }}
      className="shrink-0 rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint hover:text-mint-deep"
    >
      خروج
    </button>
  );

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-sm2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-mint-tint text-mint-deep"
        : "text-muted hover:bg-canvas hover:text-ink"
    }`;

  /* ================= واجهة الإدارة: قائمة جانبية ================= */
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-tint">
        <AnnouncementModal />
        <TrialBanner />

        {/* شريط علوي للجوال */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="القائمة"
                  className="rounded-sm2 border border-line p-2 text-muted hover:bg-canvas">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <UserInline />
          <Actions />
        </header>

        <div className="mx-auto flex max-w-[1400px]">
          {/* القائمة الجانبية — سطح المكتب */}
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-line bg-white lg:flex">
            <div className="flex h-[4.5rem] items-center border-b border-line px-4">
              <Brand />
            </div>

            <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {groups.map((g, gi) => {
                const isOpen = !g.title || effectiveOpenTitle === g.title;
                return (
                  <div key={gi}>
                    {g.title && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.title)}
                        className="mb-1.5 flex w-full items-center justify-between rounded-sm2 px-3 py-2 text-[13px] font-bold text-muted hover:bg-canvas hover:text-ink"
                      >
                        <span>{g.title}</span>
                        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                             fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                    )}
                    {isOpen && (
                      <div className="space-y-0.5">
                        {g.items.map((i) => (
                          <NavLink key={i.to} to={i.to} end={i.to === "/"} className={linkClass}>
                            <Icon name={i.icon} />
                            <span className="truncate">{i.label}</span>
                            {i.to === "/forms" && returnedForms > 0 && (
                              <span className="num ml-auto shrink-0 rounded-full bg-absent px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {returnedForms}
                              </span>
                            )}
                            {i.to === "/notifications-review" && pendingReview > 0 && (
                              <span className="num ml-auto shrink-0 rounded-full bg-absent px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {pendingReview}
                              </span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

          </aside>

          {/* القائمة المنسدلة — الجوال */}
          {open && (
            <>
              <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
                   onClick={() => setOpen(false)} />
              <aside className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-white shadow-xl lg:hidden">
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

                <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
                  {groups.map((g, gi) => {
                    const isOpen = !g.title || effectiveOpenTitle === g.title;
                    return (
                      <div key={gi}>
                        {g.title && (
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.title)}
                            className="mb-1.5 flex w-full items-center justify-between rounded-sm2 px-3 py-2 text-[13px] font-bold text-muted hover:bg-canvas hover:text-ink"
                          >
                            <span>{g.title}</span>
                            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                 fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        )}
                        {isOpen && (
                          <div className="space-y-0.5">
                            {g.items.map((i) => (
                              <NavLink key={i.to} to={i.to} end={i.to === "/"}
                                       onClick={() => setOpen(false)} className={linkClass}>
                                <Icon name={i.icon} />
                                <span className="truncate">{i.label}</span>
                            {i.to === "/forms" && returnedForms > 0 && (
                              <span className="num ml-auto shrink-0 rounded-full bg-absent px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {returnedForms}
                              </span>
                            )}
                            {i.to === "/notifications-review" && pendingReview > 0 && (
                              <span className="num ml-auto shrink-0 rounded-full bg-absent px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {pendingReview}
                              </span>
                            )}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </aside>
            </>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* شريط علوي — سطح المكتب */}
            <header className="sticky top-0 z-20 hidden h-[4.5rem] border-b border-line bg-white/95 backdrop-blur lg:block">
              <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-3 px-6">
                <UserInline />
                <Actions />
              </div>
            </header>

            <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
              <div className="mx-auto max-w-5xl">{children}</div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  /* ====== باقي الفئات: قائمة جانبية على المتصفح، ومنسدلة في الجوال ====== */
  return (
    <div className="min-h-screen bg-gray-tint">
      <AnnouncementModal />
      <TrialBanner />

      {/* شريط علوي للجوال */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="القائمة"
                className="rounded-sm2 border border-line p-2 text-muted hover:bg-canvas">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <UserInline />
        <Actions />
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* القائمة الجانبية — المتصفح */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-line bg-white lg:flex">
          <div className="flex h-[4.5rem] items-center border-b border-line px-4">
            <Brand />
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
            {items.map((i, k) => (
              i.group ? (
                <p key={`g${k}`}
                   className={`px-3 pb-1 text-[11px] font-bold text-faint ${k ? "pt-4" : ""}`}>
                  {i.group}
                </p>
              ) : (
                <NavLink key={i.to} to={i.to} end={i.to === "/"} className={linkClass}>
                  <Icon name={i.icon} />
                  <span className="truncate">{i.label}</span>
                </NavLink>
              )
            ))}
          </nav>
        </aside>

        {/* القائمة المنسدلة — الجوال */}
        {open && (
          <>
            <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-white shadow-xl lg:hidden">
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
              <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
                {items.map((i, k) => (
                  i.group ? (
                    <p key={`g${k}`}
                       className={`px-3 pb-1 text-[11px] font-bold text-faint ${k ? "pt-4" : ""}`}>
                      {i.group}
                    </p>
                  ) : (
                    <NavLink key={i.to} to={i.to} end={i.to === "/"}
                             onClick={() => setOpen(false)} className={linkClass}>
                      <Icon name={i.icon} />
                      <span className="truncate">{i.label}</span>
                    </NavLink>
                  )
                ))}
              </nav>
            </aside>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* شريط علوي — المتصفح */}
          <header className="sticky top-0 z-20 hidden h-[4.5rem] border-b border-line bg-white/95 backdrop-blur lg:block">
            <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-3 px-6">
              <UserInline />
              <Actions />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
