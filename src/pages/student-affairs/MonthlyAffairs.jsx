// src/pages/student-affairs/MonthlyAffairs.jsx
import { useEffect, useMemo, useState } from "react";
import { todayISO } from "../../lib/schoolTime";
import { STUDENT_DEPUTY_NAME } from "../../lib/exportUtils";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import { loadActiveTerm } from "../../lib/officialAttendance";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { academicYearLabel, TERM_LABEL } from "../studio/lib";
import { loadAffairsMonthly, monthLabels } from "./monthlyData";
import { affairsPages } from "./MonthlyAffairsDoc.jsx";

/* =====================================================================
   «التقرير الشهري» في مركز تقارير شؤون الطلاب — لوكيل شؤون الطلاب والمدير
   والدعم الفني: تقرير مصمّم بهوية استوديو البوابة (MonthlyAffairsDoc.jsx).
   ===================================================================== */

const notesKey = (month) => `affairs-report-notes:${month}`;
const readNotes = (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeNotes = (k, v) => {
  try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* تخزين محجوب */ }
};

export default function MonthlyAffairs() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [d, setD] = useState(null);
  const [term, setTerm] = useState(1);
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(() => readNotes(notesKey(todayISO().slice(0, 7))));
  const [sigs, setSigs] = useState({});

  useEffect(() => {
    let live = true;
    setD(null); setNotes(readNotes(notesKey(month)));
    loadAffairsMonthly(month).then((x) => { if (live) setD(x); });
    return () => { live = false; };
  }, [month]);

  useEffect(() => {
    loadActiveTerm().then((t) => setTerm(t.term));
    Promise.all([signatureByName(STUDENT_DEPUTY_NAME), loadPrincipalSignature(), loadSchoolStamp()])
      .then(([dep, p, st]) => setSigs({ deputy: dep, principal: p?.url ?? null, stamp: st }));
  }, []);

  const info = useMemo(() => (d ? {
    ...monthLabels(month), year: academicYearLabel(new Date(`${month}-15T12:00:00`)),
    termLabel: TERM_LABEL[term] ?? "", deputy: STUDENT_DEPUTY_NAME,
  } : null), [d, month, term]);

  const pages = useMemo(() => (d && info ? affairsPages({ d, info, theme, notes, sigs }) : null), [d, info, theme, notes, sigs]);

  return (
    <ReportViewer id="affairs-monthly-print" pages={pages} theme={theme} setTheme={setTheme}
      fileTitle={info ? `التقرير الشهري لشؤون الطلاب - ${info.month}` : "التقرير الشهري لشؤون الطلاب"}
      controls={<input type="month" className="field num w-auto" value={month} max={todayISO().slice(0, 7)}
                       onChange={(e) => e.target.value && setMonth(e.target.value)} />}>
      <div>
        <label className="text-xs text-muted">ملاحظات الوكيل وتوصياته (تظهر في الصفحة الأخيرة، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
        <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes}
                  placeholder="مثل: التواصل مع أولياء أمور المتغيبين أكثر من 3 أيام، وتفعيل برنامج الانضباط الصباحي…"
                  onChange={(e) => { setNotes(e.target.value); writeNotes(notesKey(month), e.target.value); }} />
      </div>
    </ReportViewer>
  );
}
