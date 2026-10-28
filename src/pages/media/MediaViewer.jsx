// src/pages/media/MediaViewer.jsx
import { useEffect, useState } from "react";
import { useSession } from "../../lib/session.jsx";
import { signedUrls, VIDEO_TTL } from "../../lib/media.js";
import { fmtDate } from "../../lib/dates";

/* =====================================================================
   عارض المادة داخل البوابة: الصورة أو المقطع برابط موقّع قصير العمر يُطلب عند الفتح،
   وفوقها علامة مائية باسم المشاهد وتاريخ اليوم، بلا تنزيل ولا قائمة الزر الأيمن ولا سحب.
   ===================================================================== */

const block = (e) => e.preventDefault();

export function Watermark({ name }) {
  const t = `${name || "بوابة مكة الثانوية"} · ${fmtDate(new Date().toISOString())} · للعرض داخل البوابة فقط`;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-col justify-center gap-16">
        {Array.from({ length: 9 }, (_, i) => (
          <p key={i} className="whitespace-nowrap text-center text-[13px] font-semibold tracking-wide text-white/25 [text-shadow:0_0_2px_rgba(0,0,0,.35)]"
             style={{ marginInlineStart: i % 2 ? 120 : 0 }}>{`${t}      ${t}      ${t}`}</p>
        ))}
      </div>
    </div>
  );
}

export default function MediaViewer({ item, onClose, onPrev, onNext }) {
  const { profile } = useSession();
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    signedUrls([item.path], item.kind === "video" ? VIDEO_TTL : 300).then((m) => { if (live) setUrl(m.get(item.path) ?? false); });
    return () => { live = false; };
  }, [item.path, item.kind]);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft") onNext?.(); if (e.key === "ArrowRight") onPrev?.(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, onNext, onPrev]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 sm:p-6" onContextMenu={block} onClick={onClose}>
      <div className="mx-auto flex w-full max-w-4xl items-center gap-2 pb-2 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.title}</p>
          <p className="text-xs text-white/60">{item.album ? `${item.album} · ` : ""}{fmtDate(item.created_at)}</p>
        </div>
        <button className="rounded-pill bg-white/10 px-3 py-1 text-sm hover:bg-white/20" onClick={onClose}>إغلاق ✕</button>
      </div>
      <div className="relative mx-auto flex w-full max-w-4xl flex-1 items-center justify-center overflow-hidden rounded-card bg-black select-none"
           onClick={(e) => e.stopPropagation()}>
        {url === null && <p className="text-sm text-white/60">جارٍ التحميل…</p>}
        {url === false && <p className="text-sm text-white/60">تعذّر فتح المادة.</p>}
        {url && item.kind === "photo" && (
          <img src={url} alt={item.title} draggable={false} onDragStart={block} className="max-h-full max-w-full object-contain" />
        )}
        {url && item.kind === "video" && (
          <video src={url} controls autoPlay playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture
                 onDragStart={block} className="max-h-full max-w-full" />
        )}
        <Watermark name={profile?.full_name} />
        {onPrev && <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white" onClick={onPrev} aria-label="السابق">›</button>}
        {onNext && <button className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white" onClick={onNext} aria-label="التالي">‹</button>}
      </div>
      {item.body && <p className="mx-auto mt-2 w-full max-w-4xl text-sm leading-relaxed text-white/80" onClick={(e) => e.stopPropagation()}>{item.body}</p>}
      <p className="mx-auto mt-2 text-[11px] text-white/45">للعرض داخل البوابة فقط · يُمنع تصوير الشاشة ونشر المادة في وسائل التواصل</p>
    </div>
  );
}
