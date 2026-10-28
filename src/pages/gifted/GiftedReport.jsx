// src/pages/gifted/GiftedReport.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ROLE_PERSON_NAME } from "../../lib/session.jsx";
import { todayISO } from "../../lib/schoolTime";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import Loader from "../../components/Loader.jsx";
import { academicYearLabel, TERM_LABEL } from "../studio/lib";
import { useSignedPhotos } from "../globe/shared.jsx";
import { programPages } from "../globe/ProgramReportDoc.jsx";
import { GIFTED_KIND, GIFTED_KIND_PLURAL, GIFTED_BUCKET, domainOf } from "../../lib/gifted.js";

/* «تقرير الخطة» لبرنامج الموهوبين بهوية البوابة (ملوّنة ورسمية)، للطباعة وملف PDF. */
const CFG = { title: "خطة برنامج الموهوبين", unit: "برنامج الموهوبين", tag: "star", kinds: GIFTED_KIND, kindPlural: GIFTED_KIND_PLURAL,
              domainOf, signer: "مسؤول برنامج الموهوبين", membersLabel: "الطلاب الموهوبون" };
const NOTES_KEY = "gifted-plan-notes";
const readNotes = () => { try { return localStorage.getItem(NOTES_KEY) ?? ""; } catch { return ""; } };
const writeNotes = (v) => { try { if (v) localStorage.setItem(NOTES_KEY, v); else localStorage.removeItem(NOTES_KEY); } catch { /* تخزين محجوب */ } };

export default function GiftedReport({ onBack }) {
  const leader = (ROLE_PERSON_NAME.gifted_program ?? "").replace(/^الأستاذ:\s*/, "");
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(readNotes);
  const [data, setData] = useState(null);
  const [sigs, setSigs] = useState({ leader: null, principal: null, stamp: null });
  useEffect(() => {
    Promise.all([
      supabase.from("gifted_programs").select("*").order("planned_date", { ascending: true, nullsFirst: false }),
      supabase.from("gifted_members").select("student_id", { count: "exact", head: true }),
    ]).then(([p, m]) => setData({ programs: p.data ?? [], members: m.count ?? 0 }));
    Promise.all([leader ? signatureByName(leader) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([l, p, s]) => setSigs({ leader: l, principal: p?.url ?? null, stamp: s }));
  }, [leader]);
  const done = useMemo(() => (data ? data.programs.filter((p) => p.status === "done") : null), [data]);
  const urls = useSignedPhotos(done, GIFTED_BUCKET);
  const info = useMemo(() => {
    const today = todayISO();
    return { leader, members: data?.members ?? 0, year: academicYearLabel(), termLabel: TERM_LABEL[data?.programs[0]?.term ?? 1] ?? "",
             issued: `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`,
             hijri: new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${today}T12:00:00`)) };
  }, [leader, data]);
  const pages = useMemo(() => {
    if (!data || !urls) return null;
    return programPages({ cfg: CFG, programs: data.programs.map((p) => ({ ...p, photoUrls: (p.photos ?? []).map((x) => urls.get(x)).filter(Boolean) })), theme, info, notes, sigs });
  }, [data, urls, theme, info, notes, sigs]);
  if (!data) return <Loader />;
  return (
    <ReportViewer id="gifted-plan-print" pages={pages} theme={theme} setTheme={setTheme} fileTitle="خطة برنامج الموهوبين وتقرير تنفيذها"
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للخطة</button>}>
      <div>
        <label className="text-xs text-muted">ملاحظات مسؤول البرنامج وتوصياته (تظهر في صفحة الاعتماد، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
        <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes} onChange={(e) => { setNotes(e.target.value); writeNotes(e.target.value); }} />
      </div>
    </ReportViewer>
  );
}
