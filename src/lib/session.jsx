import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "./supabase";
import { setHolidayRanges, todayISO } from "./schoolTime";

const SessionContext = createContext(null);

// الأدوار التي تملك صلاحية كاملة دائمًا
const SUPER_ROLES = ["principal", "tech_support"];

// يُحمّل الإجازات الرسمية المفعّلة مرة واحدة عند إقلاع البوابة، ويخزّنها في
// schoolTime حتى تعمل دوال اليوم/العطلة المتزامنة في كل الشاشات. لا يُعطّل
// الدخول أبدًا لو فشل (يبقى بلا إجازات = أيام دراسية عادية).
async function loadHolidays() {
  try {
    const iso = todayISO();
    const { data } = await supabase
      .from("academic_calendar")
      .select("title, start_date, end_date")
      .eq("kind", "holiday")
      .eq("is_active", true)
      .or(`end_date.gte.${iso},and(end_date.is.null,start_date.gte.${iso})`);
    setHolidayRanges(
      (data ?? []).map((r) => ({
        name: r.title,
        start: r.start_date,
        end: r.end_date || r.start_date,
      })),
    );
  } catch {
    setHolidayRanges([]);
  }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [adminRoles, setAdminRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  // يُرفع أثناء جلب بيانات المستخدم، فلا تُعرض شاشة «الحساب غير مفعّل» قبل وصولها
  const [profileLoading, setProfileLoading] = useState(false);
  // دعم الدور المزدوج (معلم + إداري): هل للمستخدم سجل معلّم أيضًا؟ وأي واجهة نشطة الآن؟
  const [isTeacher, setIsTeacher] = useState(false);
  const [view, setViewState] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfileLoading(false);
      setProfile(null);
      setAdminRoles([]);
      setPermissions([]);
      setIsTeacher(false);
      setViewState(null);
      return;
    }
    setProfileLoading(true);

    const { data: u } = await supabase
      .from("users")
      .select("id, username, full_name, role, is_active, must_change_pw")
      .eq("id", userId)
      .maybeSingle();

    setProfile(u ?? null);

    // هل هذا المستخدم معلّم أيضًا؟ (سجل في جدول المعلمين مرتبط به) — لدعم
    // الشخص الذي يجمع بين مهمة إدارية ومهمة تدريس، فينتقل بين الواجهتين.
    const { data: tRow } = await supabase
      .from("teachers").select("id").eq("user_id", userId).maybeSingle();
    const teacherRec = !!tRow;
    setIsTeacher(teacherRec);

    // المستخدم المزدوج (دوره الأساسي إداري وله سجل معلّم): نهيّئ الواجهة
    // النشطة من آخر اختيار محفوظ، وإلا نبدأ بواجهة الإدارة (دوره المسجّل)،
    // مع إتاحة زر التبديل لواجهة المعلم.
    if (u?.role === "admin" && teacherRec) {
      let saved = null;
      try { saved = localStorage.getItem("mk_view_" + userId); } catch { /* تجاهل */ }
      setViewState(saved === "admin" || saved === "teacher" ? saved : "admin");
    } else {
      setViewState(null);
    }

    if (u?.role === "admin") {
      const { data: roles } = await supabase
        .from("admin_roles")
        .select("role_type")
        .eq("user_id", userId);

      const list = (roles ?? []).map((r) => r.role_type);
      setAdminRoles(list);

      // صلاحية كاملة للمدير والدعم الفني
      if (list.some((r) => SUPER_ROLES.includes(r))) {
        setPermissions(["*"]);
      } else if (list.length) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("permission")
          .in("role_type", list);
        setPermissions([...new Set((perms ?? []).map((p) => p.permission))]);
      } else {
        setPermissions([]);
      }
    } else {
      setAdminRoles([]);
      setPermissions([]);
    }

    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user?.id);
      await loadHolidays();            // قبل عرض الصفحات حتى تكون حالة العطلة صحيحة من أول عرض
      if (alive) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!alive) return;
      setSession(s ?? null);
      await loadProfile(s?.user?.id);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = async () => {
    // تسجيل عملية الخروج في سجل الدخول والخروج — بلا انتظار ولا تعطيل لو فشل
    const nid = profile?.username;
    if (nid) {
      supabase
        .from("login_log")
        .insert({ national_id: nid, event_type: "logout", success: true })
        .then(() => {}, () => {});
    }

    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
    setAdminRoles([]);
    setPermissions([]);
    setIsTeacher(false);
    setViewState(null);
  };

  // الدور المزدوج: إداري + معلّم في حساب واحد
  const dualRole = profile?.role === "admin" && isTeacher;
  // الواجهة الفعّالة للعرض: للمزدوج تتبع اختياره، ولغيره دوره الأساسي
  const effectiveRole = dualRole ? (view ?? "teacher") : profile?.role;
  const switchView = (v) => {
    if (!dualRole || (v !== "admin" && v !== "teacher")) return;
    setViewState(v);
    try { localStorage.setItem("mk_view_" + (session?.user?.id ?? ""), v); } catch { /* تجاهل */ }
  };

  const hasAdminRole = (...roles) => roles.some((r) => adminRoles.includes(r));

  // هل يملك المستخدم هذه الصلاحية؟
  const can = (perm) =>
    permissions.includes("*") || permissions.includes(perm);

  const isSuper = adminRoles.some((r) => SUPER_ROLES.includes(r));

  return (
    <SessionContext.Provider
      value={{
        session, profile, adminRoles, permissions, loading, profileLoading,
        signOut, hasAdminRole, can, isSuper,
        isTeacher, dualRole, effectiveRole, view, switchView,
        reload: () => loadProfile(session?.user?.id),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession خارج SessionProvider");
  return ctx;
};

export const ROLE_LABEL = {
  admin: "الإدارة المدرسية",
  teacher: "المعلم",
  student: "الطالب",
  guardian: "ولي الأمر",
};

export const ADMIN_ROLE_LABEL = {
  principal:       "مدير المدرسة",
  deputy_academic: "وكيل الشؤون التعليمية",
  deputy_school:   "وكيل الشؤون المدرسية",
  deputy_students: "وكيل شؤون الطلاب",
  counselor_1:     "الموجه الطلابي 1",
  counselor_2:     "الموجه الطلابي 2",
  counselor_3:     "الموجه الطلابي 3",
  clerk:           "المساعد الإداري 1",
  clerk_2:         "المساعد الإداري 2",
  activity_leader: "رائد النشاط",
  tech_support:    "الدعم الفني",
  media_portal:    "البوابة الإعلامية",
  gifted_program:  "برنامج الموهوبين",
  globe_program:   "برنامج جلوب البيئي العالمي",
  student_voice:   "برنامج صوت الطالب",
  makkah_sport:    "مكة سبورت",
  safety_security: "مسؤول الأمن والسلامة",
  health_counselor: "الموجه الصحي",
  science_labs:     "مختبرات العلوم",
  computer_lab:     "معمل الحاسب الآلي",
  // أدوار قديمة (للتوافق مع بيانات سابقة)
  deputy:          "الوكيل",
  counselor:       "الموجه الطلابي",
};

// الأدوار المتاحة للإسناد في شاشة الإدارة
export const ASSIGNABLE_ROLES = [
  "principal",
  "deputy_academic",
  "deputy_school",
  "deputy_students",
  "counselor_1",
  "counselor_2",
  "counselor_3",
  "clerk",
  "clerk_2",
  "activity_leader",
  "tech_support",
  "media_portal",
  "gifted_program",
  "globe_program",
  "student_voice",
  "makkah_sport",
  "safety_security",
  "health_counselor",
  "science_labs",
  "computer_lab",
];

// تدرّج لوني مميّز لكل حساب إداري — يُستخدم في بطاقة غلاف الأخبار
// بدلًا من رفع صورة يدويًا (كل حساب له لون ثابت وتلقائي خاص به)
export const ROLE_COVER_HUE = {
  principal:       152,
  deputy_academic: 176,
  deputy_school:   200,
  deputy_students: 224,
  counselor_1:     248,
  counselor_2:     272,
  counselor_3:     296,
  clerk:           320,
  clerk_2:         308,
  activity_leader: 344,
  tech_support:      8,
  media_portal:     32,
  gifted_program:   56,
  globe_program:    80,
  student_voice:   104,
  makkah_sport:    128,
  safety_security: 356,
  health_counselor: 188,
  science_labs:     68,
  computer_lab:    236,
};

// يبني تدرّجًا لونيًا CSS من قيمة hue الخاصة بالحساب
export const coverGradient = (hue) =>
  `linear-gradient(135deg, hsl(${hue} 58% 32%), hsl(${hue} 64% 50%))`;

// اسم شاغل الحساب — يظهر تحت مسمّى الحساب في بطاقة غلاف الخبر (اختياري)
export const ROLE_PERSON_NAME = {
  principal:       "الأستاذ: عبدالله بن حسن الفيفي",
  deputy_academic: "الأستاذ: فهد بن سعود حضراوي",
  deputy_students: "الأستاذ: فهد بن نايف المعبدي",
  activity_leader: "الأستاذ: عمر بن سلمان الصاعدي",
  counselor_1:     "الأستاذ: منصور بن ناصر العوفي",
  counselor_2:     "الأستاذ: نواف بن نايف القرشي",
  counselor_3:     "الأستاذ: هاني بن خليفة الخضيري",
  gifted_program:  "الأستاذ: فواز بن حامد الحارثي",
  globe_program:   "الأستاذ: عبدالله بن محمد بادابود",
  tech_support:    "الأستاذ: محمد بن حسن الحازمي",
  deputy_school:   "الأستاذ: غالي بن ستر السلمي",
  safety_security: "الأستاذ: بندر بن معيض الحارثي",
  health_counselor: "الأستاذ: أيمن بن جميل المحمادي",
};

// مفاتيح الصلاحيات وأسماؤها
export const PERMISSIONS = [
  { key: "students",       label: "الطلاب",             desc: "البحث والفلترة والتقارير" },
  { key: "records",        label: "تعديل السجلات",       desc: "إضافة وتعديل الطلاب والمعلمين وأولياء الأمور يدويًا" },
  { key: "results",        label: "نتائج الطلاب",        desc: "رفع نتائج نور PDF ونشرها للطلاب وأولياء الأمور" },
  { key: "reports",        label: "التقارير",           desc: "تقارير الحضور والغياب" },
  { key: "home_stats",     label: "إحصائيات الرئيسية",   desc: "أرقام المدرسة وملخّص اليوم في الصفحة الرئيسية" },
  { key: "permissions",    label: "الاستئذان",          desc: "رفع الاستئذان والسجل" },
  { key: "accounts",       label: "الحسابات",           desc: "إنشاء حسابات الدخول" },
  { key: "staff",          label: "الإدارة",            desc: "أعضاء الإدارة وأدوارهم" },
  { key: "import",         label: "الاستيراد",          desc: "استيراد بيانات نور والتوقيت الزمني" },
  { key: "schedules",      label: "الجداول",            desc: "عرض الجدول العام وجداول المعلمين والطلاب (بلا الاستيراد الذكي)" },
  { key: "calendar",       label: "التقويم والإجازات",   desc: "إضافة وتعديل إجازات المدرسة ومحطات التقويم الدراسي" },
  { key: "news",           label: "الأخبار والمقالات",   desc: "نشر أخبار المدرسة ومقالاتها" },
  { key: "guides",         label: "الأدلة",             desc: "رفع أدلة الاستخدام" },
  { key: "notifications",  label: "الإشعارات",          desc: "تعاميم وتنبيهات تصل على جوال المستخدم بعد تفعيل الخدمة" },
  { key: "feedback",       label: "الملاحظات",          desc: "ملاحظات المستخدمين" },
  { key: "password_reset", label: "استعادة كلمة المرور", desc: "إعادة تعيين لأي مستخدم" },
  { key: "login_log",      label: "سجل الدخول والخروج",  desc: "متابعة عمليات تسجيل الدخول والخروج بالوقت والحالة" },
];
