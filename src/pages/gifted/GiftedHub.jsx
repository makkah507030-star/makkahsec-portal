// src/pages/gifted/GiftedHub.jsx
import { useState } from "react";
import { useSession } from "../../lib/session.jsx";
import MawhibaTracker from "./MawhibaTracker.jsx";
import GiftedMembers from "./GiftedMembers.jsx";
import GiftedReport from "./GiftedReport.jsx";
import ProgramPlan from "../globe/ProgramPlan.jsx";
import { GIFTED_KIND, GIFTED_PRESETS, GIFTED_DOMAINS, GIFTED_BUCKET, domainOf } from "../../lib/gifted.js";

/* =====================================================================
   برنامج الموهوبين — صفحة البرنامج (صلاحية «برنامج الموهوبين»، supabase/gifted_1..3.sql):
   متابعة مقياس موهبة لطلاب الأول الثانوي، والطلاب الموهوبون، وخطة البرنامج وتقريرها.
   ===================================================================== */

export const GIFTED_PLAN = {
  table: "gifted_programs", bucket: GIFTED_BUCKET, file: "gifted_3.sql", field: "domain",
  title: "خطة برنامج الموهوبين", sub: "البرامج الإثرائية والتدريبية والمسابقات والزيارات بموعدها، وتوثيق تنفيذها بالمستفيدين والأثر والصور.",
  kinds: GIFTED_KIND, presets: GIFTED_PRESETS, domains: GIFTED_DOMAINS, domainOf, domainLabel: "مجال الموهبة",
  targetHint: "الفئة المستهدفة (مثل: الطلاب الموهوبون، طلاب الأول الثانوي)", emoji: "⭐",
  outcomeHint: "الأثر والملاحظات: ما تحقق من أهداف البرنامج، ونتائج الطلاب ومشاركاتهم…",
};
const TABS = [["mawhiba", "مقياس موهبة"], ["members", "الطلاب الموهوبون"], ["plan", "خطة البرنامج"]];

export default function GiftedHub() {
  const { profile } = useSession();
  const [tab, setTab] = useState("mawhiba");
  if (tab === "report") return <GiftedReport onBack={() => setTab("plan")} />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">برنامج الموهوبين</h1>
        <p className="mt-1 text-sm text-muted">متابعة طلاب الأول الثانوي في مقياس موهبة، والطلاب الموهوبون بمجالاتهم والتواصل معهم، وخطة البرنامج وتقريرها.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-pill border border-line bg-paper p-1">
        {TABS.map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 whitespace-nowrap rounded-pill px-3 py-1.5 text-[13px] font-semibold transition-colors ${tab === k ? "bg-mint-deep text-white" : "text-muted hover:bg-canvas"}`}>{t}</button>
        ))}
      </div>
      {tab === "mawhiba" && <MawhibaTracker />}
      {tab === "members" && <GiftedMembers />}
      {tab === "plan" && <ProgramPlan cfg={GIFTED_PLAN} me={profile?.full_name} onReport={() => setTab("report")} />}
    </div>
  );
}
