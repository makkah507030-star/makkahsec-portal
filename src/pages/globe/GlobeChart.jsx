// src/pages/globe/GlobeChart.jsx
import { useEffect, useMemo, useState } from "react";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { academicYearLabel } from "../studio/lib";
import { chartPages } from "./GlobeCharts.jsx";

/* هيكل فريق برنامج جلوب بصفات الطلاب (globe_members.role) للطباعة وملف PDF بهوية البوابة */
export default function GlobeChart({ leader, members, onBack }) {
  const [theme, setTheme] = useState("light");
  const [sigs, setSigs] = useState({ leader: null, principal: null, stamp: null });
  useEffect(() => {
    let live = true;
    Promise.all([leader ? signatureByName(leader) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([l, p, s]) => { if (live) setSigs({ leader: l, principal: p?.url ?? null, stamp: s }); });
    return () => { live = false; };
  }, [leader]);
  const pages = useMemo(() => chartPages({ members, leader, theme, sigs, year: academicYearLabel() }), [members, leader, theme, sigs]);
  return (
    <ReportViewer id="globe-chart-print" pages={pages} theme={theme} setTheme={setTheme}
      fileTitle="هيكل فريق برنامج جلوب"
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للطلاب</button>} />
  );
}
