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
import DisciplineReport from "./DisciplineReport.jsx";

const GRADE = { 1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي" };
const PER = 20;   // طالب في الورقة: عمودان في عشرة صفوف
// الشرطة المنفردة في أسماء نور مكان جزء ناقص من الاسم، فلا تظهر في لوحة التكريم
const cleanName = (n) => String(n ?? "").replace(/(^|\s)-(?=\s|$)/g, "").replace(/\s+/g, " ").trim();
const dmy = (s) => (s ? s.split("-").reverse().join("/") : "");

const pctOf = (n, d) => (d ? Math.round((n * 1000) / d) / 10 : 0);

function Kpi({ v, t, s, c = "text-ink" }) {
  return (
    <div className="card px-3 py-3">
      <span className={`num block text-2xl font-bold leading-none ${c}`}>{v}</span>
      <span className="mt-1.5 block text-[12px] font-semibold text-ink">{t}</span>
      {s && <span className="num mt-0.5 block text-[11px] text-muted">{s}</span>}
    </div>
  );
}
function Bar({ v, c = "bg-mint-deep" }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-canvas"><div className={`h-full rounded-full ${c}`} style={{ width: `${Math.min(100, v)}%` }} /></div>;
}

/* grades: الصفوف المتاحة (الموجه يرى صفه وحده، وشؤون الطلاب الصفوف كلها) */
export default function Regulars({ grades = [1, 2, 3] }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("clean");     // clean: بلا غياب ولا تأخر · all: بلا غياب
  const [grade, setGrade] = useState(grades.length === 1 ? grades[0] : 0);
  const [q, setQ] = useState("");
  const [report, setReport] = useState(false);
  const [full, setFull] = useState(false);   // تقرير الانضباط الكامل
  const gkey = grades.join(",");

  useEffect(() => { loadRegulars().then(setData).catch((e) => { setErr(friendlyError(e)); setData({ rows: [], near: [], sizes: {} }); }); }, []);

  const inScope = (g) => grades.includes(g) && (!grade || g === grade);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => inScope(r.grade)), [data, grade, gkey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => {
    if (!data) return null;
    const sizes = Object.entries(data.sizes ?? {}).map(([k, n]) => { const [g, c] = k.split("-").map(Number); return { g, c, n }; })
      .filter((x) => inScope(x.g));
    const students = sizes.reduce((s, x) => s + x.n, 0);
    const clean = rows.filter((r) => r.late === 0).length;
    const classes = sizes.map((x) => {
      const rs = rows.filter((r) => r.grade === x.g && r.class_no === x.c);
      const cl = rs.filter((r) => r.late === 0).length;
      return { ...x, reg: rs.length, clean: cl, p: pctOf(rs.length, x.n), pc: pctOf(cl, x.n) };
    }).sort((a, b) => b.p - a.p || b.clean - a.clean || a.c - b.c);
    const byG = grades.filter((g) => !grade || g === grade).map((g) => {
      const n = sizes.filter((x) => x.g === g).reduce((s, x) => s + x.n, 0);
      const rs = rows.filter((r) => r.grade === g), cl = rs.filter((r) => r.late === 0).length;
      return { g, n, reg: rs.length, clean: cl, p: pctOf(rs.length, n), pc: pctOf(cl, n) };
    });
    const lateBands = [["بلا تأخر", (x) => x === 0], ["1–2", (x) => x >= 1 && x <= 2], ["3–5", (x) => x >= 3 && x <= 5], ["6 فأكثر", (x) => x >= 6]]
      .map(([t, f]) => ({ t, n: rows.filter((r) => f(r.late)).length }));
    const near = (data.near ?? []).filter((x) => inScope(x.grade));
    return { students, reg: rows.length, clean, classes, byG, lateBands,
             near1: near.filter((x) => x.abs === 1).length, near2: near.filter((x) => x.abs === 2).length };
  }, [data, rows, grade, gkey]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = rows.filter((r) => mode === "all" || r.late === 0);
  const shown = base.filter((r) => matchQ(q, r.full_name, String(r.class_no)));

  if (!data) return <Loading />;
  if (report) return <HonorReport data={data} grades={grades} onBack={() => setReport(false)} />;
  if (full) return <DisciplineReport data={data} grades={grade ? [grade] : grades} onBack={() => setFull(false)} />;

  const scope = grade ? GRADE[grade] : "المدرسة";
  const title = mode === "clean" ? `المنضبطون بلا غياب ولا تأخر — ${scope}` : `المنتظمون بلا غياب — ${scope}`;
  const sub = `${TERM_LABEL[data.term] ?? ""} · ${data.days} يومًا معتمدًا${data.from ? ` (${dmy(data.from)} — ${dmy(data.to)})` : ""}`;
  const excel = () => exportStyledExcel({
    title, subtitle: sub, headers: ["م", "اسم الطالب", "الهوية", "الصف", "الفصل", "مرات التأخر"],
    rows: shown.map((r, i) => [i + 1, r.full_name, r.national_id, GRADE[r.grade], r.class_no, r.late]),
    fileName: mode === "clean" ? "المنضبطون" : "المنتظمون", sheetName: "المنتظمون", signatures: SIGNS,
  });
  const maxLate = Math.max(1, ...stats.lateBands.map((b) => b.n));

  return (
    <div className="space-y-4">
      <Note>
        طلاب لم يغيبوا أي يوم في {TERM_LABEL[data.term] ?? "الفصل الحالي"}، لا بعذر ولا بدونه، في الأيام التي اعتمدها الوكيل
        (<span className="num">{data.days}</span> يومًا). اليوم غير المعتمد لا يدخل، ومن انتقل للمدرسة متأخرًا لا تظهر أيامه السابقة فراجع المستجدين.
      </Note>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      {grades.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Pill on={!grade} onClick={() => setGrade(0)}>كل الصفوف</Pill>
          {grades.map((g) => <Pill key={g} on={grade === g} onClick={() => setGrade(g)}>{GRADE[g]}</Pill>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi v={stats.students} t={`طلاب ${scope}`} s={`${data.days} يومًا معتمدًا`} />
        <Kpi v={stats.reg} t="بلا غياب" s={`${pctOf(stats.reg, stats.students)}% من الطلاب`} c="text-present" />
        <Kpi v={stats.clean} t="بلا غياب ولا تأخر" s={`${pctOf(stats.clean, stats.students)}% من الطلاب`} c="text-mint-deep" />
        <Kpi v={stats.near1 + stats.near2} t="قريبون من الانتظام" s={`غاب يومًا: ${stats.near1} · يومين: ${stats.near2}`} c="text-late" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-3 text-sm font-bold text-ink">{stats.byG.length > 1 ? "بالصف" : "الانتظام في الصف"}</p>
          <div className="space-y-3">
            {stats.byG.map((x) => (
              <div key={x.g}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 text-[12.5px]">
                  <span className="shrink-0 whitespace-nowrap font-semibold text-ink">{GRADE[x.g]}</span>
                  <span className="num text-[11.5px] text-muted">بلا غياب {x.reg} ({x.p}%) · منضبطون {x.clean} ({x.pc}%) من {x.n}</span>
                </div>
                <Bar v={x.p} c="bg-present" />
                <div className="mt-1"><Bar v={x.pc} /></div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-present" />بلا غياب</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-mint-deep" />بلا غياب ولا تأخر</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="mb-3 text-sm font-bold text-ink">التأخر الصباحي بين من لم يغيبوا</p>
          <div className="space-y-2">
            {stats.lateBands.map((b) => (
              <div key={b.t} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-20 shrink-0 text-muted">{b.t}</span>
                <div className="flex-1"><Bar v={(b.n * 100) / maxLate} c={b.t === "بلا تأخر" ? "bg-mint-deep" : "bg-late"} /></div>
                <span className="num w-8 shrink-0 text-end font-semibold text-ink">{b.n}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">مرات التأخر في الأيام المعتمدة. من تأخر مرة أو مرتين قريب من الانضباط التام.</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <p className="px-4 pt-3 text-sm font-bold text-ink">الفصول مرتبة بنسبة الانتظام</p>
        <table className="mt-2 w-full text-sm">
          <thead className="bg-canvas text-xs text-muted">
            <tr><th className="px-3 py-2 text-start">الفصل</th><th className="px-3 py-2 text-start">الطلاب</th>
              <th className="px-3 py-2 text-start">بلا غياب</th><th className="px-3 py-2 text-start">بلا غياب ولا تأخر</th><th className="w-1/3 px-3 py-2 text-start">النسبة</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stats.classes.map((x) => (
              <tr key={`${x.g}-${x.c}`}>
                <td className="num px-3 py-2 font-semibold text-ink">{x.c}</td>
                <td className="num px-3 py-2 text-muted">{x.n}</td>
                <td className="num px-3 py-2">{x.reg}</td>
                <td className="num px-3 py-2">{x.clean}</td>
                <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="flex-1"><Bar v={x.p} c="bg-present" /></div><span className="num w-12 text-end text-[12px] text-muted">{x.p}%</span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill on={mode === "clean"} onClick={() => setMode("clean")}>بلا غياب ولا تأخر <span className="num">({stats.clean})</span></Pill>
        <Pill on={mode === "all"} onClick={() => setMode("all")}>بلا غياب (مع التأخر) <span className="num">({stats.reg})</span></Pill>
        <button className="btn-primary ms-auto px-4 py-1.5 text-xs" disabled={!data.all?.length} onClick={() => setFull(true)}>
          تقرير الانضباط بالصف</button>
        <button className="btn-ghost px-4 py-1.5 text-xs" disabled={!stats.clean} onClick={() => setReport(true)}>
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
function HonorReport({ data, grades, onBack }) {
  const [theme, setTheme] = useState("light");
  const [grade, setGrade] = useState(grades.length === 1 ? grades[0] : 0);
  const [counselors, setCounselors] = useState({});
  const [stamp, setStamp] = useState(null);
  const [printing, setPrinting] = useState(false);
  useFontsReady();
  useEffect(() => {
    loadSchoolStamp().then(setStamp);
    Promise.all(grades.map((g) => gradeCounselor(g).then((c) => [g, c?.name ?? ""])))
      .then((x) => setCounselors(Object.fromEntries(x)));
  }, []);

  const pages = useMemo(() => grades.filter((g) => !grade || g === grade).flatMap((g) => {
    const list = data.rows.filter((r) => r.grade === g && r.late === 0)
      .map((r, i) => ({ no: i + 1, name: cleanName(r.full_name), cls: r.class_no }));
    if (!list.length) return [];
    const n = Math.ceil(list.length / PER);
    return Array.from({ length: n }, (_, p) => ({
      year: academicYearLabel(), grade: g, termLabel: TERM_LABEL[data.term], days: data.days,
      from: dmy(data.from), to: dmy(data.to), total: list.length, students: list.slice(p * PER, (p + 1) * PER),
      page: p + 1, pages: n, counselor: counselors[g], principal: PRINCIPAL_NAME,
    }));
  }), [data, grade, counselors, grades]);

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
            {grades.length > 1 && <option value={0}>كل الصفوف</option>}
            {grades.map((g) => <option key={g} value={g}>{GRADE[g]}</option>)}
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
