// src/pages/accreditation/Accreditation.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { cmpAr } from "../../lib/sortAr.js";
import { DOMAINS, analyze, levelOf, fmtPct, progOf, setupMsg, loadAccData } from "../../lib/accreditation.js";
import Loader from "../../components/Loader.jsx";
import AccPlan from "./AccPlan.jsx";
import AccEvaluation from "./AccEvaluation.jsx";
import AccEvidence from "./AccEvidence.jsx";
import AccTools from "./AccTools.jsx";
import AccCommittee from "./AccCommittee.jsx";
import AccMemberFile from "./AccMemberFile.jsx";
import AccDomainReport from "./AccDomainDoc.jsx";

/* =====================================================================
   قسم التقويم والاعتماد المدرسي (supabase/acc_1..3.sql، src/lib/accreditation.js) تديره لجنة التميز:
   • المدير ووكيل الشؤون التعليمية والدعم الفني يرون الكل، ويعيّنون مشرف اللجنة.
   • المشرف يرى الكل، ويضيف الأعضاء ويسند لكل منهم مجالات، فيرى العضو مجالاته وحدها.
   التبويبات: اللوحة، والمؤشرات والشواهد، والتقويم الذاتي، والتقويم الخارجي، وخطة التحسين
   (من تقرير التقويم الذاتي حتى يصدر الخارجي ثم تُحدَّث بنسخة جديدة)، وأدوات التقويم، واللجنة.
   ===================================================================== */

const TABS = [
  ["dash", "لوحة الأداء"], ["ind", "المؤشرات والشواهد"], ["plan", "خطة التحسين"], ["self", "التقويم الذاتي"],
  ["ext", "التقويم الخارجي"], ["tools", "أدوات التقويم"], ["team", "لجنة التميز"],
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
      {sp.get("file") || sp.get("report") ? <Views sp={sp} tab={tab} {...common} /> : <>
      {tab === "dash" && <Dashboard {...common} />}
      {tab === "ind" && <AccEvidence {...common} />}
      {tab === "plan" && <AccPlan {...common} />}
      {tab === "self" && <AccEvaluation kind="self" {...common} />}
      {tab === "ext" && <AccEvaluation kind="external" {...common} />}
      {tab === "tools" && <AccTools {...common} />}
      {tab === "team" && <AccCommittee {...common} />}
      </>}
    </div>
  );
}

/* الملف الرقمي لعضو (file=) وتقرير المجال (report=): يُحمَّلان ببيانات الخطة السارية والشواهد والمحاضر */
function Views({ sp, go, tab, me, members, reports, plans }) {
  const [data, setData] = useState(null);
  useEffect(() => { loadAccData(plans).then(setData); }, [plans]);
  if (!data) return <Loader />;
  const fileId = sp.get("file");
  const d = Number(sp.get("report"));
  if (d && DOMAINS[d]) {
    if (!me.coord && !me.domains.includes(d)) return <p className="card px-4 py-6 text-sm text-muted">تقرير هذا المجال لمشرفه ولمشرف اللجنة.</p>;
    return <AccDomainReport d={d} data={data} reports={reports} members={members} onClose={() => go(tab, fileId ? { file: fileId } : {})} />;
  }
  const m = members.find((x) => x.user_id === fileId);
  if (!m) return <p className="card px-4 py-6 text-sm text-muted">لم يُعثر على العضو في لجنة التميز.</p>;
  return <AccMemberFile m={m} data={data} reports={reports} onBack={() => go("team")} onReport={(x) => go(tab, { file: fileId, report: String(x) })} />;
}

/* لوحة الأداء: نتيجة آخر تقرير، والخطة السارية وإنجازها، ومحطات المتابعة */
function Dashboard({ me, reports, plans, members, go }) {
  const { profile } = useSession();
  const self = members.find((m) => m.user_id === profile?.id);
  const selfRep = reports.find((r) => r.kind === "self");
  const ext = reports.find((r) => r.kind === "external");
  const base = ext ?? selfRep;
  const a = useMemo(() => analyze(base?.scores ?? {}), [base]);
  const plan = plans.find((p) => p.status === "active") ?? plans[0];
  const [progs, setProgs] = useState(null);
  const [ev, setEv] = useState({});
  useEffect(() => {
    if (plan) supabase.from("acc_programs").select("id, kind, code, domain, methods").eq("plan_id", plan.id).then(({ data }) => setProgs(data ?? []));
    else setProgs([]);
    supabase.from("acc_evidence").select("domain").then(({ data }) => {
      const m = {}; (data ?? []).forEach((x) => { m[x.domain] = (m[x.domain] ?? 0) + 1; }); setEv(m);
    });
  }, [plan]);
  const lv = levelOf(a.overall);
  const inPlan = (progs ?? []).filter((p) => p.kind === "plan");
  const avgDone = inPlan.length ? Math.round(inPlan.reduce((s, p) => s + progOf(p).done, 0) / inPlan.length) : 0;
  const doms = Object.keys(DOMAINS).filter((d) => me.coord || me.domains.includes(+d));
  const next = (plan?.milestones ?? []).find((m) => !m.done_at);

  return (
    <div className="space-y-4">
      {self && <div className="flex flex-wrap gap-2">
        <button className="rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white" onClick={() => go("dash", { file: self.user_id })}>ملفي الرقمي</button>
        {(self.role === "coordinator" ? [1, 2, 3, 4] : self.domains).map((d) => <button key={d} className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs text-mint-deep" onClick={() => go("dash", { report: String(d) })}>تقرير مجال {DOMAINS[d]}</button>)}
      </div>}
      {!base && (
        <div className="card space-y-2 p-4 text-sm">
          <p className="font-semibold text-ink">ابدأ من تقرير التقويم الذاتي</p>
          <p className="text-muted">ارفع تقرير الأداء المدرسي وأدخل نسب مؤشراته، أو استورد بيانات 1448هـ من ملف خطة المدرسة، فتظهر هنا النتائج والخطة.</p>
          {me.coord && <div className="flex flex-wrap gap-2"><button className="btn-primary px-4 py-1.5 text-xs" onClick={() => go("plan")}>استيراد خطة 1448هـ</button>
            <button className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted" onClick={() => go("self")}>رفع تقرير التقويم الذاتي</button></div>}
        </div>
      )}
      {base && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi t="الأداء العام" v={fmtPct(a.overall)} sub={lv?.t} c={lv?.c} />
          <Kpi t="المؤشرات المقاسة" v={a.measured} sub={`من 47 · ${ext ? "التقويم الخارجي" : "التقويم الذاتي"}`} />
          <Kpi t="ضمن خطة التحسين" v={inPlan.length} sub={plan ? `إنجاز البرامج ${avgDone}%` : "لا خطة بعد"} />
          <Kpi t="الشواهد" v={Object.values(ev).reduce((s, x) => s + x, 0)} sub={me.coord ? "في كل المجالات" : "في مجالاتك"} />
        </div>
      )}
      {base && (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">المجالات</p>
          {doms.map((d) => {
            const v = a.byDomain[d]; const l = levelOf(v);
            const mine = inPlan.filter((p) => p.domain === +d);
            return (
              <div key={d} className="grid items-center gap-2 sm:grid-cols-[160px_1fr_auto]">
                <span className="text-sm text-ink">{DOMAINS[d]}</span>
                <span className="h-2.5 overflow-hidden rounded-pill bg-canvas"><span className="block h-full rounded-pill" style={{ width: `${v ?? 0}%`, background: l?.c }} /></span>
                <span className="num text-xs text-muted">{fmtPct(v)} · {l?.t ?? "—"} · {mine.length} في الخطة · {ev[d] ?? 0} شاهدًا</span>
              </div>
            );
          })}
        </section>
      )}
      {base && a.low.length > 0 && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-semibold text-ink">أولويات التحسين (الأدنى)</p>
          <div className="flex flex-wrap gap-1.5">{a.low.map((c) => (
            <button key={c} onClick={() => go("ind", { code: c })} className="rounded-pill border border-line bg-white px-3 py-1 text-xs text-ink hover:border-mint-light">
              <span className="num font-bold">{c}</span> · <span className="num text-absent">{base.scores[c]}%</span></button>
          ))}</div>
        </section>
      )}
      {next && <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-sm text-mint-deep">المحطة القادمة في الخطة: <b>{next.title}</b> — {next.due} ({next.owner})</p>}
    </div>
  );
}

function Kpi({ t, v, sub, c }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{t}</p>
      <p className="num mt-1 text-2xl font-bold" style={{ color: c ?? "rgb(var(--c-ink))" }}>{v}</p>
      {sub && <p className="mt-0.5 text-[11px] text-faint">{sub}</p>}
    </div>
  );
}
