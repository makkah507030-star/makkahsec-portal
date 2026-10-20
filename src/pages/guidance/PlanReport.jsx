// src/pages/guidance/PlanReport.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { todayISO } from "../../lib/schoolTime";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { academicYearLabel, TERM_LABEL } from "../studio/lib";
import { planInfo, planPages } from "./PlanReportDoc.jsx";

/* =====================================================================
   «تقرير الخطة» في الخطة والبرامج: الخطة الإرشادية للصف وتقرير تنفيذها
   بهوية البوابة (نسخة ملوّنة ورسمية)، بكل تفاصيل البرامج وصور تنفيذها.
   يُطبع من الحاسب مباشرة، ومن الجوال ملف PDF بمقاس A4.
   ===================================================================== */

const notesKey = (grade) => `guidance-plan-notes:${grade}`;
const readNotes = (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeNotes = (k, v) => {
  try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* تخزين محجوب */ }
};

// اسم الموجه: صاحب الحساب إن كان موجه الصف، وإلا أكثر من أضاف برامج الخطة
function counselorOf(rows, me, isCounselor) {
  if (isCounselor && me) return me;
  const c = {};
  rows.forEach((p) => { if (p.created_by_name) c[p.created_by_name] = (c[p.created_by_name] ?? 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? me ?? "";
}

export default function PlanReport({ grade, me, rows, bucket, PROGRAM_KIND, EV_STAGE, onBack }) {
  const { adminRoles } = useSession();
  const isCounselor = adminRoles.includes(`counselor_${grade}`);
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(() => readNotes(notesKey(grade)));
  const [photoBy, setPhotoBy] = useState(null);
  const [sigs, setSigs] = useState({ counselor: null, principal: null, stamp: null });
  const counselor = useMemo(() => counselorOf(rows, me, isCounselor), [rows, me, isCounselor]);

  // روابط موقّتة لصور البرامج المنفّذة كلها (حتى ثلاث لكل برنامج)
  useEffect(() => {
    let live = true;
    const paths = rows.filter((p) => p.st.done).flatMap((p) => p.photos ?? []);
    if (!paths.length) { setPhotoBy(new Map()); return undefined; }
    supabase.storage.from(bucket).createSignedUrls(paths, 3600).then(({ data }) => {
      if (live) setPhotoBy(new Map(paths.map((p, i) => [p, data?.[i]?.signedUrl ?? null])));
    });
    return () => { live = false; };
  }, [rows, bucket]);

  useEffect(() => {
    let live = true;
    Promise.all([counselor ? signatureByName(counselor) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([c, p, s]) => { if (live) setSigs({ counselor: c, principal: p?.url ?? null, stamp: s }); });
    return () => { live = false; };
  }, [counselor]);

  const info = useMemo(() => planInfo({
    grade, counselor, yearLabel: academicYearLabel(), termLabel: TERM_LABEL[rows[0]?.term ?? 1] ?? "", today: todayISO(),
  }), [grade, counselor, rows]);

  const pages = useMemo(() => {
    if (!photoBy) return null;
    const withPhotos = rows.map((p) => ({ ...p, photoUrls: (p.photos ?? []).map((x) => photoBy.get(x)).filter(Boolean) }));
    return planPages({ rows: withPhotos, theme, info, notes, sigs, PROGRAM_KIND, EV_STAGE });
  }, [rows, photoBy, theme, info, notes, sigs, PROGRAM_KIND, EV_STAGE]);

  return (
    <ReportViewer id="guidance-plan-print" pages={pages} theme={theme} setTheme={setTheme}
      fileTitle={`الخطة الإرشادية وتقرير تنفيذها - ${info.grade}`}
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للبرامج</button>}>
      <div>
        <label className="text-xs text-muted">ملاحظات الموجه وتوصياته (تظهر في صفحة الاعتماد، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
        <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes}
                  placeholder="مثل: استمرار برامج الوقاية من التنمر، وتكثيف التهيئة للاختبارات قبل نهاية الفصل…"
                  onChange={(e) => { setNotes(e.target.value); writeNotes(notesKey(grade), e.target.value); }} />
      </div>
    </ReportViewer>
  );
}
