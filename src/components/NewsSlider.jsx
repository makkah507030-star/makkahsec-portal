import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtBoth } from "../lib/dates";
import NewsCoverCard from "./NewsCoverCard.jsx";



export default function NewsSlider() {
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("news")
        .select("id, title, slug, excerpt, cover_url, cover_theme, published_at")
        .eq("is_published", true)
        .eq("is_featured", true)
        .order("published_at", { ascending: false })
        .limit(5);
      setItems(data ?? []);
    })();
  }, []);

  // تقليب تلقائي
  useEffect(() => {
    if (!items || items.length < 2) return;
    timer.current = setInterval(
      () => setIdx((i) => (i + 1) % items.length),
      6000
    );
    return () => clearInterval(timer.current);
  }, [items]);

  const go = (i) => {
    clearInterval(timer.current);
    setIdx(i);
  };

  if (!items || items.length === 0) return null;

  const current = items[idx];
  const href = `/news/${current.slug ?? current.id}`;

  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-ink">الأخبار والمقالات</h2>
          <Link to="/news" className="text-sm font-medium text-[#6AA786] hover:text-mint-deep">
            كل الأخبار والمقالات
          </Link>
        </div>

        <Link
          to={href}
          className="group mt-6 block overflow-hidden rounded-card border border-line bg-white transition-colors hover:border-[#CCF2DB]"
        >
          <div className="grid md:grid-cols-[1.3fr_1fr]">
            <div className="relative aspect-[16/9] bg-mint-tint md:aspect-auto md:min-h-[19rem]">
              {current.cover_theme ? (
                <NewsCoverCard role={current.cover_theme} className="absolute inset-0 h-full w-full" />
              ) : current.cover_url ? (
                <img
                  src={current.cover_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-sm text-muted">
                  بلا صورة
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center p-6 md:p-8">
              {current.published_at && (
                <p className="text-xs text-muted">
                  {fmtBoth(current.published_at)}
                </p>
              )}
              <h3 className="mt-2 text-lg font-bold leading-snug text-ink group-hover:text-mint-deep md:text-xl">
                {current.title}
              </h3>
              {current.excerpt && (
                <p className="mt-3 text-sm leading-relaxed text-muted line-clamp-3">
                  {current.excerpt}
                </p>
              )}
              <span className="mt-5 text-sm font-semibold text-[#6AA786]">
                قراءة الخبر ←
              </span>
            </div>
          </div>
        </Link>

        {items.length > 1 && (
          <div className="mt-5 flex justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`الخبر ${i + 1}`}
                className={`h-2 rounded-pill transition-all ${
                  i === idx ? "w-7 bg-mint-deep" : "w-2 bg-[#CCF2DB] hover:bg-[#89D7AD]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
