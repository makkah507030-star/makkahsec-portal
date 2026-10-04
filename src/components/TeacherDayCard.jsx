// src/components/TeacherDayCard.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "../lib/session.jsx";
import { isTeacherDay, showTeacherDayCard } from "../lib/teacherDay.js";
import iconWhite from "../assets/icon-white.png";
import { fmtDate } from "../lib/dates";

/* بطاقة شكر باسم المعلم في يوم المعلم، بهوية اليوم الرسمية (الكحلي والأصفر وخط حرير).
   تظهر في رئيسية كل حساب له سجل معلم، ويحفظها صورة بمقاس منشور (1080 × 1350). */

const W = 1080;
const H = 1350;
const NAME_SIZE = 96;

// خط حرير الخاص بهوية اليوم — يُحمَّل مع البطاقة فقط
const FONT_CSS = `
@font-face{font-family:Harir;font-weight:400;font-display:swap;src:url(/teacher-day/harir-400.woff2) format('woff2')}
@font-face{font-family:Harir;font-weight:700;font-display:swap;src:url(/teacher-day/harir-700.woff2) format('woff2')}`;

const C = { navy: "#00234E", yellow: "#FFCB05", green: "#55AA5C", violet: "#8f7fe0" };

/** البطاقة نفسها بمقاسها الحقيقي — تُصغَّر للعرض وتُحفظ كما هي */
export function TeacherDayArt({ name, nodeRef }) {
  const nameRef = useRef(null);
  const [fs, setFs] = useState(NAME_SIZE);

  // الاسم الطويل يُصغَّر ليبقى في سطرين (البطاقة تُرسم من جديد إن تغيّر الاسم: key={name})
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (el && el.scrollHeight > fs * 1.18 * 2 + 4 && fs > 56) setFs(fs - 4);
  }, [fs, name]);
  useEffect(() => {
    document.fonts?.ready.then(() => setFs(NAME_SIZE));
  }, []);

  return (
    <div
      ref={nodeRef}
      dir="rtl"
      style={{
        position: "relative", width: W, height: H, overflow: "hidden", color: "#fff",
        fontFamily: "Harir, 'IBM Plex Sans Arabic', sans-serif",
        background: `radial-gradient(ellipse 70% 45% at 50% 30%,#0b3570 0%,transparent 70%),linear-gradient(180deg,#012a5c 0%,${C.navy} 50%,#001b3d 100%)`,
      }}
    >
      <style>{FONT_CSS}</style>

      {/* توهج ألوان الهوية */}
      <div style={{ position: "absolute", width: 640, height: 420, left: 220, top: 300, borderRadius: "50%", filter: "blur(110px)", background: "rgba(40,25,89,.75)" }} />
      <div style={{ position: "absolute", width: 420, height: 420, right: -120, top: -80, borderRadius: "50%", filter: "blur(110px)", background: "rgba(85,170,92,.22)" }} />
      <div style={{ position: "absolute", width: 520, height: 300, left: -120, top: 120, borderRadius: "50%", filter: "blur(110px)", background: "rgba(255,203,5,.10)" }} />

      {/* متوازيات الهوية الخطية */}
      <svg viewBox={`0 0 ${W} ${H}`} fill="none" strokeWidth="2.5" strokeLinejoin="round" opacity=".55"
           style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M860 210 L1130 210 L1200 300 L930 300 Z" stroke={C.green} />
        <path d="M-80 470 L150 470 L220 560 L-10 560 Z" stroke={C.yellow} />
        <path d="M900 640 L1140 640 L1210 730 L970 730 Z" stroke={C.violet} />
        <path d="M-60 300 L110 300 L180 390 L10 390 Z" stroke={C.violet} />
      </svg>

      {/* رمز الهوية مكبّرًا أسفل البطاقة */}
      <img src="/teacher-day/mark.png" alt="" style={{ position: "absolute", width: 1240, left: -80, bottom: 20, filter: "blur(40px) brightness(.4)", opacity: 0.6 }} />
      <img src="/teacher-day/mark.png" alt="" style={{ position: "absolute", width: 1240, left: -80, bottom: 40, opacity: 0.97 }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, background: "linear-gradient(rgba(0,27,61,0) 0%,rgba(0,27,61,.7) 45%,#001a3a 75%)" }} />

      {/* الترويسة: شعار يوم المعلم وشعار البوابة */}
      <div style={{ position: "absolute", top: 58, right: 72, left: 72, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          <img src={iconWhite} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} />
          <div>
            <b style={{ display: "block", fontSize: 19, fontWeight: 700 }}>بوابة مكة الثانوية الرقمية</b>
            <span style={{ display: "block", fontSize: 14, color: "#AFC0D6", marginTop: 2 }}>مدرسة مكة الثانوية</span>
          </div>
        </div>
        <img src="/teacher-day/logo-white.png" alt="يوم المعلم" style={{ height: 92 }} />
      </div>

      {/* الإهداء */}
      <div style={{ position: "absolute", top: 290, right: 72, left: 72, textAlign: "center" }}>
        <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 14, fontSize: 22, color: C.yellow }}>
          <i style={{ display: "inline-block", width: 56, height: 2, background: `linear-gradient(90deg,transparent,${C.yellow})` }} />
          يوم المعلم ١٤٤٨
          <i style={{ display: "inline-block", width: 56, height: 2, background: `linear-gradient(90deg,${C.yellow},transparent)` }} />
        </p>
        <p style={{ margin: "40px 0 0", fontSize: 34, color: "#C9D6E8" }}>إلى المعلم المُلهِم</p>
        <h1 ref={nameRef} style={{ margin: "14px auto 0", maxWidth: 900, fontWeight: 700, fontSize: fs, lineHeight: 1.18, textWrap: "balance", textShadow: "0 10px 40px rgba(0,0,0,.25)" }}>
          {name}
        </h1>
        <div style={{ margin: "30px auto 0", width: 180, height: 4, borderRadius: 4, display: "flex", overflow: "hidden" }}>
          <b style={{ flex: 1, background: C.green }} /><b style={{ flex: 1, background: C.violet }} /><b style={{ flex: 1, background: C.yellow }} />
        </div>
        <p style={{ margin: "40px 0 0", fontWeight: 700, fontSize: 70, lineHeight: 1.1, color: C.yellow }}>أنت الأساس</p>
        <p style={{ margin: "10px 0 0", fontSize: 34, color: "#E3EAF4" }}>بك يسمو العلم وتثمر المعرفة</p>
        <p style={{ margin: "30px auto 0", maxWidth: 720, fontSize: 26, lineHeight: 1.8, color: "#B9C8DC" }}>
          شكرًا لعطائك الذي يصنع الفرق كل يوم، ولأثرك الباقي في عقول طلابك وقلوبهم.
        </p>
      </div>

      {/* التذييل */}
      <div style={{ position: "absolute", bottom: 40, right: 72, left: 72, display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 20, color: "#DDE6F2", textShadow: "0 2px 10px rgba(0,0,0,.35)" }}>
        <span>مع خالص التقدير والامتنان<b style={{ display: "block", fontSize: 24, color: "#fff" }}>إدارة مدرسة مكة الثانوية</b></span>
        <span style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 18, fontWeight: 600, border: "1.5px solid rgba(255,255,255,.55)", borderRadius: 999, padding: "7px 18px", background: "rgba(0,35,78,.45)" }}>
          الاثنين {fmtDate("2026-10-05T12:00:00")}
        </span>
      </div>
    </div>
  );
}

/* تنزيل البطاقة صورة بمقاسها الحقيقي */
async function saveArt(node) {
  const { toBlob } = await import("html-to-image");
  await document.fonts?.ready;
  const blob = await toBlob(node, { pixelRatio: 1, cacheBust: true, width: W, height: H });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "بطاقة-يوم-المعلم.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** معاينة البطاقة مصغّرة بعرض حاويتها، وزر حفظها */
function useCardPreview({ name, className }) {
  const boxRef = useRef(null);
  const artRef = useRef(null);
  const [scale, setScale] = useState(0.3);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const save = async () => {
    setSaving(true);
    try { await saveArt(artRef.current); } finally { setSaving(false); }
  };

  return { save, saving, box: (
    <div ref={boxRef} className={`overflow-hidden rounded-sm2 ${className ?? ""}`} style={{ height: H * scale }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top right" }}>
        <TeacherDayArt key={name} name={name} nodeRef={artRef} />
      </div>
    </div>
  ) };
}

function SaveButton({ save, saving, className = "" }) {
  return (
    <button onClick={save} disabled={saving}
            className={`rounded-pill px-5 py-2 text-sm font-bold transition-opacity disabled:opacity-60 ${className}`}
            style={{ background: C.yellow, color: C.navy }}>
      {saving ? "جارٍ التجهيز…" : "حفظ البطاقة صورة"}
    </button>
  );
}

/** نافذة عرض البطاقة كاملة */
function CardModal({ name, onClose }) {
  const { box, save, saving } = useCardPreview({ name, className: "w-full" });
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-[min(26rem,calc((100vh-9rem)*0.8))]" onClick={(e) => e.stopPropagation()}>
        {box}
        <div className="mt-3 flex items-center justify-center gap-2">
          <SaveButton save={save} saving={saving} />
          <button onClick={onClose}
                  className="rounded-pill border border-white/40 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

/** بنر يوم المعلم أعلى رئيسية المعلم — طوال يوم المناسبة */
function TeacherDayHero({ name, firstName }) {
  const [open, setOpen] = useState(false);
  return (
    <section dir="rtl" className="relative overflow-hidden rounded-card text-white"
             style={{ fontFamily: "Harir, 'IBM Plex Sans Arabic', sans-serif",
                      background: `radial-gradient(ellipse 60% 90% at 75% 20%,#0b3570 0%,transparent 70%),linear-gradient(135deg,#012a5c 0%,${C.navy} 55%,#001b3d 100%)` }}>
      <style>{FONT_CSS}</style>
      {/* توهج ألوان الهوية */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full" style={{ background: "rgba(85,170,92,.20)", filter: "blur(70px)" }} />
      <div className="pointer-events-none absolute left-1/3 top-10 h-56 w-96 rounded-full" style={{ background: "rgba(40,25,89,.7)", filter: "blur(80px)" }} />
      {/* متوازيات الهوية */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice"
           fill="none" strokeWidth="1.8" strokeLinejoin="round" opacity=".5">
        <path d="M-40 40 L120 40 L170 100 L10 100 Z" stroke={C.violet} />
        <path d="M430 230 L600 230 L650 290 L480 290 Z" stroke={C.yellow} />
        <path d="M880 -20 L1060 -20 L1110 40 L930 40 Z" stroke={C.green} />
      </svg>
      {/* رمز الهوية في الزاوية */}
      <img src="/teacher-day/mark.png" alt=""
           className="pointer-events-none absolute -bottom-6 -left-10 w-[22rem] opacity-90 sm:-bottom-10 sm:w-[30rem] lg:w-[36rem]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 sm:hidden"
           style={{ background: "linear-gradient(rgba(0,27,61,0),#001b3d 85%)" }} />

      <div className="relative flex flex-col gap-4 px-6 pb-28 pt-6 sm:min-h-[15rem] sm:pb-8 sm:pt-8 sm:pl-[32%] lg:px-10">
        <div className="flex items-center gap-3">
          <img src="/teacher-day/logo-white.png" alt="يوم المعلم" className="h-12 sm:h-14" />
          <span className="text-sm" style={{ color: C.yellow }}>الاثنين {fmtDate("2026-10-05T12:00:00")}</span>
        </div>
        <div>
          <p className="text-lg sm:text-xl" style={{ color: "#C9D6E8" }}>شكرًا لك أ. {firstName}</p>
          <h2 className="mt-1 text-4xl font-bold leading-tight sm:text-5xl" style={{ color: C.yellow }}>أنت الأساس</h2>
          <p className="mt-2 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "#E3EAF4" }}>
            بك يسمو العلم وتثمر المعرفة.. شكرًا لعطائك الذي يصنع الفرق كل يوم.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          <button onClick={() => setOpen(true)}
                  className="rounded-pill px-6 py-2.5 text-sm font-bold shadow-lg transition-transform hover:scale-[1.03]"
                  style={{ background: C.yellow, color: C.navy }}>
            شاهد بطاقتك ←
          </button>
          <span className="text-xs" style={{ color: "#AFC0D6" }}>بطاقة شكر باسمك من إدارة المدرسة</span>
        </div>
      </div>
      {open && <CardModal name={name} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** صندوق البطاقة بعد يوم المناسبة (حتى نهاية الأسبوع): معاينة مصغّرة وزر الحفظ */
function TeacherDayBox({ name }) {
  const { box, save, saving } = useCardPreview({ name, className: "w-full shrink-0 sm:w-64" });
  return (
    <section id="teacher-day-card" className="overflow-hidden rounded-card" style={{ background: C.navy }}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {box}
        <div className="text-center sm:text-right">
          <p className="text-sm font-semibold" style={{ color: C.yellow }}>يوم المعلم</p>
          <p className="mt-1 text-xl font-bold text-white">شكرًا لك.. أنت الأساس</p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#C9D6E8" }}>
            بطاقة شكر باسمك من إدارة المدرسة، احفظها وشاركها.
          </p>
          <SaveButton save={save} saving={saving} className="mt-4" />
        </div>
      </div>
    </section>
  );
}

/** يوم المعلم في رئيسية كل حساب له سجل معلم:
    يوم المناسبة بنر كبير يفتح البطاقة، وبقية الأسبوع صندوق البطاقة. */
export default function TeacherDayCard() {
  const { profile, isTeacher } = useSession();
  if (!isTeacher || !showTeacherDayCard()) return null;

  const raw = (profile?.full_name || "").trim().replace(/^أ\.\s*/, "");
  const name = `أ. ${raw}`;
  const firstName = raw.split(/\s+/)[0] || "";

  return isTeacherDay()
    ? <TeacherDayHero name={name} firstName={firstName} />
    : <TeacherDayBox name={name} />;
}
