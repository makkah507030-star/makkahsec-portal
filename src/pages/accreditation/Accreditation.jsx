// src/pages/accreditation/Accreditation.jsx
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { cmpAr } from "../../lib/sortAr.js";
import { DOMAINS, setupMsg, loadAccData } from "../../lib/accreditation.js";
import Loader from "../../components/Loader.jsx";
import AccPlan from "./AccPlan.jsx";
import AccEvaluation from "./AccEvaluation.jsx";
import AccEvidence from "./AccEvidence.jsx";
import AccTools from "./AccTools.jsx";
import AccCommittee from "./AccCommittee.jsx";
import AccDomainReport from "./AccDomainDoc.jsx";
import AccDashboard from "./AccDashboard.jsx";
import AccNational from "./AccNational.jsx";

/* =====================================================================
   قسم التقويم والاعتماد المدرسي (supabase/acc_1..5.sql، src/lib/accreditation.js) تديره لجنة التميز:
   • المدير ووكيل الشؤون التعليمية والدعم الفني يرون الكل، ويعيّنون مشرف اللجنة.
   • المشرف يرى الكل، ويضيف الأعضاء ويسند لكل منهم مجالات، فيرى العضو مجالاته وحدها.
   التبويبات: اللوحة، والمؤشرات والشواهد، والتقويم الذاتي، والتقويم الخارجي، والاختبارات الوطنية (القدرات والتحصيلي)، وخطة التحسين
   (من تقرير التقويم الذاتي حتى يصدر الخارجي ثم تُحدَّث بنسخة جديدة)، وأدوات التقويم، واللجنة.
   ===================================================================== */

const TABS = [
  ["dash", "لوحة الأداء"], ["ind", "المؤشرات والشواهد"], ["plan", "خطة التحسين"], ["self", "التقويم الذاتي"],
  ["ext", "التقويم الخارجي"], ["nat", "الاختبارات الوطنية"], ["tools", "أدوات التقويم"], ["team", "لجنة التميز"],
];
const pill = (on) => `shrink-0 rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export default function Accreditation() {
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some(([k]) => k === sp.get("tab")) ? sp.get("tab") : "dash";
  const go = (k, extra = {}) => setSp({ tab: k, ...extra }, { replace: true });
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [me, st, ms, rp, pl] = await Promise.all([
      supabase.rpc("acc_me"),
      supabase.from("settings").select("value").eq("key", "active_year").maybeSingle(),
      supabase.rpc("acc_members_list"),
      supabase.from("acc_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("acc_plans").select("*").order("version", { ascending: false }),
    ]);
    const e = me.error || ms.error || rp.error || pl.error;
    if (e) { setErr(setupMsg(e)); setCtx(false); return; }
    setErr("");
    setCtx({
      me: me.data, year: st.data?.value || "1448",
      members: (ms.data ?? []).sort((a, b) => (a.role === "coordinator" ? -1 : 0) - (b.role === "coordinator" ? -1 : 0) || cmpAr(a.full_name, b.full_name)),
      reports: rp.data ?? [], plans: pl.data ?? [],
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (ctx === null) return <Loader />;
  if (err) return <p className="card px-4 py-6 text-sm text-absent">{err}</p>;
  if (!ctx.me?.member) return <p className="card px-4 py-6 text-sm text-muted">قسم التقويم والاعتماد المدرسي لأعضاء لجنة التميز، ولمدير المدرسة ووكيل الشؤون التعليمية.</p>;
  const common = { ...ctx, reload: load, go };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">التقويم والاعتماد المدرسي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          تديره لجنة التميز: التقويم الذاتي والخارجي وتقاريرهما، وخطة التحسين المبنية على مؤشرات الدليل، وشواهد كل مؤشر.
          {!ctx.me.coord && ctx.me.domains.length > 0 && <> مجالاتك: <b className="text-ink">{ctx.me.domains.map((d) => DOMAINS[d]).join("، ")}</b>.</>}
        </p>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map(([k, t]) => <button key={k} className={pill(tab === k)} onClick={() => go(k)}>{t}</button>)}
      </div>
      {sp.get("report") ? <Views sp={sp} tab={tab} {...common} /> : <>
      {tab === "dash" && <AccDashboard {...common} />}
      {tab === "ind" && <AccEvidence {...common} />}
      {tab === "plan" && <AccPlan {...common} />}
      {tab === "self" && <AccEvaluation kind="self" {...common} />}
      {tab === "ext" && <AccEvaluation kind="external" {...common} />}
      {tab === "nat" && <AccNational {...common} />}
      {tab === "tools" && <AccTools {...common} />}
      {tab === "team" && <AccCommittee {...common} />}
      </>}
    </div>
  );
}

/* تقرير المجال لمشرفه (report=1..4) والتقرير العام لمشرف اللجنة (report=all) */
function Views({ sp, go, tab, me, members, reports, plans }) {
  const [data, setData] = useState(null);
  useEffect(() => { loadAccData(plans).then(setData); }, [plans]);
  if (!data) return <Loader />;
  const r = sp.get("report");
  const d = r === "all" ? 0 : Number(r);
  if (!(d === 0 || DOMAINS[d]) || (d === 0 ? !me.coord : !me.coord && !me.domains.includes(d)))
    return <p className="card px-4 py-6 text-sm text-muted">{d === 0 ? "التقرير العام لمشرف اللجنة والمدير." : "تقرير هذا المجال لمشرفه ولمشرف اللجنة."}</p>;
  return <AccDomainReport d={d} data={data} reports={reports} members={members} onClose={() => go(tab)} />;
}
