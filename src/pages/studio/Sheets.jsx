// src/pages/studio/Sheets.jsx
import iconMint from "../../assets/icon-mint.png";
import iconWhite from "../../assets/icon-white.png";
import moeLogo from "../../assets/moe-logo.png";
import { fitSize, fitTitle } from "./lib";
import "./studio.css";

/* =====================================================================
   أوراق استوديو البوابة — كل ورقة بمقاس A4 الحقيقي (96dpi)، وتُستخدم كما هي
   في المعاينة المصغّرة والطباعة وتصدير الصورة.
   ===================================================================== */

const P = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
export const ICONS = {
  book:     <svg {...P}><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h7"/></svg>,
  case:     <svg {...P}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></svg>,
  user:     <svg {...P}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>,
  cap:      <svg {...P}><path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v5c0 2 3 3 6 3s6-1 6-3V9"/></svg>,
  table:    <svg {...P}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>,
  calendar: <svg {...P}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  building: <svg {...P}><path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>,
  hourglass:<svg {...P}><path d="M5 3h14M5 21h14M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9"/></svg>,
};

const YEAR_FALLBACK = "";

function Decor() {
  return (
    <div className="stu-bgbox">
      <div className="stu-tex" /><div className="stu-blob" />
      <div className="stu-cube a" /><div className="stu-cube b" />
      <div className="stu-progress" />
    </div>
  );
}

function Head({ theme, year }) {
  if (theme === "official") {
    return (
      <>
        <div className="stu-gov">
          <div className="lines">
            المملكة العربية السعودية<br />وزارة التعليم<br />الإدارة العامة للتعليم بمنطقة مكة المكرمة
            <b>مدرسة مكة الثانوية</b>
          </div>
          <div className="logos"><img src={moeLogo} alt="" /><img src={iconMint} alt="" /></div>
        </div>
        <div className="stu-rule" />
      </>
    );
  }
  return (
    <div className="stu-bar">
      <div className="stu-brand">
        <img src={theme === "dark" ? iconWhite : iconMint} alt="" />
        <div><b>بوابة مكة الثانوية الرقمية</b><span>مدرسة مكة الثانوية</span></div>
      </div>
      {year && <div className="stu-year">{year}</div>}
    </div>
  );
}

function Foot() {
  return (
    <div className="stu-foot">
      <span>بوابة مكة الثانوية الرقمية · استوديو البوابة</span>
      <span className="site">makkahsec.com</span>
    </div>
  );
}

/* ----------------------------- غلاف السجل ----------------------------- */
/* kind: teacher (سجل المعلم) أو admin (السجل الإداري) */
export function RegisterCover({ theme = "light", orient = "portrait", kind = "teacher", d }) {
  const land = orient === "landscape";
  const titleW = land ? 490 : 636;
  const valW = land ? 200 : 410;
  const h1 = fitTitle(d.title, { max: land ? 80 : 88, min: 30, width: titleW });
  const sub = fitTitle(d.sub, { max: land ? 38 : 44, min: 18, width: titleW, weight: 700 });

  const rows = kind === "admin"
    ? [
        ["building", "القسم", d.dept],
        ["user", "المسؤول", d.person, d.personTitle],
        ["hourglass", "مدة الحفظ", d.retention],
        ["calendar", "العام الدراسي", d.year],
      ]
    : [
        ["user", "المعلم", d.teacher],
        ["cap", "المادة", d.subject],
        ["table", "الفصول", d.classes],
        ["calendar", "العام الدراسي", d.year],
      ];

  return (
    <div className={`stu stu-cover stu-${theme} stu-${orient} sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={d.year || YEAR_FALLBACK} />
        <div className="stu-body">
          <div className="stu-hero">
            <span className="stu-tag">{ICONS[kind === "admin" ? "case" : "book"]}{kind === "admin" ? "سجل إداري" : "سجل"}</span>
            <div className={`stu-h1${h1.wrap ? " wrap" : ""}`} style={{ fontSize: h1.size }}>{d.title}</div>
            {d.sub && <div className={`stu-sub${sub.wrap ? " wrap" : ""}`} style={{ fontSize: sub.size }}>{d.sub}</div>}
            {kind === "admin" && d.code && <div className="stu-code">رقم السجل <b>{d.code}</b></div>}
            <div className="stu-grule" />
          </div>
          <div className="stu-info">
            {rows.filter((r) => r[2]).map(([ic, k, v, small]) => (
              <div key={k} className="stu-row">
                <div className="stu-ic">{ICONS[ic]}</div>
                <span className="k">{k}</span>
                <span className="v" style={{ fontSize: fitSize(v, { max: 21, min: 13, width: valW }) }}>
                  {v}{small && <small>{small}</small>}
                </span>
              </div>
            ))}
          </div>
        </div>
        <Foot />
      </div>
    </div>
  );
}

/* ----------------------------- فاصل الأقسام ----------------------------- */
const ORDINAL = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

export function Divider({ theme = "light", d }) {
  const n = Math.max(1, Math.min(10, Number(d.n) || 1));
  const toc = (d.toc ?? []).filter((r) => r.a?.trim());
  return (
    <div className={`stu stu-divider stu-${theme} stu-portrait sheet`}>
      <Decor />
      {/* اللسان على الحافة اليسرى (جهة فتح الملف العربي) وينزل بحسب رقم القسم */}
      <div className="stu-tab" style={{ top: 70 + ((n - 1) % 5) * 160 }}><span>القسم</span><b>{n}</b></div>
      <div className="stu-page">
        <div className="stu-bar">
          <div className="stu-brand">
            <img src={theme === "dark" ? iconWhite : iconMint} alt="" />
            <div><b>مدرسة مكة الثانوية</b><span>{d.year}</span></div>
          </div>
          {(d.recName || d.recSub) && (
            <div className="stu-rec">{d.recName}{d.recSub && <> · <b>{d.recSub}</b></>}</div>
          )}
        </div>
        <div className="stu-mid">
          <div className="stu-big">{n}</div>
          <div className="stu-lbl">القسم {ORDINAL[n]}</div>
          {(() => {
            const t = fitTitle(d.title, { max: 64, min: 28, width: 570 });
            return <div className={`stu-h1${t.wrap ? " wrap" : ""}`} style={{ fontSize: t.size }}>{d.title}</div>;
          })()}
          {d.desc && <p className="stu-desc">{d.desc}</p>}
          <div className="stu-grule" />
          {toc.length > 0 && (
            <div className="stu-toc">
              {toc.map((r, i) => <div key={i}><span>{r.a}</span><i>{r.b || "—"}</i></div>)}
            </div>
          )}
        </div>
        <div className="stu-foot"><span>استوديو البوابة</span><span className="site">makkahsec.com</span></div>
      </div>
    </div>
  );
}

/* ----------------------------- ملصقات الظهر ----------------------------- */
export const SPINE_SIZES = {
  narrow: { label: "4 سم — للملف الرفيع", count: 4, title: [58, 26, 640], sub: [22, 13, 640] },
  wide:   { label: "7.5 سم — للملف العريض", count: 2, title: [86, 34, 600], sub: [30, 16, 600] },
};

export function Spines({ theme = "light", d }) {
  const size = SPINE_SIZES[d.size] ? d.size : "narrow";
  const cfg = SPINE_SIZES[size];
  const items = Array.from({ length: cfg.count }, (_, i) => d.items?.[i] ?? {});
  return (
    <div className={`stu stu-spines stu-${theme} stu-portrait sheet`}>
      <div className="row">
        {items.map((it, i) => (
          <div key={i} className={`stu-lab ${size}${it.title ? "" : " empty"}`}>
            {it.title && (
              <div className="in">
                <img src={theme === "dark" ? iconWhite : iconMint} alt="" />
                <div className="sch">مدرسة مكة<br />الثانوية</div>
                {d.year && <div className="yr">{d.year}</div>}
                <div className="gr" />
                <div className="v">
                  <h2 style={{ fontSize: fitSize(it.title, { max: cfg.title[0], min: cfg.title[1], width: cfg.title[2] }) }}>{it.title}</h2>
                  {it.sub && <p style={{ fontSize: fitSize(it.sub, { max: cfg.sub[0], min: cfg.sub[1], width: cfg.sub[2], weight: 600 }) }}>{it.sub}</p>}
                </div>
                {it.no && <div className="no"><small>ملف</small><b>{it.no}</b></div>}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="note">
        {cfg.count === 2 ? "ملصقان" : `${cfg.count} ملصقات`} بعرض {size === "wide" ? "7.5" : "4"} سم — قصّ على الخط المتقطع
      </p>
    </div>
  );
}
