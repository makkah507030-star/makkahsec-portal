// src/pages/student-affairs/DisciplineReport.jsx
// تقرير الانضباط لكل صف بطقم تقارير البوابة: نسب الانتظام والانضباط في الصف وفصوله، وتوزيع الطلاب بأيام الغياب
// ومرات التأخر، وترتيب الفصول، ثم سجل الطلاب المنضبطين والمنتظمين. البيانات من src/lib/regulars.js.
import { useEffect, useMemo, useState } from "react";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import { gradeCounselor } from "../../lib/deputyReferral";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { n, pct, dmy, paginate, Box, Signs, Page, Kpis, Bars, Split, Highlights, S } from "../../components/report/ReportKit.jsx";
import { TERM_LABEL } from "../studio/lib";

const GRADE = { 1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي" };
const C = { clean: "#4E7D66", reg: "#7FB59A", near: "#C9A23A", mid: "#C47F3A", high: "#A23B3B" };
const cleanName = (x) => String(x ?? "").replace(/(^|\s)-(?=\s|$)/g, "").replace(/\s+/g, " ").trim();
const ABS_BANDS = [["بلا غياب", (a) => a === 0, C.clean], ["يوم أو يومان", (a) => a >= 1 && a <= 2, C.near],
  ["3 إلى 5 أيام", (a) => a >= 3 && a <= 5, C.mid], ["6 أيام فأكثر", (a) => a >= 6, C.high]];
const LATE_BANDS = [["بلا تأخر", (x) => x === 0, C.clean], ["مرة أو مرتان", (x) => x >= 1 && x <= 2, C.near],
  ["3 إلى 5", (x) => x >= 3 && x <= 5, C.mid], ["6 فأكثر", (x) => x >= 6, C.high]];

function pages({ data, g, theme, sigs, counselor }) {
  const doc = { title: `تقرير الانضباط — ${GRADE[g]}`, meta: [TERM_LABEL[data.term], `${data.days} يومًا معتمدًا`], foot: "تقرير الانضباط" };
  const all = data.all.filter((s) => s.grade === g);
  const reg = all.filter((s) => s.abs === 0), clean = reg.filter((s) => s.late === 0);
  const near = all.filter((s) => s.abs >= 1 && s.abs <= 2);
  const absTotal = all.reduce((a, s) => a + s.abs, 0);
  const avgAbs = all.length ? Math.round((absTotal / all.length) * 10) / 10 : 0;
  const classes = [...new Set(all.map((s) => s.class_no))].sort((a, b) => a - b).map((c) => {
    const st = all.filter((s) => s.class_no === c), r = st.filter((s) => s.abs === 0), cl = r.filter((s) => s.late === 0);
    const ab = st.reduce((a, s) => a + s.abs, 0);
    return { c, n: st.length, reg: r.length, clean: cl.length, near: st.filter((s) => s.abs >= 1 && s.abs <= 2).length,
             abs: ab, avg: st.length ? Math.round((ab / st.length) * 10) / 10 : 0, p: pct(r.length, st.length) ?? 0, pc: pct(cl.length, st.length) ?? 0 };
  });
  const ranked = [...classes].sort((a, b) => b.p - a.p || b.pc - a.pc || a.avg - b.avg);
  ranked.forEach((x, i) => { x.rank = i + 1; });
  const best = ranked[0], worst = ranked[ranked.length - 1];
  const lateOfReg = LATE_BANDS.map(([t, f, c]) => ({ t, v: reg.filter((s) => f(s.late)).length, c }));

  const high = [
    `من ${n(all.length)} طالبًا في ${GRADE[g]}، لم يغب ${n(reg.length)} (${pct(reg.length, all.length) ?? 0}%) أي يوم في ${n(data.days)} يومًا معتمدًا، ومنهم ${n(clean.length)} (${pct(clean.length, all.length) ?? 0}%) بلا تأخر أيضًا.`,
    near.length ? `${n(near.length)} طالبًا غابوا يومًا أو يومين فقط، وهم الأقرب إلى الانتظام التام.` : null,
    best ? `أعلى الفصول انتظامًا ${best.c} (${best.p}%)${worst && worst.c !== best.c ? `، وأقلها ${worst.c} (${worst.p}%)` : ""}.` : null,
    `متوسط أيام الغياب للطالب ${avgAbs} يومًا في الفترة.`,
  ].filter(Boolean);

  const regList = [...reg].sort((a, b) => a.class_no - b.class_no || a.late - b.late || cleanName(a.full_name).localeCompare(cleanName(b.full_name), "ar"));
  const chunks = regList.length ? paginate(regList, (s) => (cleanName(s.full_name).length > 30 ? 2 : 1), 28, 34) : [];
  const total = 2 + chunks.length;
  const signs = <Signs stamp={sigs.stamp} people={[{ title: `موجه ${GRADE[g]}`, name: counselor?.name, sig: sigs.counselor },
                                                      { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />;

  return [
    <Page key="p1" theme={theme} doc={doc} page={1} total={total}
          sec={{ no: 1, title: "ملخص الانضباط", sub: `${GRADE[g]} · ${data.from ? `${dmy(data.from)} — ${dmy(data.to)}` : TERM_LABEL[data.term]}` }}>
      <Kpis items={[
        { ic: "users", t: "طلاب الصف", v: all.length, s: `${classes.length} فصول` },
        { ic: "check", t: "بلا غياب", v: reg.length, s: `${pct(reg.length, all.length) ?? 0}% من الطلاب`, c: C.reg },
        { ic: "check", t: "بلا غياب ولا تأخر", v: clean.length, s: `${pct(clean.length, all.length) ?? 0}% من الطلاب`, c: C.clean },
        { ic: "chart", t: "متوسط أيام الغياب", v: String(avgAbs), s: "للطالب في الفترة", c: C.mid },
      ]} />
      <Box icon="users" title="الطلاب بأيام الغياب">
        <Split parts={ABS_BANDS.map(([t, f, c]) => ({ t, v: all.filter((s) => f(s.abs)).length, c }))} />
      </Box>
      <div className="mr-row c2">
        <Box icon="chart" title="الانتظام بالفصل" aside="بلا غياب">
          <Bars items={classes.map((x) => ({ t: String(x.c), v: x.p, note: `${x.p}%`, c: C.reg }))} max={100} wide />
        </Box>
        <Box icon="chart" title="الانضباط بالفصل" aside="بلا غياب ولا تأخر">
          <Bars items={classes.map((x) => ({ t: String(x.c), v: x.pc, note: `${x.pc}%`, c: C.clean }))} max={100} wide />
        </Box>
      </div>
      <Highlights items={high} />
    </Page>,
    <Page key="p2" theme={theme} doc={doc} page={2} total={total} sec={{ no: 2, title: "الفصول مرتبة بالانتظام" }}>
      <table className="mr-table" style={{ fontSize: 11 }}>
        <thead><tr><th className="c">الترتيب</th><th className="c">الفصل</th><th className="c">الطلاب</th><th className="c">بلا غياب</th><th className="c">النسبة</th>
          <th className="c">بلا غياب ولا تأخر</th><th className="c">النسبة</th><th className="c">غاب يومًا أو يومين</th><th className="c">أيام الغياب</th><th className="c">المتوسط</th></tr></thead>
        <tbody>{ranked.map((x) => (
          <tr key={x.c}>
            <td className="c num">{x.rank}</td><td className="c num" style={{ fontWeight: 700 }}>{x.c}</td><td className="c num">{x.n}</td>
            <td className="c num">{x.reg}</td><td className="c num" style={{ color: C.reg, fontWeight: 700 }}>{x.p}%</td>
            <td className="c num">{x.clean}</td><td className="c num" style={{ color: C.clean, fontWeight: 700 }}>{x.pc}%</td>
            <td className="c num">{x.near}</td><td className="c num">{x.abs}</td><td className="c num">{x.avg}</td>
          </tr>))}
          <tr style={{ fontWeight: 700 }}>
            <td className="c" colSpan={2}>الصف</td><td className="c num">{all.length}</td><td className="c num">{reg.length}</td>
            <td className="c num">{pct(reg.length, all.length) ?? 0}%</td><td className="c num">{clean.length}</td><td className="c num">{pct(clean.length, all.length) ?? 0}%</td>
            <td className="c num">{near.length}</td><td className="c num">{absTotal}</td><td className="c num">{avgAbs}</td>
          </tr>
        </tbody>
      </table>
      <div className="mr-row c2">
        <Box icon="alert" title="التأخر الصباحي بين من لم يغيبوا">
          <Bars items={lateOfReg} wide />
        </Box>
        <Box icon="users" title="القريبون من الانتظام بالفصل" aside="غاب يومًا أو يومين">
          <Bars items={classes.map((x) => ({ t: String(x.c), v: x.near, c: C.near }))} wide />
        </Box>
      </div>
      {!chunks.length && signs}
    </Page>,
    ...chunks.map((chunk, i) => (
      <Page key={`t${i}`} theme={theme} doc={doc} page={3 + i} total={total}
            sec={i === 0 ? { no: 3, title: "الطلاب بلا غياب", sub: `${n(reg.length)} طالبًا، منهم ${n(clean.length)} بلا تأخر` } : { no: 3, title: "الطلاب بلا غياب (تتمة)" }}>
        <table className="mr-table" style={{ fontSize: 11 }}>
          <thead><tr><th className="c">#</th><th>اسم الطالب</th><th className="c">الفصل</th><th className="c">مرات التأخر</th><th className="c">الحالة</th></tr></thead>
          <tbody>{chunk.map((s) => (
            <tr key={s.student_id}>
              <td className="c num">{regList.indexOf(s) + 1}</td><td>{cleanName(s.full_name)}</td><td className="c num">{s.class_no}</td>
              <td className="c num">{s.late || "—"}</td>
              <td className="c" style={{ color: s.late ? C.near : C.clean, fontWeight: 600 }}>{s.late ? "منتظم" : "منضبط"}</td>
            </tr>))}</tbody>
        </table>
        {i === chunks.length - 1 && signs}
      </Page>
    )),
  ];
}

export default function DisciplineReport({ data, grades, onBack }) {
  const [theme, setTheme] = useState("light");
  const [g, setG] = useState(grades[0]);
  const [counselor, setCounselor] = useState(null);
  const [sigs, setSigs] = useState({ counselor: null, principal: null, stamp: null });
  useEffect(() => {
    Promise.all([loadPrincipalSignature(), loadSchoolStamp()]).then(([p, s]) => setSigs((x) => ({ ...x, principal: p?.url ?? null, stamp: s })));
  }, []);
  useEffect(() => {
    let live = true;
    gradeCounselor(g).then(async (c) => {
      const sig = c?.name ? await signatureByName(c.name) : null;
      if (live) { setCounselor(c); setSigs((x) => ({ ...x, counselor: sig })); }
    });
    return () => { live = false; };
  }, [g]);
  const pg = useMemo(() => pages({ data, g, theme, sigs, counselor }), [data, g, theme, sigs, counselor]);
  return (
    <ReportViewer id="discipline-report-print" pages={pg} theme={theme} setTheme={setTheme} fileTitle={`تقرير الانضباط - ${GRADE[g]}`}
      controls={<>
        <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع</button>
        {grades.length > 1 && (
          <select className="field py-1 text-xs" value={g} onChange={(e) => setG(Number(e.target.value))}>
            {grades.map((x) => <option key={x} value={x}>{GRADE[x]}</option>)}
          </select>
        )}
      </>} />
  );
}
