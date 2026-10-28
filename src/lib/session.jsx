import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { traced, bootSummary } from "./bootTrace.js";
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
  const sessionRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [adminRoles, setAdminRoles] = useState([]);
  // صفحات القائمة المخفية: ما أخفته كل أدوار المستخدم («hide:/مسار» في role_permissions)
  const [hiddenNav, setHiddenNav] = useState(() => new Set());
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  // دعم الدور المزدوج (معلم + إداري): هل للمستخدم سجل معلّم أيضًا؟ وأي واجهة نشطة الآن؟
  const [isTeacher, setIsTeacher] = useState(false);
  // المعلم أو الإداري الذي له أبناء في المدرسة مربوطون بحسابه (guardians.user_id): واجهة «أبنائي»
  const [hasChildren, setHasChildren] = useState(false);
  const [view, setViewState] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setAdminRoles([]);
      setPermissions([]);
      setIsTeacher(false);
      setHasChildren(false);
      setViewState(null);
      return;
    }
    // بيانات الحساب وسجل المعلم والأدوار معًا بدل التتابع — أقل انتظارًا عند فتح البوابة
    const [{ data: u }, { data: tRow }, { data: roleRows }, , { data: gRow }] = await Promise.all([
      traced("بيانات الحساب", supabase
        .from("users")
        .select("id, username, full_name, role, is_active, must_change_pw")
        .eq("id", userId)
        .maybeSingle()),
      traced("سجل المعلم", supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle()),
      traced("الأدوار الإدارية", supabase.from("admin_roles").select("role_type").eq("user_id", userId)),
      loadCustomRoles(),   // أسماء الأدوار المخصّصة قبل عرض أي شاشة
      traced("الأبناء", supabase.from("guardians").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle()),
    ]);

    setProfile(u ?? null);

    // هل هذا المستخدم معلّم أيضًا؟ (سجل في جدول المعلمين مرتبط به) — لدعم
    // الشخص الذي يجمع بين مهمة إدارية ومهمة تدريس، فينتقل بين الواجهتين.
    const teacherRec = !!tRow;
    setIsTeacher(teacherRec);
    const kids = !!gRow && ["admin", "teacher"].includes(u?.role);
    setHasChildren(kids);

    // صاحب أكثر من واجهة (إداري ومعلّم، أو موظف له أبناء): نهيّئ الواجهة النشطة من آخر
    // اختيار محفوظ، وإلا نبدأ بدوره المسجّل، مع إتاحة التبديل بين واجهاته.
    const avail = viewsOf(u?.role, teacherRec, kids);
    if (avail.length > 1) {
      let saved = null;
      try { saved = localStorage.getItem("mk_view_" + userId); } catch { /* تجاهل */ }
      setViewState(avail.includes(saved) ? saved : u.role);
    } else {
      setViewState(null);
    }

    if (u?.role === "admin") {
      const list = (roleRows ?? []).map((r) => r.role_type);
      setAdminRoles(list);

      // صلاحية كاملة للمدير والدعم الفني
      if (list.some((r) => SUPER_ROLES.includes(r))) {
        setPermissions(["*"]);
        setHiddenNav(new Set());
      } else if (list.length) {
        const { data: perms } = await traced("الصلاحيات", supabase
          .from("role_permissions")
          .select("role_type, permission")
          .in("role_type", list));
        const rows = perms ?? [];
        setPermissions([...new Set(rows.filter((p) => !p.permission.startsWith("hide:")).map((p) => p.permission))]);
        // تُخفى الصفحة إن أخفاها كل دور يحمله المستخدم (من يجمع دورين يرى ما يظهر لأحدهما)
        const hid = list.map((r) => new Set(rows.filter((p) => p.role_type === r && p.permission.startsWith("hide:")).map((p) => p.permission.slice(5))));
        setHiddenNav(new Set([...hid[0]].filter((x) => hid.every((h) => h.has(x)))));
      } else {
        setPermissions([]);
        setHiddenNav(new Set());
      }
    } else {
      setAdminRoles([]);
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;

    traced("استعادة الجلسة", supabase.auth.getSession()).then(async ({ data }) => {
      if (!alive) return;
      // قد يسبقه حدث المصادقة الأول بالجلسة نفسها — فلا نستبدل الكائن
      if (sessionRef.current?.user?.id === data.session?.user?.id && sessionRef.current) {
        Object.assign(sessionRef.current, data.session);
      } else {
        sessionRef.current = data.session ?? null;
        setSession(data.session ?? null);
      }
      await loadProfile(data.session?.user?.id);
      await traced("التقويم والإجازات", loadHolidays());   // قبل عرض الصفحات حتى تكون حالة العطلة صحيحة من أول عرض
      if (alive) setLoading(false);
      console.info("[فتح البوابة]", bootSummary());
    });

    // أحداث المصادقة تتكرر للمستخدم نفسه (تجديد الرمز كل ساعة، العودة للتبويب).
    // كان كل حدث يضع كائن جلسة جديدًا فتعيد كل صفحة تعتمد على [session] جلب
    // بياناتها، ويُعاد تحميل الملف الشخصي — حمل متكرر بلا داعٍ على قاعدة البيانات.
    // للمستخدم نفسه: نحدّث الرمز داخل الكائن نفسه (فيبقى access_token صالحًا لمن
    // يقرؤه) دون تغيير هويته، ولا نعيد تحميل الملف الشخصي.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!alive) return;
      const prev = sessionRef.current;
      if (prev && s && prev.user?.id === s.user?.id) {
        Object.assign(prev, s);
        return;
      }
      sessionRef.current = s ?? null;
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
    sessionRef.current = null;
    setSession(null);
    setProfile(null);
    setAdminRoles([]);
    setPermissions([]);
    setIsTeacher(false);
    setViewState(null);
  };

  // الدور المزدوج: إداري + معلّم في حساب واحد
  const dualRole = profile?.role === "admin" && isTeacher;
  // واجهات المستخدم المتاحة: الإدارة، والمعلم، و«أبنائي» (واجهة ولي الأمر) لمن رُبط به أبناؤه
  const views = viewsOf(profile?.role, isTeacher, hasChildren);
  // الواجهة الفعّالة للعرض: لصاحب أكثر من واجهة تتبع اختياره، ولغيره دوره الأساسي
  const effectiveRole = views.length > 1 ? (view ?? profile?.role) : profile?.role;
  const switchView = (v) => {
    if (!views.includes(v)) return;
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
        session, profile, adminRoles, permissions, loading, hiddenNav,
        signOut, hasAdminRole, can, isSuper,
        isTeacher, dualRole, hasChildren, views, effectiveRole, view, switchView,
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

/** واجهات الحساب: دوره المسجّل، والمعلم لمن له سجل معلّم وهو إداري، و«أبنائي» لموظف رُبط به أبناؤه */
function viewsOf(role, teacher, kids) {
  if (!role) return [];
  const v = [role];
  if (role === "admin" && teacher) v.push("teacher");
  if (kids && (role === "admin" || role === "teacher")) v.push("guardian");
  return v;
}

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
  clerk_3:         "المساعد الإداري 3",
  activity_leader: "رائد النشاط",
  tech_support:    "الدعم الفني",
  data_registrar:  "مسجّل المعلومات",
  media_portal:    "البوابة الإعلامية",
  gifted_program:  "برنامج الموهوبين",
  globe_program:   "برنامج جلوب البيئي العالمي",
  student_voice:   "برنامج صوت الطالب",
  makkah_sport:    "مكة سبورت",
  safety_security: "مسؤول الأمن والسلامة",
  health_counselor: "الموجه الصحي",
  science_labs:     "محضر مختبر العلوم 1",
  science_labs_2:   "محضر مختبر العلوم 2",
  science_labs_3:   "محضر مختبر العلوم 3",
  computer_lab:     "محضر معمل الحاسب الآلي",
  // أدوار قديمة (للتوافق مع بيانات سابقة)
  deputy:          "الوكيل",
  counselor:       "الموجه الطلابي",
};

// الأدوار المتاحة للإسناد في شاشة الإدارة (وتُلحق بها الأدوار المخصّصة عند الإقلاع)
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
  "clerk_3",
  "activity_leader",
  "tech_support",
  "data_registrar",
  "media_portal",
  "gifted_program",
  "globe_program",
  "student_voice",
  "makkah_sport",
  "safety_security",
  "health_counselor",
  "science_labs",
  "science_labs_2",
  "science_labs_3",
  "computer_lab",
];

/* الأدوار المخصّصة (supabase/custom_roles_*.sql): خانات custom_1..custom_10 يسمّيها
   المدير أو الدعم الفني من «الإدارة» ← «الأدوار المخصّصة»، مثل «القائد الكشفي».
   تُضاف أسماؤها إلى ADMIN_ROLE_LABEL وقائمة الإسناد عند الإقلاع، فتظهر في كل
   الشاشات كبقية الأدوار. وإن لم يُنفَّذ الملف بعد تبقى القوائم كما هي. */
export const CUSTOM_SLOTS = Array.from({ length: 10 }, (_, i) => `custom_${i + 1}`);
export const EXTERNAL_ROLES = new Set();   // أدوار من خارج المدرسة
export async function loadCustomRoles() {
  try {
    const { data, error } = await supabase.from("custom_roles").select("role_type, label, external");
    if (error) return;
    const named = new Set((data ?? []).map((r) => r.role_type));
    for (let i = ASSIGNABLE_ROLES.length - 1; i >= 0; i--) {
      if (CUSTOM_SLOTS.includes(ASSIGNABLE_ROLES[i]) && !named.has(ASSIGNABLE_ROLES[i])) ASSIGNABLE_ROLES.splice(i, 1);
    }
    EXTERNAL_ROLES.clear();
    CUSTOM_SLOTS.forEach((k) => { if (!named.has(k)) delete ADMIN_ROLE_LABEL[k]; });
    for (const r of data ?? []) {
      ADMIN_ROLE_LABEL[r.role_type] = r.label;
      if (r.external) EXTERNAL_ROLES.add(r.role_type);
      if (!ASSIGNABLE_ROLES.includes(r.role_type)) ASSIGNABLE_ROLES.push(r.role_type);
    }
  } catch { /* لا شيء: تبقى الأدوار الثابتة */ }
}

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
  clerk_3:         292,
  activity_leader: 344,
  tech_support:      8,
  data_registrar:  212,
  media_portal:     32,
  gifted_program:   56,
  globe_program:    80,
  student_voice:   104,
  makkah_sport:    128,
  safety_security: 356,
  health_counselor: 188,
  science_labs:     68,
  science_labs_2:   84,
  science_labs_3:   44,
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
  { key: "attendance_fix", label: "تصحيح الحضور",       desc: "المكان الرسمي لتعديل غياب الحصص والتأخر الصباحي والغياب الرسمي، مع إعادة احتساب اليوم" },
  { key: "accounts",       label: "الحسابات",           desc: "إنشاء حسابات الدخول" },
  { key: "staff",          label: "الإدارة",            desc: "أعضاء الإدارة وأدوارهم" },
  { key: "import",         label: "الاستيراد",          desc: "استيراد بيانات نور والتوقيت الزمني" },
  { key: "schedules",      label: "الجداول",            desc: "عرض الجدول العام وجداول المعلمين والطلاب (بلا الاستيراد الذكي)" },
  { key: "calendar",       label: "التقويم والإجازات",   desc: "إضافة وتعديل إجازات المدرسة ومحطات التقويم الدراسي" },
  { key: "news",           label: "الأخبار والمقالات",   desc: "نشر أخبار المدرسة ومقالاتها" },
  { key: "banners",        label: "إعلانات الرئيسية",    desc: "بطاقات مصوّرة للفرص والمناسبات أعلى الصفحة الرئيسية للطلاب وأولياء الأمور والمنسوبين" },
  { key: "guides",         label: "الأدلة",             desc: "رفع أدلة الاستخدام" },
  { key: "circulars",      label: "التعاميم",           desc: "إرسال التعاميم الواردة والداخلية للمنسوبين وأولياء الأمور، وأرشفتها، ومتابعة الاطلاع والتذكير والتقارير" },
  { key: "notifications",  label: "الإشعارات",          desc: "تعاميم وتنبيهات تصل على جوال المستخدم بعد تفعيل الخدمة" },
  { key: "feedback",       label: "الملاحظات",          desc: "ملاحظات المستخدمين" },
  { key: "password_reset", label: "استعادة كلمة المرور", desc: "إعادة تعيين لأي مستخدم" },
  { key: "login_log",      label: "سجل الدخول والخروج",  desc: "متابعة عمليات تسجيل الدخول والخروج بالوقت والحالة" },
  { key: "scouts",         label: "الفريق الكشفي",      desc: "إضافة أعضاء الفريق الكشفي من كل الفصول وحذفهم" },
  { key: "gifted",         label: "برنامج الموهوبين",   desc: "متابعة طلاب الأول الثانوي في مقياس موهبة من التسجيل إلى النتيجة، وتذكيرهم وأولياء أمورهم بالواتساب" },
  { key: "globe",          label: "برنامج جلوب",        desc: "إضافة طلاب برنامج جلوب البيئي من كل الفصول، والتواصل معهم بالواتساب، وبطاقاتهم في الاستوديو" },
];
