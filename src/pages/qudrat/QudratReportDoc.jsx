// src/pages/qudrat/QudratReportDoc.jsx
import { GRADE_NAMES } from "../../lib/schoolTime";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import { SECS, SKILLS } from "../../qudrat-content/index.js";
import {
  S, n, pct, countAr, Ring, Bars, GroupedColumns, Legend, Kpis, Highlights, Box, Signs, Page, Cover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   تقرير متابعة مركز التدريب (القدرات) بطقم التقارير (components/report)
   وبتصميم التقرير الشهري لشؤون الطلاب نفسه:
   الغلاف ← المشاركة والنشاط ← مستوى المهارات والاختبار المحاكي ← المتدربون
   ← أسئلة الطلاب وردود المعلمين، مع ملاحظات وكيل الشؤون التعليمية والتوقيعات.
   البيانات من qudrat_report (supabase/qudrat_6.sql).
   ===================================================================== */

const pc = (v) => (v == null ? "—" : `${v}%`);
const docOf = (info) => ({ title: "تقرير متابعة مركز التدريب (القدرات)", meta: [info.month, info.hijri], foot: "الشؤون التعليمية" });
const hrs = (h) => (h == null ? "—" : h < 1 ? "أقل من ساعة" : h < 24 ? countAr(Math.round(h), "hour")
  : Math.round(h / 24) === 1 ? "يوم واحد" : Math.round(h / 24) === 2 ? "يومان" : `${Math.round(h / 24)} أيام`);

function highlights(d) {
  const out = [], p = pct(d.correct, d.answers);
  if (!d.users) return ["لم يتدرب أحد في مركز التدريب خلال هذه الفترة."];
  out.push(`تدرّب ${countAr(d.users, "student")} وأجابوا عن ${n(d.answers)} سؤالًا، بنسبة صواب ${pc(p)}.`);
  const g = [...d.by_grade].filter((x) => x.students).sort((a, b) => b.users / b.students - a.users / a.students)[0];
  if (g?.users) out.push(`أعلى الصفوف مشاركة: ${GRADE_NAMES[g.g]} بنسبة ${pc(pct(g.users, g.students))} من طلابه.`);
  const sk = d.skills.filter((s) => SKILLS[s.skill] && s.answers >= 10).map((s) => ({ ...s, p: pct(s.correct, s.answers) })).sort((a, b) => a.p - b.p);
  if (sk[0]) out.push(`أضعف المهارات: ${SKILLS[sk[0].skill].t} (${pc(sk[0].p)})، وأقواها: ${SKILLS[sk.at(-1).skill].t} (${pc(sk.at(-1).p)}).`);
  if (d.mocks.n) out.push(`أُدّي ${n(d.mocks.n)} اختبارًا محاكيًا، بمتوسط ${pc(d.mocks.avg)} وأعلى نتيجة ${pc(d.mocks.best)}.`);
  if (d.asks.n) out.push(`سأل الطلاب معلميهم ${n(d.asks.n)} سؤالًا، رُدّ على ${n(d.asks.answered)} منها، ومتوسط زمن الرد ${hrs(d.asks.hrs)}.`);
  if (d.plans.soon) out.push(`طلاب اختبارهم خلال 30 يومًا: ${n(d.plans.soon)}.`);
  return out.slice(0, 6);
}

function StudentsTable({ list }) {
  return list.length ? (
    <table className="mr-table">
      <thead><tr><th className="c" style={{ width: 24 }}>م</th><th>الطالب</th>
        <th className="c" style={{ width: 54 }}>الصف</th><th className="c" style={{ width: 52 }}>الإجابات</th>
        <th className="c" style={{ width: 48 }}>الصواب</th><th className="c" style={{ width: 44 }}>الأيام</th></tr></thead>
      <tbody>{list.map((s, i) => (
        <tr key={i}><td className="c num">{i + 1}</td>
          <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>{s.full_name ?? "حساب غير طالب"}</td>
          <td className="c num">{s.grade ? `${s.grade}/${s.class_no}` : "—"}</td>
          <td className="c num">{n(s.n)}</td><td className="c num">{s.p}%</td><td className="c num">{s.days}</td></tr>
      ))}</tbody>
    </table>
  ) : <div className="mr-empty">لا طلاب.</div>;
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل */
export function qudratPages({ d, info, theme = "light", notes, sigs = {} }) {
  const doc = docOf(info), total = 5;
  const common = { theme, doc, total };
  const p = pct(d.correct, d.answers);
  const enrolled = d.by_grade.reduce((x, g) => x + g.students, 0);
  const skills = d.skills.filter((s) => SKILLS[s.skill]).map((s) => ({ ...s, p: pct(s.correct, s.answers) ?? 0 }));
  const weekSeries = [{ k: "users", t: "المتدربون", c: S[0] }];
  const wk = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

  return [
    <Cover key="cover" theme={theme} c={{
      year: info.year, tag: ["award", "الشؤون التعليمية"], title: "تقرير متابعة", sub: "مركز التدريب (القدرات العامة)",
      badge: { main: info.month, sub: "الشهر" }, side: { main: info.hijri, sub: info.termLabel },
      rows: [["user", "وكيل الشؤون التعليمية", info.deputy || "—"], ["calendar", "الفترة", info.range],
             ["users", "المتدربون", countAr(d.users, "student")], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]],
      note: ["check", "الأرقام من سجل تدريب الطلاب في البوابة: إجاباتهم، واختباراتهم المحاكية، وأسئلتهم لمعلميهم."],
      strip: [[n(d.users), "متدربًا"], [n(d.answers), "إجابة"], [pc(p), "نسبة الصواب"], [n(d.mocks.n), "اختبارًا محاكيًا"]],
      foot: "الشؤون التعليمية",
    }} />,

    <Page key="act" {...common} page={2} sec={{ no: 1, title: "المشاركة والنشاط", sub: "من تدرّب، وكم، ومتى" }}>
      <Kpis items={[
        { ic: "users", t: "المتدربون", v: n(d.users), s: `من ${n(enrolled)} طالبًا (${pc(pct(d.users, enrolled))})`, c: S[0] },
        { ic: "check", t: "الإجابات", v: n(d.answers), s: `صحيح ${n(d.correct)}`, c: S[1] },
        { ic: "chart", t: "نسبة الصواب", v: pc(p), s: "لكل الإجابات", c: S[2] },
        { ic: "calendar", t: "أيام التدريب", v: d.active_days ?? "—", s: "متوسط الطالب في الفترة", c: S[3] },
      ]} />
      <Box icon="cap" title="نسبة المشاركة لكل صف" aside="من طلاب الصف">
        <div className="mr-rings">
          <Ring value={pct(d.users, enrolled)} label="المدرسة" sub={`${n(d.users)} متدربًا`} color="var(--mr-deep)" />
          {[1, 2, 3].map((g, i) => {
            const x = d.by_grade.find((r) => r.g === g);
            return <Ring key={g} value={x ? pct(x.users, x.students) : null} label={GRADE_NAMES[g]}
                         sub={x ? `صواب ${pc(pct(x.correct, x.answers))}` : "—"} color={S[i]} />;
          })}
        </div>
      </Box>
      <div className="mr-row c2">
        <Box icon="users" title="المتدربون كل أسبوع" aside="بداية الأسبوع">
          {d.weeks.length ? (
            <>
              <GroupedColumns width={320} height={170} series={weekSeries}
                cols={d.weeks.map((w) => ({ key: w.wk, label: wk(w.wk), values: { users: w.users } }))} />
              <Legend series={weekSeries} />
            </>
          ) : <div className="mr-empty">لا نشاط في هذه الفترة.</div>}
        </Box>
        <Box icon="chart" title="الإجابات كل أسبوع" aside="بداية الأسبوع">
          {d.weeks.length
            ? <Bars items={d.weeks.map((w) => ({ t: `أسبوع ${wk(w.wk)}`, v: w.answers, c: S[1] }))} />
            : <div className="mr-empty">لا نشاط في هذه الفترة.</div>}
        </Box>
      </div>
      <Highlights title="خلاصة الفترة" items={highlights(d)} />
    </Page>,

    <Page key="skills" {...common} page={3} sec={{ no: 2, title: "مستوى المهارات والاختبار المحاكي", sub: "نسبة الصواب في كل مهارة، ونتائج الاختبارات المحاكية" }}>
      <div className="mr-row c2" style={{ alignItems: "start" }}>
        {Object.entries(SECS).map(([sec, Sx], i) => (
          <Box key={sec} icon="chart" title={`القسم ${Sx.t}`} aside="نسبة الصواب">
            {skills.some((s) => s.sec === sec)
              ? <Bars wide items={skills.filter((s) => s.sec === sec).sort((a, b) => a.p - b.p)
                  .map((s) => ({ t: SKILLS[s.skill].t, v: s.p, note: `${s.p}%`, c: S[i] }))} max={100} />
              : <div className="mr-empty">لا إجابات.</div>}
          </Box>
        ))}
      </div>
      <Kpis items={[
        { ic: "clock", t: "اختبارات محاكية", v: n(d.mocks.n), s: `أدّاها ${n(d.mocks.users)} طالبًا`, c: S[0] },
        { ic: "chart", t: "متوسط النتيجة", v: pc(d.mocks.avg), s: `أعلى نتيجة ${pc(d.mocks.best)}`, c: S[1] },
        { ic: "check", t: "متوسط الكمي", v: pc(d.mocks.quant), s: "في المحاكاة", c: S[2] },
        { ic: "check", t: "متوسط اللفظي", v: pc(d.mocks.verbal), s: "في المحاكاة", c: S[3] },
      ]} />
      <Box icon="calendar" title="خطط الطلاب" tint>
        <p className="mr-note" style={{ fontSize: 12.5 }}>
          طلاب حددوا موعد اختبارهم وبُنيت لهم خطة يومية: <b className="num">{n(d.plans.n)}</b>،
          منهم <b className="num">{n(d.plans.soon)}</b> اختبارهم خلال 30 يومًا. وأسئلة المعلمين المنشورة في البنك: <b className="num">{n(d.tq)}</b>.
        </p>
      </Box>
    </Page>,

    <Page key="students" {...common} page={4} sec={{ no: 3, title: "المتدربون", sub: "الأكثر تدريبًا، ومن يحتاج دعمًا (أقل نسبة صواب لمن أجاب عن 20 سؤالًا فأكثر)" }}>
      <Box icon="award" title="الأكثر تدريبًا" aside="عدد الإجابات"><StudentsTable list={d.top} /></Box>
      <Box icon="alert" title="يحتاجون دعمًا" aside="الأقل صوابًا"><StudentsTable list={d.support} /></Box>
    </Page>,

    <Page key="asks" {...common} page={5} sec={{ no: 4, title: "أسئلة الطلاب وردود المعلمين", sub: "«اسأل معلمك»: الكمي لمعلم الرياضيات، واللفظي لمعلم اللغة العربية" }}>
      <Kpis items={[
        { ic: "users", t: "أسئلة الطلاب", v: n(d.asks.n), s: "في الفترة", c: S[0] },
        { ic: "check", t: "تم الرد", v: n(d.asks.answered), s: `بانتظار الرد ${n(d.asks.n - d.asks.answered)}`, c: S[1] },
        { ic: "clock", t: "متوسط زمن الرد", v: hrs(d.asks.hrs), s: "من السؤال إلى الرد", c: S[2] },
        { ic: "pen", t: "ردود صوتية", v: n(d.asks.voice), s: "سجّلها المعلمون", c: S[3] },
      ]} />
      <Box icon="list" title="الأسئلة حسب المعلم" aside="الأسئلة · الردود · زمن الرد">
        {d.asks.teachers.length ? (
          <table className="mr-table">
            <thead><tr><th>المعلم</th><th className="c" style={{ width: 60 }}>الأسئلة</th><th className="c" style={{ width: 60 }}>الردود</th><th className="c" style={{ width: 90 }}>زمن الرد</th></tr></thead>
            <tbody>{d.asks.teachers.map((t, i) => (
              <tr key={i}><td>{t.name}</td><td className="c num">{t.n}</td><td className="c num">{t.answered}</td><td className="c">{hrs(t.hrs)}</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="mr-empty">لا أسئلة في هذه الفترة.</div>}
      </Box>
      <Box icon="pen" title="ملاحظات وكيل الشؤون التعليمية وتوصياته" tint style={{ minHeight: 150, maxHeight: 300, overflow: "hidden" }}>
        {notes?.trim() ? <div className="mr-notes">{notes.trim()}</div> : <div className="mr-lines">{[0, 1, 2, 3].map((i) => <i key={i} />)}</div>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: "وكيل الشؤون التعليمية", name: info.deputy, sig: sigs.deputy }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
}
