// src/pages/studio/ProgramCards.jsx
// بطاقات طلاب البرامج داخل أقسامها (كما في الثقافة المؤسسية)، لأن «استوديو البوابة» لا يظهر لمشرفي البرامج:
// جلوب (طلاب برنامج جلوب)، والموهوبون (برنامج الموهوبين)، والكشافة (الفريق الكشفي).
// القالب والبيانات والتصميم نفسها في الاستوديو (templates.js و Sheets.jsx)، لكل الطلاب أو لطالب واحد.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PrintPortal from "../../components/PrintPortal.jsx";
import Loader from "../../components/Loader.jsx";
import { printThen } from "../../lib/print.js";
import { supabase } from "../../lib/supabase";
import { loadSchoolStamp } from "../../lib/principalSignature";
import { templateOf } from "./templates";
import { THEMES, academicYearLabel, useFontsReady } from "./lib";
import { StudioAssets } from "./assets";
import { GlobeCards, GiftedCards, ScoutCards } from "./Sheets.jsx";

const SHEETS = { globecard: [GlobeCards, 9], giftedcard: [GiftedCards, 9], scoutcard: [ScoutCards, 10] };
const SHEET_W = 794;   // عرض ورقة A4 في الاستوديو بالبكسل

/* صور الطلاب اختيارية: تُصغَّر إلى 360 بكسل مربعًا كما في الاستوديو، وتُحفظ في مخزن البرنامج في البوابة
   (cards/رقم الطالب.jpg) فتظهر من أي جهاز. المخازن وصلاحياتها قائمة: globe_2.sql وgifted_3.sql وscouts_7.sql.
   وما لا صورة له يظهر برمز البرنامج. */
const BUCKETS = { "globe-card": "globe-files", "gifted-card": "gifted-files", "scout-card": "scout-files" };
const asDataUrl = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });
function squarePhoto(file, done) {
  const img = new Image();
  img.onload = () => {
    const n = 360, cv = document.createElement("canvas");
    cv.width = cv.height = n;
    const k = Math.min(img.width, img.height);
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, n, n);
    g.drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, n, n);
    cv.toBlob((b) => done(b, cv.toDataURL("image/jpeg", 0.85)), "image/jpeg", 0.85);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

/* الورقة مصغّرة بعرض الشاشة */
function Fit({ children }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [s, setS] = useState(0.5);
  const [h, setH] = useState(1123);
  useLayoutEffect(() => {
    const fit = () => {
      setS(Math.min(1, (box.current?.clientWidth ?? SHEET_W) / SHEET_W));
      setH(inner.current?.offsetHeight || 1123);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={box} className="w-full overflow-hidden" style={{ height: h * s }}>
      <div ref={inner} style={{ width: SHEET_W, transform: `scale(${s})`, transformOrigin: "top right" }}>{children}</div>
    </div>
  );
}

export default function ProgramCards({ tplKey, onBack, backLabel = "رجوع" }) {
  const tpl = templateOf(tplKey);
  const [Sheet, per] = SHEETS[tpl.sheet];
  const [ctx, setCtx] = useState(null);
  const [stamp, setStamp] = useState(null);
  const [theme, setTheme] = useState(tpl.defaultTheme ?? "light");
  const [who, setWho] = useState("all");          // all أو رقم البطاقة لبطاقة واحدة
  const [printing, setPrinting] = useState(false);
  const [photos, setPhotos] = useState({});       // رقم الطالب ← الصورة (data URL، فتظهر في الطباعة فورًا)
  const [busyPhoto, setBusyPhoto] = useState(null);
  const [photoMsg, setPhotoMsg] = useState("");
  const bucket = BUCKETS[tplKey];
  useFontsReady();

  // الصور المحفوظة في المخزن
  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error } = await supabase.storage.from(bucket).list("cards", { limit: 1000 });
      if (error || !live) return;
      const got = await Promise.all((data ?? []).filter((f) => f.name.endsWith(".jpg")).map(async (f) => {
        const { data: b } = await supabase.storage.from(bucket).download(`cards/${f.name}`);
        return [f.name.replace(/\.jpg$/, ""), b ? await asDataUrl(b) : null];
      }));
      if (live) setPhotos(Object.fromEntries(got.filter(([, u]) => u)));
    })();
    return () => { live = false; };
  }, [bucket]);

  const setPhoto = async (sid, file) => {
    if (!sid) return;
    setBusyPhoto(sid); setPhotoMsg("");
    if (!file) {
      const { error } = await supabase.storage.from(bucket).remove([`cards/${sid}.jpg`]);
      if (error) setPhotoMsg(`تعذّر حذف الصورة: ${error.message}`);
      else setPhotos((x) => { const n = { ...x }; delete n[sid]; return n; });
      setBusyPhoto(null);
      return;
    }
    squarePhoto(file, async (blob, url) => {
      const { error } = await supabase.storage.from(bucket)
        .upload(`cards/${sid}.jpg`, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) setPhotoMsg(`تعذّر حفظ الصورة: ${error.message}`);
      else setPhotos((x) => ({ ...x, [sid]: url }));
      setBusyPhoto(null);
    });
  };

  useEffect(() => {
    tpl.load().then((c) => setCtx({ ...c, year: academicYearLabel() })).catch(() => setCtx({ year: academicYearLabel() }));
    loadSchoolStamp().then(setStamp);
  }, [tpl]);

  // كل البطاقات بترقيمها في الكشف، ثم المختارة منها
  const base = useMemo(() => (ctx ? { ...tpl.defaults(ctx), scope: "all" } : null), [ctx, tpl]);
  const cards = useMemo(() => (base ? tpl.pages(base, ctx).flatMap((p) => p.cards ?? []).filter((c) => c?.name) : []), [base, ctx, tpl]);
  const chosen = who === "all" ? cards : cards.filter((c) => String(c.no) === who);
  const list = chosen.map((c) => (photos[c.sid] ? { ...c, photo: photos[c.sid] } : c));
  const withPhoto = cards.filter((c) => photos[c.sid]).length;
  const pages = [];
  for (let i = 0; i < list.length; i += per) pages.push({ ...base, cards: list.slice(i, i + per) });

  const print = () => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 300); };
  const label = (c) => [c.name, c.role ?? c.rank].filter(Boolean).join(" — ");

  return (
    <StudioAssets.Provider value={{ stamp }}>
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          {onBack && <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>{backLabel}</button>}
          <div className="flex gap-1 rounded-pill border border-line bg-paper p-1">
            {THEMES.map((t) => (
              <button key={t.key} onClick={() => setTheme(t.key)} title={t.hint}
                      className={`rounded-pill px-3 py-1 text-xs font-semibold ${theme === t.key ? "bg-mint-deep text-white" : "text-muted"}`}>{t.label}</button>
            ))}
          </div>
          <select className="field order-last w-full text-sm sm:order-none sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1"
                  value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">الكل ({cards.length})</option>
            {cards.map((c) => <option key={c.no} value={String(c.no)}>{label(c)}</option>)}
          </select>
          <button className="btn-primary ms-auto px-4 py-1.5 text-xs" disabled={!list.length} onClick={print}>
            طباعة / حفظ PDF {pages.length > 1 && <span className="num">({pages.length} أوراق)</span>}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          {tpl.title}: بطاقة لكل طالب من كشف البرنامج بصورته إن أُضيفت، {per === 10 ? "عشر" : "تسع"} في الورقة. اطبعها على ورق مقوّى بمقاس A4
          دون تصغير («الحجم الفعلي»)، ثم قصّها على الخط المتقطع. البيانات تُعدَّل من كشف الطلاب.
        </p>

        {cards.length > 0 && (
          <details className="card overflow-hidden" open={who !== "all"}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
              صور الطلاب (اختيارية) <span className="num text-xs font-normal text-muted">— أُضيفت {withPhoto} من {cards.length}</span>
            </summary>
            <p className="px-4 pb-2 text-[11.5px] leading-relaxed text-muted">
              لمن يرغب: صورة لكل طالب تظهر في بطاقته، تُقص مربعة وتُحفظ في البوابة فتظهر من أي جهاز. ومن لا صورة له يظهر برمز البرنامج.
            </p>
            {photoMsg && <p className="mx-4 mb-2 rounded-sm2 bg-warning-light px-3 py-2 text-[11.5px] text-warning">{photoMsg}</p>}
            <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
              {chosen.map((c) => (
                <div key={c.no} className="flex items-center gap-2 bg-white px-4 py-2">
                  {photos[c.sid]
                    ? <img src={photos[c.sid]} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-line" />
                    : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-[10px] text-faint">صورة</span>}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{c.name}</span>
                  {busyPhoto === c.sid ? <span className="shrink-0 text-[11.5px] text-muted">جارٍ الحفظ…</span> : (
                    <>
                      <label className="shrink-0 cursor-pointer rounded-pill border border-line px-3 py-1 text-[11.5px] text-muted hover:bg-canvas">
                        {photos[c.sid] ? "تغيير" : "إضافة"}
                        <input type="file" accept="image/*" className="hidden"
                               onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPhoto(c.sid, f); }} />
                      </label>
                      {photos[c.sid] && <button className="shrink-0 text-[11.5px] text-absent" onClick={() => setPhoto(c.sid, null)}>إزالة</button>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {!ctx ? <Loader /> : list.length === 0 ? <p className="card px-4 py-8 text-center text-sm text-muted">لا طلاب في الكشف بعد.</p> : (
          pages.map((d, i) => <div key={i} className="card overflow-hidden p-2"><Fit><Sheet theme={theme} d={d} /></Fit></div>)
        )}

        {printing && (
          <PrintPortal id="program-cards-print"
            extraCss="#program-cards-print .sheet { break-after: page; } #program-cards-print .sheet:last-child { break-after: auto; }">
            <StudioAssets.Provider value={{ stamp }}>
              {pages.map((d, i) => <Sheet key={i} theme={theme} d={d} />)}
            </StudioAssets.Provider>
          </PrintPortal>
        )}
      </div>
    </StudioAssets.Provider>
  );
}
