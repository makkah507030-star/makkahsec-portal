import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * حالة وضع الصيانة — تُحدَّث لحظيًا عبر Realtime،
 * مع تحديث احتياطي كل دقيقة.
 */
export function useMaintenance(session) {
  const [state, setState] = useState({ loading: true, enabled: false, message: null });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("maintenance_state")
      .select("is_enabled, message")
      .eq("id", 1)
      .maybeSingle();
    setState({ loading: false, enabled: !!data?.is_enabled, message: data?.message ?? null });
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setState({ loading: false, enabled: false, message: null });
      return;
    }
    load();

    let channel = null;
    const name = `maint-${session.user.id}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      channel = supabase.channel(name);
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "maintenance_state" },
        () => load()
      );
      channel.subscribe();
    } catch (e) {
      console.warn("realtime unavailable:", e?.message ?? e);
      channel = null;
    }

    const timer = setInterval(load, 60000);

    return () => {
      clearInterval(timer);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* تجاهل */ }
      }
    };
  }, [session?.user?.id, load]);

  return state;
}
