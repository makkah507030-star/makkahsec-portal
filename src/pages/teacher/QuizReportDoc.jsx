// src/pages/teacher/QuizReportDoc.jsx
import { fmtDate } from "../../lib/dates";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import {
  S, n, countAr, pct, Ring, Bars, Kpis, Highlights, Box, Signs, Page, Cover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   تقرير تحليل نتائج الاختبارات للمعلم بطقم التقارير (components/report).
   يأخذ ما حسبته صفحة «تحليل النتائج» (QuizAnalytics.jsx) للنطاق المختار:
   الغلاف ← ملخص النتائج (المؤشرات، والتوزيع، ومتوسط كل اختبار) ← الفصول
   وتحليل الفقرات ← المتفوقون ومن يحتاجون دعمًا ثم التوقيعات.
   ===================================================================== */

const p1 = (v) => (v == null ? "—" : `${Math.round(v * 10) / 10}%`);

function highlights({ kpi, perQuiz, perClass, items, support }) {
  const out = [];
  if (!kpi.sheets) return ["لا درجات مرصودة في هذا النطاق بعد."];
  out.push(`متوسط الأداء ${p1(kpi.avg)}: الاختبارات ${n(kpi.quizzes)}، والطلاب ${n(kpi.students)}.`);
  out.push(`نسبة التفوق (90٪ فأكثر): ${kpi.excel}% من أوراق الإجابة.`);
  const best = [...perQuiz].sort((a, b) => b.value - a.value)[0];
  if (best && perQuiz.length > 1) out.push(`أعلى الاختبارات متوسطًا: «${best.label}» (${p1(best.value)}).`);
  const bc = [...perClass].sort((a, b) => b.value - a.value)[0];
  if (bc && perClass.length > 1) out.push(`أعلى الفصول متوسطًا: ${bc.label} (${p1(bc.value)}).`);
  const hard = items.filter((x) => x.value < 50).length;
  if (items.length) out.push(`فقرات صعبة أجاب عنها أقل من نصف الطلاب: ${n(hard)} من ${n(items.length)}.`);
  if (support.length) out.push(`طلاب يحتاجون دعمًا (متوسطهم دون 60٪): ${n(support.length)}.`);
  return out.slice(0, 6);
}

function StudentTable({ list, classes }) {
  return list.length ? (
    <table className="mr-table">
      <thead><tr><th className="c" style={{ width: 24 }}>م</th><th>الطالب</th><th className="c" style={{ width: 46 }}>الفصل</th><th className="c" style={{ width: 56 }}>المتوسط</th></tr></thead>
      <tbody>{list.map((s, i) => (
        <tr key={s.id}><td className="c num">{i + 1}</td>
          <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>{s.name}</td>
          <td className="c num">{classes[s.cls]?.class_no ?? "—"}</td><td className="c num">{p1(s.avg)}</td></tr>
      ))}</tbody>
    </table>
  ) : <div className="mr-empty">لا طلاب.</div>;
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل
 *  r: { kpi, perQuiz, dist, perClass, items, one, top, support, classes } من صفحة التحليل */
export function quizReportPages({ r, teacher, scopeLine, year, term, theme = "light", sigs = {} }) {
  const doc = { title: "تحليل نتائج الاختبارات", meta: [teacher, scopeLine || term], foot: "تحليل النتائج" };
  const { kpi, perQuiz, dist, perClass, items, one, top, support, classes } = r;
  const common = { theme, doc, total: 4 };
  const distTotal = dist.reduce((a, b) => a + b.n, 0);
  const attend = kpi.sheets + kpi.absent;
  return [
    <Cover key="cover" theme={theme} c={{
      year, tag: ["chart", "تحليل النتائج"], title: "تحليل نتائج", sub: `الاختبارات · ${teacher}`, titleSize: 86,
      badge: { main: p1(kpi.avg), sub: "متوسط الأداء" }, side: { main: `${kpi.excel}% تفوق`, sub: "أوراق 90٪ فأكثر" },
      rows: [["user", "المعلم", teacher || "—"], ["book", "النطاق", scopeLine || "كل الاختبارات في الفصل الدراسي"],
             ["table", "الفصول", countAr(perClass.length, "cls")], ["calendar", "الفصل الدراسي", `${term} · ${fmtDate(new Date())}`]],
      note: ["check", "اختبارات المعلم المنفّذة عبر البوابة: الورقية والمصحّحة آليًا والإلكترونية."],
      strip: [[kpi.quizzes, "الاختبارات"], [kpi.students, "الطلاب"], [p1(kpi.avg), "متوسط الأداء"], [`${kpi.excel}%`, "نسبة التفوق"]],
      foot: "تحليل النتائج",
    }} />,

    <Page key="sum" {...common} page={2} sec={{ no: 1, title: "ملخص النتائج", sub: "المؤشرات وتوزيع الدرجات ومتوسط كل اختبار" }}>
      <Kpis items={[
        { ic: "doc", t: "الاختبارات", v: kpi.quizzes, s: `أوراق الإجابة ${n(kpi.sheets)}`, c: S[0] },
        { ic: "users", t: "الطلاب", v: kpi.students, s: `غياب ${n(kpi.absent)}`, c: S[1] },
        { ic: "chart", t: "متوسط الأداء", v: p1(kpi.avg), s: "من الدرجة الكلية", c: S[2] },
        { ic: "trophy", t: "نسبة التفوق", v: `${kpi.excel}%`, s: "أوراق 90٪ فأكثر", c: S[3] },
      ]} />
      <Box icon="trophy" title="مؤشرات الأداء">
        <div className="mr-rings">
          <Ring value={Math.round(kpi.avg)} label="متوسط الأداء" sub={`أوراق الإجابة ${n(kpi.sheets)}`} color={S[0]} />
          <Ring value={kpi.excel} label="التفوق" sub="90٪ فأكثر" color={S[1]} />
          <Ring value={pct(kpi.students - support.length, kpi.students)} label="فوق حد الدعم" sub={`${n(kpi.students - support.length)} من ${n(kpi.students)}`} color={S[2]} />
          <Ring value={pct(kpi.sheets, attend)} label="حضور الاختبارات" sub={`${n(kpi.sheets)} من ${n(attend)}`} color={S[3]} />
        </div>
      </Box>
      <div className="mr-row c2">
        <Box icon="chart" title="توزيع الدرجات" aside={countAr(distTotal, "sheet")}>
          <Bars items={[...dist].reverse().map((b) => ({ t: b.excel ? `${b.t} (تفوق)` : b.t, v: b.n, c: b.c, note: `${pct(b.n, distTotal) ?? 0}%` }))} />
        </Box>
        <Box icon="list" title="متوسط كل اختبار" aside={`${n(perQuiz.length)}`}>
          {perQuiz.length ? <Bars max={100} items={perQuiz.slice(0, 9).map((q) => ({ t: q.label, v: q.value, note: p1(q.value), c: S[0] }))} /> : <div className="mr-empty">لا اختبارات.</div>}
        </Box>
      </div>
      <Highlights title="خلاصة النتائج" items={highlights(r)} />
    </Page>,

    <Page key="cls" {...common} page={3} sec={{ no: 2, title: "الفصول والفقرات", sub: one ? `مقارنة الفصول، وتحليل فقرات «${one.title}»` : "مقارنة الفصول بمتوسطها ونسبة تفوقها" }}>
      <Box icon="table" title="مقارنة الفصول" aside="المتوسط · التفوق">
        {perClass.length ? <Bars wide max={100} items={perClass.map((c) => ({ t: c.label, v: c.value, c: S[1], note: `${p1(c.value)}` }))} /> : <div className="mr-empty">لا فصول.</div>}
        {perClass.length > 0 && (
          <div className="mr-tiles" style={{ gridTemplateColumns: `repeat(${Math.min(perClass.length, 6)}, 1fr)`, marginTop: 10 }}>
            {perClass.slice(0, 6).map((c) => <div key={c.id} className="mr-tile"><b className="num" style={{ fontSize: 20 }}>{c.excel}%</b><span>تفوق · {c.label}</span></div>)}
          </div>
        )}
      </Box>
      <Box icon="grid" title="تحليل الفقرات" aside={one ? "نسبة الإجابة الصحيحة لكل فقرة" : "اختر اختبارًا واحدًا مصحّحًا آليًا"}>
        {items.length ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px 18px" }}>
              {items.slice(0, 30).map((x) => (
                <div key={x.id} className="mr-bar" style={{ gridTemplateColumns: "40px 1fr 44px" }}>
                  <span className="t num" style={{ fontWeight: 700 }}>{x.label}</span>
                  <span className="tr"><i style={{ width: `${x.value}%`, "--c": x.value < 50 ? "var(--s4)" : "var(--s1)" }} /></span>
                  <span className="n num" style={{ color: x.value < 50 ? "#B4506A" : undefined }}>{x.value}%{x.value < 50 ? " ▲" : ""}</span>
                </div>
              ))}
            </div>
            <p className="mr-note" style={{ marginTop: 6 }}>▲ فقرة صعبة: أجاب عنها صحيحًا أقل من نصف الطلاب، وتستحق إعادة التدريس.</p>
          </>
        ) : <div className="mr-empty">{one ? "لا إجابات مصحّحة آليًا لهذا الاختبار." : "يظهر تحليل الفقرات حين يُختار اختبار واحد مصحّح آليًا أو إلكتروني."}</div>}
      </Box>
    </Page>,

    <Page key="stu" {...common} page={4} sec={{ no: 3, title: "المتفوقون ومن يحتاجون دعمًا", sub: "متوسط كل طالب عبر اختبارات النطاق" }}>
      <div className="mr-row c2" style={{ alignItems: "start" }}>
        <Box icon="trophy" title="المتفوقون" aside="90٪ فأكثر"><StudentTable list={top} classes={classes} /></Box>
        <Box icon="alert" title="يحتاجون دعمًا" aside="أقل من 60٪"><StudentTable list={support} classes={classes} /></Box>
      </div>
      <Box icon="pen" title="التوصيات" tint style={{ minHeight: 140 }}>
        <ul className="mr-points" style={{ listStyle: "none", display: "grid", gap: 6, fontSize: 12.5, lineHeight: 1.7 }}>
          {items.some((x) => x.value < 50) && <li>• إعادة تدريس مهارات الفقرات الصعبة وتقويمها بأسئلة علاجية.</li>}
          {support.length > 0 && <li>• خطة علاجية لمن يحتاجون دعمًا، ومتابعتها في دورة الاختبار.</li>}
          {top.length > 0 && <li>• خطة إثرائية للمتفوقين وتكريمهم.</li>}
          <li>• مشاركة نتائج التحليل مع أولياء الأمور من البوابة.</li>
        </ul>
      </Box>
      <Signs showStamp={false} people={[{ title: "المعلم", name: teacher, sig: sigs.teacher }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
}
