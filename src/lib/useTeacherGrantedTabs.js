import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session.jsx";

/**
 * الصلاحيات الإضافية الممنوحة صراحة للمعلم الحالي (مثل الاستئذان
 * أو الأخبار) — نموذج "منح": لا سجل = معطَّل. عكس useTeacherHiddenTabs
 * الذي يتعامل مع التبويبات الأساسية الظاهرة افتراضيًا.
 */
export function useTeacherGrantedTabs() {
  const { session, profile } = useSession();
  const [granted, setGranted] = useState(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (profile?.role !== "teacher" || !session?.user?.id) {
        setGranted(new Set());
        setReady(true);
        return;
      }

      const { data: t0 } = await supabase
        .from("teachers").select("id").eq("user_id", session.user.id).maybeSingle();

      if (!t0) {
        if (!cancelled) { setGranted(new Set()); setReady(true); }
        return;
      }

      const { data } = await supabase
        .from("teacher_granted_tabs").select("tab_key").eq("teacher_id", t0.id);

      if (!cancelled) {
        setGranted(new Set((data ?? []).map((r) => r.tab_key)));
        setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [session, profile]);

  return { granted, ready };
}
