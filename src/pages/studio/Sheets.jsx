// src/pages/studio/Sheets.jsx
import iconMint from "../../assets/icon-mint.png";
import iconWhite from "../../assets/icon-white.png";
import moeLogo from "../../assets/moe-logo.png";
import { fitSize, fitTitle, bodySize } from "./lib";
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
  hall:     <svg {...P}><rect x="3" y="3.5" width="18" height="11.5" rx="1.5"/><path d="M7 11l3-3 2.5 2 4-4M12 15v3M8 21l4-3 4 3"/></svg>,
  table:    <svg {...P}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>,
  calendar: <svg {...P}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  building: <svg {...P}><path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>,
  hourglass:<svg {...P}><path d="M5 3h14M5 21h14M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9"/></svg>,
  megaphone:<svg {...P}><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8M8 14l1 5h2"/></svg>,
  flask:    <svg {...P}><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/></svg>,
  monitor:  <svg {...P}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>,
  health:   <svg {...P}><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2"/><path d="M12 10.5v6M9 13.5h6"/></svg>,
  chat:     <svg {...P}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/></svg>,
  shield:   <svg {...P}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>,
  trophy:   <svg {...P}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/></svg>,
  clock:    <svg {...P}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  send:     <svg {...P}><path d="M21 3L3 11l7 3 3 7z"/><path d="M10 14l11-11"/></svg>,
};
// أسماء الرموز كما تظهر للمستخدم في اختيار رمز اللوحة
export const ICON_LABEL = {
  building: "مكتب", user: "شخص", hall: "قاعة", cap: "فصل", book: "مكتبة", flask: "مختبر", monitor: "حاسب",
  health: "عيادة", chat: "توجيه", shield: "أمن وسلامة", trophy: "نشاط",
};

const YEAR_FALLBACK = "";

export function Decor() {
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

/* ----------------------------- تعميم وإعلان ----------------------------- */
const KIND_ICON = { "تعميم": "send", "إعلان": "megaphone", "تنبيه": "shield", "دعوة": "calendar" };

export function Circular({ theme = "light", d }) {
  const points = (d.points ?? []).filter((x) => x?.trim());
  const paras = String(d.body ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const size = bodySize([d.body, ...points].join(" "), { max: 20, min: 14.5, from: 380, step: 90 });
  const t = fitTitle(d.title, { max: 44, min: 24, width: 640 });
  return (
    <div className={`stu stu-circular stu-${theme} stu-portrait sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={d.year} />
        <div className="stu-cmeta">
          <span className="stu-tag">{ICONS[KIND_ICON[d.kind] ?? "send"]}{d.kind || "تعميم"}</span>
          <div className="refs">
            {d.no && <span>الرقم <b dir="ltr">{d.no}</b></span>}
            {d.date && <span>التاريخ <b>{d.date}</b></span>}
          </div>
        </div>
        {d.to && <div className="stu-to"><span>إلى</span>{d.to}</div>}
        <div className="stu-subj">الموضوع</div>
        <div className={`stu-h1${t.wrap ? " wrap" : ""}`} style={{ fontSize: t.size }}>{d.title}</div>
        <div className="stu-grule" />
        <div className="stu-text" style={{ fontSize: size }}>
          {paras.map((x, i) => <p key={i}>{x}</p>)}
          {points.length > 0 && (
            <ol className="stu-points">
              {points.map((x, i) => <li key={i}><i className="num">{i + 1}</i><span>{x}</span></li>)}
            </ol>
          )}
        </div>
        <div className="stu-sign">
          <div className="who">
            {d.signerTitle && <small>{d.signerTitle}</small>}
            <b>{d.signer}</b>
            <span className="line">التوقيع</span>
          </div>
          <div className="stamp">الختم</div>
        </div>
        <Foot />
      </div>
    </div>
  );
}

/* ----------------------------- لوحة الباب ----------------------------- */
export function DoorSign({ theme = "light", d }) {
  const place = fitTitle(d.place, { max: 96, min: 44, width: 700 });
  return (
    <div className={`stu stu-door stu-${theme} stu-landscape sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} />
        <div className="stu-dbody">
          <div className="stu-dicon">{ICONS[d.icon] ?? ICONS.building}</div>
          <div className="stu-dtext">
            <div className={`stu-h1${place.wrap ? " wrap" : ""}`} style={{ fontSize: place.size }}>{d.place}</div>
            <div className="stu-grule" />
            {d.name && <div className="stu-dname" style={{ fontSize: fitSize(d.name, { max: 40, min: 24, width: 700 }) }}>{d.name}</div>}
            {d.role && <div className="stu-drole">{d.role}</div>}
          </div>
        </div>
        <div className="stu-dfoot">
          {d.hours ? <span className="stu-hours">{ICONS.clock}أوقات المراجعة <b>{d.hours}</b></span> : <span />}
          {d.room && <span className="stu-room"><small>غرفة</small><b dir="ltr">{d.room}</b></span>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- منشور التواصل ----------------------------- */
export function Social({ theme = "dark", d }) {
  const story = d.format === "story";
  const points = (d.points ?? []).filter((x) => x?.trim());
  const h = fitTitle(d.title, { max: story ? 118 : 104, min: 50, width: 900 });
  const a = fitTitle(d.accent, { max: story ? 96 : 84, min: 40, width: 900 });
  return (
    <div className={`stu stu-social stu-${theme} ${story ? "story" : "square"}`}
         style={{ width: 1080, height: story ? 1920 : 1080 }}>
      <Decor />
      <div className="stu-spage">
        <Head theme={theme} year={d.date} />
        <div className="stu-smid">
          {d.tag && <span className="stu-tag">{ICONS.megaphone}{d.tag}</span>}
          <div className={`stu-h1${h.wrap ? " wrap" : ""}`} style={{ fontSize: h.size }}>{d.title}</div>
          {d.accent && <div className={`stu-accent${a.wrap ? " wrap" : ""}`} style={{ fontSize: a.size }}>{d.accent}</div>}
          {d.sub && <p className="stu-slead">{d.sub}</p>}
          {points.length > 0 && (
            <div className="stu-scards">
              {points.map((x, i) => <div key={i}><i className="num">{i + 1}</i><span>{x}</span></div>)}
            </div>
          )}
        </div>
        <div className="stu-sfoot">
          <span>مدرسة مكة الثانوية</span>
          <span className="site">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}
