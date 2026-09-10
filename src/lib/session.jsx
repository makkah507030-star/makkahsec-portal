import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "./supabase";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);   // صف من جدول users
  const [adminRoles, setAdminRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setAdminRoles([]);
      return;
    }
    const { data: u } = await supabase
      .from("users")
      .select("id, username, role, is_active, must_change_pw")
      .eq("id", userId)
      .maybeSingle();

    setProfile(u ?? null);

    if (u?.role === "admin") {
      const { data: roles } = await supabase
        .from("admin_roles")
        .select("role_type")
        .eq("user_id", userId);
      setAdminRoles((roles ?? []).map((r) => r.role_type));
    } else {
      setAdminRoles([]);
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
  };

  const hasAdminRole = (...roles) => roles.some((r) => adminRoles.includes(r));

  return (
    <SessionContext.Provider
      value={{ session, profile, adminRoles, loading, signOut, hasAdminRole, reload: () => loadProfile(session?.user?.id) }}
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
  principal: "مدير المدرسة",
  deputy: "الوكيل",
  counselor: "الموجه الطلابي",
  clerk: "الإداري",
  activity_leader: "رائد النشاط",
};
