// src/pages/student-affairs/Regulars.jsx
// المنتظمون: طلاب بلا أي غياب رسمي (بعذر أو بدونه) في الفصل الحالي، للتكريم (src/lib/regulars.js).
// الكشف بالاسم والفصل ومرات التأخر مع تصدير Excel، و«لوحة الانضباط» بهوية الاستوديو:
// ورقة لكل صف بالطلاب بلا غياب ولا تأخر، باسم موجه الصف ومدير المدرسة والختم.
import { useEffect, useMemo, useState } from "react";
import { loadRegulars } from "../../lib/regulars";
import { gradeCounselor } from "../../lib/deputyReferral";
import { exportStyledExcel, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { loadSchoolStamp } from "../../lib/principalSignature";
import { printThen } from "../../lib/print.js";
import { friendlyError } from "../../lib/friendlyError.js";
import PrintPortal from "../../components/PrintPortal.jsx";
import NameSearch, { matchQ } from "../../components/NameSearch.jsx";
import { SIGNS, Pill, Note, Loading, Empty } from "./shared.jsx";
import { StudioAssets } from "../studio/assets";
import { THEMES, TERM_LABEL, academicYearLabel, useFontsReady } from "../studio/lib";
import { HonorRoll } from "../studio/Sheets.jsx";
import { Fit } from "../studio/ProgramCards.jsx";

const GRADE = { 1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي" };
const PER = 20;   // طالب في الورقة: عمودان في عشرة صفوف
const dmy = (s) => (s ? s.split("-").reverse().join("/") : "");

export default function Regulars() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("clean");     // clean: بلا غياب ولا تأخر · all: بلا غياب
  const [grade, setGrade] = useState(0);
  const [q, setQ] = useState("");
  const [report, setReport] = useState(false);

  useEffect(() => { loadRegulars().then(setData).catch((e) => { setErr(friendlyError(e)); setData({ rows: [] }); }); }, []);

  const base = useMemo(() => (data?.rows ?? []).filter((r) => mode === "all" || r.late === 0), [data, mode]);
  const shown = base.filter((r) => (!grade || r.grade === grade) && matchQ(q, r.full_name, String(r.class_no)));
  const byGrade = (g) => base.filter((r) => r.grade === g).length;

  if (!data) return <Loading />;
  if (report) return <HonorReport data={data} onBack={() => setReport(false)} />;

  const title = mode === "clean" ? "الطلاب المنضبطون بلا غياب ولا تأخر" : "الطلاب المنتظمون بلا غياب";
  const sub = `${TERM_LABEL[data.term] ?? ""} · ${data.days} يومًا معتمدًا${data.from ? ` (${dmy(data.from)} — ${dmy(data.to)})` : ""}`;
  const excel = () => exportStyledExcel({
    title, subtitle: sub, headers: ["م", "اسم الطالب", "الهوية", "الصف", "الفصل", "مرات التأخر"],
    rows: shown.map((r, i) => [i + 1, r.full_name, r.national_id, GRADE[r.grade], r.class_no, r.late]),
    fileName: mode === "clean" ? "المنضبطون" : "المنتظمون", sheetName: "المنتظمون", signatures: SIGNS,
  });

  return (
    <div className="space-y-4">
      <Note>
        طلاب لم يغيبوا أي يوم في {TERM_LABEL[data.term] ?? "الفصل الحالي"}، لا بعذر ولا بدونه، في الأيام التي اعتمدها الوكيل
        (<span className="num">{data.days}</span> يومًا). اليوم غير المعتمد لا يدخل، ومن انتقل للمدرسة متأخرًا لا تظهر أيامه السابقة فراجع المستجدين.
      </Note>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((g) => (
          <button key={g} onClick={() => setGrade(g)} className={`card px-3 py-2.5 text-start ${grade === g ? "ring-2 ring-mint-deep" : ""}`}>
            <span className="num block text-xl font-bold text-ink">{g ? byGrade(g) : base.length}</span>
            <span className="block text-[11.5px] text-muted">{g ? GRADE[g] : "كل الصفوف"}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill on={mode === "clean"} onClick={() => setMode("clean")}>بلا غياب ولا تأخر</Pill>
        <Pill on={mode === "all"} onClick={() => setMode("all")}>بلا غياب (مع التأخر)</Pill>
        <button className="btn-primary ms-auto px-4 py-1.5 text-xs" disabled={!data.rows.some((r) => r.late === 0)} onClick={() => setReport(true)}>
          لوحة الانضباط بهوية الاستوديو</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NameSearch value={q} onChange={setQ} placeholder="ابحث بالاسم أو الفصل" />
        <button className="btn-ghost px-4 py-1.5 text-xs" disabled={!shown.length} onClick={excel}>تصدير Excel</button>
      </div>

      {shown.length === 0 ? <Empty>لا طلاب هنا.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr><th className="px-3 py-2 text-start">م</th><th className="px-3 py-2 text-start">اسم الطالب</th>
                <th className="px-3 py-2 text-start">الصف</th><th className="px-3 py-2 text-start">الفصل</th><th className="px-3 py-2 text-start">مرات التأخر</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r, i) => (
                <tr key={r.student_id}>
                  <td className="num px-3 py-2 text-faint">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-ink">{r.full_name}</td>
                  <td className="px-3 py-2 text-muted">{GRADE[r.grade]}</td>
                  <td className="num px-3 py-2">{r.class_no}</td>
                  <td className={`num px-3 py-2 ${r.late ? "text-late" : "text-present"}`}>{r.late || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* لوحة الانضباط: ورقة (أو أكثر) لكل صف بالطلاب بلا غياب ولا تأخر */
function HonorReport({ data, onBack }) {
  const [theme, setTheme] = useState("light");
  const [grade, setGrade] = useState(0);
  const [counselors, setCounselors] = useState({});
  const [stamp, setStamp] = useState(null);
  const [printing, setPrinting] = useState(false);
  useFontsReady();
  useEffect(() => {
    loadSchoolStamp().then(setStamp);
    Promise.all([1, 2, 3].map((g) => gradeCounselor(g).then((c) => [g, c?.name ?? ""])))
      .then((x) => setCounselors(Object.fromEntries(x)));
  }, []);

  const pages = useMemo(() => [1, 2, 3].filter((g) => !grade || g === grade).flatMap((g) => {
    const list = data.rows.filter((r) => r.grade === g && r.late === 0)
      .map((r, i) => ({ no: i + 1, name: r.full_name, cls: r.class_no }));
    if (!list.length) return [];
    const n = Math.ceil(list.length / PER);
    return Array.from({ length: n }, (_, p) => ({
      year: academicYearLabel(), grade: g, termLabel: TERM_LABEL[data.term], days: data.days,
      from: dmy(data.from), to: dmy(data.to), total: list.length, students: list.slice(p * PER, (p + 1) * PER),
      page: p + 1, pages: n, counselor: counselors[g], principal: PRINCIPAL_NAME,
    }));
  }), [data, grade, counselors]);

  const print = () => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 300); };
  return (
    <StudioAssets.Provider value={{ stamp }}>
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للكشف</button>
          <div className="flex gap-1 rounded-pill border border-line bg-paper p-1">
            {THEMES.map((t) => (
              <button key={t.key} onClick={() => setTheme(t.key)} title={t.hint}
                      className={`rounded-pill px-3 py-1 text-xs font-semibold ${theme === t.key ? "bg-mint-deep text-white" : "text-muted"}`}>{t.label}</button>
            ))}
          </div>
          <select className="field text-sm" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            <option value={0}>كل الصفوف</option>
            {[1, 2, 3].map((g) => <option key={g} value={g}>{GRADE[g]}</option>)}
          </select>
          <button className="btn-primary ms-auto px-4 py-1.5 text-xs" disabled={!pages.length} onClick={print}>
            طباعة / حفظ PDF <span className="num">({pages.length} {pages.length === 1 ? "ورقة" : "أوراق"})</span></button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          ورقة لكل صف بطلابه بلا غياب ولا تأخر، باسم موجه الصف من «الأدوار الإدارية» ومدير المدرسة وختمها. اطبعها A4 بالحجم الفعلي.
        </p>
        {pages.length === 0 ? <Empty>لا طلاب بلا غياب ولا تأخر بعد.</Empty>
          : pages.map((d, i) => <div key={i} className="card overflow-hidden p-2"><Fit><HonorRoll theme={theme} d={d} /></Fit></div>)}
        {printing && (
          <PrintPortal id="honor-roll-print"
            extraCss="#honor-roll-print .sheet { break-after: page; } #honor-roll-print .sheet:last-child { break-after: auto; }">
            <StudioAssets.Provider value={{ stamp }}>
              {pages.map((d, i) => <HonorRoll key={i} theme={theme} d={d} />)}
            </StudioAssets.Provider>
          </PrintPortal>
        )}
      </div>
    </StudioAssets.Provider>
  );
}
