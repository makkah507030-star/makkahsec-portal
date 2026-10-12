// src/pages/EventsReportDoc.jsx
import { fmtDate } from "../lib/dates";
import { PRINCIPAL_NAME } from "../lib/exportUtils.js";
import {
  S, n, pct, dmy, paginate, Ring, Bars, StackedColumns, Legend, Kpis, Highlights, Box, Signs, Page, Cover, IC,
} from "../components/report/ReportKit.jsx";

/* =====================================================================
   تقرير الأحداث والمناسبات بطقم التقارير (components/report):
   الغلاف ← ملخص الأحداث (المؤشرات، والأشهر، والتصنيفات) ← أبرز الأحداث
   بصور تقاريرها ← سجل الأحداث كاملًا ثم التوقيعات.
   الأحداث الملغاة تظهر في السجل بحالتها ولا تدخل في الأرقام.
   ===================================================================== */

const CAP = 800;
export const STAGE_AR = {
  draft: "مسودة", participants: "اختيار الطلاب", consent: "الموافقات",
  permission: "الاستئذان", attendance: "الحضور", certificates: "الشهادات",
  report: "التقرير", approved: "معتمد",
};
const MONTHS_AR = (k) => new Date(`${k}-15T12:00:00`).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "short" });

export function eventsModel(events, counts) {
  const live = events.filter((e) => !e.cancelled_at);
  const c = (e) => counts[e.id] ?? { total: 0, attended: 0, certs: 0, consent: 0 };
  const t = { events: live.length, nominated: 0, attended: 0, certs: 0, consent: 0, approved: 0, cancelled: events.length - live.length };
  live.forEach((e) => {
    const x = c(e);
    t.nominated += x.total; t.attended += x.attended; t.certs += x.certs; t.consent += x.consent ?? 0;
    if (e.stage === "approved") t.approved++;
  });
  // الأحداث بالشهر: المعتمد وما زال قيد التنفيذ
  const months = {};
  live.forEach((e) => {
    const k = e.event_date.slice(0, 7);
    const m = (months[k] ??= { approved: 0, open: 0 });
    m[e.stage === "approved" ? "approved" : "open"] += 1;
  });
  const monthCols = Object.keys(months).sort().slice(-8).map((k) => ({ label: MONTHS_AR(k), sub: k.slice(0, 4), values: months[k] }));
  const cats = {};
  live.forEach((e) => { const k = e.category || "غير مصنّف"; cats[k] = (cats[k] ?? 0) + 1; });
  const byOrganizer = {};
  live.forEach((e) => { const k = e.organizer_name || "—"; byOrganizer[k] = (byOrganizer[k] ?? 0) + 1; });
  return { live, c, t, monthCols, cats: Object.entries(cats).sort((a, b) => b[1] - a[1]), orgs: Object.entries(byOrganizer).sort((a, b) => b[1] - a[1]) };
}

function highlights(m) {
  const out = [];
  if (!m.t.events) return ["لا أحداث منفّذة في هذه الفترة."];
  out.push(`نُفّذ ${n(m.t.events)} حدثًا ومناسبة، اعتُمد منها ${n(m.t.approved)}.`);
  if (m.t.attended) out.push(`حضرها ${n(m.t.attended)} طالبًا من ${n(m.t.nominated)} مرشحًا (${pct(m.t.attended, m.t.nominated) ?? 0}%).`);
  if (m.t.certs) out.push(`صدرت ${n(m.t.certs)} شهادة مشاركة للطلاب.`);
  if (m.cats[0]) out.push(`أكثر التصنيفات: «${m.cats[0][0]}» بعدد ${n(m.cats[0][1])}.`);
  const top = [...m.live].sort((a, b) => m.c(b).attended - m.c(a).attended)[0];
  if (top && m.c(top).attended) out.push(`أكبر الأحداث حضورًا: «${top.title}» (${n(m.c(top).attended)} طالبًا).`);
  if (m.t.cancelled) out.push(`أحداث أُلغيت: ${n(m.t.cancelled)} (لا تدخل في الأرقام).`);
  return out.slice(0, 6);
}

function EventCard({ e, c, photo }) {
  return (
    <div className="mr-prog compact">
      <div className="ph">
        {photo ? <img src={photo} alt="" crossOrigin="anonymous" /> : IC.star}
        {e.category && <span className="kind" style={{ "--c": "var(--s1)" }}>{e.category}</span>}
      </div>
      <div className="bd">
        <h4>{e.title}</h4>
        <div className="mt">
          <span>التاريخ <b className="num">{dmy(e.event_date)}</b></span>
          <span>الحضور <b className="num">{c.attended}</b></span>
          <span>الشهادات <b className="num">{c.certs}</b></span>
        </div>
        {(e.report_summary || e.description) && <p>{e.report_summary || e.description}</p>}
      </div>
    </div>
  );
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل */
export function eventsReportPages({ events, counts, photos = {}, scopeLabel, organizer, from, to, year, theme = "light", sigs = {} }) {
  const m = eventsModel(events, counts);
  const period = from || to ? `${from ? dmy(from) : "من البداية"} – ${to ? dmy(to) : "حتى اليوم"}` : "كل الفترات";
  const doc = { title: "تقرير الأحداث والمناسبات", meta: [scopeLabel, period], foot: "الأحداث والمناسبات" };

  // أبرز الأحداث: المعتمدة بالأكثر حضورًا، والمصوّرة أولًا
  const feat = [...m.live].filter((e) => e.stage === "approved")
    .sort((a, b) => (!!photos[b.id] - !!photos[a.id]) || m.c(b).attended - m.c(a).attended).slice(0, 6);
  const rows = events;
  const rowH = (e) => (e.title.length > 38 ? 40 : 26);
  const tablePages = paginate(rows, rowH, CAP - 40);
  const lastUsed = tablePages[tablePages.length - 1].reduce((a, e) => a + rowH(e), 40);
  const signsApart = lastUsed + 160 > CAP;
  const total = 2 + (feat.length ? 1 : 0) + tablePages.length + (signsApart ? 1 : 0);
  let pg = 2;
  const common = { theme, doc, total };
  // تقرير المنظّم يوقّعه هو والمدير، وتقرير كل الأحداث يوقّعه المدير
  const principal = { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal };
  const signs = <Signs stamp={sigs.stamp} people={organizer ? [{ title: "المنظّم", name: organizer, sig: sigs.organizer }, principal] : [principal]} />;

  return [
    <Cover key="cover" theme={theme} c={{
      year, tag: ["star", "الأحداث والمناسبات"], title: "تقرير الأحداث", sub: "والمناسبات المدرسية", titleSize: 84,
      badge: { main: n(m.t.events), sub: "حدثًا منفّذًا" }, side: { main: period, sub: scopeLabel },
      rows: [["user", "النطاق", organizer ? `ما نفّذه: ${organizer}` : "كل أحداث المدرسة"], ["calendar", "الفترة", period],
             ["check", "المعتمدة", `${n(m.t.approved)} من ${n(m.t.events)}`], ["doc", "تاريخ الإصدار", fmtDate(new Date())]],
      note: ["check", "أرقام الأحداث كما وُثّقت في البوابة: المرشحون، والحضور، والشهادات، والاعتماد."],
      strip: [[m.t.events, "حدثًا ومناسبة"], [m.t.attended, "طالبًا حاضرًا"], [m.t.certs, "شهادة صادرة"], [m.t.approved, "حدثًا معتمدًا"]],
      foot: "الأحداث والمناسبات",
    }} />,

    <Page key="sum" {...common} page={2} sec={{ no: 1, title: "ملخص الأحداث", sub: "المؤشرات وتوزيع الأحداث على الأشهر والتصنيفات" }}>
      <Kpis items={[
        { ic: "star", t: "الأحداث", v: m.t.events, s: `معتمدة ${m.t.approved}`, c: S[0] },
        { ic: "users", t: "المرشحون", v: m.t.nominated, s: `الموافقات ${m.t.consent}`, c: S[1] },
        { ic: "check", t: "الحاضرون", v: m.t.attended, s: `من ${m.t.nominated} مرشحًا`, c: S[2] },
        { ic: "award", t: "الشهادات", v: m.t.certs, s: "شهادات مشاركة", c: S[3] },
      ]} />
      <Box icon="trophy" title="مؤشرات الإنجاز">
        <div className="mr-rings">
          <Ring value={pct(m.t.approved, m.t.events)} label="اعتماد الأحداث" sub={`${m.t.approved} من ${m.t.events}`} color={S[0]} />
          <Ring value={pct(m.t.attended, m.t.nominated)} label="نسبة الحضور" sub={`${m.t.attended} من ${m.t.nominated}`} color={S[1]} />
          <Ring value={pct(m.t.consent, m.t.nominated)} label="موافقات أولياء الأمور" sub={`${m.t.consent} من ${m.t.nominated}`} color={S[2]} />
          <Ring value={pct(m.t.certs, m.t.attended)} label="الشهادات للحاضرين" sub={`${m.t.certs} من ${m.t.attended}`} color={S[3]} />
        </div>
      </Box>
      <div className="mr-row c2">
        <Box icon="chart" title="الأحداث بالشهر">
          {m.monthCols.length ? (
            <>
              <StackedColumns width={320} height={170} cols={m.monthCols} series={[{ k: "approved", t: "معتمد", c: S[0] }, { k: "open", t: "قيد التنفيذ", c: S[2] }]} />
              <Legend series={[{ k: "approved", t: "معتمد", c: S[0] }, { k: "open", t: "قيد التنفيذ", c: S[2] }]} />
            </>
          ) : <div className="mr-empty">لا أحداث.</div>}
        </Box>
        <Box icon="grid" title="التصنيفات">
          {m.cats.length ? <Bars items={m.cats.slice(0, 7).map(([t, v]) => ({ t, v }))} /> : <div className="mr-empty">لا أحداث.</div>}
        </Box>
      </div>
      <Highlights title="خلاصة الفترة" items={highlights(m)} />
    </Page>,

    ...(feat.length ? [
      <Page key="feat" {...common} page={++pg} sec={{ no: 2, title: "أبرز الأحداث", sub: "المعتمدة بالأكثر حضورًا، بصور تقاريرها" }}>
        <div className="mr-progs">{feat.map((e) => <EventCard key={e.id} e={e} c={m.c(e)} photo={photos[e.id]} />)}</div>
        {!organizer && m.orgs.length > 1 && (
          <Box icon="users" title="المنظّمون" aside="عدد الأحداث" style={{ marginTop: "auto" }}>
            <Bars wide items={m.orgs.slice(0, 5).map(([t, v]) => ({ t, v, c: S[1] }))} />
          </Box>
        )}
      </Page>,
    ] : []),

    ...tablePages.map((list, i) => {
      const last = i === tablePages.length - 1;
      const start = tablePages.slice(0, i).reduce((a, p) => a + p.length, 0);
      return (
        <Page key={`t${i}`} {...common} page={++pg} sec={i ? null : { no: feat.length ? 3 : 2, title: "سجل الأحداث", sub: "كل الأحداث في الفترة بأرقامها وحالتها" }}>
          {rows.length ? (
            <table className="mr-table">
              <thead><tr><th className="c" style={{ width: 28 }}>م</th><th>الحدث</th><th className="c" style={{ width: 78 }}>التاريخ</th>
                <th style={{ width: 120 }}>المنظّم</th><th className="c" style={{ width: 50 }}>الحضور</th><th className="c" style={{ width: 52 }}>الشهادات</th><th className="c" style={{ width: 76 }}>الحالة</th></tr></thead>
              <tbody>{list.map((e, j) => (
                <tr key={e.id}>
                  <td className="c num">{start + j + 1}</td>
                  <td>{e.title}{e.category && <span style={{ display: "block", fontSize: 10, color: "var(--mr-ink2)" }}>{e.category}{e.venue ? ` · ${e.venue}` : ""}</span>}</td>
                  <td className="c num">{dmy(e.event_date)}</td><td style={{ fontSize: 10.5 }}>{e.organizer_name || "—"}</td>
                  <td className="c num">{m.c(e).attended}</td><td className="c num">{m.c(e).certs}</td>
                  <td className="c"><span className={`mr-chip ${e.cancelled_at ? "no" : e.stage === "approved" ? "ok" : "auto"}`}>{e.cancelled_at ? "ملغى" : STAGE_AR[e.stage] ?? e.stage}</span></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <div className="mr-empty">لا أحداث في هذا النطاق.</div>}
          {last && !signsApart && signs}
        </Page>
      );
    }),

    ...(signsApart ? [<Page key="signs" {...common} page={++pg} sec={{ no: "✓", title: "الاعتماد", sub: "توقيع المنظّم ومدير المدرسة" }}>{signs}</Page>] : []),
  ];
}
