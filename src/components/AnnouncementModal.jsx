import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";

/* ألوان صندوق الرسالة — تُضبط من الإدارة قبل الإرسال */
export const ANNOUNCEMENT_COLORS = [
  { key: "mint",  label: "أخضر",  bg: "bg-mint-deep", text: "text-white", dot: "bg-mint-deep" },
  { key: "blue",  label: "أزرق",  bg: "bg-excused",   text: "text-white", dot: "bg-excused" },
  { key: "amber", label: "أصفر",  bg: "bg-warning",   text: "text-white", dot: "bg-warning" },
  { key: "red",   label: "أحمر",  bg: "bg-danger",    text: "text-white", dot: "bg-danger" },
  { key: "gray",  label: "رمادي", bg: "bg-ink",       text: "text-white", dot: "bg-ink" },
];
export const colorMeta = (key) =>
  ANNOUNCEMENT_COLORS.find((c) => c.key === key) ?? ANNOUNCEMENT_COLORS[0];

export default function AnnouncementModal() {
  const { profile } = useSession();
  const [queue, setQueue] = useState([]);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;

    (async () => {
      const nowIso = new Date().toISOString();

      const { data: banners, error } = await supabase
        .from("announcement_banners")
        .select("id, title, body, color, target_roles")
        .eq("is_active", true)
        .lte("starts_at", nowIso)
        .gte("ends_at", nowIso)
        .order("created_at", { ascending: true });

      if (error || !banners?.length || !alive) return;

      // فلترة حسب فئة المستخدم (لا فئة محددة = تظهر للجميع)
      const targeted = banners.filter((b) => {
        const roles = b.target_roles ?? [];
        return roles.length === 0 || roles.includes(profile.role);
      });
      if (!targeted.length) return;

      const { data: dismissed } = await supabase
        .from("announcement_dismissals")
        .select("banner_id")
        .eq("user_id", profile.id)
        .in("banner_id", targeted.map((b) => b.id));

      const dismissedIds = new Set((dismissed ?? []).map((d) => d.banner_id));
      const pending = targeted.filter((b) => !dismissedIds.has(b.id));
      if (alive && pending.length) setQueue(pending);
    })();

    return () => { alive = false; };
  }, [profile?.id, profile?.role]);

  if (!queue.length) return null;

  const current = queue[0];
  const meta = colorMeta(current.color);

  const close = async () => {
    if (closing) return;
    setClosing(true);
    await supabase
      .from("announcement_dismissals")
      .upsert(
        { banner_id: current.id, user_id: profile.id },
        { onConflict: "banner_id,user_id" }
      );
    setClosing(false);
    setQueue((q) => q.slice(1));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-card bg-white shadow-card">
        <div className={`flex items-center justify-between gap-3 px-5 py-3.5 ${meta.bg} ${meta.text}`}>
          <p className="min-w-0 truncate text-sm font-bold">{current.title}</p>
          <button
            onClick={close}
            disabled={closing}
            aria-label="إغلاق"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-sm hover:bg-white/25 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {current.body && (
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{current.body}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          {queue.length > 1 ? (
            <span className="num text-xs text-muted">رسالة 1 من {queue.length}</span>
          ) : <span />}
          <button
            onClick={close}
            disabled={closing}
            className="rounded-sm2 border border-line bg-paper px-4 py-1.5 text-xs font-semibold text-ink hover:bg-canvas disabled:opacity-50"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
