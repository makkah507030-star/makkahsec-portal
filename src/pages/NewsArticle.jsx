import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtBoth } from "../lib/dates";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import NewsCoverCard from "../components/NewsCoverCard.jsx";
import ArticleImageSlider from "../components/ArticleImageSlider.jsx";

const escHtml = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));



// يستخرج معرّف الفيديو من أي صيغة رابط يوتيوب
function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

const PORTAL_NAME = "بوابة مكة الثانوية الرقمية";

export default function NewsArticle() {
  const { slug } = useParams();
  const [item, setItem] = useState(undefined); // undefined = يحمّل، null = غير موجود
  const [toast, setToast] = useState(null);

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

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // مشاركة احترافية: اسم البوابة + عنوان الخبر + مقتطفه + رابط الفيديو إن
  // وُجد + رابط الخبر. تستخدم مشاركة النظام إن توفّرت، وإلا تنسخ للحافظة.
  const shareArticle = async () => {
    if (!item) return;
    const url = window.location.href;
    const summary = [
      item.title,
      item.excerpt || null,
      item.video_url ? `🎥 الفيديو: ${item.video_url}` : null,
      `— ${PORTAL_NAME}`,
    ].filter(Boolean).join("\n");

    if (navigator.share) {
      try { await navigator.share({ title: item.title, text: summary, url }); return; }
      catch { /* ألغى المستخدم أو تعذّرت المشاركة */ }
    }
    try {
      await navigator.clipboard.writeText(`${summary}\n${url}`);
      flash("نُسخ رابط الخبر ونصّه للحافظة");
    } catch { flash("تعذّرت المشاركة — انسخ الرابط يدويًا"); }
  };

  // طباعة احترافية للاستفادة في التقارير: ترويسة رسمية باسم البوابة
  // وشعارها، ثم الخبر، وصندوق لرابط الفيديو إن وُجد، وتذييل بالرابط.
  const printArticle = () => {
    if (!item) return;
    const url = window.location.href;
    const logo = new URL(logoIcon, window.location.origin).href;
    const moe = new URL(moeLogo, window.location.origin).href;
    const bodyHtml = (item.body || "")
      .split(/\n{2,}/).filter(Boolean)
      .map((p) => `<p>${escHtml(p)}</p>`).join("");

    const w = window.open("", "_blank", "width=920,height=1040");
    if (!w) { flash("فعّل النوافذ المنبثقة للطباعة"); return; }

    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${escHtml(item.title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Segoe UI","Tahoma",sans-serif;color:#1B2A24;padding:22px 26px;line-height:1.9;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .head{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:2px solid #0F7B55;padding-bottom:10px;margin-bottom:16px}
  .head .side{width:92px;display:flex;align-items:center;justify-content:center}
  .head .side img{max-height:56px;max-width:88px;object-fit:contain}
  .head .txt{flex:1;text-align:center}
  .head .l1{font-size:11px;color:#5B6B63}
  .head .l2{font-size:15px;font-weight:700;color:#0F7B55;margin-top:2px}
  .head .l3{font-size:11px;color:#5B6B63;margin-top:2px}
  .date{font-size:12px;color:#5B6B63;margin-bottom:4px}
  h1{font-size:22px;line-height:1.5;color:#12352A;margin-bottom:10px}
  .excerpt{font-size:15px;font-weight:600;color:#33463E;background:#E9F7F0;border:1px solid #CCF2DB;border-radius:10px;padding:10px 14px;margin-bottom:14px}
  .body p{font-size:14.5px;margin-bottom:10px;text-align:justify}
  .video{margin-top:14px;border:1px dashed #0F7B55;background:#F4FBF8;border-radius:10px;padding:10px 14px;font-size:13px;word-break:break-all}
  .video .lbl{font-weight:700;color:#0F7B55;display:block;margin-bottom:4px}
  .video a{color:#0F7B55}
  .foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid #DDE6E1;margin-top:22px;padding-top:10px;font-size:11px;color:#5B6B63;word-break:break-all}
  @media print{body{padding:0}}
</style></head><body>
  <div class="head">
    <div class="side"><img src="${moe}" alt=""></div>
    <div class="txt">
      <p class="l1">المملكة العربية السعودية — وزارة التعليم</p>
      <p class="l2">مدرسة مكة الثانوية</p>
      <p class="l3">${escHtml(PORTAL_NAME)}</p>
    </div>
    <div class="side"><img src="${logo}" alt=""></div>
  </div>
  ${item.published_at ? `<p class="date">${escHtml(fmtBoth(item.published_at))}</p>` : ""}
  <h1>${escHtml(item.title)}</h1>
  ${item.excerpt ? `<p class="excerpt">${escHtml(item.excerpt)}</p>` : ""}
  ${bodyHtml ? `<div class="body">${bodyHtml}</div>` : ""}
  ${item.video_url ? `<div class="video"><span class="lbl">رابط الفيديو:</span><a href="${escHtml(item.video_url)}">${escHtml(item.video_url)}</a></div>` : ""}
  <div class="foot">
    <span>المصدر: ${escHtml(PORTAL_NAME)}</span>
    <span>${escHtml(url)}</span>
  </div>
</body></html>`);
    w.document.close();
    w.focus();
    // مهلة قصيرة لتحميل الشعارات قبل فتح مربّع الطباعة
    setTimeout(() => { try { w.print(); } catch { /* تجاهل */ } }, 500);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-ink">بوابة مكة الثانوية</span>
          </Link>
          <div className="flex items-center gap-2">
            {item && (
              <>
                <button
                  onClick={shareArticle}
                  title="مشاركة الخبر"
                  aria-label="مشاركة الخبر"
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition-colors hover:border-[#CCF2DB] hover:text-mint-deep"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"
                       stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
                  </svg>
                </button>
                <button
                  onClick={printArticle}
                  title="طباعة الخبر"
                  aria-label="طباعة الخبر"
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition-colors hover:border-[#CCF2DB] hover:text-mint-deep"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"
                       stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" rx="1" />
                  </svg>
                </button>
              </>
            )}
            <Link
              to="/news"
              className="rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep"
            >
              كل الأخبار والمقالات
            </Link>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
          <div className="rounded-pill bg-ink/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}

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
                className="mt-4 h-16 w-full rounded-card border border-line sm:h-20"
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
