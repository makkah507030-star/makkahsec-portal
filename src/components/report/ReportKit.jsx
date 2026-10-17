// src/components/report/ReportKit.jsx
import iconMint from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { Decor, ICONS } from "../../pages/studio/Sheets.jsx";
import "../../pages/studio/studio.css";
import "./report.css";

/* =====================================================================
   طقم التقارير المصمّمة بهوية استوديو البوابة — مكوّنات مشتركة لكل تقرير
   مجمّع يُطبع بغلاف وصفحات A4: الغلاف، وهيكل الصفحة بترويستها وتذييلها،
   وعناوين الأقسام، وبطاقات الأرقام، والحلقات، والرسوم، والتوقيعات.
   كل ورقة بمقاسها الحقيقي (794×1123)، وتُستخدم كما هي في المعاينة المصغّرة
   والطباعة وملف PDF للجوال (ReportViewer.jsx).
   ===================================================================== */

const P = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
export const IC = {
  ...ICONS,
  folder: <svg {...P}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  check:  <svg {...P}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>,
  doc:    <svg {...P}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>,
  clip:   <svg {...P}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>,
  arrow:  <svg {...P}><path d="M4 12h14M13 6l6 6-6 6"/></svg>,
  alert:  <svg {...P}><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/></svg>,
  chart:  <svg {...P}><path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg>,
  spark:  <svg {...P}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>,
  photo:  <svg {...P}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>,
  lock:   <svg {...P}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>,
  pen:    <svg {...P}><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></svg>,
  users:  <svg {...P}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.5 2.4 3.5 5.5"/></svg>,
  grid:   <svg {...P}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  list:   <svg {...P}><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>,
  award:  <svg {...P}><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/></svg>,
};

// ألوان السلاسل (مُتحقَّق منها لعمى الألوان): أخضر، أزرق، ذهبي، وردي — بترتيب ثابت
export const S = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];

export const n = (v) => Number(v ?? 0).toLocaleString("en-US");
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
export const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");

/* العدد مع المعدود بالعربية: يوم دراسي واحد، يومان دراسيان، 3 أيام دراسية، 11 يومًا دراسيًا.
   الصيغ: [المفرد، المثنى رفعًا، الجمع رفعًا، تمييز 11 فأكثر، المثنى جرًا ونصبًا، الجمع جرًا ونصبًا]
   والحالة g بعد حرف الجر أو في موضع النصب: «لطالبين»، «من 5 مرشحين». */
const W = {
  session: ["جلسة واحدة", "جلستان", "جلسات", "جلسة", "جلستين"],
  program: ["برنامج واحد", "برنامجان", "برامج", "برنامجًا", "برنامجين"],
  case: ["حالة واحدة", "حالتان", "حالات", "حالة", "حالتين"],
  student: ["طالب واحد", "طالبان", "طلاب", "طالبًا", "طالبين"],
  form: ["نموذج واحد", "نموذجان", "نماذج", "نموذجًا", "نموذجين"],
  teacher: ["معلم واحد", "معلمان", "معلمون", "معلمًا", "معلمين", "معلمين"],
  item: ["بند واحد", "بندان", "بنود", "بندًا", "بندين"],
  evidence: ["شاهد واحد", "شاهدان", "شواهد", "شاهدًا", "شاهدين"],
  hour: ["ساعة واحدة", "ساعتان", "ساعات", "ساعة", "ساعتين"],
  cls: ["فصل واحد", "فصلان", "فصول", "فصلًا", "فصلين"],
  day: ["يوم دراسي واحد", "يومان دراسيان", "أيام دراسية", "يومًا دراسيًا", "يومين دراسيين"],
  event: ["حدث واحد", "حدثان", "أحداث", "حدثًا", "حدثين"],
  cert: ["شهادة واحدة", "شهادتان", "شهادات", "شهادة", "شهادتين"],
  nominee: ["مرشح واحد", "مرشحان", "مرشحون", "مرشحًا", "مرشحين", "مرشحين"],
  beneficiary: ["مستفيد واحد", "مستفيدان", "مستفيدون", "مستفيدًا", "مستفيدين", "مستفيدين"],
  quiz: ["اختبار واحد", "اختباران", "اختبارات", "اختبارًا", "اختبارين"],
  sheet: ["ورقة واحدة", "ورقتان", "أوراق", "ورقة", "ورقتين"],
  record: ["سجل واحد", "سجلان", "سجلات", "سجلًا", "سجلين"],
  minute: ["دقيقة واحدة", "دقيقتان", "دقائق", "دقيقة", "دقيقتين"],
};
export function countAr(v, w, c) {
  const [one, two, few, many, twoG, fewG] = W[w];
  const g = c === "g";
  if (v === 1) return one;
  if (v === 2) return g ? twoG ?? two : two;
  if (v >= 3 && v <= 10) return `${v} ${g ? fewG ?? few : few}`;
  return `${n(v)} ${v === 0 ? (g ? fewG ?? few : few) : many}`;
}

/* يقسم قائمة على صفحات بحسب ارتفاع تقديري لكل عنصر: الأولى تتسع first والبقية rest.
   sticky(x): عنصر لا يبقى آخر الصفحة (كعنوان مجموعة) فينتقل مع ما بعده */
export function paginate(list, height, first, rest = first, sticky = null) {
  const pages = [[]];
  let room = first;
  for (const x of list) {
    const h = height(x);
    const cur = pages[pages.length - 1];
    if (cur.length && h > room) {
      const carry = sticky && cur.length > 1 && sticky(cur[cur.length - 1]) ? [cur.pop()] : [];
      pages.push(carry);
      room = rest - carry.reduce((a, y) => a + height(y), 0);
    }
    pages[pages.length - 1].push(x);
    room -= h;
  }
  return pages;
}

/* ============================ الرسوم ============================ */

/* حلقة إنجاز: نسبة من مئة، أو «—» إن لم يكن لها مقام */
export function Ring({ value, label, sub, color = S[0], size }) {
  const r = 38, c = 2 * Math.PI * r, v = value ?? 0;
  return (
    <div className="mr-ring">
      <svg viewBox="0 0 92 92" style={size ? { width: size, height: size } : undefined}>
        <circle cx="46" cy="46" r={r} fill="none" stroke="#EAF2ED" strokeWidth="9" />
        {value != null && value > 0 && (
          <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(c * Math.min(v, 100)) / 100} ${c}`} transform="rotate(-90 46 46)" />
        )}
        <text x="46" y="52" textAnchor="middle" fontSize="19" fontWeight="700" fill="currentColor"
              fontFamily="IBM Plex Sans Arabic">{value == null ? "—" : `${v}%`}</text>
      </svg>
      {label && <b>{label}</b>}{sub && <span>{sub}</span>}
    </div>
  );
}

/* كعكة بفواصل بيضاء ورقم الإجمالي في وسطها */
export function Donut({ parts, total, label, size = 150 }) {
  const r = 58, w = 20, c = 2 * Math.PI * r;
  const sum = parts.reduce((a, p) => a + p.v, 0);
  let acc = 0;
  return (
    <svg viewBox="0 0 150 150" width={size} height={size} style={{ flex: "none" }}>
      <circle cx="75" cy="75" r={r} fill="none" stroke="#EEF4F0" strokeWidth={w} />
      {sum > 0 && parts.filter((p) => p.v > 0).map((p, i, arr) => {
        const len = (p.v / sum) * c;
        const gap = arr.length > 1 ? 2.5 : 0;
        const el = (
          <circle key={i} cx="75" cy="75" r={r} fill="none" stroke={p.c} strokeWidth={w}
                  strokeDasharray={`${Math.max(len - gap, 0.1)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 75 75)" />
        );
        acc += len;
        return el;
      })}
      <text x="75" y="76" textAnchor="middle" fontSize="32" fontWeight="700" fill="currentColor" fontFamily="IBM Plex Sans Arabic">{n(total ?? sum)}</text>
      <text x="75" y="98" textAnchor="middle" fontSize="12" fill="#5E7268" fontFamily="IBM Plex Sans Arabic">{label}</text>
    </svg>
  );
}

/* مفتاح الكعكة: لون واسم وعدد ونسبة */
export function DonutLegend({ parts }) {
  const sum = parts.reduce((a, p) => a + p.v, 0);
  return (
    <div style={{ flex: 1, display: "grid", gap: 8, minWidth: 0 }}>
      {parts.map((p) => (
        <div key={p.t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          <i style={{ width: 11, height: 11, borderRadius: 3, background: p.c, flex: "none" }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.t}</span>
          <b className="num">{n(p.v)}</b>
          <span className="num" style={{ color: "var(--mr-ink2)", width: 36, textAlign: "left" }}>{pct(p.v, sum) ?? 0}%</span>
        </div>
      ))}
    </div>
  );
}

function niceStep(max) {
  if (max <= 5) return 1;
  if (max <= 10) return 2;
  if (max <= 25) return 5;
  if (max <= 50) return 10;
  return Math.ceil(max / 5 / 10) * 10;
}
const ticks = (ymax, step) => Array.from({ length: Math.floor(ymax / step) + 1 }, (_, i) => i * step);
const F = "IBM Plex Sans Arabic";

function Axis({ Wd, left, y, ymax, step }) {
  return ticks(ymax, step).map((t) => (
    <g key={t}>
      <line x1={left} x2={Wd} y1={y(t)} y2={y(t)} stroke="#E6EFE9" strokeWidth="1" />
      <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#7A8C82" fontFamily={F}>{t}</text>
    </g>
  ));
}

/* أعمدة مكدّسة: cols = [{ label, sub?, values: {مفتاح: عدد} }]، والعمود الأول يمين الرسم كاتجاه القراءة.
   width: عرض الرسم بوحدات الخط — 640 لصندوق كامل العرض، و320 لنصفه فيبقى الخط مقروءًا */
export function StackedColumns({ cols, series, height = 138, width = 640 }) {
  const Wd = width, H = height, top = 18, bottom = cols.some((c) => c.sub) ? 34 : 22, left = 26;
  const tot = (c) => series.reduce((a, s) => a + (c.values[s.k] ?? 0), 0);
  const max = Math.max(1, ...cols.map(tot));
  const step = niceStep(max);
  const ymax = Math.ceil(max / step) * step;
  const y = (v) => top + (H - top - bottom) * (1 - v / ymax);
  const slot = (Wd - left) / cols.length;
  const bw = Math.min(64, slot * 0.46);
  return (
    <svg viewBox={`0 0 ${Wd} ${H}`} width="100%" style={{ display: "block", direction: "ltr" }}>
      <Axis Wd={Wd} left={left} y={y} ymax={ymax} step={step} />
      {cols.map((col, i) => {
        const cx = Wd - (i + 0.5) * slot;
        let base = 0;
        const total = tot(col);
        return (
          <g key={i}>
            {series.map((s) => {
              const v = col.values[s.k] ?? 0;
              if (!v) return null;
              const y1 = y(base + v), y0 = y(base);
              base += v;
              return <rect key={s.k} x={cx - bw / 2} y={y1} width={bw} height={Math.max(y0 - y1 - 2, 1)} rx="3" fill={s.c} />;
            })}
            {total > 0 && <text x={cx} y={y(total) - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" fontFamily={F}>{total}</text>}
            <text x={cx} y={H - (col.sub ? 18 : 5)} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="currentColor" fontFamily={F}>{col.label}</text>
            {col.sub && <text x={cx} y={H - 4} textAnchor="middle" fontSize="10" fill="#7A8C82" fontFamily={F}>{col.sub}</text>}
          </g>
        );
      })}
      <line x1={left} x2={Wd} y1={y(0)} y2={y(0)} stroke="#B9CEC1" strokeWidth="1.2" />
    </svg>
  );
}

/* أعمدة متجاورة لسلسلتين أو أكثر على محور واحد: cols = [{ key, label, values }]، current يُبرز عمودًا */
export function GroupedColumns({ cols, series, current, height = 150, width = 640 }) {
  const Wd = width, H = height, top = 16, bottom = 22, left = 26;
  const max = Math.max(1, ...cols.flatMap((c) => series.map((s) => c.values[s.k] ?? 0)));
  const step = niceStep(max);
  const ymax = Math.ceil(max / step) * step;
  const y = (v) => top + (H - top - bottom) * (1 - v / ymax);
  const slot = (Wd - left) / cols.length;
  const bw = Math.min(26, (slot * 0.56) / series.length);
  return (
    <svg viewBox={`0 0 ${Wd} ${H}`} width="100%" style={{ display: "block", direction: "ltr" }}>
      <Axis Wd={Wd} left={left} y={y} ymax={ymax} step={step} />
      {cols.map((col, i) => {
        const cx = Wd - (i + 0.5) * slot;
        const cur = col.key === current;
        const groupW = series.length * (bw + 2);
        return (
          <g key={col.key ?? i}>
            {cur && <rect x={cx - slot / 2 + 6} y={top - 10} width={slot - 12} height={H - top - bottom + 10} rx="8" fill="#EDFAF2" />}
            {series.map((s, j) => {
              const v = col.values[s.k] ?? 0;
              // السلسلة الأولى يمين المجموعة
              const x = cx + groupW / 2 - (j + 1) * (bw + 2) + 1;
              return v > 0 ? (
                <g key={s.k}>
                  <rect x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx="3" fill={s.c} />
                  <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="currentColor" fontFamily={F}>{v}</text>
                </g>
              ) : null;
            })}
            <text x={cx} y={H - 5} textAnchor="middle" fontSize="11.5" fontWeight={cur ? 700 : 500} fill="currentColor" fontFamily={F}>{col.label}</text>
          </g>
        );
      })}
      <line x1={left} x2={Wd} y1={y(0)} y2={y(0)} stroke="#B9CEC1" strokeWidth="1.2" />
    </svg>
  );
}

/* أشرطة أفقية بعدد كل عنصر: items = [{ t, v, c?, note? }]
   wide: عمود أسماء أعرض، وfull: لصندوق بعرض الصفحة فتظهر الأسماء الطويلة كاملة */
export function Bars({ items, wide, full, max }) {
  const m = Math.max(1, max ?? Math.max(...items.map((x) => x.v)));
  return (
    <div className="mr-bars">
      {items.map((x) => (
        <div key={x.t} className={`mr-bar${full ? " xwide" : wide ? " wide" : ""}`}>
          <span className="t">{x.t}</span>
          <span className="tr"><i style={{ width: `${(x.v / m) * 100}%`, "--c": x.c ?? S[0], opacity: x.v ? 1 : 0 }} /></span>
          <span className="n num">{x.note ?? n(x.v)}</span>
        </div>
      ))}
    </div>
  );
}

/* شريط مقسّم بمفتاحه */
export function Split({ parts }) {
  const sum = parts.reduce((a, p) => a + p.v, 0);
  return (
    <>
      <div className="mr-split">{sum > 0 && parts.filter((p) => p.v).map((p) => <i key={p.t} style={{ width: `${(p.v / sum) * 100}%`, background: p.c }} />)}</div>
      <div className="mr-legend" style={{ marginTop: 7 }}>
        {parts.map((p) => <span key={p.t}><i style={{ background: p.c }} />{p.t}<b className="num">{n(p.v)}</b></span>)}
      </div>
    </>
  );
}

export function Legend({ series, totals, center = true }) {
  return (
    <div className="mr-legend" style={{ marginTop: 6, justifyContent: center ? "center" : undefined }}>
      {series.map((s) => <span key={s.k}><i style={{ background: s.c }} />{s.t}{totals && <b className="num">{n(totals[s.k])}</b>}</span>)}
    </div>
  );
}

/* بطاقات الأرقام: items = [{ ic, t, v, s, c }] */
export function Kpis({ items, cols = 4 }) {
  return (
    <div className="mr-kpis" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {items.map(({ ic, t, v, s, c }) => (
        <div key={t} className="mr-kpi" style={{ "--c": c ?? S[0] }}>
          <div className="ic">{IC[ic]}</div>
          <div className="v num">{typeof v === "number" ? n(v) : v}</div>
          <div className="k">{t}</div>
          {s && <div className="s">{s}</div>}
        </div>
      ))}
    </div>
  );
}

export function Highlights({ title = "أبرز ما في التقرير", items }) {
  return (
    <div className="mr-high">
      <h3>{IC.spark}{title}</h3>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}

export function Box({ icon, title, aside, tint, style, children }) {
  return (
    <div className={`mr-box${tint ? " tint" : ""}`} style={style}>
      {title && <h3>{icon && IC[icon]}{title}{aside != null && <span className="aside">{aside}</span>}</h3>}
      {children}
    </div>
  );
}

/* التوقيعات والختم: people = [{ title, name, sig }] (اثنان)، stamp رابط صورة الختم أو null */
export function Signs({ people, stamp, showStamp = true }) {
  const [a, b] = people;
  const one = (p) => (
    <div>
      <small>{p.title}</small>
      <b>{p.name || "…………………"}</b>
      <div className="sig">{p.sig ? <img src={p.sig} alt="" crossOrigin="anonymous" /> : <span className="ln" />}</div>
    </div>
  );
  return (
    <div className="mr-signs" style={{ marginTop: "auto" }}>
      {one(a)}
      {showStamp ? (stamp ? <div className="stamp img"><img src={stamp} alt="" crossOrigin="anonymous" /></div> : <div className="stamp">الختم</div>) : <div />}
      {b ? one(b) : <div />}
    </div>
  );
}

/* ============================ هيكل الصفحة ============================ */

/* doc = { title, meta: [شارة، شارة بارزة], foot } — مشتركة بين صفحات التقرير */
function Head({ theme, doc }) {
  if (theme === "official") {
    return (
      <>
        <div className="mr-gov">
          <div className="lines">المملكة العربية السعودية<br />وزارة التعليم<br />الإدارة العامة للتعليم بمنطقة مكة المكرمة<b>مدرسة مكة الثانوية</b></div>
          <div className="ttl"><b>{doc.title}</b><span>{doc.meta.filter(Boolean).join(" · ")}</span></div>
          <div className="logos"><img src={moeLogo} alt="" /><img src={iconMint} alt="" /></div>
        </div>
        <div className="mr-rule" />
      </>
    );
  }
  const [m1, m2] = doc.meta;
  return (
    <div className="mr-head">
      <div className="brand">
        <img src={iconMint} alt="" />
        <div><b>{doc.title}</b><span>بوابة مكة الثانوية الرقمية · مدرسة مكة الثانوية</span></div>
      </div>
      <div className="meta">{m1 && <span className="mr-pill">{m1}</span>}{m2 && <span className="mr-pill solid">{m2}</span>}</div>
    </div>
  );
}

export function Sec({ no, title, sub }) {
  return (
    <div className="mr-sec">
      <div className="no"><small>القسم</small><b className="num">{no}</b></div>
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="grule" />
    </div>
  );
}

/* ورقة داخلية: ترويسة، وعنوان القسم، والمحتوى في mr-body، وتذييل برقم الصفحة */
export function Page({ theme, doc, page, total, sec, children }) {
  return (
    <div className={`stu stu-portrait stu-${theme} mr sheet`}>
      <div className="mr-frame" />
      <div className="mr-page">
        <Head theme={theme} doc={doc} />
        {sec && <Sec {...sec} />}
        <div className="mr-body">{children}</div>
        <div className="mr-foot">
          <span>بوابة مكة الثانوية الرقمية · {doc.foot}</span>
          <span className="pg">صفحة <span className="num">{page}</span> من <span className="num">{total}</span></span>
          <span className="site">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

/* الغلاف بزخرفة الاستوديو:
   c = { year, tag: [أيقونة، نص], title, sub, badge: { main, sub }, side: { main, sub },
         rows: [[أيقونة، المفتاح، القيمة]], note: [أيقونة، نص], strip: [[عدد، وصف]], foot } */
export function Cover({ theme, c }) {
  return (
    <div className={`stu stu-cover stu-portrait stu-${theme} mr mr-cover sheet`}>
      <Decor />
      <div className="stu-page">
        {theme === "official" ? (
          <>
            <div className="stu-gov">
              <div className="lines">المملكة العربية السعودية<br />وزارة التعليم<br />الإدارة العامة للتعليم بمنطقة مكة المكرمة<b>مدرسة مكة الثانوية</b></div>
              <div className="logos"><img src={moeLogo} alt="" /><img src={iconMint} alt="" /></div>
            </div>
            <div className="stu-rule" />
          </>
        ) : (
          <div className="stu-bar">
            <div className="stu-brand">
              <img src={iconMint} alt="" />
              <div><b>بوابة مكة الثانوية الرقمية</b><span>مدرسة مكة الثانوية</span></div>
            </div>
            {c.year && <div className="stu-year">{c.year}</div>}
          </div>
        )}

        <div className="hero">
          <div><span className="stu-tag">{IC[c.tag[0]]}{c.tag[1]}</span></div>
          <h1 className="stu-h1" style={c.titleSize ? { fontSize: c.titleSize } : undefined}>{c.title}</h1>
          <span className="stu-sub" style={c.subSize ? { fontSize: c.subSize } : undefined}>{c.sub}</span>
          <div className="stu-grule" />
          {c.badge && (
            <div className="month">
              <div className="m"><b>{c.badge.main}</b>{c.badge.sub && <span>{c.badge.sub}</span>}</div>
              {c.side && <div className="hj"><b>{c.side.main}</b>{c.side.sub}</div>}
            </div>
          )}
          <div className="stu-info">
            {c.rows.map(([ic, k, v]) => (
              <div key={k} className="stu-row">
                <div className="stu-ic">{IC[ic]}</div>
                <div className="k">{k}</div>
                <div className="v" style={{ fontSize: 19 }}>{v}</div>
              </div>
            ))}
          </div>
          {c.note && <div className="conf">{IC[c.note[0]]}{c.note[1]}</div>}
        </div>

        {c.strip && (
          <div className="strip">
            {c.strip.map(([v, t]) => <div key={t}><b className="num">{typeof v === "number" ? n(v) : v}</b><span>{t}</span></div>)}
          </div>
        )}

        <div className="stu-foot">
          <span>بوابة مكة الثانوية الرقمية · {c.foot}</span>
          <span className="site">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}
