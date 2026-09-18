import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtBoth } from "../lib/dates";
import logoIcon from "../assets/icon-mint.png";
import NewsCoverCard from "../components/NewsCoverCard.jsx";
import ArticleImageSlider from "../components/ArticleImageSlider.jsx";



// يستخرج معرّف الفيديو من أي صيغة رابط يوتيوب
function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

export default function NewsArticle() {
  const { slug } = useParams();
  const [item, setItem] = useState(undefined); // undefined = يحمّل، null = غير موجود

  useEffect(() => {
    (async () => {
      // يقبل slug أو id
      const isUuid = /^[0-9a-f-]{36}$/i.test(slug);
      const { data } = await supabase
        .from("news")
        .select("title, excerpt, body, cover_url, cover_theme, body_images, video_url, published_at")
        .eq("is_published", true)
        .eq(isUuid ? "id" : "slug", slug)
        .maybeSingle();
      setItem(data ?? null);
    })();
  }, [slug]);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-ink">بوابة مكة الثانوية</span>
          </Link>
          <Link
            to="/news"
            className="rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep"
          >
            كل الأخبار والمقالات
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {item === undefined && (
          <p className="py-16 text-center text-sm text-muted">جارٍ التحميل…</p>
        )}

        {item === null && (
          <div className="rounded-card border border-line px-6 py-14 text-center">
            <p className="font-semibold text-ink">الخبر غير موجود</p>
            <p className="mt-1.5 text-sm text-muted">
              ربما حُذف أو لم يُنشر بعد.
            </p>
            <Link
              to="/"
              className="mt-5 inline-block rounded-pill bg-mint-deep px-6 py-2.5 text-sm font-semibold text-white"
            >
              العودة للرئيسية
            </Link>
          </div>
        )}

        {item && (
          <article>
            {item.published_at && (
              <p className="text-xs text-muted">
                {fmtBoth(item.published_at)}
              </p>
            )}
            <h1 className="mt-2 text-2xl font-bold leading-snug text-ink md:text-3xl">
              {item.title}
            </h1>

            {/* شريط الحساب الناشر — عرضي رفيع أسفل العنوان، بدل صورة غلاف كبيرة */}
            {item.cover_theme ? (
              <NewsCoverCard
                role={item.cover_theme}
                compact
                className="mt-4 h-16 w-full rounded-card border border-line sm:h-[4.5rem]"
              />
            ) : item.cover_url && (
              <img
                src={item.cover_url}
                alt=""
                className="mt-4 h-24 w-full rounded-card border border-line object-cover sm:h-28"
              />
            )}

            {item.excerpt && (
              <p className="mt-4 text-base leading-relaxed text-muted">
                {item.excerpt}
              </p>
            )}

            <ArticleImageSlider images={item.body_images} />

            {youtubeId(item.video_url) && (
              <div className="mt-7 aspect-video overflow-hidden rounded-card border border-line">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId(item.video_url)}`}
                  title={item.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}

            {item.body && (
              <div className="mt-7 space-y-4 text-[15px] leading-[1.9] text-ink">
                {item.body.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </article>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-6 text-xs text-muted">
          مدرسة مكة الثانوية — بوابة إلكترونية داخلية.
        </div>
      </footer>
    </div>
  );
}
