// src/pages/admin/SchoolReport.jsx
import { useEffect, useMemo, useState } from "react";
import { todayISO } from "../../lib/schoolTime";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { loadActiveTerm } from "../../lib/officialAttendance";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { academicYearLabel, TERM_LABEL } from "../studio/lib";
import { monthLabels } from "../student-affairs/monthlyData";
import { loadSchoolMonthly } from "./schoolMonthly";
import { schoolPages } from "./SchoolReportDoc.jsx";

/* =====================================================================
   التقرير الشهري للمدرسة — لمدير المدرسة والدعم الفني: خلاصة الشهر من
   أقسام البوابة كلها في تقرير مصمّم بهوية استوديو البوابة (SchoolReportDoc.jsx)،
   يصلح لرفعه لمكتب التعليم أو عرضه في اجتماع.
   ===================================================================== */

const notesKey = (month) => `school-report-notes:${month}`;
const readNotes = (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeNotes = (k, v) => {
  try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* تخزين محجوب */ }
};

export default function SchoolReport() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [d, setD] = useState(null);
  const [term, setTerm] = useState(1);
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(() => readNotes(notesKey(todayISO().slice(0, 7))));
  const [sigs, setSigs] = useState({});

  useEffect(() => {
    let live = true;
    setD(null); setNotes(readNotes(notesKey(month)));
    loadSchoolMonthly(month).then((x) => { if (live) setD(x); });
    return () => { live = false; };
  }, [month]);

  useEffect(() => {
    loadActiveTerm().then((t) => setTerm(t.term));
    Promise.all([loadPrincipalSignature(), loadSchoolStamp()]).then(([p, st]) => setSigs({ principal: p?.url ?? null, stamp: st }));
  }, []);

  const info = useMemo(() => (d ? {
    ...monthLabels(month), year: academicYearLabel(new Date(`${month}-15T12:00:00`)), termLabel: TERM_LABEL[term] ?? "",
  } : null), [d, month, term]);
  const pages = useMemo(() => (d && info ? schoolPages({ d, info, theme, notes, sigs }) : null), [d, info, theme, notes, sigs]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">التقرير الشهري للمدرسة</h1>
        <p className="mt-1 text-sm text-muted">خلاصة الشهر من أقسام البوابة: شؤون الطلاب، والتوجيه، والأحداث، والتطوير المهني، والاختبارات، والنماذج.</p>
      </div>
      <ReportViewer id="school-monthly-print" pages={pages} theme={theme} setTheme={setTheme}
        fileTitle={info ? `التقرير الشهري للمدرسة - ${info.month}` : "التقرير الشهري للمدرسة"}
        controls={<input type="month" className="field num w-auto" value={month} max={todayISO().slice(0, 7)}
                         onChange={(e) => e.target.value && setMonth(e.target.value)} />}>
        <div>
          <label className="text-xs text-muted">ملاحظات مدير المدرسة وتوجيهاته (تظهر في الصفحة الأخيرة، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
          <textarea className="field mt-1 w-full" rows={3} maxLength={600} value={notes}
                    placeholder="مثل: الإشادة بانتظام الصف الأول، ومتابعة خطط الدعم للمتعثرين…"
                    onChange={(e) => { setNotes(e.target.value); writeNotes(notesKey(month), e.target.value); }} />
        </div>
      </ReportViewer>
    </div>
  );
}
