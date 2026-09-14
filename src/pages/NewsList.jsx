import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoIcon from "../assets/icon-mint.png";

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function NewsList() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("news")
        .select("id, title, slug, excerpt, cover_url, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      setItems(data ?? []);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-ink">بوابة مكة الثانوية</span>
          </Link>
          <Link
            to="/"
            className="rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep"
          >
            الرئيسية
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-bold text-ink">أخبار المدرسة</h1>

        {!items && <p className="py-16 text-center text-sm text-muted">جارٍ التحميل…</p>}

        {items?.length === 0 && (
          <p className="mt-8 rounded-card border border-line px-6 py-12 text-center text-sm text-muted">
            لا توجد أخبار منشورة بعد.
          </p>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items?.map((n) => (
            <Link
              key={n.id}
              to={`/news/${n.slug ?? n.id}`}
              className="group overflow-hidden rounded-card border border-line bg-white transition-colors hover:border-[#CCF2DB]"
            >
              <div className="aspect-[16/9] bg-mint-tint">
                {n.cover_url && (
                  <img src={n.cover_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                {n.published_at && (
                  <p className="text-xs text-muted">
                    {dateFmt.format(new Date(n.published_at))}
                  </p>
                )}
                <h2 className="mt-1.5 text-sm font-bold leading-snug text-ink group-hover:text-mint-deep">
                  {n.title}
                </h2>
                {n.excerpt && (
                  <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-2">
                    {n.excerpt}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
