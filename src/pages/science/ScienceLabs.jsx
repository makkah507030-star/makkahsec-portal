// src/pages/science/ScienceLabs.jsx
// مختبرات العلوم (supabase/sci_lab_*.sql): الأحياء والكيمياء والفيزياء. لكل مختبر: الحجز، والخطة الفصلية
// للتجارب، وسجل التنفيذ، والعهدة، والتقارير بهوية البوابة. يديره محضره (ومعه مدير المدرسة والدعم الفني
// ووكيل الشؤون المدرسية)، ويحجزه معلمو المادة بحسب تخصصهم أو جدولهم.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession, ROLE_PERSON_NAME } from "../../lib/session.jsx";
import { signatureByName } from "../../lib/userSignatures";
import { loadSchoolStamp } from "../../lib/principalSignature";
import { useBackStep } from "../../lib/backStep.js";
import Loader from "../../components/Loader.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { SCI_LABS, labOf, managedLabs, myTeacherLabs, loadExperiments, setupMsg } from "../../lib/sciLab.js";
import SciBooking from "./SciBooking.jsx";
import SciPlan from "./SciPlan.jsx";
import SciRuns from "./SciRuns.jsx";
import SciInventory from "./SciInventory.jsx";
import SciReports from "./SciReports.jsx";
import { planPages, logPages, inventoryPages } from "./SciDocs.jsx";
import VirtualLabsGuide from "./VirtualLabsGuide.jsx";

const TABS = [
  { key: "booking", label: "حجز المختبر" },
  { key: "plan", label: "الخطة الفصلية" },
  { key: "runs", label: "سجل التنفيذ" },
  { key: "inventory", label: "العهدة", manager: true },   // للمحضر (ومتابعيه)، لا للمعلمين
  { key: "reports", label: "التقارير", manager: true },
];
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[13px] font-semibold ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`;
const DEPUTY = (ROLE_PERSON_NAME.deputy_school ?? "").replace(/^الأستاذ:\s*/, "");

export default function ScienceLabs() {
  const { adminRoles = [] } = useSession();
  const [params, setParams] = useSearchParams();
  const managed = managedLabs(adminRoles);
  const [teach, setTeach] = useState(null);
  useEffect(() => { myTeacherLabs().then(setTeach); }, []);
  const labs = useMemo(() => SCI_LABS.filter((l) => managed.includes(l.key) || (teach ?? []).includes(l.key)), [managed, teach]);
  const [lab, setLab] = useState(() => params.get("lab") ?? "");
  useEffect(() => { if (labs.length && !labs.some((l) => l.key === lab)) setLab(labs[0].key); }, [labs, lab]);
  const [tab, setTab] = useState(() => (TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "booking"));
  const isManager = managed.includes(lab);
  const canBook = isManager || (teach ?? []).includes(lab);

  const [exps, setExps] = useState(null);
  const [classes, setClasses] = useState([]);
  const [myTeacher, setMyTeacher] = useState(null);
  const [prep, setPrep] = useState("");
  const [err, setErr] = useState("");
  const [doc, setDoc] = useState(null);   // { title, build(theme, sigs) }
  useBackStep(!!doc, () => setDoc(null), "مختبرات العلوم");

  const loadExps = useCallback(() => lab && loadExperiments(lab).then(setExps, (e) => { setErr(setupMsg(e)); setExps([]); }), [lab]);
  useEffect(() => {
    if (!lab) return;
    setExps(null); setErr(""); loadExps();
    supabase.rpc("sci_classes", { p_lab: lab }).then(({ data }) => setClasses(data ?? []));
    supabase.rpc("sci_my_teacher").then(({ data }) => setMyTeacher(data ?? null));
    supabase.from("admin_roles").select("users(full_name)").eq("role_type", labOf(lab).role).limit(1)
      .then(({ data }) => setPrep(data?.[0]?.users?.full_name ?? ""));
    setParams((p) => { p.set("lab", lab); p.set("tab", tab); return p; }, { replace: true });
  }, [lab]);   // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (t) => { setTab(t); setParams((p) => { p.set("tab", t); return p; }, { replace: true }); };

  if (teach === null) return <Loader />;
  if (!labs.length) return <p className="card px-4 py-8 text-center text-sm text-muted">مختبرات العلوم لمعلمي الأحياء والكيمياء والفيزياء ومحضريها.</p>;
  if (doc) return <Doc doc={doc} prep={prep} onBack={() => setDoc(null)} />;

  const L = labOf(lab);
  const teachers = [...new Set(classes.map((c) => c.teacher_name))].join("، ");
  const print = {
    plan: (course) => setDoc({ title: `الخطة الفصلية — ${course}`, pages: (theme, s, year) => planPages({ lab: L, course, exps: exps.filter((e) => e.course === course && e.is_active),
      teachers: [...new Set(classes.filter((c) => c.grade === exps.find((e) => e.course === course)?.grade).map((c) => c.teacher_name))].join("، ") || teachers, theme, year, s }) }),
    runs: (course, klass) => setDoc({ title: `سجل التنفيذ — ${course}`, load: () => supabase.from("sci_runs").select("*, teachers(full_name), classes(class_no)")
      .eq("class_id", klass?.class_id).in("experiment_id", exps.filter((e) => e.course === course).map((e) => e.id)).then(({ data }) => data ?? []),
      pages: (theme, s, year, runs) => logPages({ lab: L, course, klass, exps: exps.filter((e) => e.course === course && e.is_active), runs, theme, year, s }) }),
    inventory: (items) => setDoc({ title: `كشف العهدة — ${L.name}`, pages: (theme, s, year) => inventoryPages({ lab: L, items, theme, year, s }) }),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">مختبرات العلوم</h1>
        <p className="mt-0.5 text-sm text-muted">
          {isManager ? "حجوزات المختبر وتجهيزها، والخطة الفصلية للتجارب وسجل تنفيذها، والعهدة والتقارير." : "احجز حصتك في المختبر لتجربة من الخطة، وسجّل تنفيذها بعد الحصة."}
        </p>
      </div>
      <VirtualLabsGuide />
      {labs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {labs.map((l) => <button key={l.key} className={pill(l.key === lab)} onClick={() => setLab(l.key)}>{l.name}</button>)}
        </div>
      )}
      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.filter((t) => !t.manager || isManager).map((t) => (
          <button key={t.key} onClick={() => pick(t.key)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-mint-deep text-mint-deep" : "border-transparent text-muted"}`}>{t.label}</button>
        ))}
      </div>
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      {exps === null ? <Loader /> : (
        <>
          {tab === "booking" && <SciBooking lab={lab} exps={exps} classes={classes} myTeacher={myTeacher} isManager={isManager} canBook={canBook} />}
          {tab === "plan" && <SciPlan key={lab} lab={lab} exps={exps} isManager={isManager} onChanged={loadExps} onPrint={print.plan} />}
          {tab === "runs" && <SciRuns key={lab} lab={lab} exps={exps} classes={classes} myTeacher={myTeacher} isManager={isManager} onPrint={print.runs} />}
          {tab === "inventory" && isManager && <SciInventory key={lab} lab={lab} isManager={isManager} onPrint={print.inventory} />}
          {tab === "reports" && isManager && <SciReports key={lab} lab={lab} exps={exps} classes={classes} onPrint={setDoc} prep={prep} />}
        </>
      )}
    </div>
  );
}

/* عرض المستند: الرسمي بترويسة الوزارة افتراضيًا، والتوقيعات للمحضر ووكيل الشؤون المدرسية */
function Doc({ doc, prep, onBack }) {
  const [theme, setTheme] = useState("official");
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([prep ? signatureByName(prep) : null, DEPUTY ? signatureByName(DEPUTY) : null, loadSchoolStamp(),
      supabase.from("settings").select("value").eq("key", "active_year").maybeSingle(), doc.load ? doc.load() : null])
      .then(([ps, ds, stamp, y, data]) => live && setExtra({ s: { prep, prepSig: ps, deputy: DEPUTY, deputySig: ds, stamp }, year: y?.data?.value ?? "", data }));
    return () => { live = false; };
  }, [doc, prep]);
  const pages = useMemo(() => (extra ? doc.pages(theme, extra.s, extra.year, extra.data) : []), [doc, extra, theme]);
  if (!extra) return <Loader />;
  return (
    <ReportViewer id="sci-doc" pages={pages} theme={theme} setTheme={setTheme} fileTitle={doc.title}
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع</button>} />
  );
}
