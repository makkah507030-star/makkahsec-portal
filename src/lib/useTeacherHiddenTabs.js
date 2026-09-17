import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session.jsx";

/**
 * التبويبات المخفية عن المعلم الحالي (تحضير/سجلات/تقارير/جدولي/إشعارات).
 * تُستخدم في القائمة الجانبية (لإخفاء الرابط) وفي الراوتر (لمنع
 * الوصول المباشر بالرابط حتى لو أُخفي الرابط من القائمة).
 *
 * ترجع Set فارغة افتراضيًا (كل شيء ظاهر) حتى يكتمل التحميل،
 * فلا تُخفى تبويبات بالخطأ أثناء انتظار الاستجابة.
 */
export function useTeacherHiddenTabs() {
  const { session, profile } = useSession();
  const [hidden, setHidden] = useState(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (profile?.role !== "teacher" || !session?.user?.id) {
        setHidden(new Set());
        setReady(true);
        return;
      }

      const { data: t0 } = await supabase
        .from("teachers").select("id").eq("user_id", session.user.id).maybeSingle();

      if (!t0) {
        if (!cancelled) { setHidden(new Set()); setReady(true); }
        return;
      }

      const { data } = await supabase
        .from("teacher_hidden_tabs").select("tab_key").eq("teacher_id", t0.id);

      if (!cancelled) {
        setHidden(new Set((data ?? []).map((r) => r.tab_key)));
        setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [session, profile]);

  return { hidden, ready };
}
