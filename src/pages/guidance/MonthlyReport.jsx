// src/pages/guidance/MonthlyReport.jsx
import { useEffect, useMemo, useState } from "react";
import { useSession } from "../../lib/session.jsx";
import { todayISO } from "../../lib/schoolTime";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { academicYearLabel, TERM_LABEL } from "../studio/lib";
import { loadMonthly, loadWarningSnapshot } from "./monthlyData";
import { reportInfo, reportPages } from "./MonthlyReportDoc.jsx";

/* =====================================================================
   تبويب «التقرير الشهري» في التوجيه الطلابي: تقرير مصمّم بهوية استوديو
   البوابة — غلاف، وملخص بمؤشرات ورسوم، والحالات والجلسات، والبرامج بصورها،
   والتواصل والنماذج، ثم ملاحظات الموجه والتوقيعات والختم.
   يُطبع من الحاسب مباشرة، ومن الجوال ملف PDF بمقاس A4 الصحيح.
   ===================================================================== */

// ملاحظات الموجه تُحفظ في المتصفح لكل صف وشهر حتى الطباعة
const notesKey = (grade, month) => `guidance-report-notes:${grade}:${month}`;
const readNotes = (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeNotes = (k, v) => {
  try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* تخزين محجوب */ }
};

export default function MonthlyReport({ grade, me }) {
  const { session, adminRoles } = useSession();
  const uid = session?.user?.id;
  const isCounselor = adminRoles.includes(`counselor_${grade}`);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [theme, setTheme] = useState("light");
  const [d, setD] = useState(null);
  const [warn, setWarn] = useState(null);
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState(() => readNotes(notesKey(grade, todayISO().slice(0, 7))));
  const [sigs, setSigs] = useState({ counselor: null, principal: null, stamp: null });

  useEffect(() => {
    let live = true;
    setD(null); setErr("");
    setNotes(readNotes(notesKey(grade, month)));
    loadMonthly({ grade, month, uid, isCounselor })
      .then((x) => { if (live) setD(x); })
      .catch((e) => { if (live) setErr(e?.message ?? String(e)); });
    return () => { live = false; };
  }, [grade, month, uid, isCounselor]);

  // الإنذار المبكر لحظي لا يتغير بالشهر
  useEffect(() => {
    let live = true;
    loadWarningSnapshot(grade).then((w) => { if (live) setWarn(w); });
    return () => { live = false; };
  }, [grade]);

  const counselor = (isCounselor ? me : d?.counselorName) || me || "";
  useEffect(() => {
    let live = true;
    Promise.all([counselor ? signatureByName(counselor) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([c, p, s]) => { if (live) setSigs({ counselor: c, principal: p?.url ?? null, stamp: s }); });
    return () => { live = false; };
  }, [counselor]);

  const info = useMemo(() => d && reportInfo({
    d, grade, counselor,
    yearLabel: academicYearLabel(new Date(`${month}-15T12:00:00`)), termLabel: TERM_LABEL[d.term] ?? "",
  }), [d, grade, counselor, month]);

  const pages = useMemo(() => (d && info ? reportPages({ d, warn, theme, info, notes, sigs }) : null), [d, warn, theme, info, notes, sigs]);
  const fileTitle = info ? `التقرير الشهري للموجه الطلابي - ${info.grade} - ${info.month}` : "التقرير الشهري";

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>;

  return (
    <ReportViewer id="guidance-monthly-print" pages={pages} theme={theme} setTheme={setTheme} fileTitle={fileTitle}
      controls={<input type="month" className="field num w-auto" value={month} max={todayISO().slice(0, 7)}
                       onChange={(e) => e.target.value && setMonth(e.target.value)} />}>
      <div>
        <label className="text-xs text-muted">ملاحظات الموجه وتوصياته (تظهر في الصفحة الأخيرة، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
        <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes}
                  placeholder="مثل: تكثيف برامج التهيئة للاختبارات، والتواصل مع أولياء أمور المتغيبين…"
                  onChange={(e) => { setNotes(e.target.value); writeNotes(notesKey(grade, month), e.target.value); }} />
      </div>
      <p className="text-[11.5px] text-muted">التقرير أرقام مجمّعة من سجلات البوابة دون أسماء الطلاب. النماذج: {isCounselor ? "كل ما أصدرته أنت من البوابة في الشهر." : "نماذج قسم التوجيه لطلاب الصف."}</p>
    </ReportViewer>
  );
}
