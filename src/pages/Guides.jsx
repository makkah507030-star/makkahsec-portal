import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { AUDIENCES, audienceLabel, fmtSize } from "../lib/guidesMeta";
import { fmtGreg } from "../lib/dates";
import logoIcon from "../assets/icon-mint.png";

const isImage = (url = "") => /\.(png|jpe?g|webp)(\?|$)/i.test(url);

export default function Guides() {
  const { session } = useSession();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("guides")
        .select("id, title, description, audience, file_url, file_name, file_size, created_at")
        .eq("is_published", true)
        .order("audience")
        .order("sort_order");
      setRows(data ?? []);
    })();
  }, [session]);

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0 };
    AUDIENCES.forEach((a) => { c[a.key] = 0; });
    (rows ?? []).forEach((r) => { c[r.audience] = (c[r.audience] ?? 0) + 1; });
    return c;
  }, [rows]);

  const shown = useMemo(
    () => (filter === "all" ? rows ?? [] : (rows ?? []).filter((r) => r.audience === filter)),
    [rows, filter]
  );

  // تجميع حسب الفئة عند عرض الكل
  const grouped = useMemo(() => {
    if (filter !== "all") return null;
    return AUDIENCES
      .map((a) => ({ ...a, items: (rows ?? []).filter((r) => r.audience === a.key) }))
      .filter((g) => g.items.length);
  }, [rows, filter]);

  return (
    <div className="min-h-screen bg-gray-tint">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-ink">بوابة مكة الثانوية</span>
          </Link>
          <Link to="/"
            className="rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep">
            الرئيسية
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-bold text-ink">أدلة الاستخدام</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          أدلة إرشادية ومنشورات تعريفية توضح خدمات البوابة وطريقة الاستفادة منها، لكل فئة دليلها.
        </p>

        {!session && (
          <p className="mt-4 rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
            تُعرض هنا الأدلة العامة. سجّل الدخول لعرض الأدلة الخاصة بفئتك.
          </p>
        )}

        <div className="mt-7 flex flex-wrap gap-1.5">
          <Pill on={filter === "all"} onClick={() => setFilter("all")}>
            الكل <span className="num">({counts.all})</span>
          </Pill>
          {AUDIENCES.filter((a) => counts[a.key] > 0).map((a) => (
            <Pill key={a.key} on={filter === a.key} onClick={() => setFilter(a.key)}>
              {a.label} <span className="num">({counts[a.key]})</span>
            </Pill>
          ))}
        </div>

        {!rows && <p className="mt-8 text-sm text-muted">جارٍ التحميل…</p>}

        {rows && rows.length === 0 && (
          <div className="mt-8 rounded-card border border-line bg-white px-6 py-14 text-center">
            <p className="font-semibold text-ink">لا توجد أدلة منشورة بعد</p>
            <p className="mt-1.5 text-sm text-muted">سيتم نشر الأدلة قريبًا.</p>
          </div>
        )}

        {grouped && (
          <div className="mt-8 space-y-9">
            {grouped.map((g) => (
              <section key={g.key}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-lg font-bold text-mint-deep">{g.label}</h2>
                  <span className="text-xs text-muted">{g.desc}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.items.map((r) => <Card key={r.id} g={r} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {!grouped && shown.length > 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {shown.map((r) => <Card key={r.id} g={r} />)}
          </div>
        )}
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-5 py-6 text-xs text-muted">
          مدرسة مكة الثانوية — بوابة إلكترونية داخلية.
        </div>
      </footer>
    </div>
  );
}

function Card({ g }) {
  const image = isImage(g.file_url);

  return (
    <article className="overflow-hidden rounded-card border border-line bg-white transition-colors hover:border-[#CCF2DB]">
      {/* المنشور المصوّر يُعرض كاملًا، فهو المحتوى نفسه لا مجرد مرفق */}
      {image && (
        <a href={g.file_url} target="_blank" rel="noreferrer" className="block bg-mint-tint">
          <img src={g.file_url} alt={g.title}
               className="max-h-72 w-full object-contain" loading="lazy" />
        </a>
      )}

      <div className="flex gap-3.5 p-4">
        {!image && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm2 bg-mint-tint">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-mint-deep"
                 stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
            </svg>
          </span>
        )}

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-ink">{g.title}</h3>

        {g.description && (
          <p className="mt-1 text-xs leading-relaxed text-muted">{g.description}</p>
        )}

        <p className="mt-1.5 text-[11px] text-faint">
          <span className="num">{image ? "صورة" : "PDF"}</span>
          {g.file_size ? <span className="num"> · {fmtSize(g.file_size)}</span> : null}
          {g.created_at ? <span className="num"> · {fmtGreg(g.created_at)}</span> : null}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <a href={g.file_url} target="_blank" rel="noreferrer"
             className="rounded-pill bg-mint-deep px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6AA786]">
            {image ? "عرض بالحجم الكامل" : "عرض الدليل"}
          </a>
          <a href={g.file_url} download={g.file_name ?? true}
             className="rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep">
            تحميل
          </a>
        </div>
      </div>
      </div>
    </article>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}
