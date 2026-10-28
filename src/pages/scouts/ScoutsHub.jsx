// src/pages/scouts/ScoutsHub.jsx
import { useState } from "react";
import ScoutTeam from "../admin/ScoutTeam.jsx";
import ScoutStructure from "./ScoutStructure.jsx";
import ScoutAttendance from "./ScoutAttendance.jsx";
import ScoutEvals from "./ScoutEvals.jsx";
import ScoutStats from "./ScoutStats.jsx";
import ScoutReports from "./ScoutReports.jsx";

/* =====================================================================
   الفريق الكشفي — صفحة القائد ونائبه: الأعضاء، والهيكل والطلائع، والتحضير،
   والتقييم الأسبوعي، والتقرير، وبلاغات وكيل شؤون الطلاب (supabase/scouts_5..7.sql).
   ===================================================================== */

const TABS = [
  ["members", "الأعضاء"], ["structure", "الهيكل والطلائع"], ["attendance", "التحضير"],
  ["evals", "التقييم"], ["stats", "التقرير"], ["reports", "بلاغات الوكيل"],
];

export default function ScoutsHub() {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("t") ?? "members");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">الفريق الكشفي</h1>
        <p className="mt-1 text-sm text-muted">الأعضاء ورتبهم، والطلائع بعرفائها ومهامها، وتحضير الاصطفاف والفسحة، والتقييم الأسبوعي وتقريره، والتواصل مع وكيل شؤون الطلاب.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-pill border border-line bg-paper p-1">
        {TABS.map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
                  className={`flex-1 whitespace-nowrap rounded-pill px-3 py-1.5 text-[13px] font-semibold transition-colors ${tab === k ? "bg-mint-deep text-white" : "text-muted hover:bg-canvas"}`}>{t}</button>
        ))}
      </div>
      {tab === "members" && <ScoutTeam embedded />}
      {tab === "structure" && <ScoutStructure />}
      {tab === "attendance" && <ScoutAttendance />}
      {tab === "evals" && <ScoutEvals />}
      {tab === "stats" && <ScoutStats />}
      {tab === "reports" && <ScoutReports />}
    </div>
  );
}
