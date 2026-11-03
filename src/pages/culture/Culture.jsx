// src/pages/culture/Culture.jsx
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { setupMsg } from "../../lib/culture.js";
import Loader from "../../components/Loader.jsx";
import { useSession } from "../../lib/session.jsx";
import CultDash from "./CultDash.jsx";
import CultPlan from "./CultPlan.jsx";
import { CultMeetings, CultCare, CultOnboard } from "./CultLogs.jsx";
import CultIdeas from "./CultIdeas.jsx";
import CultValues from "./CultValues.jsx";
import CultTeam from "./CultTeam.jsx";
import CultReport from "./CultReport.jsx";
import CultSend from "./CultSend.jsx";
import { useCultMode } from "../../lib/cultMode.js";

/* =====================================================================
   الثقافة المؤسسية — سفير الثقافة (supabase/cult_1..4.sql، src/lib/culture.js):
   • السفير (الأستاذ زياد الحربي) والمدير والوكلاء والدعم الفني: القسم كله.
   • عضو الفريق: يرى القسم ويوثّق التنفيذ. • كل الموظفين: القيم والأدوار، ومشاركة أفكارهم.
   مرتبط بالبوابة: الأحداث (ربط النشاط بحدث)، والإشعارات (رسائل التوعية ومزايا وبطاقات المناسبات)،
   والاستوديو والشهادات والاستطلاعات، وشواهد «التقويم والاعتماد» (cult_4.sql).
   ===================================================================== */

const TEAM_TABS = [
  ["dash", "لوحة التنفيذ"], ["send", "الإجراءات والرسائل"], ["plan", "الخطة التنفيذية"], ["comm", "التواصل الملهم"], ["care", "نهتم بك"],
  ["hayyak", "حيّاك"], ["ideas", "الأفكار والابتكار"], ["values", "القيم والأدوار"], ["report", "التقرير"], ["team", "الفريق"],
];
const STAFF_TABS = [["values", "القيم والأدوار"], ["ideas", "شارك فكرة"]];
const pill = (on) => `shrink-0 rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export default function Culture() {
  const [sp, setSp] = useSearchParams();
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const { session, focusLimited } = useSession();
  const uid = session?.user?.id;
  // في مساحة سفير الثقافة: التبويبات في القائمة الجانبية بدل الأزرار
  const cultMode = useCultMode(uid);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("cult_me");
    if (error) { setErr(setupMsg(error)); setMe(false); return; }
    setErr("");
    // في حساب محضر المعمل (بالتبديل من الدعم الفني): بعضويته في فريق الثقافة وحدها، لا بصلاحية الدعم الفني
    if (focusLimited && data?.all) {
      const { data: t } = await supabase.from("cult_team").select("role").eq("user_id", uid).maybeSingle();
      setMe({ ...data, all: false, amb: t?.role === "ambassador", member: !!t });
      return;
    }
    setMe(data);
  }, [focusLimited, uid]);
  useEffect(() => { load(); }, [load]);

  if (me === null) return <Loader />;
  if (err) return <p className="card px-4 py-6 text-sm text-absent">{err}</p>;
  if (!me.member && !me.staff) return <p className="card px-4 py-6 text-sm text-muted">قسم الثقافة المؤسسية لموظفي المدرسة.</p>;
  const tabs = me.member ? TEAM_TABS : STAFF_TABS;
  const tab = tabs.some(([k]) => k === sp.get("tab")) ? sp.get("tab") : tabs[0][0];
  const go = (k) => setSp({ tab: k }, { replace: true });
  const common = { me, go, reload: load };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">الثقافة المؤسسية</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          قيم نعيشها وتجسّد هويتنا المؤسسية: برامج الثقافة المؤسسية في المدرسة بخطة سفير الثقافة التنفيذية لعام 2026م،
          وقيم الوزارة الخمس (الالتزام، الجودة، الإبداع، روح الفريق، التعلم المستمر).
        </p>
      </div>
      <div className={`-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ${cultMode && me.member ? "lg:hidden" : ""}`}>
        {tabs.map(([k, t]) => <button key={k} className={pill(tab === k)} onClick={() => go(k)}>{t}</button>)}
      </div>
      {tab === "dash" && <CultDash {...common} />}
      {tab === "send" && <CultSend {...common} />}
      {tab === "plan" && <CultPlan {...common} />}
      {tab === "comm" && <CultMeetings {...common} />}
      {tab === "care" && <CultCare {...common} />}
      {tab === "hayyak" && <CultOnboard {...common} />}
      {tab === "ideas" && <CultIdeas {...common} />}
      {tab === "values" && <CultValues {...common} />}
      {tab === "report" && <CultReport {...common} />}
      {tab === "team" && <CultTeam {...common} />}
    </div>
  );
}
