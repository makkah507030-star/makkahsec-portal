// src/pages/achievement/FormsTab.jsx
/* =====================================================================
   مركز تحليل النتائج ← «النماذج والخطط» و«تقرير الوكيل» لإشعار الفترة المختار (src/lib/achForms.js).
   • النماذج: كل نموذج بحالته ومهلته، وترشيح بالحالة، والضغط يفتحه.
   • التقرير: أرقام المتابعة كلها لوكيل الشؤون التعليمية، بالمواد والمعلمين، قابل للطباعة.
   ===================================================================== */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { cmpAr } from "../../lib/sortAr.js";
import { noticeTitle } from "../../lib/achievement";
import { FORM_STATUS, isOverdue } from "../../lib/achForms";
import { StatusChip } from "./AchForm.jsx";
import { Stat } from "./Charts.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import { printThen } from "../../lib/print.js";
import moeLogo from "../../assets/moe-logo.png";
import logoIcon from "../../assets/icon-mint.png";

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
export function DeputyReport({ forms, keyName, checks }) {
  const [printing, setPrinting] = useState(false);
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

  const body = (print) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="نماذج الملاحظة" value={s.total} sub={`${s.excluded} مستبعد`} />
        <Stat label="بانتظار المعلمين" value={s.waitingTeacher} sub={`${s.overdue} تجاوز المهلة`} tone={s.overdue ? "bad" : null} />
        <Stat label="بانتظار اعتمادك" value={s.forwarded} sub={`${s.replied} عند الموجهين للمراجعة`} />
        <Stat label="خطط معتمدة" value={s.approved} sub={`وصلت ${s.guardians} من أولياء الأمور`} />
      </div>
      <p className="text-[12px] text-muted">
        الملاحظات الحرجة في هذه الفترة: <b className="num text-ink">{crit}</b> · الطلاب المتعثرون في فصول النماذج: <b className="num text-ink">{s.students}</b>
        {s.draft > 0 && <> · <b className="text-warning">لم يرسلها الموجهون بعد: <span className="num">{s.draft}</span></b></>}
      </p>
      <section className={print ? "" : "card overflow-hidden"}>
        <h3 className={`text-sm font-semibold text-ink ${print ? "mb-2" : "border-b border-line px-4 py-2.5"}`}>المواد</h3>
        <table className="w-full text-[12px]">
          <thead className="bg-canvas text-muted"><tr>
            {["المادة", "النماذج", "الفصول", "الطلاب المتعثرون", "قيد الإجراء", "معتمدة"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-line">
            {s.subjects.map((r) => (
              <tr key={r.sub}><td className="px-3 py-1.5 font-medium text-ink">{r.sub}</td>
                {[r.n, r.classes, r.students, r.pending, r.approved].map((v, i) => <td key={i} className="num px-3 py-1.5">{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={print ? "" : "card overflow-hidden"}>
        <h3 className={`text-sm font-semibold text-ink ${print ? "mb-2 mt-4" : "border-b border-line px-4 py-2.5"}`}>النماذج وحالتها</h3>
        <table className="w-full text-[12px]">
          <thead className="bg-canvas text-muted"><tr>
            {["المعلم", "المادة", "الصف والفصول", "الحالة", "المهلة"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-line">
            {s.rows.map((f) => (
              <tr key={f.id}>
                <td className="px-3 py-1.5 text-ink">{print ? f.teacher_name : <Link to={`/ach-forms/${f.id}`} className="hover:text-mint-deep">{f.teacher_name}</Link>}</td>
                <td className="px-3 py-1.5">{f.subject}</td>
                <td className="px-3 py-1.5">{GRADE_NAMES[f.grade]?.split(" ")[0]} · {f.classes.map((c) => c.class_no).join("، ")}</td>
                <td className="px-3 py-1.5">{FORM_STATUS[f.status].t}{isOverdue(f) ? " · متأخر" : ""}</td>
                <td className="num px-3 py-1.5">{["sent", "returned"].includes(f.status) ? fmtDate(f.due_on) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <h2 className="text-sm font-semibold text-ink">تقرير متابعة التحصيل · {noticeTitle(keyName)}</h2>
        {s.total > 0 && <button onClick={() => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 150); }}
                className="ms-auto rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-mint-deep">طباعة التقرير</button>}
      </div>
      {body(false)}
      {printing && (
        <PrintPortal id="ach-report" margin="12mm 12mm">
          <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 12 }}>
            <div className="flex items-start justify-between">
              <div className="text-[11px] leading-[1.8]"><div>المملكة العربية السعودية · وزارة التعليم</div><div className="font-bold text-mint-deep">مدرسة مكة الثانوية · الشؤون التعليمية</div></div>
              <div className="flex gap-3"><img src={moeLogo} alt="" className="h-9" /><img src={logoIcon} alt="" className="h-9" /></div>
            </div>
            <h1 className="my-4 text-center text-[16px] font-bold text-mint-deep">تقرير متابعة التحصيل الدراسي · {noticeTitle(keyName)}</h1>
            {body(true)}
            <div className="mt-10 text-center text-[12px]"><p className="font-bold text-mint-deep">وكيل الشؤون التعليمية</p><p className="mt-6 text-faint">التوقيع: ....................</p></div>
          </div>
        </PrintPortal>
      )}
    </div>
  );
}
