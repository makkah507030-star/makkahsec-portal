// src/pages/EventsReportDoc.jsx
import { fmtDate } from "../lib/dates";
import { todayISO } from "../lib/schoolTime";
import { PRINCIPAL_NAME } from "../lib/exportUtils.js";
import {
  S, n, countAr, pct, dmy, paginate, Ring, Bars, StackedColumns, Legend, Kpis, Highlights, Box, Signs, Page, Cover, IC,
} from "../components/report/ReportKit.jsx";

/* =====================================================================
   تقرير الأحداث والمناسبات بطقم التقارير (components/report):
   الغلاف ← ملخص الأحداث (المؤشرات، والأشهر، والتصنيفات) ← أبرز الأحداث
   بصور تقاريرها ← سجل الأحداث كاملًا ثم التوقيعات.
   الأرقام من الأحداث المنفّذة وحدها (eventPhase)؛ القادمة والملغاة وما لم يُستكمل تظهر
   في السجل بحالتها.
   ===================================================================== */

const CAP = 800;
export const STAGE_AR = {
  draft: "مسودة", participants: "اختيار الطلاب", consent: "الموافقات",
  permission: "الاستئذان", attendance: "الحضور", certificates: "الشهادات",
  report: "التقرير", approved: "معتمد",
};
const MONTH_SERIES = [{ k: "approved", t: "معتمد", c: S[0] }, { k: "open", t: "بانتظار الاعتماد", c: S[2] }, { k: "upcoming", t: "قادم", c: S[1] }];
const MONTHS_AR = (k) => new Date(`${k}-15T12:00:00`).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "short" });

/* حال الحدث في الإحصاءات: الملغى لا يُعدّ، والقادم لم يحن موعده، والمسودة التي مضى موعدها
   «لم يُستكمل»، وما عدا ذلك منفَّذ: معتمد أو بانتظار الاعتماد. الأرقام كلها من المنفَّذ وحده. */
export function eventPhase(e, today = todayISO()) {
  if (e.cancelled_at) return "cancelled";
  if (e.event_date > today) return "upcoming";
  if (e.stage === "draft") return "incomplete";
  return e.stage === "approved" ? "approved" : "done";
}

export function eventsModel(events, counts) {
  const today = todayISO();
  const ph = (e) => eventPhase(e, today);
  const done = events.filter((e) => ["approved", "done"].includes(ph(e)));
  const c = (e) => counts[e.id] ?? { total: 0, attended: 0, certs: 0, consent: 0 };
  const t = {
    events: done.length, nominated: 0, named: 0, attended: 0, certs: 0, consent: 0,
    approved: done.filter((e) => ph(e) === "approved").length,
    upcoming: events.filter((e) => ph(e) === "upcoming").length,
    incomplete: events.filter((e) => ph(e) === "incomplete").length,
    cancelled: events.filter((e) => ph(e) === "cancelled").length,
  };
  done.forEach((e) => {
    const x = c(e);
    t.nominated += x.total; t.named += x.named ?? x.total; t.attended += x.attended; t.certs += x.certs; t.consent += x.consent ?? 0;
  });
  // الأحداث بالشهر: المعتمد، والمنفَّذ بانتظار الاعتماد، والقادم
  const months = {};
  events.forEach((e) => {
    const p = ph(e);
    if (p === "cancelled" || p === "incomplete") return;
    const m = (months[e.event_date.slice(0, 7)] ??= { approved: 0, open: 0, upcoming: 0 });
    m[p === "approved" ? "approved" : p === "done" ? "open" : "upcoming"] += 1;
  });
  const monthCols = Object.keys(months).sort().slice(-8).map((k) => ({ label: MONTHS_AR(k), sub: k.slice(0, 4), values: months[k] }));
  const cats = {};
  done.forEach((e) => { const k = e.category || "غير مصنّف"; cats[k] = (cats[k] ?? 0) + 1; });
  const byOrganizer = {};
  done.forEach((e) => { const k = e.organizer_name || "—"; byOrganizer[k] = (byOrganizer[k] ?? 0) + 1; });
  return { live: done, ph, c, t, monthCols, cats: Object.entries(cats).sort((a, b) => b[1] - a[1]), orgs: Object.entries(byOrganizer).sort((a, b) => b[1] - a[1]) };
}

function highlights(m) {
  const out = [];
  if (!m.t.events) return [m.t.upcoming ? `لا أحداث منفّذة بعد، وأحداث قادمة: ${n(m.t.upcoming)}.` : "لا أحداث منفّذة في هذه الفترة."];
  out.push(`الأحداث والمناسبات المنفّذة: ${countAr(m.t.events, "event")}، اعتُمد منها ${n(m.t.approved)}.`);
  if (m.t.attended) out.push(`الحضور: ${countAr(m.t.attended, "beneficiary")} من ${countAr(m.t.nominated, "nominee", "g")} (${pct(m.t.attended, m.t.nominated) ?? 0}%).`);
  if (m.t.certs) out.push(`الشهادات الصادرة: ${countAr(m.t.certs, "cert")}.`);
  if (m.cats[0]) out.push(`أكثر التصنيفات: «${m.cats[0][0]}» بعدد ${n(m.cats[0][1])}.`);
  const top = [...m.live].sort((a, b) => m.c(b).attended - m.c(a).attended)[0];
  if (top && m.c(top).attended) out.push(`أكبر الأحداث حضورًا: «${top.title}» (${countAr(m.c(top).attended, "beneficiary")}).`);
  if (m.t.upcoming) out.push(`أحداث قادمة لم يحن موعدها: ${n(m.t.upcoming)} (لا تدخل في الأرقام).`);
  if (m.t.incomplete || m.t.cancelled) out.push(`لم يُستكمل ${n(m.t.incomplete)}، وأُلغي ${n(m.t.cancelled)} (لا تدخل في الأرقام).`);
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

/* بطاقة خبر من قسم الأخبار: صورة الغلاف والعنوان والمقتطف وتاريخ النشر */
function NewsCard({ x }) {
  return (
    <div className="mr-prog compact">
      <div className="ph">
        {x.cover_url ? <img src={x.cover_url} alt="" crossOrigin="anonymous" /> : IC.megaphone}
        <span className="kind" style={{ "--c": "var(--s2)" }}>خبر</span>
      </div>
      <div className="bd">
        <h4>{x.title}</h4>
        <div className="mt"><span>نُشر <b className="num">{dmy(String(x.published_at ?? x.created_at).slice(0, 10))}</b></span></div>
        {x.excerpt && <p>{x.excerpt}</p>}
      </div>
    </div>
  );
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل
 *  news: أخبار البوابة المنشورة في الفترة (لتقرير كل الأحداث) — تتصدّر «أبرز الأحداث» بصورها */
export function eventsReportPages({ events, counts, photos = {}, news = [], scopeLabel, organizer, from, to, year, theme = "light", sigs = {} }) {
  const m = eventsModel(events, counts);
  const period = from || to ? `${from ? dmy(from) : "من البداية"} – ${to ? dmy(to) : "حتى اليوم"}` : "كل الفترات";
  const doc = { title: "تقرير الأحداث والمناسبات", meta: [scopeLabel, period], foot: "الأحداث والمناسبات" };

  // أبرز الأحداث: أخبار البوابة في الفترة أولًا، ثم المعتمدة بالأكثر حضورًا والمصوّرة أولًا
  // (حتى ست بطاقات، ولا يتكرر حدث له خبر بالعنوان نفسه)
  const newsFeat = news.slice(0, 6);
  const titled = new Set(newsFeat.map((x) => x.title.trim()));
  const feat = [...m.live].filter((e) => e.stage === "approved" && !titled.has(e.title.trim()))
    .sort((a, b) => (!!photos[b.id] - !!photos[a.id]) || m.c(b).attended - m.c(a).attended).slice(0, 6 - newsFeat.length);
  const featN = newsFeat.length + feat.length;
  const rows = events;
  const rowH = (e) => (e.title.length > 38 ? 40 : 26);
  const tablePages = paginate(rows, rowH, CAP - 40);
  const lastUsed = tablePages[tablePages.length - 1].reduce((a, e) => a + rowH(e), 40);
  const signsApart = lastUsed + 160 > CAP;
  const total = 2 + (featN ? 1 : 0) + tablePages.length + (signsApart ? 1 : 0);
  let pg = 2;
  const common = { theme, doc, total };
  // تقرير المنظّم يوقّعه هو والمدير، وتقرير كل الأحداث يوقّعه المدير
  const principal = { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal };
  const signs = <Signs stamp={sigs.stamp} people={organizer ? [{ title: "المنظّم", name: organizer, sig: sigs.organizer }, principal] : [principal]} />;

  return [
    <Cover key="cover" theme={theme} c={{
      year, tag: ["star", "الأحداث والمناسبات"], title: "تقرير الأحداث", sub: "والمناسبات المدرسية", titleSize: 84,
      badge: { main: n(m.t.events), sub: "الأحداث المنفّذة" }, side: { main: period, sub: scopeLabel },
      rows: [["user", "النطاق", organizer ? `ما نفّذه: ${organizer}` : "كل أحداث المدرسة"], ["calendar", "الفترة", period],
             ["check", "المعتمدة", `${n(m.t.approved)} من ${n(m.t.events)}`], ["doc", "تاريخ الإصدار", fmtDate(new Date())]],
      note: ["check", "أرقام الأحداث كما وُثّقت في البوابة: المرشحون، والحضور، والشهادات، والاعتماد."],
      strip: [[m.t.events, "الأحداث والمناسبات"], [m.t.attended, "المستفيدون الحاضرون"], [m.t.certs, "الشهادات الصادرة"], [m.t.approved, "الأحداث المعتمدة"]],
      foot: "الأحداث والمناسبات",
    }} />,

    <Page key="sum" {...common} page={2} sec={{ no: 1, title: "ملخص الأحداث", sub: "المؤشرات وتوزيع الأحداث على الأشهر والتصنيفات" }}>
      <Kpis items={[
        { ic: "star", t: "الأحداث المنفّذة", v: m.t.events, s: `معتمدة ${m.t.approved} · قادمة ${m.t.upcoming}`, c: S[0] },
        { ic: "users", t: "المرشحون", v: m.t.nominated, s: `الموافقات ${m.t.consent}`, c: S[1] },
        { ic: "check", t: "الحاضرون", v: m.t.attended, s: `من ${countAr(m.t.nominated, "nominee", "g")}`, c: S[2] },
        { ic: "award", t: "الشهادات", v: m.t.certs, s: "شهادات مشاركة", c: S[3] },
      ]} />
      <Box icon="trophy" title="مؤشرات الإنجاز">
        <div className="mr-rings">
          <Ring value={pct(m.t.approved, m.t.events)} label="اعتماد الأحداث" sub={`${m.t.approved} من ${m.t.events}`} color={S[0]} />
          <Ring value={pct(m.t.attended, m.t.nominated)} label="نسبة الحضور" sub={`${m.t.attended} من ${m.t.nominated}`} color={S[1]} />
          <Ring value={pct(m.t.consent, m.t.named)} label="موافقات أولياء الأمور" sub={`${m.t.consent} من ${m.t.named}`} color={S[2]} />
          <Ring value={pct(m.t.certs, m.t.attended)} label="الشهادات للحاضرين" sub={`${m.t.certs} من ${m.t.attended}`} color={S[3]} />
        </div>
      </Box>
      <div className="mr-row c2">
        <Box icon="chart" title="الأحداث بالشهر">
          {m.monthCols.length ? (
            <>
              <StackedColumns width={320} height={170} cols={m.monthCols} series={MONTH_SERIES} />
              <Legend series={MONTH_SERIES} />
            </>
          ) : <div className="mr-empty">لا أحداث.</div>}
        </Box>
        <Box icon="grid" title="التصنيفات">
          {m.cats.length ? <Bars items={m.cats.slice(0, 7).map(([t, v]) => ({ t, v }))} /> : <div className="mr-empty">لا أحداث.</div>}
        </Box>
      </div>
      <Highlights title="خلاصة الفترة" items={highlights(m)} />
    </Page>,

    ...(featN ? [
      <Page key="feat" {...common} page={++pg} sec={{ no: 2, title: "أبرز الأحداث", sub: newsFeat.length ? "من أخبار البوابة في الفترة، والأحداث المعتمدة بصور تقاريرها" : "المعتمدة بالأكثر حضورًا، بصور تقاريرها" }}>
        <div className="mr-progs">
          {newsFeat.map((x) => <NewsCard key={`n${x.id}`} x={x} />)}
          {feat.map((e) => <EventCard key={e.id} e={e} c={m.c(e)} photo={photos[e.id]} />)}
        </div>
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
        <Page key={`t${i}`} {...common} page={++pg} sec={i ? null : { no: featN ? 3 : 2, title: "سجل الأحداث", sub: "كل الأحداث في الفترة بأرقامها وحالتها" }}>
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
                  <td className="c">{(() => {
                    const p = m.ph(e);
                    const [cls, label] = p === "cancelled" ? ["no", "ملغى"] : p === "upcoming" ? ["auto", "قادم"] : p === "incomplete" ? ["no", "لم يُستكمل"]
                      : p === "approved" ? ["ok", "معتمد"] : ["auto", STAGE_AR[e.stage] ?? e.stage];
                    return <span className={`mr-chip ${cls}`}>{label}</span>;
                  })()}</td>
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
