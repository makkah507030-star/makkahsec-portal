// src/pages/admin/SchoolReportDoc.jsx
import { GRADE_NAMES } from "../../lib/schoolTime";
import { WARNING_STAGES } from "../../lib/officialAttendance";
import { PD_KINDS } from "../../lib/pd";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import {
  S, n, countAr, pct, dmy, Ring, Bars, Split, GroupedColumns, Legend, Kpis, Highlights, Box, Signs, Page, Cover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   التقرير الشهري للمدرسة بطقم التقارير (components/report):
   الغلاف ← لوحة المدرسة ← الطلاب (الحضور والسلوك والتوجيه) ← التعليم
   والتطوير المهني والأنشطة، مع ملاحظات المدير وتوقيعه والختم.
   ===================================================================== */

const pc = (v) => (v == null ? "—" : `${v}%`);
const MODE = { paper: "ورقي", omr: "تصحيح آلي", online: "إلكتروني", external: "خارج البوابة" };

function highlights(d) {
  const out = [];
  const a = d.attendance;
  if (a.days) out.push(`نسبة الحضور الرسمية ${pc(a.pct)}، والأيام المعتمدة: ${countAr(a.days, "day")}.`);
  if (d.events.total) out.push(`الأحداث والمناسبات: ${countAr(d.events.total, "event")}، والطلاب الحاضرون ${n(d.events.attended)}.`);
  const pdAll = d.pd.reports + d.pd.plc + d.pd.visits;
  if (pdAll) out.push(`أنشطة التطوير المهني المعتمدة: ${n(pdAll)} (تقارير ${n(d.pd.reports)}، مجتمعات تعلم ${n(d.pd.plc)}، زيارات ${n(d.pd.visits)}).`);
  if (d.quizzes.total) out.push(`اختبارات منفّذة عبر البوابة: ${n(d.quizzes.total)}${d.quizzes.avg != null ? ` بمتوسط أداء ${pc(d.quizzes.avg)}` : ""}.`);
  if (d.guidance.sessions) out.push(`الجلسات الإرشادية: ${n(d.guidance.sessions)}، والحالات الجديدة ${n(d.guidance.opened)}.`);
  if (d.referrals.total) out.push(`الإحالات: ${n(d.referrals.total)}، أُقفل منها ${n(d.referrals.closed)}.`);
  if (d.forms.total) out.push(`النماذج الصادرة من البوابة: ${n(d.forms.total)}.`);
  if (!out.length) out.push("لم تُسجَّل أعمال في البوابة لهذا الشهر بعد.");
  return out.slice(0, 6);
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل */
export function schoolPages({ d, info, theme = "light", notes, sigs = {} }) {
  const a = d.attendance, g = d.guidance;
  const doc = { title: "التقرير الشهري للمدرسة", meta: [info.month, info.hijri], foot: "التقرير الشهري" };
  const common = { theme, doc, total: 4 };
  const pdAll = d.pd.reports + d.pd.plc + d.pd.visits;
  const trend = [{ k: "pct", t: "نسبة الحضور الرسمية", c: S[0] }];
  return [
    <Cover key="cover" theme={theme} c={{
      year: info.year, tag: ["building", "مدرسة مكة الثانوية"], title: "التقرير الشهري", sub: "لأعمال المدرسة",
      badge: { main: info.month, sub: "الشهر" }, side: { main: info.hijri, sub: info.termLabel },
      rows: [["user", "مدير المدرسة", PRINCIPAL_NAME], ["calendar", "الفترة", info.range],
             ["check", "الأيام المعتمدة", countAr(a.days, "day")], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]],
      note: ["chart", "خلاصة الشهر من أقسام البوابة: شؤون الطلاب، والتوجيه، والأحداث، والتطوير المهني، والاختبارات، والنماذج."],
      strip: [[pc(a.pct), "نسبة الحضور"], [d.events.total, "الأحداث والمناسبات"], [pdAll, "أنشطة التطوير المهني"], [d.forms.total, "النماذج الصادرة"]],
      foot: "التقرير الشهري",
    }} />,

    <Page key="dash" {...common} page={2} sec={{ no: 1, title: "لوحة المدرسة", sub: "أرقام الشهر من أقسام البوابة" }}>
      <Kpis items={[
        { ic: "check", t: "نسبة الحضور", v: pc(a.pct), s: `الأيام المعتمدة ${a.days}`, c: S[0] },
        { ic: "arrow", t: "الإحالات", v: d.referrals.total, s: `أُقفلت ${d.referrals.closed}`, c: S[3] },
        { ic: "chat", t: "جلسات إرشادية", v: g.sessions, s: `حالات جديدة ${g.opened}`, c: S[1] },
        { ic: "star", t: "الأحداث", v: d.events.total, s: `الحاضرون ${n(d.events.attended)}`, c: S[2] },
        { ic: "award", t: "التطوير المهني", v: pdAll, s: `شواهد مرفوعة ${n(d.pd.evidence)}`, c: S[0] },
        { ic: "doc", t: "اختبارات منفّذة", v: d.quizzes.total, s: d.quizzes.avg != null ? `متوسط ${pc(d.quizzes.avg)}` : "—", c: S[1] },
        { ic: "clip", t: "نماذج صادرة", v: d.forms.total, s: `${d.forms.by.length} أنواع`, c: S[2] },
        { ic: "exit", t: "بلاغات انقطاع", v: d.dropouts.total, s: `طُوي قيد ${d.dropouts.byStatus.withdrawn ?? 0}`, c: S[3] },
      ]} />
      <Box icon="trophy" title="مؤشرات الإنجاز">
        <div className="mr-rings">
          <Ring value={a.pct == null ? null : Math.round(a.pct)} label="الحضور" sub={`${n(a.present)} حضور`} color={S[0]} />
          <Ring value={pct(d.events.approved, d.events.total)} label="اعتماد الأحداث" sub={`${d.events.approved} من ${d.events.total}`} color={S[1]} />
          <Ring value={pct(d.referrals.closed, d.referrals.total)} label="إقفال الإحالات" sub={`${d.referrals.closed} من ${d.referrals.total}`} color={S[2]} />
          <Ring value={pct(g.requestsDone, g.requests)} label="مقابلات الموجهين" sub={`${g.requestsDone} من ${g.requests}`} color={S[3]} />
        </div>
      </Box>
      <Box icon="chart" title="الحضور في آخر ستة أشهر">
        <GroupedColumns height={130} current={d.month} series={trend} cols={d.trend.map((t) => ({ key: t.key, label: t.label, values: { pct: t.pct ?? 0 } }))} />
        <Legend series={trend} />
      </Box>
      <Highlights title="خلاصة الشهر" items={highlights(d)} />
    </Page>,

    <Page key="stu" {...common} page={3} sec={{ no: 2, title: "الطلاب", sub: "الحضور والتأخر والإنذارات، والإحالات، والتوجيه الطلابي" }}>
      <div className="mr-row c2">
        <Box icon="cap" title="الحضور لكل صف" aside="نسبة الحضور الرسمية">
          {a.grades.length ? <Bars max={100} items={a.grades.map((x, i) => ({ t: GRADE_NAMES[x.g], v: x.pct ?? 0, note: pc(x.pct), c: S[i % 4] }))} /> : <div className="mr-empty">لا أيام معتمدة.</div>}
          <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 10 }}>
            <div className="mr-tile" style={{ "--c": "var(--s4)" }}><b className="num">{n(a.absent)}</b><span>غياب بدون عذر</span></div>
            <div className="mr-tile"><b className="num">{n(a.repeat3)}</b><span>تكرر غيابهم 3 أيام</span></div>
            <div className="mr-tile"><b className="num">{d.fpOn ? n(d.late.incidents) : "—"}</b><span>حالات تأخر</span></div>
          </div>
        </Box>
        <Box icon="alert" title="الإنذارات والإحالات">
          <Bars wide items={WARNING_STAGES.map((s, i) => ({ t: s.label, v: d.warnings.byStage[s.key] ?? 0, c: [S[2], S[3], S[1]][i] }))} />
          <div style={{ marginTop: 12 }}>
            {d.referrals.total ? <Split parts={[{ t: "إحالات مُقفلة", v: d.referrals.closed, c: S[0] }, { t: "قيد المتابعة", v: d.referrals.total - d.referrals.closed, c: S[2] }]} /> : <div className="mr-empty">لا إحالات هذا الشهر.</div>}
          </div>
        </Box>
      </div>
      <Box icon="chat" title="التوجيه الطلابي" aside="الصفوف الثلاثة">
        <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
          {[["حالات جديدة", g.opened], ["حالات أُغلقت", g.closed], ["تحسّنت", g.improved], ["جلسات إرشادية", g.sessions],
            ["برامج منفّذة", g.programs], ["طلبات مقابلة", g.requests]].map(([t, v]) => (
            <div key={t} className="mr-tile"><b className="num">{n(v)}</b><span>{t}</span></div>
          ))}
        </div>
        {g.beneficiaries > 0 && <p className="mr-note" style={{ marginTop: 6 }}>المستفيدون من البرامج الإرشادية: {countAr(g.beneficiaries, "student")}.</p>}
      </Box>
      <Box icon="list" title="الأكثر غيابًا" aside="أيام بدون عذر">
        {a.top.length ? (
          <table className="mr-table">
            <thead><tr><th className="c" style={{ width: 24 }}>م</th><th>الطالب</th><th className="c" style={{ width: 110 }}>الصف</th><th className="c" style={{ width: 50 }}>الفصل</th><th className="c" style={{ width: 50 }}>الأيام</th></tr></thead>
            <tbody>{a.top.slice(0, 6).map((s, i) => (
              <tr key={i}><td className="c num">{i + 1}</td><td>{s.name}</td><td className="c">{GRADE_NAMES[s.grade] ?? s.grade}</td><td className="c num">{s.cls}</td><td className="c num">{s.days}</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="mr-empty">لا غياب مسجل.</div>}
      </Box>
    </Page>,

    <Page key="edu" {...common} page={4} sec={{ no: 3, title: "التعليم والتطوير المهني والأنشطة", sub: "الاختبارات، والتطوير المهني، والأحداث، والنماذج" }}>
      <div className="mr-row c2">
        <Box icon="doc" title="الاختبارات" aside={d.quizzes.avg != null ? `متوسط ${pc(d.quizzes.avg)}` : n(d.quizzes.total)}>
          {d.quizzes.total ? <Bars items={Object.entries(MODE).map(([k, t]) => ({ t, v: d.quizzes.byMode[k] ?? 0, c: S[1] }))} /> : <div className="mr-empty">لا اختبارات منفّذة.</div>}
          {d.quizzes.sheets > 0 && <p className="mr-note" style={{ marginTop: 6 }}>أوراق مصحّحة: {n(d.quizzes.sheets)}.</p>}
        </Box>
        <Box icon="award" title="التطوير المهني" aside={n(pdAll)}>
          <Bars items={[
            ...Object.entries(PD_KINDS).map(([k, v]) => ({ t: v.short ?? v.t, v: d.pd.byKind[k] ?? 0, c: S[0] })),
            { t: "جلسات مجتمعات التعلم", v: d.pd.plc, c: S[2] }, { t: "زيارات تبادلية", v: d.pd.visits, c: S[2] },
          ]} />
        </Box>
      </div>
      <div className="mr-row c2">
        <Box icon="star" title="أبرز الأحداث" aside={n(d.events.total)}>
          {d.events.top.length ? (
            <div className="mr-list">{d.events.top.map((e) => <div key={e.title + e.date}><span>{e.title}</span><span className="num">{dmy(e.date)} · الحاضرون {e.attended}</span></div>)}</div>
          ) : <div className="mr-empty">لا أحداث هذا الشهر.</div>}
        </Box>
        <Box icon="clip" title="النماذج الأكثر استخدامًا" aside={n(d.forms.total)}>
          {d.forms.total ? <Bars items={d.forms.by.slice(0, 6).map(([t, v]) => ({ t, v, c: S[1] }))} /> : <div className="mr-empty">لا نماذج صادرة.</div>}
        </Box>
      </div>
      <Box icon="pen" title="ملاحظات مدير المدرسة وتوجيهاته" tint style={{ minHeight: 120, maxHeight: 240, overflow: "hidden" }}>
        {notes?.trim() ? <div className="mr-notes">{notes.trim()}</div> : <div className="mr-lines">{[0, 1, 2].map((i) => <i key={i} />)}</div>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
}
