// src/pages/studio/Sheets.jsx
import iconMint from "../../assets/icon-mint.png";
import iconWhite from "../../assets/icon-white.png";
import moeLogo from "../../assets/moe-logo.png";
import { fitSize, fitTitle, bodySize, classCode, classShort, GRADE_OPTIONS } from "./lib";
import { ROLLUP_SIZES } from "./templates";
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
  health:   <svg {...P}><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2"/><path d="M6 13.5h3l1.5-2.5 2.5 5 1.5-2.5H18"/></svg>,
  chat:     <svg {...P}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/></svg>,
  shield:   <svg {...P}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>,
  trophy:   <svg {...P}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/></svg>,
  clock:    <svg {...P}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  star:     <svg {...P}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>,
  globe:    <svg {...P}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/></svg>,
  // دورات مياه (رجال) — مدرسة بنين
  wc:       <svg {...P}><circle cx="12" cy="4.2" r="2"/><path d="M9.5 8h5a1.5 1.5 0 0 1 1.5 1.5V15h-1.5v6.5h-5V15H8V9.5A1.5 1.5 0 0 1 9.5 8z"/><path d="M12 15v6.5"/></svg>,
  mosque:   <svg {...P}><path d="M12 3c-2.5 2-5 3.5-5 6.5V11h10V9.5C17 6.5 14.5 5 12 3zM5 11h14v10H5zM10 21v-4a2 2 0 0 1 4 0v4M3 21h18M20 8v13M20 6v-.5"/></svg>,
  exit:     <svg {...P}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8"/><path d="M10 12h11M17 8l4 4-4 4"/></svg>,
  assembly: <svg {...P}><circle cx="12" cy="6" r="2"/><circle cx="5.5" cy="9" r="1.7"/><circle cx="18.5" cy="9" r="1.7"/><path d="M8.5 21v-5l-1-4h9l-1 4v5M3 21v-4.5L2.5 13h6M21 21v-4.5l.5-3.5h-6"/></svg>,
  noentry:  <svg {...P}><circle cx="12" cy="12" r="9"/><path d="M7 12h10"/></svg>,
  quiet:    <svg {...P}><path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>,
  food:     <svg {...P}><path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8M8 3v6M16 21V3c2.5 1 3.5 4 3.5 7s-1.5 4-3.5 4"/></svg>,
  stairs:   <svg {...P}><path d="M3 21h5v-5h5v-5h5V6h3M3 21V3"/></svg>,
  elevator: <svg {...P}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M7.5 10l1.5-2 1.5 2M13.5 14l1.5 2 1.5-2"/></svg>,
  water:    <svg {...P}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/></svg>,
  info:     <svg {...P}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>,
  send:     <svg {...P}><path d="M21 3L3 11l7 3 3 7z"/><path d="M10 14l11-11"/></svg>,
};
// أسماء الرموز كما تظهر للمستخدم في اختيار رمز اللوحة
export const ICON_LABEL = {
  building: "مكتب", user: "شخص", hall: "قاعة", cap: "فصل", book: "مكتبة", flask: "مختبر", monitor: "حاسب",
  health: "عيادة", chat: "توجيه", shield: "أمن وسلامة", trophy: "نشاط",
  star: "موهوبين", globe: "جلوب",
  wc: "دورات مياه", mosque: "مصلى", exit: "مخرج", assembly: "تجمّع", noentry: "ممنوع", quiet: "هدوء",
  food: "مقصف", stairs: "درج", elevator: "مصعد", water: "ماء", info: "استقبال",
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
const ORDINAL = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر"];

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

/* ----------------------------- لوحة الفصل ----------------------------- */
export function ClassDoor({ theme = "light", d }) {
  const n = classShort(d.classNo);
  const code = classCode(GRADE_OPTIONS.indexOf(d.grade) + 1 || 1, n);
  return (
    <div className={`stu stu-door stu-class stu-${theme} stu-landscape sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={d.year} />
        <div className="stu-dbody">
          <div className="stu-cno"><small>فصل</small><b className="num">{code}</b></div>
          <div className="stu-dtext">
            <div className="stu-h1" style={{ fontSize: fitSize(d.grade, { max: 88, min: 50, width: 640 }) }}>{d.grade}</div>
            {d.track && <span className="stu-track">{ICONS.cap}{d.track}</span>}
            <div className="stu-grule" />
          </div>
        </div>
        <div className="stu-dfoot">
          {d.motto ? <span className="stu-motto">{d.motto}</span> : <span />}
          {d.room && <span className="stu-room"><small>غرفة</small><b dir="ltr">{d.room}</b></span>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- جدول الحصص ----------------------------- */
const DEMO_SUBJECTS = [["الرياضيات", "أحمد الغامدي"], ["اللغة العربية", "سعد الحربي"], ["الفيزياء", "خالد الزهراني"],
  ["اللغة الإنجليزية", "فهد القرني"], ["الدراسات الإسلامية", "علي الشهري"], ["الكيمياء", "ماجد العمري"], ["الأحياء", "ناصر المالكي"]];
const DEMO_COLS = [1, 2, 3, { kind: "break", label: "الفسحة" }, 4, 5, { kind: "break", label: "الصلاة" }, 6, 7]
  .map((x) => (typeof x === "number" ? { kind: "period", n: x, time: "" } : x));
const DAYS = { 1: "الأحد", 2: "الاثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس" };

export function Timetable({ theme = "light", d }) {
  const cols = d.cols?.length ? d.cols : DEMO_COLS;
  const days = d.days ?? [1, 2, 3, 4, 5];
  let cells = d.cells ?? {};
  if (!d.cells && d.sampleGrid) {
    days.forEach((dy) => cols.forEach((c) => {
      if (c.kind !== "period") return;
      const [a, b] = DEMO_SUBJECTS[(dy * 3 + c.n) % DEMO_SUBJECTS.length];
      if ((dy + c.n) % 6) cells[`${dy}-${c.n}`] = { a, b };
    }));
  }
  const periods = cols.filter((c) => c.kind === "period").length;
  const cellW = (983 - 110 - (cols.length - periods) * 38 - cols.length * 6) / Math.max(1, periods) - 14;
  const template = `110px ${cols.map((c) => (c.kind === "period" ? "1fr" : "38px")).join(" ")}`;
  return (
    <div className={`stu stu-tt stu-${theme} stu-landscape sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={d.year} />
        <div className="stu-tthead">
          <div>
            <div className="stu-h1" style={{ fontSize: fitSize(d.heading, { max: 34, min: 20, width: 640 }) }}>{d.heading}</div>
            {d.sub && <div className="stu-ttsub">{d.sub}</div>}
          </div>
          {d.term && <span className="stu-year">{d.term}</span>}
        </div>
        <div className="stu-grid" style={{ gridTemplateColumns: template }}>
          <div className="stu-corner" style={{ gridRow: 1, gridColumn: 1 }}>اليوم / الحصة</div>
          {cols.map((c, i) => c.kind === "period"
            ? <div key={i} className="stu-ph" style={{ gridRow: 1, gridColumn: i + 2 }}><b className="num">{c.n}</b>{c.time && <small className="num">{c.time}</small>}</div>
            : <div key={i} className="stu-brk" style={{ gridRow: `1 / span ${days.length + 1}`, gridColumn: i + 2 }}><span>{c.label}</span></div>)}
          {days.map((dy, r) => (
            <FragmentRow key={dy} dy={dy} r={r} cols={cols} cells={cells} cellW={cellW} />
          ))}
        </div>
        <div className="stu-ttfoot">
          <span>{d.note || "بوابة مكة الثانوية الرقمية · استوديو البوابة"}</span>
          <span className="site">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ dy, r, cols, cells, cellW }) {
  return (
    <>
      <div className="stu-day" style={{ gridRow: r + 2, gridColumn: 1 }}>{DAYS[dy]}</div>
      {cols.map((c, i) => {
        if (c.kind !== "period") return null;
        const v = cells[`${dy}-${c.n}`];
        return (
          <div key={i} className={`stu-cell${v ? "" : " empty"}`} style={{ gridRow: r + 2, gridColumn: i + 2 }}>
            {v ? <>
              <b style={{ fontSize: fitSize(v.a, { max: 16, min: 10, width: cellW }) }}>{v.a}</b>
              {v.b && <small style={{ fontSize: fitSize(v.b, { max: 12, min: 9, width: cellW, weight: 500 }) }}>{v.b}</small>}
            </> : <i>—</i>}
          </div>
        );
      })}
    </>
  );
}

/* ----------------------------- أرقام الجلوس ----------------------------- */
export function Seats({ theme = "light", d }) {
  const labels = Array.from({ length: 14 }, (_, i) => d.labels?.[i] ?? null);
  return (
    <div className={`stu stu-seats stu-${theme} stu-portrait sheet`}>
      <div className="grid">
        {labels.map((l, i) => (
          <div key={i} className={`stu-seat${l ? "" : " empty"}`}>
            {l && (
              <div className="in">
                <div className="no"><small>رقم الجلوس</small><b className="num" dir="ltr">{l.seat}</b></div>
                <div className="tx">
                  <div className="top"><img src={theme === "dark" ? iconWhite : iconMint} alt="" />
                    <span style={{ fontSize: fitSize(d.title, { max: 11, min: 8, width: 170, weight: 600 }) }}>{d.title}</span></div>
                  <div className="nm" style={{ fontSize: fitSize(l.name, { max: 19, min: 11, width: 200 }) }}>{l.name}</div>
                  <div className="tags"><span>فصل <b className="num">{l.cls}</b></span><span>لجنة <b className="num">{l.com}</b></span></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="note">قصّ على الخط المتقطع · مدرسة مكة الثانوية</p>
    </div>
  );
}

/* ----------------------------- اللافتة الإرشادية ----------------------------- */
const ARROWS = {
  right: <path d="M4 12h15M13 6l6 6-6 6" />, left: <path d="M20 12H5M11 6l-6 6 6 6" />,
  up: <path d="M12 20V5M6 11l6-6 6 6" />, down: <path d="M12 4v15M6 13l6 6 6-6" />,
};

export function Sign({ theme = "light", orient = "landscape", d }) {
  const land = orient === "landscape";
  const warn = d.tone === "warn";
  const side = land && (d.arrow === "right" || d.arrow === "left");
  // مع السهم الجانبي يضيق عرض النص حتى لا يتداخل معه
  const t = fitTitle(d.title, { max: land ? 110 : 96, min: 44, width: side ? 420 : land ? 580 : 620 });
  const arrow = d.arrow && ARROWS[d.arrow] && (
    <svg className={`stu-arrow ${d.arrow}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round">{ARROWS[d.arrow]}</svg>
  );
  return (
    <div className={`stu stu-signage stu-${theme} stu-${orient}${warn ? " warn" : ""} sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} />
        <div className={`stu-sbody ${land ? "row" : "col"}`}>
          {side && d.arrow === "right" && arrow}
          {!side && d.arrow === "up" && arrow}
          <div className="stu-sicon">{ICONS[d.icon] ?? ICONS.info}</div>
          <div className="stu-stext">
            <div className={`stu-h1${t.wrap ? " wrap" : ""}`} style={{ fontSize: t.size }}>{d.title}</div>
            {d.sub && <div className="stu-ssub">{d.sub}</div>}
          </div>
          {side && d.arrow === "left" && arrow}
          {!side && d.arrow && d.arrow !== "up" && arrow}
        </div>
        <Foot />
      </div>
    </div>
  );
}

/* ----------------------------- بطاقة التعريف ----------------------------- */
export function Badges({ theme = "light", d }) {
  const cards = Array.from({ length: 9 }, (_, i) => (d.cards ?? [d])[i] ?? null);
  return (
    <div className={`stu stu-badges stu-${theme} stu-portrait sheet`}>
      <div className="grid">
        {cards.map((c, i) => (
          <div key={i} className={`stu-badge${c ? "" : " empty"}`}>
            {c && (
              <div className="in">
                <div className="band">
                  <i className="slot" />
                  <div className="sch"><img src={iconWhite} alt="" /><b>مدرسة مكة الثانوية</b></div>
                </div>
                <div className="ph">
                  {c.photo ? <img src={c.photo} alt="" /> : ICONS.user}
                </div>
                {(() => {
                  const t = fitTitle(c.name, { max: 19, min: 12, width: 160 });
                  return <div className={`nm${t.wrap ? " wrap" : ""}`} style={{ fontSize: t.size }}>{c.name}</div>;
                })()}
                {c.role && <span className="rl">{c.role}</span>}
                {c.dept && <div className="dp" style={{ fontSize: fitSize(c.dept, { max: 12.5, min: 9, width: 170, weight: 500 }) }}>{c.dept}</div>}
                <div className="ft"><span className="num">{d.year}</span><span className="site">makkahsec.com</span></div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="note">بطاقات 5.4 × 8.6 سم · قصّ على الخط المتقطع</p>
    </div>
  );
}

/* ----------------------------- رول أب المناسبات ----------------------------- */
export function Rollup({ theme = "light", d }) {
  const { w, h } = ROLLUP_SIZES[d.size] ?? ROLLUP_SIZES["85x200"];
  const t = fitTitle(d.occasion, { max: 128, min: 60, width: w - 170 });
  const a = fitTitle(d.tagline, { max: 64, min: 34, width: w - 170, weight: 700 });
  return (
    <div className={`stu stu-rollup stu-${theme} sheet`} style={{ width: w, height: h }}>
      <Decor />
      <div className="stu-rpage">
        <div className="stu-rhead">
          {theme === "official" && <img src={moeLogo} alt="" className="moe" />}
          <img src={theme === "dark" ? iconWhite : iconMint} alt="" />
          <b>مدرسة مكة الثانوية</b>
          <span>بوابة مكة الثانوية الرقمية</span>
        </div>
        <div className="stu-rlogo">
          {d.logo ? <img src={d.logo} alt="" /> : <div className="ph">{ICONS.star}<small>شعار المناسبة</small></div>}
        </div>
        <div className={`stu-h1${t.wrap ? " wrap" : ""}`} style={{ fontSize: t.size }}>{d.occasion}</div>
        {d.tagline && <div className={`stu-accent${a.wrap ? " wrap" : ""}`} style={{ fontSize: a.size }}>{d.tagline}</div>}
        <div className="stu-grule" />
        {d.date && <span className="stu-rdate">{d.date}</span>}
        {d.sub && <p className="stu-rsub">{d.sub}</p>}
        <div className="stu-rfoot"><span className="site">makkahsec.com</span></div>
      </div>
    </div>
  );
}

/* ----------------------------- مستندات الطالب ----------------------------- */
const STAGE = "المرحلة الثانوية";
const gradeOf = (p) => GRADE_NAMES_S[p.grade] ?? GRADE_NAMES_S[Number(String(p.cls ?? "")[0])] ?? "";
const GRADE_NAMES_S = { 1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي" };

// المرسَل إليه: طالب، أو أسماء، أو فصل كامل
function Recipient({ d, big = 64, width = 900 }) {
  const to = d.to ?? [];
  if (d.mode === "class" || d.toClass) {
    const cls = d.toClass || d.cls || "…";
    return (<>
      <div className="stu-rname" style={{ fontSize: fitSize(`طلاب الفصل ${cls}`, { max: big, min: 30, width }) }}>طلاب الفصل <span className="num">{cls}</span></div>
      <div className="stu-rmeta">{[GRADE_NAMES_S[Number(String(cls)[0])], STAGE].filter(Boolean).join(" · ")}</div>
    </>);
  }
  if (to.length <= 1) {
    const p = to[0] ?? { name: "اسم الطالب", cls: "" };
    const t = fitTitle(p.name, { max: big, min: 28, width });
    return (<>
      <div className={`stu-rname${t.wrap ? " wrap" : ""}`} style={{ fontSize: t.size }}>{p.name}</div>
      <div className="stu-rmeta">{[gradeOf(p), p.cls && `فصل ${p.cls}`, STAGE].filter(Boolean).join(" · ")}</div>
    </>);
  }
  const size = to.length > 12 ? 15 : to.length > 6 ? 18 : 22;
  return (
    <div className="stu-rgroup" style={{ fontSize: size, gridTemplateColumns: `repeat(${to.length > 8 ? 3 : 2}, 1fr)` }}>
      {to.map((p, i) => <div key={i}><b>{p.name}</b>{p.cls && <small className="num">{p.cls}</small>}</div>)}
    </div>
  );
}

export function Thanks({ theme = "light", d }) {
  return (
    <div className={`stu stu-thanks stu-${theme} stu-landscape sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={d.year} />
        <div className="stu-tbody">
          <span className="stu-tag">{ICONS.star}{d.kind}</span>
          <p className="stu-tlead">يسرّنا أن نتقدّم بخالص {d.kind === "شكر وتقدير" ? "الشكر والتقدير" : d.kind === "تهنئة" ? "التهنئة" : d.kind === "تحفيز" ? "التحفيز والتشجيع" : "التقدير"} إلى</p>
          <Recipient d={d} big={62} width={860} />
          <div className="stu-grule" />
          {d.reason && <p className="stu-treason">{d.reason}</p>}
        </div>
        <div className="stu-tfoot">
          <div className="who">{d.signerTitle && <small>{d.signerTitle}</small>}<b>{d.signer}</b></div>
          {d.date && <span className="stu-rdate">{d.date}</span>}
          <div className="stamp">الختم</div>
        </div>
      </div>
    </div>
  );
}

export function Notice({ theme = "light", d }) {
  const points = (d.points ?? []).filter((x) => x?.trim());
  const paras = String(d.body ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const size = bodySize([d.body, ...points].join(" "), { max: 20, min: 14.5, from: 380, step: 90 });
  const t = fitTitle(d.title, { max: 42, min: 24, width: 640 });
  return (
    <div className={`stu stu-circular stu-notice stu-${theme} stu-portrait sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={d.year} />
        <div className="stu-cmeta">
          <span className="stu-tag">{ICONS.megaphone}{d.kind}</span>
          <div className="refs">{d.date && <span>التاريخ <b>{d.date}</b></span>}</div>
        </div>
        <div className="stu-nto"><span className="lbl">إلى</span><div className="who"><Recipient d={d} big={34} width={560} /></div></div>
        {d.title && <>
          <div className="stu-subj">الموضوع</div>
          <div className={`stu-h1${t.wrap ? " wrap" : ""}`} style={{ fontSize: t.size }}>{d.title}</div>
        </>}
        <div className="stu-grule" />
        <div className="stu-text" style={{ fontSize: size }}>
          {paras.map((x, i) => <p key={i}>{x}</p>)}
          {points.length > 0 && (
            <ol className="stu-points">{points.map((x, i) => <li key={i}><i className="num">{i + 1}</i><span>{x}</span></li>)}</ol>
          )}
        </div>
        <div className="stu-sign">
          <div className="who">{d.signerTitle && <small>{d.signerTitle}</small>}<b>{d.signer}</b><span className="line">التوقيع</span></div>
        </div>
        <Foot />
      </div>
    </div>
  );
}
