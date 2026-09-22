import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { KIND_META } from "../lib/useNotifications";
import { fmtDateTime } from "../lib/dates";
import logoIcon from "../assets/icon-mint.png";

// صفحة عرض إشعار واحد بتنسيق احترافي — تُفتح من إشعار الجوال ومن جرس الإشعارات
export default function NotificationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const [n, setN] = useState(undefined); // undefined=تحميل، null=غير متاح

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid || !id) { setN(null); return; }

      const { data } = await supabase
        .from("notification_recipients")
        .select("read_at, notifications(id, title, body, kind, link, created_at, sender_name, image_url, attachment_url, attachment_name, youtube_url)")
        .eq("user_id", uid)
        .eq("notification_id", id)
        .maybeSingle();

      const item = data?.notifications ?? null;
      setN(item);

      // تعليمه كمقروء
      if (item && !data.read_at) {
        supabase
          .from("notification_recipients")
          .update({ read_at: new Date().toISOString() })
          .eq("notification_id", id)
          .eq("user_id", uid)
          .then(() => {}, () => {});
      }
    })();
  }, [id, session]);

  const back = () => navigate("/notifications-me");

  if (n === undefined) {
    return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;
  }

  if (!n) {
    return (
      <div className="mx-auto max-w-xl">
        <button onClick={back} className="mb-4 text-sm font-medium text-mint-deep hover:underline">
          → كل الإشعارات
        </button>
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">الإشعار غير متاح</p>
          <p className="mt-1.5 text-sm text-muted">قد يكون حُذف أو أنه ليس ضمن إشعاراتك.</p>
        </div>
      </div>
    );
  }

  const meta = KIND_META[n.kind] ?? KIND_META.general;

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-mint-deep hover:underline">
        <span>→</span> كل الإشعارات
      </button>

      <article className="overflow-hidden rounded-card border border-line bg-white">
        {/* ترويسة */}
        <div className="flex items-center gap-3 border-b border-line bg-mint-tint/40 px-5 py-3.5">
          <img src={logoIcon} alt="" className="h-9 w-9 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-mint-deep">بوابة مكة الثانوية الرقمية</p>
            <p className="num text-xs text-muted">{fmtDateTime(n.created_at)}</p>
          </div>
          <span className={`chip shrink-0 ${meta.tone}`}>{meta.label}</span>
        </div>

        {/* صورة الإشعار (اختيارية) */}
        {n.image_url && (
          <img src={n.image_url} alt="" className="max-h-80 w-full object-cover" />
        )}

        <div className="px-5 py-5">
          <h1 className="text-xl font-bold leading-snug text-ink">{n.title}</h1>

          {n.sender_name && (
            <p className="mt-2 text-sm text-muted">
              <span className="text-faint">المُرسِل: </span>
              <span className="font-medium text-ink">{n.sender_name}</span>
            </p>
          )}

          {n.body && (
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-ink">{n.body}</p>
          )}

          {n.attachment_url && (
            <a href={n.attachment_url} target="_blank" rel="noreferrer"
               download={n.attachment_name || undefined}
               className="mt-5 flex items-center gap-3 rounded-card border border-[#CCF2DB] bg-mint-tint/50 px-4 py-3 transition-colors hover:bg-mint-tint">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 shrink-0 text-mint-deep"
                   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{n.attachment_name || "المرفق"}</p>
                <p className="text-xs text-muted">اضغط للتحميل</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-mint-deep"
                   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
              </svg>
            </a>
          )}

          {n.youtube_url && (
            <a href={n.youtube_url} target="_blank" rel="noreferrer"
               className="mt-5 flex items-center gap-3 rounded-card border border-[#F3C7C7] bg-[#FDECEC] px-4 py-3 transition-colors hover:bg-[#FBE0E0]">
              <svg viewBox="0 0 24 24" fill="#C4302B" className="h-7 w-7 shrink-0">
                <path d="M23 12s0-3.9-.5-5.7a3 3 0 0 0-2.1-2.1C18.6 3.7 12 3.7 12 3.7s-6.6 0-8.4.5A3 3 0 0 0 1.5 6.3C1 8.1 1 12 1 12s0 3.9.5 5.7a3 3 0 0 0 2.1 2.1c1.8.5 8.4.5 8.4.5s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM10 15.5v-7l6 3.5-6 3.5Z"/>
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">مشاهدة الفيديو</p>
                <p className="text-xs text-muted">فتح على يوتيوب</p>
              </div>
              <span className="shrink-0 text-[#C4302B]">←</span>
            </a>
          )}

          {n.link && (
            <a href={n.link} target={/^https?:/.test(n.link) ? "_blank" : undefined}
               rel="noreferrer"
               className="mt-5 inline-flex items-center gap-2 rounded-pill bg-mint-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6AA786]">
              فتح الرابط
              <span>←</span>
            </a>
          )}
        </div>
      </article>
    </div>
  );
}
