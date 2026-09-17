import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * إشعارات المستخدم الحالي — تُحدَّث لحظيًا عبر Realtime،
 * مع تحديث احتياطي كل دقيقتين.
 */
export function useNotifications(session) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setItems([]);
      setUnread(0);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("notification_recipients")
      .select("read_at, notifications(id, title, body, kind, link, created_at)")
      .eq("user_id", session.user.id)
      .order("read_at", { ascending: true, nullsFirst: true })
      .limit(50);

    const list = (data ?? [])
      .filter((r) => r.notifications)
      .map((r) => ({ ...r.notifications, read_at: r.read_at }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setItems(list);
    setUnread(list.filter((n) => !n.read_at).length);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  // تحديث لحظي عند وصول إشعار جديد
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    let channel = null;
    let alive = true;

    // اسم فريد لكل تركيب — يتفادى إعادة استخدام قناة مشتركة مسبقًا
    const name = `notif-${uid}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      channel = supabase.channel(name);
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_recipients",
          filter: `user_id=eq.${uid}`,
        },
        () => { if (alive) load(); }
      );
      channel.subscribe();
    } catch (e) {
      // التحديث الدوري أدناه يغطي الحالة إن تعذّر الاتصال اللحظي
      console.warn("realtime unavailable:", e?.message ?? e);
      channel = null;
    }

    const timer = setInterval(load, 120000);

    return () => {
      alive = false;
      clearInterval(timer);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* تجاهل */ }
      }
    };
  }, [session, load]);

  const markRead = async (id) => {
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase
      .from("notification_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("notification_id", id)
      .eq("user_id", uid);

    setItems((list) =>
      list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    await supabase
      .from("notification_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", uid)
      .is("read_at", null);

    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
  };

  return { items, unread, loading, markRead, markAllRead, reload: load };
}

/* دلالات أنواع الإشعارات */
export const KIND_META = {
  absence:    { label: "غياب",     tone: "bg-absent/10 text-absent" },
  permission: { label: "استئذان",  tone: "bg-excused/15 text-excused" },
  news:       { label: "خبر",      tone: "bg-mint-tint text-mint-deep" },
  alert:      { label: "تنبيه",    tone: "bg-late/10 text-late" },
  general:    { label: "تعميم",    tone: "bg-gray-tint text-muted" },
};
