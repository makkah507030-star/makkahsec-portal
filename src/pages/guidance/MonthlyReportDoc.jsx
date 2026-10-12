// src/pages/guidance/MonthlyReportDoc.jsx
import iconMint from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { Decor, ICONS } from "../studio/Sheets.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { SOURCE, KIND, OUTCOME } from "../../lib/guidanceWarning";
import { PROGRAM_KIND } from "../GuidanceMore.jsx";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import "../studio/studio.css";
import "./monthlyReport.css";

/* =====================================================================
   أوراق التقرير الشهري للموجه الطلابي — كل ورقة بمقاس A4 الحقيقي، تُستخدم
   كما هي في المعاينة المصغّرة والطباعة وملف PDF للجوال.
   الغلاف ← ملخص الشهر ← الحالات والجلسات ← البرامج والأنشطة (وتتمتها إن
   كثرت) ← التواصل والنماذج والتوقيعات.
   ===================================================================== */

const P = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" };
const IC = {
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
};

// ألوان السلاسل (مُتحقَّق منها لعمى الألوان): أخضر، أزرق، ذهبي، وردي — بترتيب ثابت
const S = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
const KIND_ORDER = ["individual", "group", "guardian", "teacher"];
const PKIND_ORDER = ["awareness", "preventive", "developmental", "remedial"];
const OUT_ORDER = ["improved", "continuing", "referred"];
const REQ_ORDER = [["done", "تمت"], ["scheduled", "تحدد موعدها"], ["new", "جديدة"], ["declined", "اعتذر عنها"]];

const n = (v) => Number(v ?? 0).toLocaleString("en-US");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");

/* العدد مع المعدود بالعربية (في موضع الرفع): حالة واحدة، حالتان، 3 حالات، 11 حالة */
const W = {
  session: ["جلسة واحدة", "جلستان", "جلسات", "جلسة"], program: ["برنامج واحد", "برنامجان", "برامج", "برنامجًا"],
  case: ["حالة واحدة", "حالتان", "حالات", "حالة"], student: ["طالب واحد", "طالبان", "طلاب", "طالبًا"],
  form: ["نموذج واحد", "نموذجان", "نماذج", "نموذجًا"],
};
export function countAr(v, w) {
  const [one, two, few, many] = W[w];
  if (v === 1) return one;
  if (v === 2) return two;
  if (v >= 3 && v <= 10) return `${v} ${few}`;
  return `${n(v)} ${v === 0 ? few : many}`;
}

/* ============================ الرسوم ============================ */

/* حلقة دائرية: (حلقة إنجاز) نسبة من مئة، أو «—» إن لم يكن لها مقام */
function Ring({ value, label, sub, color = S[0] }) {
  const r = 38, c = 2 * Math.PI * r, v = value ?? 0;
  return (
    <div className="mr-ring">
      <svg viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#EAF2ED" strokeWidth="9" />
        {value != null && value > 0 && (
          <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(c * Math.min(v, 100)) / 100} ${c}`} transform="rotate(-90 46 46)" />
        )}
        <text x="46" y="52" textAnchor="middle" fontSize="19" fontWeight="700" fill="currentColor"
              fontFamily="IBM Plex Sans Arabic">{value == null ? "—" : `${v}%`}</text>
      </svg>
      <b>{label}</b><span>{sub}</span>
    </div>
  );
}

/* كعكة بفواصل بيضاء ورقم الإجمالي في وسطها */
function Donut({ parts, total, label, size = 150 }) {
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
      <text x="75" y="76" textAnchor="middle" fontSize="32" fontWeight="700" fill="currentColor" fontFamily="IBM Plex Sans Arabic">{n(total)}</text>
      <text x="75" y="98" textAnchor="middle" fontSize="12" fill="#5E7268" fontFamily="IBM Plex Sans Arabic">{label}</text>
    </svg>
  );
}

/* أعمدة مكدّسة لأسابيع الشهر: كل عمود أعمال أسبوع بأنواعها */
function WeekColumns({ weeks, series }) {
  const Wd = 640, H = 138, top = 18, bottom = 34, left = 26;
  const max = Math.max(1, ...weeks.map((w) => series.reduce((a, s) => a + w[s.k], 0)));
  const step = niceStep(max);
  const ymax = Math.ceil(max / step) * step;
  const y = (v) => top + (H - top - bottom) * (1 - v / ymax);
  const slot = (Wd - left) / weeks.length;
  const bw = Math.min(64, slot * 0.46);
  return (
    <svg viewBox={`0 0 ${Wd} ${H}`} width="100%" style={{ display: "block", direction: "ltr" }}>
      {ticks(ymax, step).map((t) => (
        <g key={t}>
          <line x1={left} x2={Wd} y1={y(t)} y2={y(t)} stroke="#E6EFE9" strokeWidth="1" />
          <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#7A8C82" fontFamily="IBM Plex Sans Arabic">{t}</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        // الأسبوع الأول يمين الرسم كاتجاه القراءة العربية
        const cx = Wd - (i + 0.5) * slot;
        let base = 0;
        const total = series.reduce((a, s) => a + w[s.k], 0);
        return (
          <g key={i}>
            {series.map((s) => {
              const v = w[s.k];
              if (!v) return null;
              const y1 = y(base + v), y0 = y(base);
              base += v;
              return <rect key={s.k} x={cx - bw / 2} y={y1} width={bw} height={Math.max(y0 - y1 - 2, 1)} rx="3" fill={s.c} />;
            })}
            {total > 0 && <text x={cx} y={y(total) - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" fontFamily="IBM Plex Sans Arabic">{total}</text>}
            <text x={cx} y={H - 18} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="currentColor" fontFamily="IBM Plex Sans Arabic">{w.label}</text>
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="10" fill="#7A8C82" fontFamily="IBM Plex Sans Arabic">{w.range}</text>
          </g>
        );
      })}
      <line x1={left} x2={Wd} y1={y(0)} y2={y(0)} stroke="#B9CEC1" strokeWidth="1.2" />
    </svg>
  );
}

/* أعمدة متجاورة للأشهر الستة: الجلسات والحالات الجديدة على محور واحد */
function TrendColumns({ trend, current }) {
  const Wd = 640, H = 150, top = 16, bottom = 22, left = 26;
  const max = Math.max(1, ...trend.map((t) => Math.max(t.sessions, t.cases)));
  const step = niceStep(max);
  const ymax = Math.ceil(max / step) * step;
  const y = (v) => top + (H - top - bottom) * (1 - v / ymax);
  const slot = (Wd - left) / trend.length;
  const bw = Math.min(26, slot * 0.26);
  return (
    <svg viewBox={`0 0 ${Wd} ${H}`} width="100%" style={{ display: "block", direction: "ltr" }}>
      {ticks(ymax, step).map((t) => (
        <g key={t}>
          <line x1={left} x2={Wd} y1={y(t)} y2={y(t)} stroke="#E6EFE9" strokeWidth="1" />
          <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#7A8C82" fontFamily="IBM Plex Sans Arabic">{t}</text>
        </g>
      ))}
      {trend.map((t, i) => {
        const cx = Wd - (i + 0.5) * slot;
        const cur = t.key === current;
        return (
          <g key={t.key}>
            {cur && <rect x={cx - slot / 2 + 6} y={top - 10} width={slot - 12} height={H - top - bottom + 10} rx="8" fill="#EDFAF2" />}
            {[[t.sessions, S[0], 1], [t.cases, S[1], -1]].map(([v, c, side]) => {
              const x = side > 0 ? cx + 1 : cx - bw - 1;
              return v > 0 ? (
                <g key={c}>
                  <rect x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx="3" fill={c} />
                  <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="currentColor" fontFamily="IBM Plex Sans Arabic">{v}</text>
                </g>
              ) : null;
            })}
            <text x={cx} y={H - 5} textAnchor="middle" fontSize="11.5" fontWeight={cur ? 700 : 500} fill="currentColor" fontFamily="IBM Plex Sans Arabic">{t.label}</text>
          </g>
        );
      })}
      <line x1={left} x2={Wd} y1={y(0)} y2={y(0)} stroke="#B9CEC1" strokeWidth="1.2" />
    </svg>
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

function Bars({ items, wide, max }) {
  const m = Math.max(1, max ?? Math.max(...items.map((x) => x.v)));
  return (
    <div className="mr-bars">
      {items.map((x) => (
        <div key={x.t} className={`mr-bar${wide ? " wide" : ""}`}>
          <span className="t">{x.t}</span>
          <span className="tr"><i style={{ width: `${(x.v / m) * 100}%`, "--c": x.c ?? S[0], opacity: x.v ? 1 : 0 }} /></span>
          <span className="n num">{n(x.v)}</span>
        </div>
      ))}
    </div>
  );
}

function Split({ parts }) {
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

/* ============================ هيكل الصفحة ============================ */

function Head({ theme, info }) {
  if (theme === "official") {
    return (
      <>
        <div className="mr-gov">
          <div className="lines">المملكة العربية السعودية<br />وزارة التعليم<br />الإدارة العامة للتعليم بمنطقة مكة المكرمة<b>مدرسة مكة الثانوية</b></div>
          <div className="ttl"><b>التقرير الشهري للموجه الطلابي</b><span>{info.grade} · {info.month}</span></div>
          <div className="logos"><img src={moeLogo} alt="" /><img src={iconMint} alt="" /></div>
        </div>
        <div className="mr-rule" />
      </>
    );
  }
  return (
    <div className="mr-head">
      <div className="brand">
        <img src={iconMint} alt="" />
        <div><b>التقرير الشهري للموجه الطلابي</b><span>بوابة مكة الثانوية الرقمية · مدرسة مكة الثانوية</span></div>
      </div>
      <div className="meta"><span className="mr-pill">{info.grade}</span><span className="mr-pill solid">{info.month}</span></div>
    </div>
  );
}

function Sec({ no, title, sub }) {
  return (
    <div className="mr-sec">
      <div className="no"><small>القسم</small><b className="num">{no}</b></div>
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="grule" />
    </div>
  );
}

function Page({ theme, info, page, total, children }) {
  return (
    <div className={`stu stu-portrait stu-${theme} mr sheet`}>
      <div className="mr-frame" />
      <div className="mr-page">
        <Head theme={theme} info={info} />
        {children}
        <div className="mr-foot">
          <span>بوابة مكة الثانوية الرقمية · التوجيه الطلابي</span>
          <span className="pg">صفحة <span className="num">{page}</span> من <span className="num">{total}</span></span>
          <span className="site">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

/* ============================ الأوراق ============================ */

function Cover({ theme, d, info }) {
  const followed = d.cases.opened + d.cases.closed;
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
            <div className="stu-year">{info.year}</div>
          </div>
        )}

        <div className="hero">
          <div><span className="stu-tag">{IC.chat}التوجيه الطلابي</span></div>
          <h1 className="stu-h1">التقرير الشهري</h1>
          <span className="stu-sub">لأعمال الموجه الطلابي</span>
          <div className="stu-grule" />
          <div className="month">
            <div className="m"><b>{info.month}</b><span>{info.grade}</span></div>
            <div className="hj"><b>{info.hijri}</b>{info.termLabel}</div>
          </div>

          <div className="stu-info">
            {[["user", "الموجه الطلابي", info.counselor || "—"], ["cap", "الصف", info.grade],
              ["calendar", "الفترة", info.range], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]].map(([ic, k, v]) => (
              <div key={k} className="stu-row">
                <div className="stu-ic">{IC[ic]}</div>
                <div className="k">{k}</div>
                <div className="v" style={{ fontSize: 19 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="conf">{IC.lock}أرقام مجمّعة من سجلات البوابة، دون أسماء الطلاب حفاظًا على سرية الحالات.</div>
        </div>

        <div className="strip">
          {[[d.sessions.total, "جلسة إرشادية"], [followed, "حالة تمت متابعتها"], [d.programs.done.length, "برنامج منفّذ"], [d.forms.total, "نموذج صادر"]]
            .map(([v, t]) => <div key={t}><b className="num">{n(v)}</b><span>{t}</span></div>)}
        </div>

        <div className="stu-foot">
          <span>بوابة مكة الثانوية الرقمية · التوجيه الطلابي</span>
          <span className="site">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

const TOP_KIND = { individual: "الجلسات الفردية", group: "الجلسات الجماعية", guardian: "الجلسات مع أولياء الأمور", teacher: "الجلسات مع المعلمين" };

function highlights(d, warn) {
  const out = [];
  const k = d.sessions.kinds;
  if (d.sessions.total) {
    const top = KIND_ORDER.slice().sort((a, b) => k[b] - k[a])[0];
    out.push(`الجلسات الإرشادية: ${countAr(d.sessions.total, "session")}، أكثرها ${TOP_KIND[top]}.`);
  }
  if (d.cases.opened || d.cases.closed)
    out.push(`الحالات: فُتح ${n(d.cases.opened)} وأُغلق ${n(d.cases.closed)}${d.cases.improved ? `، تحسّن منها ${n(d.cases.improved)}` : ""}، وتُتابَع الآن ${n(d.cases.openNow)} مفتوحة.`);
  if (d.programs.done.length)
    out.push(`البرامج المنفذة: ${countAr(d.programs.done.length, "program")}${d.programs.beneficiaries ? `، استفاد منها ${countAr(d.programs.beneficiaries, "student")}` : ""}.`);
  if (d.requests.total) out.push(`طلبات المقابلة: ${n(d.requests.total)} من الطلاب وأولياء الأمور، تمّ منها ${n(d.requests.byStatus.done ?? 0)}.`);
  if (d.forms.total) out.push(`النماذج الصادرة: ${countAr(d.forms.total, "form")}، أكثرها «${d.forms.by[0][0]}».`);
  if (d.referrals.received) out.push(`الإحالات الواردة: ${n(d.referrals.received)}، عولج منها ${n(d.referrals.handled)}.`);
  if (warn?.flagged) out.push(`الإنذار المبكر: ${countAr(warn.flagged, "student")} يحتاجون تدخلًا، منهم ${n(warn.covered)} بحالة مفتوحة.`);
  if (!out.length) out.push("لم تُسجَّل أعمال للموجه في البوابة لهذا الشهر.");
  return out.slice(0, 6);
}

function Summary({ theme, d, warn, info, page, total }) {
  const k = d.sessions.kinds;
  const kpis = [
    ["chat", "الجلسات الإرشادية", d.sessions.total, `فردية ${k.individual} · جماعية ${k.group} · أسرية ${k.guardian}`, S[0]],
    ["folder", "حالات جديدة", d.cases.opened, `مفتوحة الآن ${d.cases.openNow}`, S[1]],
    ["check", "حالات أُغلقت", d.cases.closed, `تحسّنت ${d.cases.improved}`, S[0]],
    ["megaphone", "برامج منفّذة", d.programs.done.length, `المستفيدون ${n(d.programs.beneficiaries)}`, S[2]],
    ["calendar", "طلبات المقابلة", d.requests.total, `تمت ${d.requests.byStatus.done ?? 0} · أولياء أمور ${d.requests.guardian}`, S[1]],
    ["clip", "استمارات المستوى", d.inquiries.created, `أُرسلت لولي الأمر ${d.inquiries.sent}`, S[3]],
    ["arrow", "إحالات واردة", d.referrals.received, `عولجت ${d.referrals.handled} · قيد الإجراء ${d.referrals.pending}`, S[3]],
    ["doc", "نماذج صادرة", d.forms.total, `${d.forms.by.length} أنواع من النماذج`, S[2]],
  ];
  const series = [
    { k: "sessions", t: "جلسات", c: S[0] }, { k: "programs", t: "برامج", c: S[1] },
    { k: "forms", t: "نماذج", c: S[2] }, { k: "meetings", t: "مقابلات تمت", c: S[3] },
  ];
  const resolvedBase = d.cases.closed + d.cases.openNow;
  return (
    <Page theme={theme} info={info} page={page} total={total}>
      <Sec no={1} title="ملخص الشهر" sub="لوحة سريعة بأعمال الموجه الطلابي ومؤشرات إنجازها" />
      <div className="mr-body">
        <div className="mr-kpis">
          {kpis.map(([ic, t, v, s, c]) => (
            <div key={t} className="mr-kpi" style={{ "--c": c }}>
              <div className="ic">{IC[ic]}</div>
              <div className="v num">{n(v)}</div>
              <div className="k">{t}</div>
              <div className="s">{s}</div>
            </div>
          ))}
        </div>

        <div className="mr-box">
          <h3>{IC.trophy}مؤشرات الإنجاز</h3>
          <div className="mr-rings">
            <Ring value={pct(d.cases.closed, resolvedBase)} label="حسم الحالات" sub={`${d.cases.closed} مغلقة من ${resolvedBase}`} color={S[0]} />
            <Ring value={pct(d.cases.improved, d.cases.closed)} label="تحسّن المغلقة" sub={`${d.cases.improved} من ${d.cases.closed}`} color={S[1]} />
            <Ring value={pct(d.requests.byStatus.done ?? 0, d.requests.total)} label="إنجاز طلبات المقابلة" sub={`${d.requests.byStatus.done ?? 0} من ${d.requests.total}`} color={S[2]} />
            <Ring value={pct(d.programs.planDone, d.programs.planTotal)} label="تنفيذ الخطة الإرشادية" sub={`${d.programs.planDone} من ${d.programs.planTotal} في الخطة`} color={S[3]} />
          </div>
        </div>

        <div className="mr-box">
          <h3>{IC.chart}توزيع الأعمال على أسابيع الشهر<span className="aside">جلسات وبرامج ونماذج ومقابلات</span></h3>
          <WeekColumns weeks={d.weeks} series={series} />
          <div className="mr-legend" style={{ marginTop: 6, justifyContent: "center" }}>
            {series.map((s) => <span key={s.k}><i style={{ background: s.c }} />{s.t}<b className="num">{n(d.weeks.reduce((a, w) => a + w[s.k], 0))}</b></span>)}
          </div>
        </div>

        <div className="mr-high">
          <h3>{IC.spark}أبرز ما في الشهر</h3>
          <ul>{highlights(d, warn).map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
    </Page>
  );
}

function CasesPage({ theme, d, warn, info, page, total }) {
  const k = d.sessions.kinds;
  const kindParts = KIND_ORDER.map((x, i) => ({ t: KIND[x], v: k[x] ?? 0, c: S[i] }));
  const src = Object.keys(SOURCE).map((x) => ({ t: SOURCE[x], v: d.cases.bySource[x] ?? 0, c: S[1] }));
  const outs = OUT_ORDER.map((x, i) => ({ t: OUTCOME[x], v: d.cases.byOutcome[x] ?? 0, c: [S[0], S[2], S[1]][i] }));
  return (
    <Page theme={theme} info={info} page={page} total={total}>
      <Sec no={2} title="الحالات والجلسات الإرشادية" sub="متابعة الحالات الفردية وجلساتها ونتائجها في الشهر" />
      <div className="mr-body">
        <div className="mr-row c2">
          <div className="mr-box">
            <h3>{IC.chat}الجلسات بحسب النوع</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Donut parts={kindParts} total={d.sessions.total} label="جلسة" size={132} />
              <div style={{ flex: 1, display: "grid", gap: 8 }}>
                {kindParts.map((p) => (
                  <div key={p.t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <i style={{ width: 11, height: 11, borderRadius: 3, background: p.c, flex: "none" }} />
                    <span style={{ flex: 1 }}>{p.t}</span>
                    <b className="num">{p.v}</b>
                    <span className="num" style={{ color: "var(--mr-ink2)", width: 36, textAlign: "left" }}>{pct(p.v, d.sessions.total) ?? 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mr-box">
            <h3>{IC.folder}مصادر الحالات الجديدة<span className="aside num">{d.cases.opened} حالة</span></h3>
            {d.cases.opened ? <Bars items={src} /> : <div className="mr-empty">لم تُفتح حالات جديدة هذا الشهر.</div>}
          </div>
        </div>

        <div className="mr-row c32">
          <div className="mr-box">
            <h3>{IC.check}نتائج الحالات المغلقة<span className="aside num">{d.cases.closed} حالة</span></h3>
            {d.cases.closed ? <Split parts={outs} /> : <div className="mr-empty">لم تُغلق حالات هذا الشهر.</div>}
          </div>
          <div className="mr-tiles" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="mr-tile" style={{ "--c": "var(--s4)" }}><b className="num">{d.cases.openNow}</b><span>حالات مفتوحة تُتابع الآن</span></div>
            <div className="mr-tile"><b className="num">{d.cases.total}</b><span>إجمالي حالات الصف في السجل</span></div>
          </div>
        </div>

        <div className="mr-box">
          <h3>{IC.chart}اتجاه آخر ستة أشهر</h3>
          <TrendColumns trend={d.trend} current={d.month} />
          <div className="mr-legend" style={{ marginTop: 6, justifyContent: "center" }}>
            <span><i style={{ background: S[0] }} />الجلسات الإرشادية</span>
            <span><i style={{ background: S[1] }} />الحالات الجديدة</span>
          </div>
        </div>

        <div className="mr-box tint">
          <h3>{IC.alert}لقطة الإنذار المبكر<span className="aside">{warn ? "عند إصدار التقرير" : "غير متاحة"}</span></h3>
          {warn ? (
            <>
              <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
                {[["طلاب يحتاجون تدخلًا", warn.flagged, "var(--s4)"], ["الغياب", warn.absence], ["التأخر الصباحي", warn.lateOn ? warn.late : "—"],
                  ["التعثر الدراسي", warn.study], ["السلوك والإحالات", warn.behavior], ["مشمولون بحالة مفتوحة", warn.covered, "var(--s1)"]].map(([t, v, c]) => (
                  <div key={t} className="mr-tile" style={{ background: "#fff", "--c": c }}><b className="num">{v}</b><span>{t}</span></div>
                ))}
              </div>
              <p className="mr-note" style={{ marginTop: 7 }}>بحدود البوابة: الغياب بدون عذر من 5 أيام، والتأخر 3 مرات فأكثر، ومتوسط الاختبارات القصيرة أقل من 60٪ في مادتين، والإحالات في الفصل. الطالب قد يجمع أكثر من سبب.</p>
            </>
          ) : <div className="mr-empty">تعذّر جلب الإنذار المبكر.</div>}
        </div>
      </div>
    </Page>
  );
}

function ProgCard({ p, compact }) {
  const i = Math.max(0, PKIND_ORDER.indexOf(p.kind));
  return (
    <div className={`mr-prog${compact ? " compact" : ""}`}>
      <div className="ph">
        {p.photo ? <img src={p.photo} alt="" crossOrigin="anonymous" /> : IC.photo}
        <span className="kind" style={{ "--c": S[i] }}>{PROGRAM_KIND[p.kind]}</span>
      </div>
      <div className="bd">
        <h4>{p.title}</h4>
        <div className="mt">
          <span>التاريخ <b className="num">{dmy(p.st.date)}</b></span>
          <span>المستفيدون <b className="num">{p.st.beneficiaries ?? "—"}</b></span>
          {p.target && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.target}</span>}
        </div>
        {p.outcome && <p>{p.outcome}</p>}
      </div>
    </div>
  );
}

const FIRST_PROGS = 4, MORE_PROGS = 6;

function ProgramsPage({ theme, d, info, page, total, chunk, cont }) {
  const pr = d.programs;
  const evIds = new Set(pr.done.map((p) => p.event_id).filter(Boolean));
  const events = d.events.filter((e) => !evIds.has(e.id));
  return (
    <Page theme={theme} info={info} page={page} total={total}>
      <Sec no={3} title={cont ? "البرامج المنفذة (تتمة)" : "البرامج والأنشطة الإرشادية"} sub={cont ? null : "ما نُفّذ من الخطة الإرشادية في الشهر، بصوره وأثره"} />
      <div className="mr-body">
        {!cont && (
          <div className="mr-row" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
            <div className="mr-tile" style={{ display: "flex", flexDirection: "column", justifyContent: "center", "--c": "var(--mr-deep)" }}>
              <b className="num" style={{ fontSize: 40 }}>{n(pr.beneficiaries)}</b>
              <span style={{ fontSize: 12.5 }}>مستفيد من البرامج المنفذة ({pr.done.length})</span>
            </div>
            <div className="mr-box">
              <h3>{IC.chart}البرامج بحسب النوع<span className="aside">الخطة: {pr.planDone} من {pr.planTotal} منفّذ</span></h3>
              <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {PKIND_ORDER.map((x, i) => (
                  <div key={x} className="mr-tile" style={{ "--c": S[i] }}><b className="num">{pr.byKind[x] ?? 0}</b><span>{PROGRAM_KIND[x]}</span></div>
                ))}
              </div>
              <div className="mr-split" style={{ marginTop: 9, height: 10 }}>
                <i style={{ width: `${pct(pr.planDone, pr.planTotal) ?? 0}%`, background: "var(--s1)" }} />
              </div>
            </div>
          </div>
        )}

        {chunk.length ? (
          <div className="mr-progs">{chunk.map((p) => <ProgCard key={p.id} p={p} compact={cont} />)}</div>
        ) : (
          <div className="mr-empty">لم تُنفَّذ برامج إرشادية موثّقة في البوابة هذا الشهر.</div>
        )}

        {!cont && (events.length > 0 || pr.upcoming.length > 0) && (
          <div className="mr-row c2" style={{ marginTop: "auto" }}>
            <div className="mr-box">
              <h3>{IC.star}فعاليات نظّمها الموجه<span className="aside num">{events.length}</span></h3>
              {events.length ? (
                <div className="mr-list">{events.slice(0, 4).map((e) => <div key={e.id}><span>{e.title}</span><span className="num">{dmy(e.event_date)} · {e.participants} مشارك</span></div>)}</div>
              ) : <div className="mr-empty">لا فعاليات أخرى.</div>}
            </div>
            <div className="mr-box">
              <h3>{IC.calendar}برامج الشهر القادم<span className="aside num">{pr.upcoming.length}</span></h3>
              {pr.upcoming.length ? (
                <div className="mr-list">{pr.upcoming.slice(0, 4).map((p) => <div key={p.id}><span>{p.title}</span><span className="num">{dmy(p.planned_date)}</span></div>)}</div>
              ) : <div className="mr-empty">لا برامج مجدولة.</div>}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

function CommsPage({ theme, d, info, page, total, notes, sigs }) {
  const r = d.requests;
  const counselor = info.counselor;
  return (
    <Page theme={theme} info={info} page={page} total={total}>
      <Sec no={4} title="التواصل والمتابعة والنماذج" sub="المقابلات واستمارات المستوى والإحالات والنماذج التي أصدرها الموجه" />
      <div className="mr-body">
        <div className="mr-row c3">
          <div className="mr-box">
            <h3>{IC.calendar}طلبات المقابلة<span className="aside num">{r.total}</span></h3>
            <Split parts={REQ_ORDER.map(([kk, t], i) => ({ t, v: r.byStatus[kk] ?? 0, c: [S[0], S[1], S[2], "#B9C4BE"][i] }))} />
            <p className="mr-note" style={{ marginTop: 6 }}>من الطلاب <b className="num">{r.student}</b> · من أولياء الأمور <b className="num">{r.guardian}</b></p>
          </div>
          <div className="mr-box">
            <h3>{IC.clip}استمارات المستوى</h3>
            <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="mr-tile"><b className="num">{d.inquiries.created}</b><span>أُنشئت</span></div>
              <div className="mr-tile" style={{ "--c": "var(--s1)" }}><b className="num">{d.inquiries.sent}</b><span>لولي الأمر</span></div>
              <div className="mr-tile" style={{ "--c": "var(--s4)" }}><b className="num">{d.inquiries.urgent}</b><span>عاجلة</span></div>
            </div>
          </div>
          <div className="mr-box">
            <h3>{IC.arrow}الإحالات</h3>
            <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="mr-tile"><b className="num">{d.referrals.received}</b><span>واردة</span></div>
              <div className="mr-tile" style={{ "--c": "var(--s1)" }}><b className="num">{d.referrals.handled}</b><span>عولجت</span></div>
              <div className="mr-tile" style={{ "--c": "var(--s3)" }}><b className="num">{d.referrals.pending}</b><span>متبقية</span></div>
            </div>
          </div>
        </div>

        <div className="mr-box">
          <h3>{IC.doc}النماذج المستخدمة<span className="aside num">{countAr(d.forms.total, "form")}</span></h3>
          {d.forms.total ? (
            <Bars wide items={d.forms.by.slice(0, 9).map(([t, v], i) => ({ t, v, c: S[i % 2 ? 1 : 0] }))} />
          ) : <div className="mr-empty">لم تصدر نماذج من البوابة هذا الشهر.</div>}
        </div>

        <div className="mr-box tint" style={{ minHeight: 150, maxHeight: 330, overflow: "hidden" }}>
          <h3>{IC.pen}ملاحظات الموجه وتوصياته</h3>
          {notes?.trim()
            ? <div className="mr-notes">{notes.trim()}</div>
            : <div className="mr-lines">{[0, 1, 2, 3].map((i) => <i key={i} />)}</div>}
        </div>

        <div className="mr-signs" style={{ marginTop: "auto" }}>
          <div>
            <small>الموجه الطلابي</small>
            <b>{counselor || "…………………"}</b>
            <div className="sig">{sigs.counselor ? <img src={sigs.counselor} alt="" crossOrigin="anonymous" /> : <span className="ln" />}</div>
          </div>
          {sigs.stamp ? <div className="stamp img"><img src={sigs.stamp} alt="" crossOrigin="anonymous" /></div> : <div className="stamp">الختم</div>}
          <div>
            <small>مدير المدرسة</small>
            <b>{PRINCIPAL_NAME}</b>
            <div className="sig">{sigs.principal ? <img src={sigs.principal} alt="" crossOrigin="anonymous" /> : <span className="ln" />}</div>
          </div>
        </div>
      </div>
    </Page>
  );
}

/** أوراق التقرير بالترتيب، كل ورقة عنصر مستقل (للمعاينة المصغّرة) */
export function reportPages({ d, warn, theme = "light", info, notes, sigs }) {
  const progs = d.programs.done;
  const chunks = [progs.slice(0, FIRST_PROGS)];
  for (let i = FIRST_PROGS; i < progs.length; i += MORE_PROGS) chunks.push(progs.slice(i, i + MORE_PROGS));
  const total = 4 + chunks.length;
  const common = { theme, d, info, total };
  return [
    <Cover key="cover" theme={theme} d={d} info={info} />,
    <Summary key="sum" {...common} warn={warn} page={2} />,
    <CasesPage key="cases" {...common} warn={warn} page={3} />,
    ...chunks.map((c, i) => <ProgramsPage key={`prog${i}`} {...common} page={4 + i} chunk={c} cont={i > 0} />),
    <CommsPage key="comms" {...common} page={total} notes={notes} sigs={sigs} />,
  ];
}

/** كل أوراق التقرير — للطباعة وصور ملف PDF */
export default function MonthlyReportDoc(props) {
  return <>{reportPages(props)}</>;
}

export const reportInfo = ({ d, grade, counselor, yearLabel, termLabel }) => {
  const mid = new Date(`${d.month}-15T12:00:00`);
  const last = new Date(Date.UTC(d.y, d.m, 0, 12));
  const first = new Date(Date.UTC(d.y, d.m - 1, 1, 12));
  const hm = (dt) => new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { month: "long" }).format(dt);
  const hy = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { year: "numeric" }).format(last).replace(/\D/g, "");
  const h1 = hm(first), h2 = hm(last);
  return {
    month: mid.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric" }),
    hijri: `${h1 === h2 ? h1 : `${h1} – ${h2}`} ${hy}هـ`,
    range: `${dmy(d.from)} – ${dmy(`${d.from.slice(0, 8)}${String(d.days).padStart(2, "0")}`)}`,
    grade: GRADE_NAMES[grade] ?? "", counselor, year: yearLabel, termLabel,
  };
};
