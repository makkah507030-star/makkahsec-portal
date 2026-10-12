// src/pages/student-affairs/MonthlyAffairsDoc.jsx
import { GRADE_NAMES } from "../../lib/schoolTime";
import { WARNING_STAGES } from "../../lib/officialAttendance";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import {
  S, n, Ring, Bars, Split, GroupedColumns, Legend, Kpis, Highlights, Box, Signs, Page, Cover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   التقرير الشهري لشؤون الطلاب بطقم التقارير (components/report):
   الغلاف ← الحضور والغياب ← التأخر الصباحي والإنذارات ← الإحالات والمنقطعون
   مع ملاحظات الوكيل والتوقيعات.
   ===================================================================== */

const WD = { 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس" };
const DROP = { reported: "بلاغ جديد", withdrawn: "طُوي قيده", dismissed: "رُدّ البلاغ", returned: "عاد للدراسة" };
const pc = (v) => (v == null ? "—" : `${v}%`);
const docOf = (info) => ({ title: "التقرير الشهري لشؤون الطلاب", meta: [info.month, info.hijri], foot: "شؤون الطلاب" });

function highlights(d) {
  const a = d.attendance, out = [];
  if (!a.days) out.push("لم تُعتمد أيام حضور رسمية في هذا الشهر بعد.");
  else out.push(`نسبة الحضور الرسمية ${pc(a.pct)} في ${n(a.days)} يومًا دراسيًا معتمدًا.`);
  const best = [...a.grades].sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0))[0];
  if (best?.pct != null && a.grades.length > 1) out.push(`أعلى الصفوف حضورًا: ${GRADE_NAMES[best.g]} بنسبة ${pc(best.pct)}.`);
  const worstDay = [...a.weekdays].sort((x, y) => (y.rate ?? 0) - (x.rate ?? 0))[0];
  if (worstDay?.rate) out.push(`أعلى أيام الأسبوع غيابًا: ${WD[worstDay.w]} (${pc(worstDay.rate)}).`);
  if (a.repeat3) out.push(`طلاب تكرر غيابهم 3 أيام فأكثر: ${n(a.repeat3)}.`);
  if (d.fpOn && d.late.incidents) out.push(`حالات التأخر الصباحي: ${n(d.late.incidents)} لـ ${n(d.late.students)} طالبًا.`);
  if (d.warnings.total) out.push(`إنذارات غياب صدرت: ${n(d.warnings.total)}.`);
  if (d.referrals.total) out.push(`الإحالات: ${n(d.referrals.total)}، أُقفل منها ${n(d.referrals.closed)}.`);
  return out.slice(0, 6);
}

function StudentsTable({ list, unit }) {
  return list.length ? (
    <table className="mr-table">
      <thead><tr><th className="c" style={{ width: 24 }}>م</th><th>الطالب</th>
        <th className="c" style={{ width: 42 }}>الفصل</th><th className="c" style={{ width: 46 }}>{unit}</th></tr></thead>
      <tbody>{list.map((s, i) => (
        <tr key={i}><td className="c num">{i + 1}</td>
          <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>{s.name}</td>
          <td className="c num">{s.cls}</td><td className="c num">{s.days}</td></tr>
      ))}</tbody>
    </table>
  ) : <div className="mr-empty">لا طلاب.</div>;
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل */
export function affairsPages({ d, info, theme = "light", notes, sigs = {} }) {
  const a = d.attendance, l = d.late, doc = docOf(info);
  const common = { theme, doc, total: 4 };
  const trendSeries = [{ k: "pct", t: "نسبة الحضور الرسمية", c: S[0] }];
  return [
    <Cover key="cover" theme={theme} c={{
      year: info.year, tag: ["shield", "شؤون الطلاب"], title: "التقرير الشهري", sub: "لشؤون الطلاب",
      badge: { main: info.month, sub: "الشهر" }, side: { main: info.hijri, sub: info.termLabel },
      rows: [["user", "وكيل شؤون الطلاب", info.deputy || "—"], ["calendar", "الفترة", info.range],
             ["check", "الأيام المعتمدة", `${n(a.days)} يومًا دراسيًا`], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]],
      note: ["check", "الأرقام من الأيام المعتمدة في البوابة: الحضور الرسمي في الحصتين الأولى والثانية."],
      strip: [[pc(a.pct), "نسبة الحضور"], [a.absent, "غياب بدون عذر"], [d.fpOn ? l.incidents : "—", "حالة تأخر"], [d.referrals.total, "إحالة"]],
      foot: "شؤون الطلاب",
    }} />,

    <Page key="att" {...common} page={2} sec={{ no: 1, title: "الحضور والغياب", sub: "من الأيام المعتمدة في الشهر" }}>
      <Kpis items={[
        { ic: "check", t: "نسبة الحضور", v: pc(a.pct), s: `في ${a.days} يومًا معتمدًا`, c: S[0] },
        { ic: "alert", t: "غياب بدون عذر", v: a.absent, s: `بعذر ${n(a.excused)}`, c: S[3] },
        { ic: "users", t: "طلاب غابوا", v: a.students, s: `تكرر 3 أيام فأكثر ${a.repeat3}`, c: S[1] },
        { ic: "calendar", t: "أيام معتمدة", v: a.days, s: `لم يُحضَّر ${n(a.pending)} سجلًا`, c: S[2] },
      ]} />
      <Box icon="cap" title="نسبة الحضور لكل صف">
        <div className="mr-rings">
          <Ring value={a.pct == null ? null : Math.round(a.pct)} label="المدرسة" sub={`${n(a.present)} حضور`} color="var(--mr-deep)" />
          {[1, 2, 3].map((g, i) => {
            const x = a.grades.find((r) => r.g === g);
            return <Ring key={g} value={x?.pct == null ? null : Math.round(x.pct)} label={GRADE_NAMES[g]} sub={x ? `غياب ${n(x.absent)}` : "—"} color={S[i]} />;
          })}
        </div>
      </Box>
      <div className="mr-row c2">
        <Box icon="chart" title="الحضور في آخر ستة أشهر">
          <GroupedColumns width={320} height={170} current={d.month} series={trendSeries}
            cols={d.trend.map((t) => ({ key: t.key, label: t.label, values: { pct: t.pct ?? 0 } }))} />
          <Legend series={trendSeries} />
        </Box>
        <Box icon="calendar" title="الغياب حسب أيام الأسبوع" aside="نسبة الغياب بدون عذر">
          {a.weekdays.length ? <Bars items={a.weekdays.map((w) => ({ t: WD[w.w], v: w.rate ?? 0, note: pc(w.rate), c: S[3] }))} /> : <div className="mr-empty">لا أيام معتمدة.</div>}
        </Box>
      </div>
      <Highlights title="خلاصة الشهر" items={highlights(d)} />
    </Page>,

    <Page key="late" {...common} page={3} sec={{ no: 2, title: "التأخر الصباحي والإنذارات", sub: "التأخر من البصمة، وإنذارات الغياب الصادرة، والطلاب الأكثر غيابًا" }}>
      {d.fpOn ? (
        <Kpis items={[
          { ic: "clock", t: "حالات التأخر", v: l.incidents, s: `لـ ${n(l.students)} طالبًا`, c: S[2] },
          { ic: "users", t: "تأخروا 3 مرات فأكثر", v: l.repeat3, s: "الموقف الثالث في الإجراءات", c: S[3] },
          { ic: "hourglass", t: "مجموع الدقائق", v: l.minutes, s: l.incidents ? `متوسط ${Math.round(l.minutes / l.incidents)} دقيقة` : "—", c: S[1] },
          { ic: "alert", t: "إنذارات الغياب", v: d.warnings.total, s: "صدرت في الشهر", c: S[0] },
        ]} />
      ) : <Box icon="clock" title="التأخر الصباحي" tint><p className="mr-note" style={{ fontSize: 12 }}>البصمة مقفلة في البوابة، فلا يُحتسب التأخر الصباحي في هذا التقرير.</p></Box>}
      <div className="mr-row c2">
        <Box icon="alert" title="إنذارات الغياب" aside={n(d.warnings.total)}>
          <Bars items={WARNING_STAGES.map((s, i) => ({ t: s.label, v: d.warnings.byStage[s.key] ?? 0, c: [S[2], S[3], S[1]][i] }))} wide />
        </Box>
        <Box icon="cap" title="التأخر حسب الصف" aside={d.fpOn ? n(l.incidents) : "—"}>
          {d.fpOn ? <Bars items={[1, 2, 3].map((g) => ({ t: GRADE_NAMES[g], v: l.byGrade[g] ?? 0, c: S[2] }))} /> : <div className="mr-empty">البصمة مقفلة.</div>}
        </Box>
      </div>
      <div className="mr-row c2" style={{ alignItems: "start" }}>
        <Box icon="list" title="الأكثر غيابًا" aside="أيام بدون عذر"><StudentsTable list={a.top.slice(0, d.fpOn ? 10 : 14)} unit="الأيام" /></Box>
        {d.fpOn
          ? <Box icon="list" title="الأكثر تأخرًا" aside="مرات التأخر"><StudentsTable list={l.top} unit="المرات" /></Box>
          : <Box icon="calendar" title="الصفوف" aside="غياب بدون عذر"><Bars items={a.grades.map((x) => ({ t: GRADE_NAMES[x.g], v: x.absent, c: S[3] }))} /></Box>}
      </div>
    </Page>,

    <Page key="refs" {...common} page={4} sec={{ no: 3, title: "الإحالات والمنقطعون", sub: "الإحالات السلوكية وإحالات المعلمين، وبلاغات الانقطاع" }}>
      <Kpis items={[
        { ic: "arrow", t: "الإحالات", v: d.referrals.total, s: `أُقفلت ${n(d.referrals.closed)}`, c: S[1] },
        { ic: "user", t: "إحالات المعلمين", v: d.referrals.byKind.teacher ?? 0, s: "من الحصص", c: S[0] },
        { ic: "shield", t: "إحالات المخالفات", v: d.referrals.byKind.behavior ?? 0, s: "من الوكيل", c: S[3] },
        { ic: "exit", t: "بلاغات الانقطاع", v: d.dropouts.total, s: `طُوي قيد ${n(d.dropouts.byStatus.withdrawn ?? 0)}`, c: S[2] },
      ]} />
      <div className="mr-row c2">
        <Box icon="check" title="حالة الإحالات" aside={n(d.referrals.total)}>
          {d.referrals.total ? <Split parts={[{ t: "مُقفلة", v: d.referrals.closed, c: S[0] }, { t: "قيد المتابعة", v: d.referrals.total - d.referrals.closed, c: S[2] }]} /> : <div className="mr-empty">لا إحالات هذا الشهر.</div>}
          <div style={{ marginTop: 10 }}><Bars items={[1, 2, 3].map((g) => ({ t: GRADE_NAMES[g], v: d.referrals.byGrade[g] ?? 0, c: S[1] }))} /></div>
        </Box>
        <Box icon="exit" title="بلاغات الانقطاع" aside={n(d.dropouts.total)}>
          {d.dropouts.total ? <Bars items={Object.entries(DROP).map(([k, t]) => ({ t, v: d.dropouts.byStatus[k] ?? 0, c: S[2] }))} /> : <div className="mr-empty">لا بلاغات هذا الشهر.</div>}
        </Box>
      </div>
      <Box icon="pen" title="ملاحظات الوكيل وتوصياته" tint style={{ minHeight: 150, maxHeight: 300, overflow: "hidden" }}>
        {notes?.trim() ? <div className="mr-notes">{notes.trim()}</div> : <div className="mr-lines">{[0, 1, 2, 3].map((i) => <i key={i} />)}</div>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: "وكيل شؤون الطلاب", name: info.deputy, sig: sigs.deputy }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
}

