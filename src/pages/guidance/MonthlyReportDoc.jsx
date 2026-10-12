// src/pages/guidance/MonthlyReportDoc.jsx
import { GRADE_NAMES } from "../../lib/schoolTime";
import { SOURCE, KIND, OUTCOME } from "../../lib/guidanceWarning";
import { PROGRAM_KIND } from "../GuidanceMore.jsx";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import {
  IC, S, n, pct, dmy, countAr, Ring, Donut, DonutLegend, StackedColumns, GroupedColumns, Bars, Split, Legend,
  Kpis, Highlights, Signs, Page, Cover as KitCover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   أوراق التقرير الشهري للموجه الطلابي بطقم التقارير (components/report):
   الغلاف ← ملخص الشهر ← الحالات والجلسات ← البرامج والأنشطة (وتتمتها إن
   كثرت) ← التواصل والنماذج والتوقيعات.
   ===================================================================== */

const TREND = [{ k: "sessions", t: "الجلسات الإرشادية", c: S[0] }, { k: "cases", t: "الحالات الجديدة", c: S[1] }];
const KIND_ORDER = ["individual", "group", "guardian", "teacher"];
const PKIND_ORDER = ["awareness", "preventive", "developmental", "remedial"];
const OUT_ORDER = ["improved", "continuing", "referred"];
const REQ_ORDER = [["done", "تمت"], ["scheduled", "تحدد موعدها"], ["new", "جديدة"], ["declined", "اعتذر عنها"]];

// ترويسة الصفحات وتذييلها
const docOf = (info) => ({ title: "التقرير الشهري للموجه الطلابي", meta: [info.grade, info.month], foot: "التوجيه الطلابي" });

/* ============================ الأوراق ============================ */

function Cover({ theme, d, info }) {
  return (
    <KitCover theme={theme} c={{
      year: info.year, tag: ["chat", "التوجيه الطلابي"], title: "التقرير الشهري", sub: "لأعمال الموجه الطلابي",
      badge: { main: info.month, sub: info.grade }, side: { main: info.hijri, sub: info.termLabel },
      rows: [["user", "الموجه الطلابي", info.counselor || "—"], ["cap", "الصف", info.grade],
             ["calendar", "الفترة", info.range], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]],
      note: ["lock", "أرقام مجمّعة من سجلات البوابة، دون أسماء الطلاب حفاظًا على سرية الحالات."],
      strip: [[d.sessions.total, "جلسة إرشادية"], [d.cases.opened + d.cases.closed, "حالة تمت متابعتها"],
              [d.programs.done.length, "برنامج منفّذ"], [d.forms.total, "نموذج صادر"]],
      foot: "التوجيه الطلابي",
    }} />
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
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 1, title: "ملخص الشهر", sub: "لوحة سريعة بأعمال الموجه الطلابي ومؤشرات إنجازها" }}>
        <Kpis items={kpis.map(([ic, t, v, sub, c]) => ({ ic, t, v, s: sub, c }))} />

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
          <StackedColumns series={series} cols={d.weeks.map((w) => ({ label: w.label, sub: w.range, values: w }))} />
          <Legend series={series} totals={Object.fromEntries(series.map((x) => [x.k, d.weeks.reduce((a, w) => a + w[x.k], 0)]))} />
        </div>

        <Highlights title="أبرز ما في الشهر" items={highlights(d, warn)} />
    </Page>
  );
}

function CasesPage({ theme, d, warn, info, page, total }) {
  const k = d.sessions.kinds;
  const kindParts = KIND_ORDER.map((x, i) => ({ t: KIND[x], v: k[x] ?? 0, c: S[i] }));
  const src = Object.keys(SOURCE).map((x) => ({ t: SOURCE[x], v: d.cases.bySource[x] ?? 0, c: S[1] }));
  const outs = OUT_ORDER.map((x, i) => ({ t: OUTCOME[x], v: d.cases.byOutcome[x] ?? 0, c: [S[0], S[2], S[1]][i] }));
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 2, title: "الحالات والجلسات الإرشادية", sub: "متابعة الحالات الفردية وجلساتها ونتائجها في الشهر" }}>
        <div className="mr-row c2">
          <div className="mr-box">
            <h3>{IC.chat}الجلسات بحسب النوع</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Donut parts={kindParts} total={d.sessions.total} label="جلسة" size={132} />
              <DonutLegend parts={kindParts} />
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
          <GroupedColumns current={d.month} series={TREND} cols={d.trend.map((t) => ({ key: t.key, label: t.label, values: t }))} />
          <Legend series={TREND} />
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
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 3, title: cont ? "البرامج المنفذة (تتمة)" : "البرامج والأنشطة الإرشادية", sub: cont ? null : "ما نُفّذ من الخطة الإرشادية في الشهر، بصوره وأثره" }}>
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
    </Page>
  );
}

function CommsPage({ theme, d, info, page, total, notes, sigs }) {
  const r = d.requests;
  const counselor = info.counselor;
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 4, title: "التواصل والمتابعة والنماذج", sub: "المقابلات واستمارات المستوى والإحالات والنماذج التي أصدرها الموجه" }}>
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

        <Signs stamp={sigs.stamp} people={[{ title: "الموجه الطلابي", name: counselor, sig: sigs.counselor },
                                           { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
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
