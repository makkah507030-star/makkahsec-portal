// src/pages/lab/Lab.jsx
// معمل الحاسب الآلي: حجز الحصص وسجل الأجهزة.
// يحجز معلمو التقنية الرقمية المخوّلون من «صلاحيات المعلمين»، ويدير الأجهزة
// والحجوزات محضر معمل الحاسب الآلي ومدير المدرسة والدعم الفني.
import { useState } from "react";
import { useSession } from "../../lib/session.jsx";
import { useTeacherGrantedTabs } from "../../lib/useTeacherGrantedTabs.js";
import { LAB_MANAGER_ROLES, DEFAULT_LAB } from "../../lib/lab.js";
import LabBooking from "./LabBooking.jsx";
import LabDevices from "./LabDevices.jsx";

const TABS = [
  { key: "booking", label: "حجز المعمل" },
  { key: "devices", label: "سجل الأجهزة" },
];

export default function Lab() {
  const { effectiveRole, adminRoles } = useSession();
  const { granted } = useTeacherGrantedTabs();
  const [tab, setTab] = useState("booking");

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

      <div className="inline-flex max-w-full flex-wrap rounded-card border border-line bg-paper p-1 print:hidden">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`rounded-pill px-4 py-1.5 text-[13px] transition-colors ${
                    tab === t.key ? "bg-mint-deep font-semibold text-white" : "font-medium text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "booking"
        ? <LabBooking lab={DEFAULT_LAB} canBook={canBook} isManager={isManager} />
        : <LabDevices lab={DEFAULT_LAB} isManager={isManager} />}
    </div>
  );
}
