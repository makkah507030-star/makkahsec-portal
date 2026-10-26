// src/pages/achievement/FormsTab.jsx
/* =====================================================================
   مركز تحليل النتائج ← «النماذج والخطط» و«تقرير الوكيل» لإشعار الفترة المختار (src/lib/achForms.js).
   • النماذج: كل نموذج بحالته ومهلته، وترشيح بالحالة، والضغط يفتحه.
   • التقرير: أرقام المتابعة كلها لوكيل الشؤون التعليمية بالمواد والمعلمين، و«التقرير الرسمي»
     بغلاف وصفحات A4 بالهوية (AchReportDoc.jsx) للطباعة وملف PDF.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { cmpAr } from "../../lib/sortAr.js";
import { FORM_STATUS, isOverdue } from "../../lib/achForms";
import { StatusChip } from "./AchForm.jsx";
import { Stat } from "./Charts.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { academicYearLabel } from "../studio/lib";
import { termName, noticeTitle } from "../../lib/achievement";
import { achReportPages } from "./AchReportDoc.jsx";

// خلايا جداول التقرير على الشاشة
const TH = "px-3 py-2.5 text-[12px] font-semibold";
const TD = "px-3 py-2.5 align-middle";

const chip = (on) => `rounded-pill px-3 py-1.5 text-xs font-semibold transition ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export function FormsTab({ forms, err }) {
  const [st, setSt] = useState("");
  if (err) return <p className="card px-4 py-6 text-sm text-muted">{err}</p>;
  if (!forms) return null;
  if (!forms.length) return <div className="card px-6 py-10 text-center text-sm text-muted">لا نماذج لهذا الإشعار: لم يرصد الفحص معلمًا بضعف واضح (ملاحظة حرجة أو تنبيهان فأكثر في فصل يدرّسه).</div>;
  const shown = forms.filter((f) => !st || (st === "overdue" ? isOverdue(f) : f.status === st));
  const overdue = forms.filter(isOverdue).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSt("")} className={chip(!st)}>الكل ({forms.length})</button>
        {Object.entries(FORM_STATUS).map(([k, v]) => {
          const n = forms.filter((f) => f.status === k).length;
          return n > 0 && <button key={k} onClick={() => setSt(k)} className={chip(st === k)}>{v.t} ({n})</button>;
        })}
        {overdue > 0 && <button onClick={() => setSt("overdue")} className={chip(st === "overdue")}>تجاوز المهلة ({overdue})</button>}
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {shown.map((f) => (
          <Link key={f.id} to={`/ach-forms/${f.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-canvas/60">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{f.teacher_name} · {f.subject}</span>
              <span className="block text-[11.5px] text-muted">
                {GRADE_NAMES[f.grade]} · الفصول {f.classes.map((c) => c.class_no).join("، ")}
                {" · "}{f.classes.reduce((a, c) => a + c.checks.filter((k) => k.sev === "critical").length, 0)} ملاحظة حرجة
                {["sent", "returned"].includes(f.status) && <> · المهلة <span className="num">{fmtDate(f.due_on)}</span></>}
              </span>
            </span>
            <StatusChip f={f} />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* تقرير وكيل الشؤون التعليمية */
export function DeputyReport({ forms, keyName, checks, recs, scope, counselor = null }) {
  const [official, setOfficial] = useState(false);
  const [theme, setTheme] = useState("light");
  const [sigs, setSigs] = useState({});
  useEffect(() => {
    if (!official) return;
    Promise.all([loadPrincipalSignature(), loadSchoolStamp()]).then(([p, st]) => setSigs({ principal: p?.url ?? null, stamp: st }));
  }, [official]);
  const pages = useMemo(() => (official && forms ? achReportPages({
    recs, checks, forms, keyName, scope, year: academicYearLabel(), term: termName(keyName), theme, sigs, counselor,
  }) : null), [official, recs, checks, forms, keyName, scope, theme, sigs, counselor]);
  const s = useMemo(() => {
    const all = forms ?? [];
    const by = (k) => all.filter((f) => f.status === k).length;
    const subjects = [...new Set(all.map((f) => f.subject))].sort(cmpAr).map((sub) => {
      const fs = all.filter((f) => f.subject === sub);
      return { sub, n: fs.length, classes: fs.reduce((a, f) => a + f.classes.length, 0),
        approved: fs.filter((f) => f.status === "approved").length, pending: fs.filter((f) => !["approved", "excluded"].includes(f.status)).length,
        students: fs.reduce((a, f) => a + f.classes.reduce((b, c) => b + c.students.length, 0), 0) };
    });
    return {
      total: all.length, draft: by("draft"), waitingTeacher: by("sent") + by("returned"), replied: by("replied"), forwarded: by("forwarded"),
      approved: by("approved"), excluded: by("excluded"), overdue: all.filter(isOverdue).length,
      guardians: all.reduce((a, f) => a + (f.guardians_notified ?? 0), 0),
      students: all.reduce((a, f) => a + f.classes.reduce((b, c) => b + c.students.length, 0), 0),
      subjects, rows: [...all].sort((a, b) => a.grade - b.grade || cmpAr(a.subject, b.subject)),
    };
  }, [forms]);
  if (!forms) return null;
  const crit = checks.filter((c) => c.sev === "critical").length;

  const body = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="نماذج الملاحظة" value={s.total} sub={`${s.excluded} مستبعد`} />
        <Stat label="بانتظار المعلمين" value={s.waitingTeacher} sub={`${s.overdue} تجاوز المهلة`} tone={s.overdue ? "bad" : null} />
        <Stat label={counselor ? "بانتظار اعتماد الوكيل" : "بانتظار اعتمادك"} value={s.forwarded} sub={`${s.replied} عند الموجهين للمراجعة`} />
        <Stat label="خطط معتمدة" value={s.approved} sub={`وصلت ${s.guardians} من أولياء الأمور`} />
      </div>
      <p className="text-[12px] text-muted">
        الملاحظات الحرجة في هذه الفترة: <b className="num text-ink">{crit}</b> · الطلاب المتعثرون في فصول النماذج: <b className="num text-ink">{s.students}</b>
        {s.draft > 0 && <> · <b className="text-warning">لم يرسلها الموجهون بعد: <span className="num">{s.draft}</span></b></>}
      </p>
      <section className="card overflow-hidden">
        <h3 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">المواد</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] table-fixed text-[12.5px]">
            <colgroup><col className="w-[28%]" />{[0, 1, 2, 3, 4].map((i) => <col key={i} />)}</colgroup>
            <thead className="bg-canvas text-muted"><tr>
              <th className={`${TH} text-start`}>المادة</th>
              {["النماذج", "الفصول", "الطلاب المتعثرون", "قيد الإجراء", "معتمدة"].map((h) => <th key={h} className={`${TH} text-center`}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-line">
              {s.subjects.map((r) => (
                <tr key={r.sub} className="hover:bg-canvas/50">
                  <td className={`${TD} font-semibold text-ink`}>{r.sub}</td>
                  {[r.n, r.classes, r.students, r.pending, r.approved].map((v, i) => <td key={i} className={`${TD} num text-center`}>{v}</td>)}
                </tr>
              ))}
            </tbody>
            {s.subjects.length > 1 && (
              <tfoot className="border-t-2 border-line bg-canvas/60 font-bold text-ink"><tr>
                <td className={TD}>المجموع</td>
                {["n", "classes", "students", "pending", "approved"].map((k) => <td key={k} className={`${TD} num text-center`}>{s.subjects.reduce((a, r) => a + r[k], 0)}</td>)}
              </tr></tfoot>
            )}
          </table>
        </div>
      </section>
      <section className="card overflow-hidden">
        <h3 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">النماذج وحالتها</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed text-[12.5px]">
            <colgroup><col className="w-[24%]" /><col className="w-[15%]" /><col className="w-[21%]" /><col className="w-[19%]" /><col /></colgroup>
            <thead className="bg-canvas text-muted"><tr>
              <th className={`${TH} text-start`}>المعلم</th><th className={`${TH} text-start`}>المادة</th><th className={`${TH} text-start`}>الصف والفصول</th>
              <th className={`${TH} text-center`}>الحالة</th><th className={`${TH} text-center`}>المهلة</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {s.rows.map((f) => (
                <tr key={f.id} className="hover:bg-canvas/50">
                  <td className={`${TD} font-semibold text-ink`}><Link to={`/ach-forms/${f.id}`} className="hover:text-mint-deep">{f.teacher_name}</Link></td>
                  <td className={TD}>{f.subject}</td>
                  <td className={`${TD} num`}>{GRADE_NAMES[f.grade]?.split(" ")[0]} · {f.classes.map((c) => c.class_no).join("، ")}</td>
                  <td className={`${TD} text-center`}><StatusChip f={f} /></td>
                  <td className={`${TD} num whitespace-nowrap text-center`}>{["sent", "returned"].includes(f.status) ? fmtDate(f.due_on) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">تقرير متابعة التحصيل · {noticeTitle(keyName)}</h2>
        <div className="ms-auto flex gap-1.5">
          <button onClick={() => setOfficial(false)} className={chip(!official)}>الملخص</button>
          <button onClick={() => setOfficial(true)} className={chip(official)}>التقرير الرسمي (طباعة / PDF)</button>
        </div>
      </div>
      {official
        ? <ReportViewer id="ach-report" pages={pages} theme={theme} setTheme={setTheme} fileTitle={`${counselor ? "تقرير الموجه الطلابي" : "تقرير متابعة التحصيل"} - ${noticeTitle(keyName)}`} />
        : body}
    </div>
  );
}
