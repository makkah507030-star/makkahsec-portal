// src/pages/activities/ActivityReport.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtHijri } from "../../lib/dates";
import { activeYear } from "../../lib/performance";
import { ACADEMIC_DEPUTY_NAME } from "../../lib/exportUtils";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { academicYearLabel } from "../studio/lib";
import { activityReportPages } from "./ActivityReportDoc.jsx";

/* =====================================================================
   «التقرير الشامل لبنك الأنشطة» بهوية البوابة (ReportViewer): كل بطاقة
   باستخدامها وتقييمها وملاحظات المعلمين عليها، وما استخدمه كل معلم.
   يُفتح من «استخدام المعلمين» في إدارة البنك. البيانات من act_cards_report
   (supabase/activities_6.sql)، وعدد المعلمين من تقرير الاستخدام.
   ===================================================================== */

const notesKey = "activity-report-notes";
const readNotes = () => { try { return localStorage.getItem(notesKey) ?? ""; } catch { return ""; } };
const writeNotes = (v) => { try { if (v) localStorage.setItem(notesKey, v); else localStorage.removeItem(notesKey); } catch { /* تخزين محجوب */ } };

export default function ActivityReport({ teachers = 0, onBack }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(readNotes);
  const [sigs, setSigs] = useState({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("act_cards_report", { p_year: await activeYear() });
      if (error) setErr(/act_cards_report/.test(error.message) ? "التقرير يحتاج تشغيل supabase/activities_6.sql." : error.message);
      else setD(data);
    })();
    Promise.all([signatureByName(ACADEMIC_DEPUTY_NAME), loadPrincipalSignature(), loadSchoolStamp()])
      .then(([dep, p, st]) => setSigs({ deputy: dep, principal: p?.url ?? null, stamp: st }));
  }, []);

  const info = useMemo(() => ({
    year: academicYearLabel(new Date()), date: fmtHijri(new Date()), deputy: ACADEMIC_DEPUTY_NAME, teachers,
  }), [teachers]);
  const pages = useMemo(() => (d ? activityReportPages({ d, info, theme, notes, sigs }) : null), [d, info, theme, notes, sigs]);

  return (
    <div className="space-y-3">
      <button type="button" className="text-sm font-semibold text-muted hover:text-ink" onClick={onBack}>رجوع إلى استخدام المعلمين</button>
      {err ? <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p> : (
        <ReportViewer id="activity-report-print" pages={pages} theme={theme} setTheme={setTheme} fileTitle="التقرير الشامل لبنك الأنشطة">
          <div>
            <label className="text-xs text-muted">ملاحظات وكيل الشؤون التعليمية وتوصياته (تظهر في الصفحة الأخيرة، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
            <textarea className="field mt-1 w-full" rows={3} maxLength={900} value={notes}
                      placeholder="مثل: التعريف بالبطاقات التي لم تُستخدم، وتعديل الأنشطة التي لم تناسب المعلمين…"
                      onChange={(e) => { setNotes(e.target.value); writeNotes(e.target.value); }} />
          </div>
        </ReportViewer>
      )}
    </div>
  );
}
