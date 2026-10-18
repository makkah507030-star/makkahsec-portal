// src/pages/lab/Lab.jsx
// معمل الحاسب الآلي: الحجز، وخريطة الجلوس، والأجهزة، والبلاغات، وقواعد السلامة، وسجل الاستخدام.
// يحجز معلمو التقنية الرقمية المخوّلون من «صلاحيات المعلمين»، ويدير الأجهزة
// والحجوزات محضر معمل الحاسب الآلي ومدير المدرسة والدعم الفني.
import { useState } from "react";
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

const TABS = [
  { key: "lessons", label: "الدروس" },
  { key: "booking", label: "حجز المعمل" },
  { key: "seating", label: "خريطة الجلوس" },
  { key: "devices", label: "سجل الأجهزة" },
  { key: "tickets", label: "البلاغات" },
  { key: "rules", label: "قواعد السلامة" },
  { key: "usage", label: "سجل الاستخدام" },
];

export default function Lab() {
  const { effectiveRole, adminRoles } = useSession();
  const { granted } = useTeacherGrantedTabs();
  // ?report=5 يأتي من رمز QR على خلفية الجهاز (/lab/r/5)، و?tab= من الإشعارات
  const [params, setParams] = useSearchParams();
  // ?report=0 من لوحة البلاغ العامة: يُختار الجهاز من رسم المعمل
  const reportSeat = /^\d+$/.test(params.get("report") ?? "") ? Number(params.get("report")) : null;
  const [tab, setTab] = useState(() =>
    reportSeat != null ? "tickets" : TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "booking");

  const isManager = effectiveRole === "admin" && LAB_MANAGER_ROLES.some((r) => adminRoles.includes(r));
  const canBook = effectiveRole === "teacher" && granted.has("computer_lab");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">معمل الحاسب الآلي</h1>
        <p className="mt-0.5 text-sm text-muted">
          {isManager ? "متابعة حجوزات المعمل وحالة الأجهزة." : "احجز حصتك في المعمل، واطّلع على حالة الأجهزة."}
        </p>
      </div>

      {/* ست تبويبات: سطر واحد يُمرَّر أفقيًا على الجوال بدل التفافها */}
      <div className="flex max-w-full overflow-x-auto rounded-card border border-line bg-paper p-1 sm:inline-flex print:hidden">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`shrink-0 whitespace-nowrap rounded-pill px-4 py-1.5 text-[13px] transition-colors ${
                    tab === t.key ? "bg-mint-deep font-semibold text-white" : "font-medium text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "lessons" && <LabLessons />}
      {tab === "booking" && <LabBooking lab={DEFAULT_LAB} canBook={canBook} isManager={isManager} />}
      {tab === "seating" && <LabSeating lab={DEFAULT_LAB} canEdit={canBook || isManager} />}
      {tab === "devices" && <LabDevices lab={DEFAULT_LAB} isManager={isManager} canEdit={canBook || isManager} />}
      {tab === "rules" && <LabRules lab={DEFAULT_LAB} isManager={isManager} />}
      {tab === "usage" && <LabUsage lab={DEFAULT_LAB} canBook={canBook} isManager={isManager} />}
      {tab === "tickets" && (
        <LabTickets lab={DEFAULT_LAB} canReport={canBook || isManager} isManager={isManager}
                    reportSeat={reportSeat} onReportDone={() => reportSeat != null && setParams({}, { replace: true })} />
      )}
    </div>
  );
}
