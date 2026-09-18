import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "./supabase";

const SessionContext = createContext(null);

// الأدوار التي تملك صلاحية كاملة دائمًا
const SUPER_ROLES = ["principal", "tech_support"];

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [adminRoles, setAdminRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setAdminRoles([]);
      setPermissions([]);
      return;
    }
    const { data: u } = await supabase
      .from("users")
      .select("id, username, full_name, role, is_active, must_change_pw")
      .eq("id", userId)
      .maybeSingle();

    setProfile(u ?? null);

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
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setAdminRoles([]);
    setPermissions([]);
  };

  const hasAdminRole = (...roles) => roles.some((r) => adminRoles.includes(r));

  // هل يملك المستخدم هذه الصلاحية؟
  const can = (perm) =>
    permissions.includes("*") || permissions.includes(perm);

  const isSuper = adminRoles.some((r) => SUPER_ROLES.includes(r));

  return (
    <SessionContext.Provider
      value={{
        session, profile, adminRoles, permissions, loading,
        signOut, hasAdminRole, can, isSuper,
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
  clerk:           "المساعد الإداري",
  activity_leader: "رائد النشاط",
  tech_support:    "الدعم الفني",
  media_portal:    "البوابة الإعلامية",
  gifted_program:  "برنامج الموهوبين",
  globe_program:   "برنامج جلوب البيئي العالمي",
  student_voice:   "برنامج صوت الطالب",
  makkah_sport:    "مكة سبورت",
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
  "activity_leader",
  "tech_support",
  "media_portal",
  "gifted_program",
  "globe_program",
  "student_voice",
  "makkah_sport",
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
  activity_leader: 344,
  tech_support:      8,
  media_portal:     32,
  gifted_program:   56,
  globe_program:    80,
  student_voice:   104,
  makkah_sport:    128,
};

// يبني تدرّجًا لونيًا CSS من قيمة hue الخاصة بالحساب
export const coverGradient = (hue) =>
  `linear-gradient(135deg, hsl(${hue} 58% 32%), hsl(${hue} 64% 50%))`;

// مفاتيح الصلاحيات وأسماؤها
export const PERMISSIONS = [
  { key: "students",       label: "الطلاب",             desc: "البحث والفلترة والتقارير" },
  { key: "records",        label: "تعديل السجلات",       desc: "إضافة وتعديل الطلاب والمعلمين وأولياء الأمور يدويًا" },
  { key: "results",        label: "نتائج الطلاب",        desc: "رفع نتائج نور PDF ونشرها للطلاب وأولياء الأمور" },
  { key: "reports",        label: "التقارير",           desc: "تقارير الحضور والغياب" },
  { key: "permissions",    label: "الاستئذان",          desc: "رفع الاستئذان والسجل" },
  { key: "accounts",       label: "الحسابات",           desc: "إنشاء حسابات الدخول" },
  { key: "staff",          label: "الإدارة",            desc: "أعضاء الإدارة وأدوارهم" },
  { key: "import",         label: "الاستيراد",          desc: "بيانات نور والجدول" },
  { key: "news",           label: "الأخبار",            desc: "نشر أخبار المدرسة" },
  { key: "guides",         label: "الأدلة",             desc: "رفع أدلة الاستخدام" },
  { key: "notifications",  label: "الإشعارات",          desc: "إرسال التعاميم والتنبيهات" },
  { key: "feedback",       label: "الملاحظات",          desc: "ملاحظات المستخدمين" },
  { key: "password_reset", label: "استعادة كلمة المرور", desc: "إعادة تعيين لأي مستخدم" },
];
