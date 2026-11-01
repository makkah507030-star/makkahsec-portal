// src/pages/achievement/AchReportDoc.jsx
import { fmtDate } from "../../lib/dates";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { cmpAr } from "../../lib/sortAr.js";
import { PRINCIPAL_NAME, ACADEMIC_DEPUTY_NAME } from "../../lib/exportUtils";
import { stats, groupBy, studentSummaries, weakTeachers, BANDS, bandOf, SEV, KIND_T, WEAK, noticeTitle } from "../../lib/achievement";
import { FORM_STATUS, isOverdue } from "../../lib/achForms";
import {
  S, n, countAr, pct, dmy, paginate, Ring, Donut, DonutLegend, Bars, Split, Kpis, Highlights, Box, Signs, Page, Cover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   تقرير متابعة التحصيل الدراسي لوكيل الشؤون التعليمية بطقم التقارير (components/report):
   الغلاف ← ملخص النتائج ← المواد الدراسية ← الملاحظات الآلية ← نماذج الملاحظة
   والخطط العلاجية ← التوصيات والاعتماد. يأخذ ما في مركز تحليل النتائج للإشعار المختار
   ونطاقه (الصف والمادة)، وتنقسم الجداول الطويلة على صفحات.
   • تقرير الصف (counselor): باسم الصف لا الموجه، لطلاب صف الموجه وحده، ويُضاف قسم «الطلاب» بأسماء المتعثرين
     ومواد ضعفهم والمتفوقين ومتوسط كل فصل، وتوقّعها الموجه ووكيل الشؤون التعليمية.
   ===================================================================== */

// النسبة معزولة الاتجاه (LRI…PDI) فلا تنقلب علامة % أول السطر العربي
const p1 = (v) => (v == null ? "—" : `\u2066${Math.round(v * 10) / 10}%\u2069`);
const gShort = (g) => GRADE_NAMES[g]?.split(" ")[0] ?? "";
const ROWS = 26;   // صفوف الجدول في الصفحة الكاملة
const SUBJ_ONE = 14;   // حتى هذا العدد من المواد: الرسم والجدول في صفحة واحدة

function Chip({ c, bg, children }) {
  return <span className="mr-chip" style={{ color: c, background: bg }}>{children}</span>;
}

function summary(recs, checks, forms) {
  const st = stats(recs);
  const subjects = [...groupBy(recs, (r) => r.subject)].map(([sub, rs]) => {
    const s = stats(rs);
    const cs = checks.filter((c) => c.subject === sub);
    return { sub, ...s, crit: cs.filter((c) => c.sev === "critical").length, warn: cs.filter((c) => c.sev === "warning").length,
             forms: forms.filter((f) => f.subject === sub).length };
  }).filter((x) => x.n).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || cmpAr(a.sub, b.sub));
  const grades = [...groupBy(recs, (r) => r.grade)].map(([g, rs]) => ({ g, ...stats(rs) })).sort((a, b) => a.g - b.g);
  const pairs = groupBy(recs, (r) => `${r.class_id}|${r.subject}`).size;
  const incomplete = checks.filter((c) => c.kind === "incomplete").length;
  const students = new Set(recs.filter((r) => r.testPct != null).map((r) => r.sid)).size;
  const classes = new Set(recs.map((r) => r.class_id)).size;
  const by = (k) => forms.filter((f) => f.status === k).length;
  const fs = {
    total: forms.length, draft: by("draft"), waiting: by("sent") + by("returned"), replied: by("replied"), forwarded: by("forwarded"),
    approved: by("approved"), excluded: by("excluded"), overdue: forms.filter(isOverdue).length,
    guardians: forms.reduce((a, f) => a + (f.guardians_notified ?? 0), 0),
    students: forms.reduce((a, f) => a + f.classes.reduce((b, c) => b + c.students.length, 0), 0),
  };
  const sev = Object.fromEntries(Object.keys(SEV).map((k) => [k, checks.filter((c) => c.sev === k).length]));
  const teachers = new Set(weakTeachers(checks).map((x) => x.teacher.teacher_id)).size;
  return { st, subjects, grades, pairs, incomplete, students, classes, fs, sev, teachers };
}

function highlights(x) {
  const { st, subjects, grades, sev, fs, incomplete } = x;
  const out = [];
  out.push(`متوسط الطلاب في الاختبارات ${p1(st.avg)}، وبلغ 90% فأكثر ${p1(st.exPct)} من الدرجات، ونزل دون ${WEAK}% ${p1(st.weakPct)}.`);
  if (subjects.length > 1) {
    out.push(`أعلى المواد متوسطًا: ${subjects[0].sub} (${p1(subjects[0].avg)})، وأدناها: ${subjects.at(-1).sub} (${p1(subjects.at(-1).avg)}).`);
  }
  if (grades.length > 1) {
    const g = [...grades].sort((a, b) => b.avg - a.avg);
    out.push(`أعلى الصفوف متوسطًا: ${GRADE_NAMES[g[0].g]} (${p1(g[0].avg)}).`);
  }
  if (sev.critical) out.push(`رصد الفحص الآلي ${countAr(sev.critical, "case")} حرجة و${countAr(sev.warning, "case")} تستدعي التنبيه.`);
  if (fs.total) out.push(`نماذج الملاحظة: ${countAr(fs.total, "form")}، اعتُمد منها ${n(fs.approved)}، ووصلت الخطط ${n(fs.guardians)} من أولياء الأمور.`);
  if (incomplete) out.push(`رصد غير مكتمل في ${n(incomplete)} من الفصول والمواد، فلا يُحكم على مستواها حتى يكتمل.`);
  return out.slice(0, 5);
}

function recommendations(x, multi, counselor) {
  const { sev, fs, subjects, incomplete, st } = x;
  const out = [];
  if (multi) out.push(`دراسة حالة الطلاب المتعثرين في ثلاث مواد فأكثر (${n(multi)})، والتواصل مع أولياء أمورهم، وإحالة من يحتاج منهم.`);
  const low = subjects.filter((s) => s.avg != null && s.avg < 65).map((s) => s.sub);
  if (low.length) out.push(`اجتماع أقسام المواد الأدنى متوسطًا (${low.slice(0, 4).join("، ")}) لمراجعة توزيع المنهج والاختبارات، وخطة علاجية على مستوى الصف.`);
  if (sev.critical) out.push("متابعة الفصول ذات الملاحظات الحرجة بزيارات صفية، وتشخيص المهارات غير المتقنة، وإعادة التقويم بعد التدخل.");
  if (fs.draft) out.push(counselor ? `إرسال نماذج الملاحظة المتبقية إلى المعلمين (${n(fs.draft)}).` : `إرسال نماذج الملاحظة التي لم يرسلها الموجهون بعد إلى المعلمين (${n(fs.draft)}).`);
  if (fs.overdue) out.push(`متابعة المعلمين الذين تجاوزوا مهلة الرد على نماذج الملاحظة (${n(fs.overdue)}).`);
  if (fs.forwarded && !counselor) out.push(`اعتماد الخطط العلاجية التي رفعها الموجهون (${n(fs.forwarded)}).`);
  if (incomplete) out.push("إكمال رصد الدرجات في نور للفصول غير المكتملة، ثم إعادة رفع إشعار الفترة.");
  if (st.ex) out.push("تكريم الطلاب المتفوقين، وبرامج إثرائية لهم.");
  out.push("إشعار أولياء أمور الطلاب المتعثرين بالخطط العلاجية ومتابعة أثرها في الفترة التالية.");
  return out.slice(0, 6);
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل
 *  recs/checks/forms: ما في مركز التحليل للنطاق المختار، keyName: الإشعار، scope: نص النطاق */
export function achReportPages({ recs, checks, forms, keyName, scope, year, term, theme = "light", sigs = {}, counselor = null }) {
  // نسخة الموجه: طلاب صفوفه وحدها مهما كان النطاق المعروض
  if (counselor) {
    const inG = (g) => counselor.grades.includes(g);
    recs = recs.filter((r) => inG(r.grade)); checks = checks.filter((c) => inG(c.grade)); forms = forms.filter((f) => inG(f.grade));
  }
  const x = summary(recs, checks, forms);
  const { st, subjects, grades, fs, sev } = x;
  const title = noticeTitle(keyName);
  const gradeName = counselor ? `الصف ${counselor.grades.map((g) => GRADE_NAMES[g]).join(" و")}` : "";
  const doc = { title: counselor ? `تقرير ${gradeName} · متابعة التحصيل` : "تقرير متابعة التحصيل الدراسي", meta: [title, scope], foot: "مركز تحليل النتائج" };

  // طلاب الموجه: المتعثرون (مادة فأكثر دون الحد) والمتفوقون (متوسط 90% فأكثر)، ومتوسط كل فصل
  const studs = counselor ? studentSummaries(recs) : [];
  const weakStuds = studs.filter((s) => s.weakSubjects.length).sort((a, b) => b.weakSubjects.length - a.weakSubjects.length || a.avg - b.avg || cmpAr(a.name, b.name));
  const multi = weakStuds.filter((s) => s.weakSubjects.length >= 3).length;
  const topStuds = studs.filter((s) => s.avg >= 90).sort((a, b) => b.avg - a.avg || cmpAr(a.name, b.name));
  const classRows = counselor ? [...groupBy(recs, (r) => r.class_id)].map(([, rs]) => ({ g: rs[0].grade, no: rs[0].class_no, ...stats(rs) }))
    .sort((a, b) => a.g - b.g || a.no - b.no) : [];

  // الجداول الطويلة على صفحات
  const subjPages = paginate(subjects, () => 1, ROWS, ROWS);
  const notes = checks.filter((c) => c.sev !== "info");
  const notePages = notes.length ? paginate(notes, () => 1, 9, 16) : [[]];
  const formRows = [...forms].sort((a, b) => a.grade - b.grade || cmpAr(a.subject, b.subject) || cmpAr(a.teacher_name, b.teacher_name));
  const formPages = formRows.length ? paginate(formRows, () => 1, 13, 22) : [[]];

  const specs = [];   // [مفتاح، القسم، المحتوى]
  specs.push(["sum", { title: "ملخص النتائج", sub: "درجات الاختبارات وحدها دون المهام الأدائية والمشاركة" }, (
    <>
      <Kpis items={[
        { ic: "users", t: "الطلاب", v: x.students, s: `${countAr(x.classes, "cls")} · ${countAr(subjects.length, "subject")}`, c: S[0] },
        { ic: "chart", t: "متوسط الاختبارات", v: p1(st.avg), s: `الوسيط ${p1(st.median)}`, c: S[1] },
        { ic: "trophy", t: "التفوق (90% فأكثر)", v: p1(st.exPct), s: `${n(st.ex)} درجة`, c: S[2] },
        { ic: "alert", t: `الضعف (دون ${WEAK}%)`, v: p1(st.weakPct), s: `${n(st.weak)} درجة`, c: S[3] },
      ]} />
      <div className="mr-row c2">
        <Box icon="grid" title="توزيع التقديرات" aside={`${n(st.n)} درجة`}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Donut size={136} total={st.n} label="درجة" parts={BANDS.map((b) => ({ t: b.t, v: st.dist[b.k], c: b.color }))} />
            <DonutLegend parts={BANDS.map((b) => ({ t: b.t, v: st.dist[b.k], c: b.color }))} />
          </div>
        </Box>
        <Box icon="check" title="مؤشرات الأداء">
          <div className="mr-rings" style={{ gridTemplateColumns: "repeat(2, 1fr)", rowGap: 8 }}>
            <Ring size={70} value={st.avg == null ? null : Math.round(st.avg)} label="المتوسط" color={S[0]} />
            <Ring size={70} value={st.weakPct == null ? null : Math.round(100 - st.weakPct)} label={`${WEAK}% فأكثر`} color={S[1]} />
            <Ring size={70} value={st.exPct == null ? null : Math.round(st.exPct)} label="التفوق" color={S[2]} />
            <Ring size={70} value={pct(x.pairs - x.incomplete, x.pairs)} label="اكتمال الرصد" color={S[3]} />
          </div>
        </Box>
      </div>
      {grades.length > 1 && (
        <Box icon="cap" title="متوسط الصفوف" aside="المتوسط · نسبة الضعف">
          <Bars wide max={100} items={grades.map((g) => ({ t: GRADE_NAMES[g.g], v: g.avg ?? 0, c: bandOf(g.avg)?.color, note: p1(g.avg) }))} />
          <div className="mr-tiles" style={{ gridTemplateColumns: `repeat(${grades.length}, 1fr)`, marginTop: 10 }}>
            {grades.map((g) => <div key={g.g} className="mr-tile"><b className="num" style={{ fontSize: 20 }}>{p1(g.weakPct)}</b><span>ضعف · {GRADE_NAMES[g.g]}</span></div>)}
          </div>
        </Box>
      )}
      <Highlights title="أبرز ما في التقرير" items={highlights(x)} />
    </>
  )]);

  const subjBars = (
    <Box icon="chart" title="متوسط المواد" aside={`المرجع ${WEAK}% · لون التقدير`}>
      <Bars full max={100} items={subjects.slice(0, 24).map((s) => ({ t: s.sub, v: s.avg ?? 0, c: bandOf(s.avg)?.color, note: p1(s.avg) }))} />
      <div className="mr-legend" style={{ marginTop: 10, justifyContent: "center" }}>
        {BANDS.map((b) => <span key={b.k}><i style={{ background: b.color }} />{b.t}</span>)}
      </div>
    </Box>
  );
  const subjTable = (list) => (
    <table className="mr-table">
      <thead><tr>
        <th>المادة</th><th className="c">الطلاب</th><th className="c">المتوسط</th><th className="c">الوسيط</th>
        <th className="c">ممتاز</th><th className="c">ضعيف</th><th className="c">نسبة الضعف</th><th className="c">حرجة</th><th className="c">تنبيه</th><th className="c">النماذج</th>
      </tr></thead>
      <tbody>{list.map((s) => (
        <tr key={s.sub}>
          <td style={{ fontWeight: 600 }}>{s.sub}</td>
          <td className="c num">{n(s.n)}</td>
          <td className="c num" style={{ fontWeight: 700, color: s.avg < 65 ? "#A23B3B" : undefined }}>{p1(s.avg)}</td>
          <td className="c num">{p1(s.median)}</td>
          <td className="c num">{n(s.ex)}</td>
          <td className="c num">{n(s.weak)}</td>
          <td className="c num">{p1(s.weakPct)}</td>
          <td className="c num" style={{ color: s.crit ? "#A23B3B" : undefined, fontWeight: s.crit ? 700 : 400 }}>{s.crit || "—"}</td>
          <td className="c num">{s.warn || "—"}</td>
          <td className="c num">{s.forms || "—"}</td>
        </tr>
      ))}</tbody>
    </table>
  );
  if (subjects.length <= SUBJ_ONE) {
    specs.push(["subj", { title: "المواد الدراسية", sub: "متوسط كل مادة وتقديراتها وملاحظاتها ونماذجها" }, <>{subjBars}{subjTable(subjects)}</>]);
  } else {
    specs.push(["subj", { title: "المواد الدراسية", sub: "متوسط كل مادة في الاختبارات مرتّبة من الأعلى" }, subjBars]);
    subjPages.forEach((list, i) => specs.push([`subjt${i}`, i ? { title: "تفصيل المواد (تتمة)" } : { title: "تفصيل المواد", sub: "الطلاب والتقديرات والملاحظات والنماذج لكل مادة" }, subjTable(list)]));
  }

  if (counselor) {
    const first = classRows.length > 6 ? 13 : 17, rest = 28;
    const wPages = weakStuds.length ? paginate(weakStuds, () => 1, first, rest) : [[]];
    // أدنى ثلاث مواد، والباقي عددًا (يتسع السطر الواحد)
    const subjLine = (s) => s.weakSubjects.slice(0, 3).map((w) => `${w.subject} ${p1(w.pct)}`).join(" · ")
      + (s.weakSubjects.length > 3 ? ` · و${s.weakSubjects.length - 3} أخرى` : "");
    wPages.forEach((list, i) => specs.push([`weak${i}`, i ? { title: "الطلاب المتعثرون (تتمة)" } : { title: "الطلاب المتعثرون", sub: `من نزل في مادة أو أكثر دون ${WEAK}%، الأكثر مواد أولًا` }, (
      <>
        {!i && (
          <>
            <Kpis items={[
              { ic: "users", t: "متعثرون في مادة فأكثر", v: weakStuds.length, s: `من ${countAr(studs.length, "student", "g")}`, c: S[3] },
              { ic: "alert", t: "في ثلاث مواد فأكثر", v: multi, s: "تستدعي دراسة حالة", c: S[2] },
              { ic: "chart", t: `متوسطهم دون ${WEAK}%`, v: studs.filter((s) => s.avg < WEAK).length, s: "في الاختبارات كلها", c: S[1] },
              { ic: "trophy", t: "المتفوقون", v: topStuds.length, s: "متوسط 90% فأكثر", c: S[0] },
            ]} />
            <Box icon="table" title="متوسط الفصول" aside="في الاختبارات">
              <Bars wide max={100} items={classRows.map((c) => ({ t: `${GRADE_NAMES[c.g]} · ${c.no}`, v: c.avg ?? 0, c: bandOf(c.avg)?.color,
                note: p1(c.avg) }))} />
            </Box>
          </>
        )}
        {weakStuds.length ? (
          <table className="mr-table">
            <thead><tr><th className="c" style={{ width: 26 }}>م</th><th style={{ width: 215 }}>الطالب</th><th className="c" style={{ width: 52 }}>الفصل</th>
              <th className="c" style={{ width: 58 }}>المتوسط</th><th className="c" style={{ width: 44 }}>المواد</th><th>مواد الضعف ونسبها</th></tr></thead>
            <tbody>{list.map((s, k) => (
              <tr key={s.sid}>
                <td className="c num">{(i ? first + (i - 1) * rest : 0) + k + 1}</td>
                <td style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 215 }}>{s.name}</td>
                <td className="c num">{s.class_no}</td>
                <td className="c num" style={{ color: s.avg < WEAK ? "#A23B3B" : undefined, fontWeight: 700 }}>{p1(s.avg)}</td>
                <td className="c num" style={{ color: s.weakSubjects.length >= 3 ? "#A23B3B" : undefined, fontWeight: 700 }}>{s.weakSubjects.length}</td>
                <td style={{ fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 230 }}>{subjLine(s)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="mr-empty">لا طلاب متعثرون في هذا النطاق.</div>}
      </>
    )]));
    if (topStuds.length) {
      paginate(topStuds, () => 1, ROWS + 2, ROWS + 2).forEach((list, i) => specs.push([`top${i}`, i ? { title: "المتفوقون (تتمة)" } : { title: "المتفوقون", sub: "متوسطهم في الاختبارات 90% فأكثر، للتكريم والبرامج الإثرائية" }, (
        <table className="mr-table">
          <thead><tr><th className="c" style={{ width: 30 }}>م</th><th>الطالب</th><th className="c" style={{ width: 80 }}>الفصل</th><th className="c" style={{ width: 80 }}>المتوسط</th><th className="c" style={{ width: 80 }}>المواد</th></tr></thead>
          <tbody>{list.map((s, k) => (
            <tr key={s.sid}><td className="c num">{i * (ROWS + 2) + k + 1}</td><td style={{ fontWeight: 600 }}>{s.name}</td>
              <td className="c num">{s.class_no}</td><td className="c num" style={{ fontWeight: 700 }}>{p1(s.avg)}</td><td className="c num">{s.subjects}</td></tr>
          ))}</tbody>
        </table>
      )]));
    }
  }

  notePages.forEach((list, i) => specs.push([`notes${i}`, i ? { title: "الملاحظات الآلية (تتمة)" } : { title: "الملاحظات الآلية", sub: "ما رصده الفحص الجماعي على مستوى الفصل والمادة" }, (
    <>
      {!i && (
        <>
          <Kpis items={[
            { ic: "alert", t: "ملاحظات حرجة", v: sev.critical, s: "تستدعي تدخلًا عاجلًا", c: S[3] },
            { ic: "clock", t: "تنبيهات", v: sev.warning, s: "تحتاج متابعة", c: S[2] },
            { ic: "list", t: "للمتابعة", v: sev.info, s: "منها الرصد غير المكتمل", c: S[1] },
            { ic: "user", t: "معلمون بضعف واضح", v: x.teachers, s: "حرجة أو تنبيهان فأكثر", c: S[0] },
          ]} />
          <Box icon="grid" title="الملاحظات بأنواعها" aside={countAr(checks.length, "case")}>
            <Bars wide items={Object.keys(KIND_T).map((k) => ({ t: KIND_T[k], v: checks.filter((c) => c.kind === k).length, c: S[0] })).filter((b) => b.v).sort((a, b) => b.v - a.v)} />
          </Box>
        </>
      )}
      {notes.length ? (
        <table className="mr-table">
          <thead><tr><th className="c" style={{ width: 62 }}>الدرجة</th><th style={{ width: 74 }}>الفصل</th><th style={{ width: 96 }}>المادة</th><th>الملاحظة</th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id}>
              <td className="c"><Chip c={SEV[c.sev].c} bg={SEV[c.sev].bg}>{SEV[c.sev].t}</Chip></td>
              <td>{gShort(c.grade)} · {c.class_no ?? "الصف"}</td>
              <td>{c.subject ?? "عدة مواد"}</td>
              <td><b style={{ fontWeight: 600 }}>{c.title}</b><div style={{ fontSize: 10.5, color: "var(--mr-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 420 }}>{c.detail}</div></td>
            </tr>
          ))}</tbody>
        </table>
      ) : <div className="mr-empty">لا ملاحظات حرجة أو تنبيهات في هذا النطاق.</div>}
    </>
  )]));

  formPages.forEach((list, i) => specs.push([`forms${i}`, i ? { title: "نماذج الملاحظة (تتمة)" } : { title: "نماذج الملاحظة والخطط العلاجية", sub: "من الموجه إلى المعلم ثم اعتماد وكيل الشؤون التعليمية" }, (
    <>
      {!i && (
        <>
          <Kpis items={[
            { ic: "doc", t: "نماذج الملاحظة", v: fs.total, s: `${n(fs.excluded)} مستبعد · ${n(fs.draft)} لم يُرسل`, c: S[0] },
            { ic: "clock", t: "بانتظار المعلمين", v: fs.waiting, s: `${n(fs.overdue)} تجاوز المهلة`, c: S[3] },
            { ic: "pen", t: "بانتظار الاعتماد", v: fs.forwarded, s: `${n(fs.replied)} عند الموجهين للمراجعة`, c: S[2] },
            { ic: "award", t: "خطط معتمدة", v: fs.approved, s: `وصلت ${n(fs.guardians)} من أولياء الأمور`, c: S[1] },
          ]} />
          {fs.total > 0 && (
            <Box icon="arrow" title="سير النماذج" aside={`الطلاب المتعثرون فيها ${n(fs.students)}`}>
              <Split parts={Object.entries(FORM_STATUS).map(([k, v]) => ({ t: v.t, v: forms.filter((f) => f.status === k).length, c: v.c })).filter((p) => p.v)} />
            </Box>
          )}
        </>
      )}
      {forms.length ? (
        <table className="mr-table">
          <thead><tr><th>المعلم</th><th style={{ width: 92 }}>المادة</th><th style={{ width: 150 }}>الصف والفصول</th><th className="c" style={{ width: 52 }}>المتعثرون</th><th className="c" style={{ width: 120 }}>الحالة</th><th className="c" style={{ width: 70 }}>المهلة</th></tr></thead>
          <tbody>{list.map((f) => {
            const s = FORM_STATUS[f.status] ?? FORM_STATUS.draft;
            const late = isOverdue(f);
            return (
              <tr key={f.id}>
                <td style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170 }}>{f.teacher_name}</td>
                <td style={{ whiteSpace: "nowrap" }}>{f.subject}</td>
                <td style={{ whiteSpace: "nowrap" }}>{gShort(f.grade)} · {f.classes.map((c) => c.class_no).join("، ")}</td>
                <td className="c num">{n(f.classes.reduce((a, c) => a + c.students.length, 0))}</td>
                <td className="c"><Chip c={late ? "#A23B3B" : s.c} bg={late ? "#FBEBEB" : s.bg}>{s.t}{late ? " · متأخر" : ""}</Chip></td>
                <td className="c num">{["sent", "returned"].includes(f.status) ? dmy(f.due_on) : "—"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      ) : <div className="mr-empty">لا نماذج لهذا الإشعار: لم يرصد الفحص معلمًا بضعف واضح.</div>}
    </>
  )]));

  specs.push(["end", { title: "التوصيات والاعتماد", sub: counselor ? "مقترحة آليًا من نتائج تحليل طلاب الصف" : "مقترحة آليًا من نتائج التحليل، ولوكيل الشؤون التعليمية تعديلها" }, (
    <>
      <Box icon="spark" title="التوصيات" tint>
        <ul style={{ listStyle: "none", display: "grid", gap: 7, fontSize: 12.5, lineHeight: 1.75 }}>
          {recommendations(x, counselor ? multi : 0, !!counselor).map((t, i) => <li key={i} style={{ display: "flex", gap: 8 }}><b className="num" style={{ color: "var(--mr-acc)" }}>{i + 1}.</b><span>{t}</span></li>)}
        </ul>
      </Box>
      <Box icon="pen" title={counselor ? "ملاحظات الموجه الطلابي" : "ملاحظات وكيل الشؤون التعليمية وتوجيهاته"}>
        <div className="mr-lines">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div>
      </Box>
      <Signs stamp={sigs.stamp} people={counselor ? [
        { title: "الموجه الطلابي", name: counselor.name },
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME, sig: sigs.deputy },
      ] : [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME, sig: sigs.deputy },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal },
      ]} />
    </>
  )]);

  const total = specs.length + 1;
  const common = { theme, doc, total };
  let no = 0;
  return [
    <Cover key="cover" theme={theme} c={{
      year, tag: ["chart", counselor ? "متابعة التحصيل الدراسي" : "مركز تحليل النتائج"], title: counselor ? gradeName : "متابعة التحصيل الدراسي", titleSize: 64, sub: title,
      badge: { main: p1(st.avg), sub: "متوسط الاختبارات" }, side: { main: `${p1(st.weakPct)} دون ${WEAK}%`, sub: `${p1(st.exPct)} بلغوا 90% فأكثر` },
      rows: counselor
        ? [["cap", "الصف", counselor.grades.map((g) => GRADE_NAMES[g]).join(" و")], ["book", "المواد", countAr(subjects.length, "subject")],
           ["table", "الفصول", countAr(x.classes, "cls")], ["calendar", "الفصل الدراسي", `${term} · ${fmtDate(new Date())}`]]
        : [["cap", "النطاق", scope], ["book", "المواد", countAr(subjects.length, "subject")],
           ["table", "الفصول", countAr(x.classes, "cls")], ["calendar", "الفصل الدراسي", `${term} · ${fmtDate(new Date())}`]],
      note: ["check", "تحليل درجات الاختبارات من إشعار الفترة المنشور، دون المهام الأدائية والمشاركة."],
      strip: counselor
        ? [[x.students, "الطلاب"], [p1(st.avg), "المتوسط"], [weakStuds.length, "متعثرون"], [topStuds.length, "متفوقون"]]
        : [[x.students, "الطلاب"], [p1(st.avg), "المتوسط"], [sev.critical, "ملاحظات حرجة"], [fs.total, "نماذج الملاحظة"]],
      foot: "مركز تحليل النتائج",
    }} />,
    ...specs.map(([k, sec, body], i) => {
      if (!/\(تتمة\)$/.test(sec.title)) no += 1;   // التتمة برقم قسمها
      return <Page key={k} {...common} page={i + 2} sec={{ ...sec, no }}>{body}</Page>;
    }),
  ];
}
