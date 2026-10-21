// src/pages/qudrat/QudratReport.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { ACADEMIC_DEPUTY_NAME } from "../../lib/exportUtils";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import { loadActiveTerm } from "../../lib/officialAttendance";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { academicYearLabel, TERM_LABEL } from "../studio/lib";
import { monthBounds, monthLabels } from "../student-affairs/monthlyData";
import { qudratPages } from "./QudratReportDoc.jsx";

/* =====================================================================
   «تقرير متابعة مركز التدريب (القدرات)» — للمدير ووكيل الشؤون التعليمية
   والدعم الفني، بتصميم التقرير الشهري لشؤون الطلاب (ReportViewer):
   شهر يُختار، وملاحظات الوكيل، وتوقيعه وتوقيع المدير والختم.
   البيانات من qudrat_report (supabase/qudrat_6.sql).
   ===================================================================== */

const notesKey = (month) => `qudrat-report-notes:${month}`;
const readNotes = (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeNotes = (k, v) => {
  try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* تخزين محجوب */ }
};

export default function QudratReport() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [term, setTerm] = useState(1);
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(() => readNotes(notesKey(todayISO().slice(0, 7))));
  const [sigs, setSigs] = useState({});

  useEffect(() => {
    let live = true;
    setD(null); setErr(""); setNotes(readNotes(notesKey(month)));
    const b = monthBounds(month);
    supabase.rpc("qudrat_report", { p_from: b.from, p_to: `${b.from.slice(0, 8)}${String(b.days).padStart(2, "0")}` })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setErr(/qudrat_report/.test(error.message) ? "التقرير غير مفعّل بعد: يلزم تشغيل ملف supabase/qudrat_6.sql." : error.message);
        else setD(data);
      });
    return () => { live = false; };
  }, [month]);

  useEffect(() => {
    loadActiveTerm().then((t) => setTerm(t.term));
    Promise.all([signatureByName(ACADEMIC_DEPUTY_NAME), loadPrincipalSignature(), loadSchoolStamp()])
      .then(([dep, p, st]) => setSigs({ deputy: dep, principal: p?.url ?? null, stamp: st }));
  }, []);

  const info = useMemo(() => (d ? {
    ...monthLabels(month), year: academicYearLabel(new Date(`${month}-15T12:00:00`)),
    termLabel: TERM_LABEL[term] ?? "", deputy: ACADEMIC_DEPUTY_NAME,
  } : null), [d, month, term]);

  const pages = useMemo(() => (d && info ? qudratPages({ d, info, theme, notes, sigs }) : null), [d, info, theme, notes, sigs]);

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>;
  return (
    <ReportViewer id="qudrat-report-print" pages={pages} theme={theme} setTheme={setTheme}
      fileTitle={info ? `تقرير متابعة مركز التدريب - ${info.month}` : "تقرير متابعة مركز التدريب"}
      controls={<input type="month" className="field num w-auto" value={month} max={todayISO().slice(0, 7)}
                       onChange={(e) => e.target.value && setMonth(e.target.value)} />}>
      <div>
        <label className="text-xs text-muted">ملاحظات وكيل الشؤون التعليمية وتوصياته (تظهر في الصفحة الأخيرة، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
        <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes}
                  placeholder="مثل: تشجيع طلاب الثالث الثانوي على الاختبار المحاكي، ومتابعة الأسئلة التي لم يُرد عليها…"
                  onChange={(e) => { setNotes(e.target.value); writeNotes(notesKey(month), e.target.value); }} />
      </div>
    </ReportViewer>
  );
}
