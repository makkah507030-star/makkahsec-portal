import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/**
 * إشعارات المستخدم الحالي — تُحدَّث لحظيًا عبر Realtime، مع تحديث احتياطي
 * كل ٥ دقائق ما دامت الصفحة ظاهرة، وعند العودة إليها.
 *
 * يعتمد على معرّف المستخدم لا على كائن الجلسة: الكائن يتجدد مع كل حدث
 * مصادقة (تجديد الرمز، العودة للتبويب)، فكان كل تجدد يعيد الجلب ويفتح
 * قناة ومؤقتًا جديدين — وصار هذا الاستعلام أثقل حمل على قاعدة البيانات.
 */
const POLL_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

export function useNotifications(session) {
  const uid = session?.user?.id ?? null;
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    if (!uid) {
      setItems([]);
      setUnread(0);
      setLoading(false);
      return;
    }
    lastLoad.current = Date.now();

    // الدالة my_notifications تجلب إشعارات المستخدم مباشرة دون أن يمرّ كل إشعار
    // بقواعد الصلاحية (كان الاستعلام المضمَّن يستغرق ثوانيَ). وإن لم تُنفَّذ
    // بعد في قاعدة البيانات نعود للاستعلام القديم.
    let list;
    const rpc = await supabase.rpc("my_notifications", { p_limit: 50 });
    if (!rpc.error) {
      list = rpc.data ?? [];
    } else {
      const { data } = await supabase
        .from("notification_recipients")
        .select("read_at, notifications(id, title, body, kind, link, created_at)")
        .eq("user_id", uid)
        .order("read_at", { ascending: true, nullsFirst: true })
        .limit(50);

      list = (data ?? [])
        .filter((r) => r.notifications)
        .map((r) => ({ ...r.notifications, read_at: r.read_at }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    setItems(list);
    setUnread(list.filter((n) => !n.read_at).length);
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // تحديث لحظي عند وصول إشعار جديد، واحتياطي دوري للصفحة الظاهرة فقط
  useEffect(() => {
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

    // التبويب المخفي لا يجلب شيئًا؛ وعند العودة إليه نجلب إن مضت دقيقة
    const visible = () => document.visibilityState === "visible";
    const timer = setInterval(() => { if (visible()) load(); }, POLL_MS);
    const onVisible = () => {
      if (visible() && Date.now() - lastLoad.current > MIN_GAP_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* تجاهل */ }
      }
    };
  }, [uid, load]);

  const markRead = async (id) => {
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
