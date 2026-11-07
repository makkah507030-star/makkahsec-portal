// src/pages/lab/Lab.jsx
// معمل الحاسب الآلي: الحجز، وخريطة الجلوس، والأجهزة، والبلاغات، وقواعد السلامة، وسجل الاستخدام.
// يحجز معلمو التقنية الرقمية المخوّلون من «صلاحيات المعلمين»، ويدير الأجهزة
// والحجوزات محضر معمل الحاسب الآلي ومدير المدرسة والدعم الفني.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSearchParams } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import { useTeacherGrantedTabs } from "../../lib/useTeacherGrantedTabs.js";
import { LAB_MANAGER_ROLES, DEFAULT_LAB } from "../../lib/lab.js";
import LabBooking from "./LabBooking.jsx";
import LabDevices from "./LabDevices.jsx";
import LabSeating from "./LabSeating.jsx";
import LabTickets from "./LabTickets.jsx";
import LabRules from "./LabRules.jsx";
import LabUsage from "./LabUsage.jsx";
import LabLessons from "./LabLessons.jsx";
import LabRecord from "./LabRecord.jsx";
import LabStudio from "./LabStudio.jsx";
import LabExams from "./exams/LabExams.jsx";

const TABS = [
  { key: "lessons", label: "الدروس" },
  { key: "record", label: "سجل التطبيقات" },
  { key: "booking", label: "حجز المعمل" },
  { key: "seating", label: "خريطة الجلوس" },
  // سجل الأجهزة وقواعد السلامة واستوديو المعمل من أعمال المحضر (ومتابعيه)، لا للمعلمين
  { key: "devices", label: "سجل الأجهزة", manager: true },
  { key: "tickets", label: "البلاغات" },
  { key: "rules", label: "قواعد السلامة", manager: true },
  { key: "usage", label: "سجل الاستخدام" },
  // استوديو المعمل: اللوحات الإرشادية وبطاقات الأجهزة وخلفيات سطح المكتب — لمن يدير المعمل
  { key: "studio", label: "استوديو المعمل", manager: true },
  // مركز اختبارات التقنية الرقمية: النهائي النظري والعملي وبنك الأسئلة (exams/LabExams.jsx)
  { key: "exams", label: "مركز الاختبارات", studio: true },
];

export default function Lab() {
  const { effectiveRole, adminRoles } = useSession();
  const { granted } = useTeacherGrantedTabs();
  // ?report=5 يأتي من رمز QR على خلفية الجهاز (/lab/r/5)، و?tab= من الإشعارات
  const [params, setParams] = useSearchParams();
  // ?report=0 من لوحة البلاغ العامة: يُختار الجهاز من رسم المعمل
  const reportSeat = /^\d+$/.test(params.get("report") ?? "") ? Number(params.get("report")) : null;
  const isManager = effectiveRole === "admin" && LAB_MANAGER_ROLES.some((r) => adminRoles.includes(r));
  const canBook = effectiveRole === "teacher" && granted.has("computer_lab");
  const tabs = TABS.filter((t) => (!t.manager || isManager) && (!t.studio || isManager || canBook));
  const [tab, setTab] = useState(() =>
    reportSeat != null ? "tickets" : tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : "booking");

  // المعامل المفعّلة: يظهر المبدّل حين يكون أكثر من معمل، والاختيار يُحفظ للزيارة القادمة،
  // و?lab= من رمز QR على جهاز المعمل الثاني يفتحه مباشرة
  const [labs, setLabs] = useState([]);
  const [lab, setLab] = useState(() => {
    const q = Number(params.get("lab"));
    if (q) return q;
    try { return Number(localStorage.getItem("mk_lab")) || DEFAULT_LAB; } catch { return DEFAULT_LAB; }
  });
  useEffect(() => {
    supabase.from("labs").select("id, name").eq("is_active", true).order("id").then(({ data }) => {
      const list = data ?? [];
      setLabs(list);
      if (list.length && !list.some((l) => l.id === lab)) setLab(list[0].id);
    });
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const pickLab = (id) => {
    setLab(id);
    try { localStorage.setItem("mk_lab", String(id)); } catch { /* تجاهل */ }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">معمل الحاسب الآلي</h1>
        <p className="mt-0.5 text-sm text-muted">
          {isManager ? "متابعة حجوزات المعمل وحالة الأجهزة." : "احجز حصتك في المعمل، ونفّذ دروسه، وأبلغ عن أعطال الأجهزة."}
        </p>
      </div>

      {labs.length > 1 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {labs.map((l) => (
            <button key={l.id} type="button" onClick={() => pickLab(l.id)}
                    className={`rounded-pill border px-4 py-1.5 text-sm font-semibold transition-colors ${
                      lab === l.id ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-muted hover:text-ink"}`}>
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* ست تبويبات: سطر واحد يُمرَّر أفقيًا على الجوال بدل التفافها */}
      <div className="flex max-w-full overflow-x-auto rounded-card border border-line bg-paper p-1 sm:inline-flex print:hidden">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`shrink-0 whitespace-nowrap rounded-pill px-4 py-1.5 text-[13px] transition-colors ${
                    tab === t.key ? "bg-mint-deep font-semibold text-white" : "font-medium text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "lessons" && <LabLessons key={lab} lab={lab} canCreate={canBook || isManager} />}
      {tab === "record" && <LabRecord key={lab} lab={lab} canEdit={canBook} />}
      {tab === "booking" && <LabBooking key={lab} lab={lab} canBook={canBook} isManager={isManager} />}
      {tab === "seating" && <LabSeating key={lab} lab={lab} canEdit={canBook || isManager} />}
      {tab === "devices" && <LabDevices key={lab} lab={lab} isManager={isManager} canEdit={canBook || isManager} />}
      {tab === "rules" && <LabRules key={lab} lab={lab} isManager={isManager} />}
      {tab === "usage" && <LabUsage key={lab} lab={lab} canBook={canBook} isManager={isManager} />}
      {tab === "studio" && <LabStudio key={lab} lab={lab} />}
      {tab === "exams" && <LabExams key={lab} lab={lab} canCreate={canBook} />}
      {tab === "tickets" && (
        <LabTickets key={lab} lab={lab} canReport={canBook || isManager} isManager={isManager}
                    reportSeat={reportSeat} onReportDone={() => reportSeat != null && setParams({}, { replace: true })} />
      )}
    </div>
  );
}
