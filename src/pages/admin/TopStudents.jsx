// src/pages/admin/TopStudents.jsx
/* =====================================================================
   تقرير الطلاب المتفوقين — تبويب في «نتائج الطلاب»، من إشعارات الفترة المرفوعة من نور
   (period_notices). المجموع والنسبة من المواد المرصودة وحدها، ولا يظهران للطالب.
   الفلترة: الإشعار، والصف، والقسم، والفصل، والحد الأدنى للنسبة، وعدد الأوائل، ونطاق الترتيب
   (المدرسة أو كل صف أو كل فصل)، والترتيب بالنسبة أو المجموع، واكتمال الرصد، والبحث بالاسم.
   يُطبع بهوية البوابة (غلاف، ثم جدول لكل مجموعة) ويُصدَّر Excel.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDateTime } from "../../lib/dates";
import { gradeBand } from "../../lib/gradeBands";
import { printReport, exportStyledExcel, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { countAr } from "../../lib/arabicCount.js";
import Loader from "../../components/Loader.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
const MINS = [0, 95, 90, 85, 80];
const TOPS = [10, 20, 50, 0];
const SCOPES = { school: "المدرسة", grade: "كل صف", class: "كل فصل" };
const classNum = (l) => parseInt(String(l ?? "").split("فصل ")[1], 10) || 0;
const gradeOrder = (n) => ["الأول", "الثاني", "الثالث"].findIndex((w) => String(n).includes(w)) + 1 || 9;
const uniq = (a) => [...new Set(a.filter(Boolean))];

function Stat({ v, t }) {
  return (
    <div className="rounded-card border border-line bg-white px-3 py-2.5 text-center">
      <p className="num text-xl font-bold leading-none text-ink">{v}</p>
      <p className="mt-1 text-[11px] text-muted">{t}</p>
    </div>
  );
}

export default function TopStudents({ year }) {
  const [all, setAll] = useState(null);
  const [err, setErr] = useState("");
  const [key, setKey] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [cls, setCls] = useState("");
  const [min, setMin] = useState(0);
  const [top, setTop] = useState(10);
  const [scope, setScope] = useState("grade");
  const [by, setBy] = useState("pct");
  const [complete, setComplete] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!year) return;
    supabase.from("period_notices")
      .select("student_id, report_key, title, term, grade_name, section, class_label, subjects, total, max_total, pct, updated_at, students(full_name)")
      .eq("academic_year", year)
      .then(({ data, error }) => {
        if (error) setErr(/period_notices/.test(error.message) ? "التقرير يحتاج تشغيل supabase/period_notices.sql ورفع إشعار فترة." : error.message);
        const rows = (data ?? []).map((r) => ({ ...r, n: r.subjects?.length ?? 0, name: r.students?.full_name ?? "—" }));
        setAll(rows);
        const latest = rows.reduce((a, r) => (!a || r.updated_at > a.updated_at ? r : a), null);
        setKey(latest?.report_key ?? "");
      });
  }, [year]);

  const notices = useMemo(() => {
    const m = new Map();
    (all ?? []).forEach((r) => { if (!m.has(r.report_key)) m.set(r.report_key, `${r.title} — ${r.term ?? ""}`); });
    return [...m];
  }, [all]);
  const inKey = useMemo(() => (all ?? []).filter((r) => r.report_key === key), [all, key]);
  const grades = uniq(inKey.map((r) => r.grade_name)).sort((a, b) => gradeOrder(a) - gradeOrder(b));
  const sections = uniq(inKey.filter((r) => !grade || r.grade_name === grade).map((r) => r.section));
  const classes = uniq(inKey.filter((r) => !grade || r.grade_name === grade).map((r) => r.class_label)).sort((a, b) => classNum(a) - classNum(b));
  // اكتمال الرصد: عدد المواد المرصودة يساوي أكثر ما رُصد لطالب في صفه وقسمه
  const fullCount = useMemo(() => {
    const m = new Map();
    inKey.forEach((r) => { const k = `${r.grade_name}|${r.section}`; m.set(k, Math.max(m.get(k) ?? 0, r.n)); });
    return m;
  }, [inKey]);
  const isFull = (r) => r.n >= (fullCount.get(`${r.grade_name}|${r.section}`) ?? 0);

  // المجموعات المرتبة بحسب نطاق الترتيب، ثم الفلترة
  const groups = useMemo(() => {
    const val = (r) => Number(by === "pct" ? r.pct : r.total) || 0;
    const base = inKey.filter((r) => (!grade || r.grade_name === grade) && (!section || r.section === section)
      && (!cls || r.class_label === cls) && (!complete || isFull(r)));
    const gk = (r) => (scope === "school" ? "المدرسة" : scope === "grade" ? r.grade_name : r.class_label) ?? "—";
    const m = new Map();
    base.forEach((r) => { const k = gk(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    const term = q.trim();
    return [...m].map(([name, list]) => {
      const sorted = [...list].sort((a, b) => val(b) - val(a) || (Number(b.pct) || 0) - (Number(a.pct) || 0));
      let rank = 0, prev = null;
      const ranked = sorted.map((r, i) => { if (val(r) !== prev) { rank = i + 1; prev = val(r); } return { ...r, rank }; });
      const rows = ranked.filter((r) => (Number(r.pct) || 0) >= min && (!top || r.rank <= top) && (!term || r.name.includes(term)));
      return { name, total: list.length, rows };
    }).filter((g) => g.rows.length)
      .sort((a, b) => gradeOrder(a.name) - gradeOrder(b.name) || classNum(a.name) - classNum(b.name));
  }, [inKey, grade, section, cls, complete, scope, by, min, top, q, fullCount]);   // eslint-disable-line react-hooks/exhaustive-deps

  const shown = groups.flatMap((g) => g.rows);
  const best = shown.reduce((a, r) => Math.max(a, Number(r.pct) || 0), 0);
  const avg = shown.length ? Math.round((shown.reduce((a, r) => a + (Number(r.pct) || 0), 0) / shown.length) * 10) / 10 : 0;
  const noticeName = notices.find(([k]) => k === key)?.[1] ?? "";
  const lastAt = inKey.reduce((a, r) => (!a || r.updated_at > a ? r.updated_at : a), null);
  const filterText = [grade || "كل الصفوف", section, cls, min ? `النسبة ${min}% فأعلى` : null,
    top ? `أعلى ${top} في ${SCOPES[scope]}` : `الترتيب على ${SCOPES[scope]}`].filter(Boolean).join(" · ");

  const HEAD = ["الترتيب", "اسم الطالب", "الصف والفصل", "المواد المرصودة", "المجموع", "من", "النسبة", "التقدير"];
  const line = (r) => [r.rank, r.name, r.class_label ?? "", r.n, r.total, r.max_total, `${r.pct}%`, gradeBand(r.pct)?.label ?? ""];

  const print = () => printReport({
    title: "تقرير الطلاب المتفوقين",
    subtitle: `${noticeName} · ${filterText}`,
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    cover: {
      title: "تقرير الطلاب المتفوقين",
      subtitle: noticeName,
      rows: [["المصدر", "إشعار الفترة من نظام نور"], ["آخر تحديث للدرجات", fmtDateTime(lastAt)], ["الفلترة", filterText],
        ["عدد المتفوقين", countAr(shown.length, "student")], ["أعلى نسبة", `${best}%`], ["متوسط نسبهم", `${avg}%`]],
      year,
    },
    sections: groups.map((g) => ({ title: g.name, subtitle: `${countAr(g.rows.length, "student")} من ${g.total}`, headerRows: [HEAD], rows: g.rows.map(line) })),
    note: "المجموع والنسبة من المواد المرصودة في نور حتى آخر تحديث، وليست النتيجة النهائية.",
    signatures: [{ title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    signOnLastPageOnly: true,
  });
  const excel = () => exportStyledExcel({
    title: "تقرير الطلاب المتفوقين", subtitle: `${noticeName} · ${filterText}`,
    headers: ["المجموعة", ...HEAD], rows: groups.flatMap((g) => g.rows.map((r) => [g.name, ...line(r)])),
    fileName: "الطلاب-المتفوقون", sheetName: "المتفوقون",
  });

  if (!all) return <Loader />;
  if (err) return <p className="card px-4 py-5 text-sm text-absent">{err}</p>;
  if (!notices.length) return <p className="card px-4 py-6 text-sm text-muted">ارفع إشعار فترة من نور أولًا من تبويب «إشعار الفترة»، فيُبنى منه التقرير.</p>;

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted">الإشعار
            <select className="field mt-1 w-full" value={key} onChange={(e) => { setKey(e.target.value); setGrade(""); setSection(""); setCls(""); }}>
              {notices.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select></label>
          <label className="text-xs text-muted">القسم
            <select className="field mt-1 w-full" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">كل الأقسام</option>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
          <label className="text-xs text-muted">الفصل
            <select className="field mt-1 w-full" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">كل الفصول</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className="text-xs text-muted">بحث بالاسم
            <input className="field mt-1 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جزء من الاسم" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="ml-1 text-xs text-muted">الصف:</span>
          <button className={pill(!grade)} onClick={() => { setGrade(""); setCls(""); setSection(""); }}>الكل</button>
          {grades.map((g) => <button key={g} className={pill(grade === g)} onClick={() => { setGrade(g); setCls(""); setSection(""); }}>{g}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="ml-1 text-xs text-muted">النسبة:</span>
          {MINS.map((m) => <button key={m} className={pill(min === m)} onClick={() => setMin(m)}>{m ? `${m}% فأعلى` : "الكل"}</button>)}
          <span className="mr-3 ml-1 text-xs text-muted">العدد:</span>
          {TOPS.map((t) => <button key={t} className={pill(top === t)} onClick={() => setTop(t)}>{t ? `أعلى ${t}` : "الكل"}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="ml-1 text-xs text-muted">الترتيب على:</span>
          {Object.entries(SCOPES).map(([k, t]) => <button key={k} className={pill(scope === k)} onClick={() => setScope(k)}>{t}</button>)}
          <span className="mr-3 ml-1 text-xs text-muted">حسب:</span>
          <button className={pill(by === "pct")} onClick={() => setBy("pct")}>النسبة</button>
          <button className={pill(by === "total")} onClick={() => setBy("total")}>المجموع</button>
          <label className="mr-3 flex items-center gap-1.5 text-xs text-ink">
            <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
            من اكتمل رصد مواده فقط
          </label>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat v={inKey.length} t="طلاب الإشعار" />
        <Stat v={shown.length} t="المتفوقون حسب الفلترة" />
        <Stat v={`${best}%`} t="أعلى نسبة" />
        <Stat v={`${avg}%`} t="متوسط نسبهم" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] text-muted">آخر تحديث للدرجات: <span className="num">{fmtDateTime(lastAt)}</span> · النسبة من المواد المرصودة فقط.</p>
        <button className="btn-primary mr-auto" disabled={!shown.length} onClick={print}>طباعة التقرير</button>
        <button className="btn-ghost" disabled={!shown.length} onClick={excel}>Excel</button>
      </div>

      {groups.length === 0 ? <p className="card px-4 py-6 text-sm text-muted">لا طلاب بهذه الفلترة.</p> : groups.map((g) => (
        <section key={g.name} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-mint-tint/40 px-4 py-2.5">
            <p className="text-sm font-bold text-mint-deep">{g.name}</p>
            <p className="text-[11px] text-muted">{countAr(g.rows.length, "student")} من <span className="num">{g.total}</span></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-center font-medium">الترتيب</th><th className="px-3 py-2 text-right font-medium">الطالب</th>
                  <th className="px-3 py-2 text-center font-medium">المواد</th><th className="px-3 py-2 text-center font-medium">المجموع</th>
                  <th className="px-3 py-2 text-center font-medium">النسبة</th><th className="px-3 py-2 text-center font-medium">التقدير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {g.rows.map((r) => {
                  const band = gradeBand(r.pct);
                  return (
                    <tr key={r.student_id}>
                      <td className="px-3 py-2 text-center">
                        <span className={`num inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${r.rank <= 3 ? "bg-mint-deep text-white" : "bg-canvas text-ink"}`}>{r.rank}</span></td>
                      <td className="px-3 py-2"><p className="font-medium text-ink">{r.name}</p><p className="text-[11px] text-muted">{r.class_label}{r.section ? ` · ${r.section}` : ""}</p></td>
                      <td className="num px-3 py-2 text-center text-muted">{r.n}</td>
                      <td className="num whitespace-nowrap px-3 py-2 text-center text-ink">{r.total}<span className="text-[11px] text-muted"> / {r.max_total}</span></td>
                      <td className="num px-3 py-2 text-center font-bold text-ink">{r.pct}%</td>
                      <td className="px-3 py-2 text-center">{band && <span className="rounded-pill px-2.5 py-1 text-[11px] font-bold" style={{ background: band.bg, color: band.text }}>{band.label}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
