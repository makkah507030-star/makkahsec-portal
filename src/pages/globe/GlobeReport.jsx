// src/pages/globe/GlobeReport.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import Loader from "../../components/Loader.jsx";
import { academicYearLabel, TERM_LABEL } from "../studio/lib";
import { useSignedPhotos } from "./shared.jsx";
import { globePages } from "./GlobeReportDoc.jsx";

/* =====================================================================
   «تقرير الخطة» لبرنامج جلوب: خطة البرنامج وخطة الرصد وتوثيق تنفيذهما
   بهوية البوابة (ملوّنة ورسمية)، للطباعة وملف PDF.
   ===================================================================== */

const NOTES_KEY = "globe-plan-notes";
const readNotes = () => { try { return localStorage.getItem(NOTES_KEY) ?? ""; } catch { return ""; } };
const writeNotes = (v) => {
  try { if (v) localStorage.setItem(NOTES_KEY, v); else localStorage.removeItem(NOTES_KEY); } catch { /* تخزين محجوب */ }
};

export default function GlobeReport({ leader, members, onBack }) {
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(readNotes);
  const [data, setData] = useState(null);
  const [sigs, setSigs] = useState({ leader: null, principal: null, stamp: null });

  useEffect(() => {
    Promise.all([
      supabase.from("globe_programs").select("*").order("planned_date", { ascending: true, nullsFirst: false }),
      supabase.from("globe_observations").select("*").order("obs_date").order("obs_time"),
    ]).then(([p, o]) => setData({ programs: p.data ?? [], obs: o.data ?? [] }));
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all([leader ? signatureByName(leader) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([l, p, s]) => { if (live) setSigs({ leader: l, principal: p?.url ?? null, stamp: s }); });
    return () => { live = false; };
  }, [leader]);

  const all = useMemo(() => (data ? [...data.programs, ...data.obs].filter((x) => x.status === "done") : null), [data]);
  const urls = useSignedPhotos(all);

  const info = useMemo(() => {
    const today = todayISO();
    return {
      leader, members: members?.length ?? 0, year: academicYearLabel(),
      termLabel: TERM_LABEL[data?.programs[0]?.term ?? data?.obs[0]?.term ?? 1] ?? "",
      issued: `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`,
      hijri: new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(`${today}T12:00:00`)),
    };
  }, [leader, members, data]);

  const pages = useMemo(() => {
    if (!data || !urls) return null;
    const withUrls = (x) => ({ ...x, photoUrls: (x.photos ?? []).map((p) => urls.get(p)).filter(Boolean) });
    return globePages({ programs: data.programs.map(withUrls), obs: data.obs.map(withUrls), theme, info, notes, sigs, today: todayISO() });
  }, [data, urls, theme, info, notes, sigs]);

  if (!data) return <Loader />;
  return (
    <ReportViewer id="globe-plan-print" pages={pages} theme={theme} setTheme={setTheme}
      fileTitle="خطة برنامج جلوب وتقرير تنفيذها"
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للخطة</button>}>
      <div>
        <label className="text-xs text-muted">ملاحظات منسق البرنامج وتوصياته (تظهر في صفحة الاعتماد، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
        <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes}
                  placeholder="مثل: انتظام رصد الجو والمناخ يوميًا، والتوسع في رصد التربة في الفصل القادم…"
                  onChange={(e) => { setNotes(e.target.value); writeNotes(e.target.value); }} />
      </div>
    </ReportViewer>
  );
}
