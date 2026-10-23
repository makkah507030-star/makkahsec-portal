// src/components/HomeBanners.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BANNER_KIND, bannerImage, isExternal } from "../lib/banners.js";
import { useStudioTheme, StudioDecor } from "../lib/studioTheme.jsx";

/* =====================================================================
   إعلانات الرئيسية — بطاقات مصوّرة للفرص والمناسبات أعلى الصفحة الرئيسية.
   ما يظهر يحدده الخادم (المدة والفئة والصف)؛ تتقلب البطاقات وحدها كل 6 ثوانٍ،
   والضغط على البطاقة يفتح رابطها (صفحة في البوابة أو رابطًا خارجيًا) إن وُجد.
   ===================================================================== */
export default function HomeBanners() {
  const [rows, setRows] = useState([]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const track = useRef(null);
  const auto = useRef(false);   // تمرير برمجي جارٍ: لا تتبعه النقاط حتى لا يتوقف في منتصفه

  useEffect(() => {
    supabase.from("home_banners").select("id, kind, title, body, image_path, link, link_label")
      .order("sort").order("created_at", { ascending: false }).limit(12)
      .then(({ data, error }) => setRows(error ? [] : data ?? []));   // قبل تشغيل ملف SQL لا يظهر شيء
  }, []);

  // التقليب التلقائي، ويتوقف عند لمس البطاقات أو الوقوف عليها
  useEffect(() => {
    if (rows.length < 2 || paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % rows.length), 6000);
    return () => clearInterval(t);
  }, [rows.length, paused]);
  useEffect(() => {
    // كل بطاقة بعرض الشريط وبينها 12px؛ وفي الاتجاه من اليمين يكون الموضع سالبًا
    const box = track.current; if (!box) return;
    const rtl = getComputedStyle(box).direction === "rtl";
    auto.current = true;
    box.scrollTo({ left: (rtl ? -1 : 1) * i * (box.clientWidth + 12), behavior: "smooth" });
    const t = setTimeout(() => { auto.current = false; }, 800);
    return () => clearTimeout(t);
  }, [i]);

  if (!rows.length) return null;

  // موضع البطاقة الظاهرة عند التمرير باليد، لتتبعها النقاط
  const onScroll = () => {
    const box = track.current; if (!box || auto.current) return;
    const w = box.clientWidth || 1;
    const n = Math.round(Math.abs(box.scrollLeft) / (w + 12));
    if (n !== i && n < rows.length) setI(n);
  };

  return (
    <section className="space-y-2" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
             onTouchStart={() => setPaused(true)}>
      <div ref={track} onScroll={onScroll}
           className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth rounded-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((b) => <Banner key={b.id} b={b} />)}
      </div>
      {rows.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {rows.map((b, n) => (
            <button key={b.id} aria-label={`الإعلان ${n + 1}`} onClick={() => { setPaused(true); setI(n); }}
                    className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-mint-deep" : "w-1.5 bg-line"}`} />
          ))}
        </div>
      )}
    </section>
  );
}

/* بطاقة واحدة بهوية استوديو البوابة (فاتحة أو غامقة كبطاقة الطالب): النوع والعنوان والوصف
   وزر الرابط بجانب، والصورة في إطار بالجانب الآخر (وأعلاها على الجوال) */
export function Banner({ b, preview = false }) {
  const [, t] = useStudioTheme();
  const img = b.image_url ?? bannerImage(b.image_path);
  const kind = BANNER_KIND[b.kind] ?? BANNER_KIND.general;
  const inner = (
    <div className="relative isolate flex h-full flex-col overflow-hidden rounded-[18px] border-[1.5px] shadow-card sm:flex-row sm:items-stretch"
         style={{ background: t.bg, borderColor: t.border, color: t.text }}>
      <StudioDecor t={t} />
      {img && (
        <div className="p-3 pb-0 sm:order-2 sm:w-[46%] sm:shrink-0 sm:p-3 sm:pr-0">
          <img src={img} alt="" loading="lazy" className="aspect-[16/8] h-full w-full rounded-card object-cover shadow-card sm:aspect-auto sm:min-h-[180px]" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4 sm:p-5">
        <span className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: t.sub }}>
          <img src={t.logo} alt="" className="h-4 w-4 object-contain" />
          بوابة مكة الثانوية الرقمية
        </span>
        <div className="h-[1.5px] w-24" style={{ background: `linear-gradient(270deg, ${t.gold}, transparent)` }} />
        <span className={`mt-1 w-fit rounded-pill px-2.5 py-0.5 text-[11px] font-bold text-white ${kind.c}`}>{kind.t}</span>
        <p className="text-base font-bold leading-snug sm:text-xl">{b.title || "عنوان الإعلان"}</p>
        {b.body && <p className="line-clamp-3 text-xs leading-relaxed sm:text-sm" style={{ color: t.sub }}>{b.body}</p>}
        {b.link && (
          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-pill px-3.5 py-1.5 text-xs font-bold"
                style={{ background: t.disc, color: t.discT }}>
            {b.link_label || (isExternal(b.link) ? "زيارة الرابط" : "التفاصيل")} ←
          </span>
        )}
      </div>
    </div>
  );
  const cls = "block w-full shrink-0 snap-center";
  if (preview || !b.link) return <div className={cls}>{inner}</div>;
  return isExternal(b.link)
    ? <a href={b.link} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link to={b.link} className={cls}>{inner}</Link>;
}
