// src/pages/accreditation/AccPlan.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import {
  CODES, DOMAINS, DOMAIN_COLOR, STANDARDS, INDICATORS, PLAN_BELOW, domainOf, LEVEL_T, PLAN_STATUS, levelOf, stdOf, progOf, fmtPct, setupMsg,
} from "../../lib/accreditation.js";
import { SELF_1448, PROGRAMS_1448, SUSTAIN_1448, MILESTONES_1448 } from "../../lib/accPlan1448.js";
import Loader from "../../components/Loader.jsx";
import AccPlanReport from "./AccPlanDoc.jsx";

/* =====================================================================
   خطة التحسين المبنية على مؤشرات الدليل (supabase/acc_2.sql): لكل مؤشر دون المستهدف برنامج
   بمبادرته وأساليب تنفيذه وشواهده ومؤشر قياسه، وجدول «قياس نواتج المبادرات والبرامج» يعبّئه
   الفريق المكلف (التنفيذ ودرجة الإنجاز وتحقق الأهداف)، ولمؤشرات التقدم والتميز إجراء استدامة.
   النسخة الأولى من تقرير التقويم الذاتي، وبعد صدور التقويم الخارجي تُنسخ نسخة تُحدَّث وتُعتمد.
   ===================================================================== */

const lines = (s) => String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const gap = (p) => (p.current == null || p.target == null ? null : Math.round((p.target - p.current) * 100) / 100);

export default function AccPlan({ me, year, plans, reports, members, reload }) {
  const { profile } = useSession();
  const [, setMsg] = useNotice(null);
  const [planId, setPlanId] = useState(null);
  const plan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.status === "active") ?? plans[0];
  const [progs, setProgs] = useState(null);
  const [dom, setDom] = useState(0);
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [susEdit, setSusEdit] = useState(null);
  const loadProgs = () => plan
    ? supabase.from("acc_programs").select("*").eq("plan_id", plan.id).order("code").then(({ data, error }) => { if (error) setMsg({ ok: false, text: setupMsg(error) }); setProgs(data ?? []); })
    : setProgs([]);
  useEffect(() => { setProgs(null); loadProgs(); }, [plan?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const doms = Object.keys(DOMAINS).map(Number).filter((d) => me.coord || me.domains.includes(d));
  const editProps = { planId: plan?.id, doms, canDelete: me.coord && plan?.status !== "archived" };
  const canEditP = (p) => plan?.status !== "archived" && (me.coord || me.domains.includes(p.domain));
  const list = (progs ?? []).filter((p) => !dom || p.domain === dom);
  const inPlan = list.filter((p) => p.kind === "plan");
  const sustain = list.filter((p) => p.kind === "sustain");

  // استيراد خطة المدرسة 1448هـ: تقرير التقويم الذاتي بنسبه، والنسخة الأولى بكل برامجها
  // استيراد خطة المدرسة 1448هـ: تقرير التقويم الذاتي بنسبه، والنسخة الأولى بكل برامجها.
  // يُستكمل إن أُنشئت النسخة من قبل بلا برامج (into)، ولا يكرر ما أُدخل.
  const importPlan = async (into = null) => {
    if (!window.confirm(into ? "إكمال استيراد برامج خطة 1448هـ في هذه النسخة؟"
      : "استيراد خطة 1448هـ من ملف المدرسة؟ يُنشأ تقرير التقويم الذاتي بنسبه، ونسخة أولى من الخطة فيها 23 برنامجًا و24 إجراءً للاستدامة.")) return;
    setBusy(true); setImportErr("");
    const fail = (e, step) => { setBusy(false); const t = `${step}: ${setupMsg(e)}`; setImportErr(t); setMsg({ ok: false, text: t }); };
    const by = profile?.full_name ?? null;
    let pl = into;
    if (!pl) {
      // الأداء العام الرسمي في تقرير 1448هـ: 75% (التقدم)
      const scores = { ...Object.fromEntries(Object.entries(SELF_1448).filter(([, [v]]) => v != null).map(([c, [v]]) => [c, v])), _overall: 75 };
      let rep = reports.find((r) => r.kind === "self" && r.academic_year === year);
      if (!rep) {
        const { data, error } = await supabase.from("acc_reports").insert({ kind: "self", academic_year: year, title: `تقرير التقويم الذاتي ${year}هـ`, scores, created_by_name: by }).select().single();
        if (error) return fail(error, "تقرير التقويم الذاتي");
        rep = data;
      }
      const { data, error } = await supabase.from("acc_plans").insert({
        academic_year: year, version: 1, title: `خطة التحسين والتطوير ${year}هـ`, source: "self", report_id: rep.id,
        milestones: MILESTONES_1448, created_by_name: by }).select().single();
      if (error) return fail(error, "إنشاء الخطة");
      pl = data;
    }
    // كل صف بالحقول نفسها: الإدراج الجماعي يملأ الحقل الغائب بقيمة فارغة لا بالافتراضية، فيُرفض
    const have = new Set((into ? progs ?? [] : []).map((p) => p.code));
    const row = (o) => ({ plan_id: pl.id, semester: null, team: [], methods: [], evidence: [], follow: null, period: null, measure: null,
      needs: null, rec: null, owner: null, ...o });
    const rows = [
      ...PROGRAMS_1448.map((p, i) => row({ kind: "plan", code: p.code, current: SELF_1448[p.code][0], target: SELF_1448[p.code][1],
        semester: p.semester, team: p.team, initiative: p.initiative, methods: p.methods.map((t) => ({ t })), evidence: p.evidence,
        follow: p.follow, period: p.period, measure: p.measure, needs: p.needs ?? null, rec: p.rec, sort: i })),
      ...SUSTAIN_1448.map(([code, initiative, owner], i) => row({ kind: "sustain", code, current: SELF_1448[code][0],
        target: SELF_1448[code][1], initiative, owner, sort: 100 + i })),
    ].filter((r) => !have.has(r.code));
    if (rows.length) {
      const { error } = await supabase.from("acc_programs").insert(rows);
      if (error) return fail(error, "إدخال البرامج");
    }
    if (pl.status !== "active") await supabase.rpc("acc_plan_activate", { p_plan: pl.id });
    setBusy(false);
    setMsg({ ok: true, text: "استُوردت خطة 1448هـ وأصبحت النسخة السارية." }); setPlanId(pl.id); loadProgs(); reload();
  };

  const newVersion = async () => {
    const ext = reports.find((r) => r.kind === "external");
    const t = window.prompt(ext ? "عنوان النسخة الجديدة (تُحدَّث النسب من تقرير التقويم الخارجي):" : "لا تقرير خارجي بعد؛ تُنسخ الخطة كما هي. عنوان النسخة:",
      ext ? `خطة التحسين بعد التقويم الخارجي ${plan.academic_year}هـ` : `${plan.title} — تحديث`);
    if (!t) return;
    const { data, error } = await supabase.rpc("acc_plan_copy", { p_plan: plan.id, p_report: ext?.id ?? null, p_title: t });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "أُنشئت نسخة جديدة مسودة: عدّلها ثم اعتمدها لتصبح السارية." }); setPlanId(data); reload();
  };
  const activate = async () => {
    if (!window.confirm("اعتماد هذه النسخة؟ تصبح الخطة السارية وتُؤرشف النسخة السابقة للاطلاع.")) return;
    const { error } = await supabase.rpc("acc_plan_activate", { p_plan: plan.id });
    if (error) setMsg({ ok: false, text: error.message }); else { setMsg({ ok: true, text: "اعتُمدت النسخة." }); reload(); }
  };
  const toggleMile = async (i) => {
    const milestones = plan.milestones.map((m, k) => (k === i ? { ...m, done_at: m.done_at ? null : new Date().toISOString() } : m));
    const { error } = await supabase.from("acc_plans").update({ milestones }).eq("id", plan.id);
    if (error) setMsg({ ok: false, text: error.message }); else reload();
  };

  if (!plan) return (
    <div className="card space-y-2 p-4 text-sm">
      <p className="font-semibold text-ink">لا خطة تحسين بعد</p>
      <p className="text-muted">الخطة الحالية مبنية على تقرير التقويم الذاتي حتى يصدر تقرير التقويم الخارجي، ثم تُحدَّث بنسخة جديدة.</p>
      {me.coord ? <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={() => importPlan()}>{busy ? "جارٍ الاستيراد…" : "استيراد خطة 1448هـ من ملف المدرسة"}</button>
        : <p className="text-faint">يستوردها مشرف اللجنة.</p>}
      {importErr && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs leading-relaxed text-absent">تعذّر الاستيراد — {importErr}</p>}
    </div>
  );
  if (!progs) return <Loader />;
  // نسخة أُنشئت بلا برامج (تعثّر استيراد سابق): إكمال الاستيراد فيها
  if (!progs.length && plan.status !== "archived") return (
    <div className="card space-y-2 p-4 text-sm">
      <p className="font-semibold text-ink">{plan.title} — بلا برامج بعد</p>
      <p className="text-muted">أُنشئت هذه النسخة ولم تُدخل برامجها. أكمل الاستيراد لتُضاف البرامج الـ23 وإجراءات الاستدامة الـ24 وتصبح الخطة السارية.</p>
      {me.coord ? <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={() => importPlan(plan)}>{busy ? "جارٍ الاستيراد…" : "إكمال استيراد خطة 1448هـ"}</button>
        : <p className="text-faint">يكمله مشرف اللجنة.</p>}
      {importErr && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs leading-relaxed text-absent">تعذّر الاستيراد — {importErr}</p>}
    </div>
  );
  if (report) return <AccPlanReport plan={plan} progs={progs} reports={reports} members={members} onClose={() => setReport(false)} />;
  const st = PLAN_STATUS[plan.status];
  const ext = reports.find((r) => r.id === plan.report_id && r.kind === "external");

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{plan.title}</p>
            <p className="text-xs text-muted">النسخة {plan.version} · مصدرها {plan.source === "external" ? "تقرير التقويم الخارجي" : "تقرير التقويم الذاتي"}
              {plan.approved_at && <> · اعتُمدت {fmtDate(plan.approved_at)}{plan.approved_by_name && ` (${plan.approved_by_name})`}</>}</p>
          </div>
          <span className={`chip ${st.c}`}>{st.t}</span>
        </div>
        {plans.length > 1 && (
          <div className="flex flex-wrap gap-1.5">{plans.map((p) => (
            <button key={p.id} onClick={() => setPlanId(p.id)} className={`rounded-pill border px-3 py-1 text-xs ${p.id === plan.id ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted"}`}>
              النسخة {p.version} · {PLAN_STATUS[p.status].t}</button>))}</div>
        )}
        {plan.source === "self" && plan.status === "active" && <p className="rounded-sm2 bg-canvas px-3 py-2 text-xs text-muted">الخطة مبنية على تقرير التقويم الذاتي حتى يصدر تقرير التقويم الخارجي، فتُنسخ نسخة جديدة بنسبه وتُعدَّل وتُعتمد.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="rounded-pill border border-line px-3 py-1.5 text-xs text-mint-deep" onClick={() => setReport(true)}>تقرير الخطة للطباعة</button>
          {me.coord && plan.status !== "archived" && <button className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted" onClick={newVersion}>نسخة جديدة {reports.some((r) => r.kind === "external") ? "بعد التقويم الخارجي" : ""}</button>}
          {me.coord && plan.status === "draft" && <button className="btn-primary px-4 py-1.5 text-xs" onClick={activate}>اعتماد هذه النسخة</button>}
        </div>
      </section>

      {ext && plan.status === "draft" && <Suggest plan={plan} progs={progs} ext={ext} me={me} onChange={loadProgs} setMsg={setMsg} />}

      {doms.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {[0, ...doms].map((d) => <button key={d} onClick={() => setDom(d)} className={`rounded-pill border px-3 py-1 text-xs ${dom === d ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted"}`}>
            {d ? DOMAINS[d] : "كل المجالات"} <span className="num">({(progs ?? []).filter((p) => p.kind === "plan" && (!d || p.domain === d)).length})</span></button>)}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm font-semibold text-ink">برامج الخطة <span className="num text-muted">({inPlan.length})</span></p>
          {me.coord && plan.status !== "archived" && !adding && <button className="rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setAdding(true)}>+ برنامج جديد</button>}
        </div>
        {adding && <div className="card overflow-hidden"><ProgramEdit p={{ kind: "plan", code: "", methods: [], team: [], evidence: [], follow: "فريق التقويم الذاتي" }} {...editProps}
          by={profile?.full_name} setMsg={setMsg} onDone={(ok) => { setAdding(false); if (ok) loadProgs(); }} /></div>}
        {inPlan.length === 0 && <p className="card px-4 py-6 text-center text-sm text-muted">لا برامج في {dom ? DOMAINS[dom] : "مجالاتك"}.</p>}
        {inPlan.map((p) => <Program key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)}
          canEdit={canEditP(p)} edit={editProps} by={profile?.full_name} onSaved={loadProgs} setMsg={setMsg} />)}
      </section>

      {sustain.length > 0 && (
        <section className="card overflow-hidden">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">جدول الاستدامة — مؤشرات في مستوى التقدم والتميز <span className="num text-muted">({sustain.length})</span></p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">الرمز</th><th className="p-2">الحالي</th><th className="p-2">المستهدف</th><th className="p-2">إجراء الاستدامة</th><th className="p-2">المسؤول</th><th className="p-2" /></tr></thead>
              <tbody className="divide-y divide-line/60">{sustain.map((p) => (
                <tr key={p.id}><td className="num p-2 font-bold text-ink" title={INDICATORS[p.code]}>{p.code}</td>
                  <td className="num p-2" style={{ color: levelOf(p.current)?.c }}>{fmtPct(p.current)}</td><td className="num p-2 text-muted">{fmtPct(p.target)}</td>
                  <td className="p-2 text-ink">{p.initiative}</td><td className="p-2 text-xs text-muted">{p.owner ?? "—"}</td>
                  <td className="p-2">{canEditP(p) && <button className="text-[11px] font-semibold text-mint-deep" onClick={() => setSusEdit(p)}>تعديل</button>}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {susEdit && <ProgramEdit key={susEdit.id} p={susEdit} {...editProps} by={profile?.full_name} setMsg={setMsg} onDone={(ok) => { setSusEdit(null); if (ok) loadProgs(); }} />}
        </section>
      )}

      {plan.milestones?.length > 0 && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-semibold text-ink">المتابعة والاعتماد</p>
          <div className="divide-y divide-line/60">{plan.milestones.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className={m.done_at ? "text-present" : "text-faint"}>{m.done_at ? "✓" : "○"}</span>
              <span className="min-w-0 flex-1 text-ink">{m.title}</span>
              <span className="text-xs text-muted">{m.due} · {m.owner}</span>
              {me.coord && plan.status !== "archived" && <button className="text-[11px] text-mint-deep" onClick={() => toggleMile(i)}>{m.done_at ? "تراجع" : "تمّت"}</button>}
            </div>
          ))}</div>
        </section>
      )}
    </div>
  );
}

/* مقترحات تحديث النسخة بعد التقويم الخارجي */
function Suggest({ plan, progs, ext, me, onChange, setMsg }) {
  const has = new Map(progs.map((p) => [p.code, p]));
  const add = Object.entries(ext.scores).filter(([c, v]) => INDICATORS[c] && v < PLAN_BELOW && has.get(c)?.kind !== "plan").map(([c]) => c);
  const reached = progs.filter((p) => p.kind === "plan" && p.current != null && p.target != null && p.current >= p.target);
  if (!add.length && !reached.length) return null;
  const toPlan = async (c) => {
    const p = has.get(c);
    const row = { kind: "plan", current: ext.scores[c], target: Math.max(PLAN_BELOW, Math.ceil(ext.scores[c] + 5)), follow: "فريق التقويم الذاتي" };
    const { error } = p ? await supabase.from("acc_programs").update(row).eq("id", p.id)
      : await supabase.from("acc_programs").insert({ ...row, plan_id: plan.id, code: c, sort: 50 });
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  const toSustain = async (p) => {
    const { error } = await supabase.from("acc_programs").update({ kind: "sustain", owner: p.team?.[0] ?? null }).eq("id", p.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  return (
    <section className="card space-y-2 border-late/40 p-4 text-sm">
      <p className="font-semibold text-ink">مقترحات التحديث من تقرير التقويم الخارجي</p>
      {add.length > 0 && <div><p className="text-xs text-muted">دون {PLAN_BELOW}% وليست في الخطة:</p>
        <div className="mt-1 flex flex-wrap gap-1.5">{add.map((c) => (
          <button key={c} disabled={!me.coord} onClick={() => toPlan(c)} className="rounded-pill border border-line bg-white px-3 py-1 text-xs"><span className="num font-bold">{c}</span> · <span className="num text-absent">{ext.scores[c]}%</span> {me.coord && "← إلى الخطة"}</button>))}</div></div>}
      {reached.length > 0 && <div><p className="text-xs text-muted">بلغت مستهدفها، فيمكن نقلها إلى الاستدامة:</p>
        <div className="mt-1 flex flex-wrap gap-1.5">{reached.map((p) => (
          <button key={p.id} disabled={!me.coord} onClick={() => toSustain(p)} className="rounded-pill border border-line bg-white px-3 py-1 text-xs"><span className="num font-bold">{p.code}</span> · <span className="num text-present">{p.current}%</span> {me.coord && "← إلى الاستدامة"}</button>))}</div></div>}
    </section>
  );
}

function Program({ p, open, onToggle, canEdit, edit, by, onSaved, setMsg }) {
  const lv = levelOf(p.current);
  const pr = progOf(p);
  const g = gap(p);
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 p-3 text-start">
        <span className="num rounded-sm2 px-2 py-1 text-xs font-bold text-white" style={{ background: DOMAIN_COLOR[p.domain] }}>{p.code}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{p.initiative || INDICATORS[p.code]}</span>
          <span className="block text-[11.5px] text-muted">{STANDARDS[stdOf(p.code)]} · {INDICATORS[p.code]}</span>
        </span>
        <span className="text-end text-xs">
          <span className="block text-muted">الحالي <b className="num" style={{ color: lv?.c }}>{p.current == null ? "مستحدث" : `${p.current}%`}</b> · المستهدف <b className="num text-ink">{fmtPct(p.target)}</b></span>
          <span className="block text-faint">{g != null && g > 0 && <>الفجوة <span className="num">{g}</span> نقطة · </>}الإنجاز <span className="num">{pr.done}%</span></span>
        </span>
      </button>
      <div className="h-1 bg-canvas"><div className="h-full bg-mint-deep" style={{ width: `${pr.done}%` }} /></div>
      {open && <ProgramBody p={p} canEdit={canEdit} edit={edit} by={by} onSaved={onSaved} setMsg={setMsg} />}
    </div>
  );
}

function ProgramBody({ p, canEdit, edit: editProps, by, onSaved, setMsg }) {
  const [edit, setEdit] = useState(false);
  const [m, setM] = useState(p.methods ?? []);
  useEffect(() => setM(p.methods ?? []), [p.methods]);
  const saveM = async (next) => {
    setM(next);
    const { error } = await supabase.from("acc_programs").update({ methods: next, updated_by_name: by ?? null, updated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) setMsg({ ok: false, text: error.message }); else onSaved();
  };
  const setOne = (i, k, v) => saveM(m.map((x, j) => (j === i ? { ...x, [k]: x[k] === v ? null : v } : x)));
  if (edit) return <ProgramEdit p={p} {...editProps} by={by} onDone={(ok) => { setEdit(false); if (ok) onSaved(); }} setMsg={setMsg} />;
  const row = (t, v) => (v ? <div key={t} className="grid gap-1 sm:grid-cols-[140px_1fr]"><span className="text-xs font-semibold text-mint-deep">{t}</span><span className="text-sm text-ink">{v}</span></div> : null);
  const opt = (on) => `rounded-pill border px-2 py-0.5 text-[11px] ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-faint"}`;

  return (
    <div className="space-y-4 border-t border-line p-4">
      <div className="space-y-2">
        {row("الفصل الدراسي", p.semester)}
        {row("الفريق المكلف", p.team?.join("، "))}
        {row("الفريق المكلف بالمتابعة", p.follow)}
        {row("الفترة الزمنية للقياس", p.period)}
        {row("مؤشر القياس", p.measure)}
        {row("الاحتياجات", p.needs)}
      </div>
      {p.evidence?.length > 0 && <div><p className="mb-1 text-xs font-semibold text-mint-deep">الأدلة والشواهد</p>
        <ul className="list-disc space-y-0.5 ps-5 text-sm text-ink">{p.evidence.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      <div>
        <p className="mb-1 text-xs font-semibold text-mint-deep">قياس نواتج المبادرات والبرامج</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">البرامج وأساليب التنفيذ</th><th className="p-2">التنفيذ</th><th className="p-2">درجة الإنجاز</th><th className="p-2">تحقق الأهداف</th></tr></thead>
            <tbody className="divide-y divide-line/60">{m.map((x, i) => (
              <tr key={i}><td className="p-2 text-ink">{x.t}</td>
                <td className="p-2"><span className="flex gap-1">{[[true, "نعم"], [false, "لا"]].map(([v, t]) => <button key={t} disabled={!canEdit} className={opt(x.done === v)} onClick={() => setOne(i, "done", v)}>{t}</button>)}</span></td>
                <td className="p-2"><span className="flex gap-1">{Object.entries(LEVEL_T).map(([v, t]) => <button key={v} disabled={!canEdit} className={opt(x.level === v)} onClick={() => setOne(i, "level", v)}>{t}</button>)}</span></td>
                <td className="p-2"><span className="flex gap-1">{[[true, "متحققة"], [false, "غير متحققة"]].map(([v, t]) => <button key={t} disabled={!canEdit} className={opt(x.met === v)} onClick={() => setOne(i, "met", v)}>{t}</button>)}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {p.rec && <div className="rounded-sm2 bg-mint-tint/60 px-3 py-2"><p className="text-xs font-semibold text-mint-deep">التوصيات والمقترحات العلاجية</p><p className="mt-1 text-sm leading-relaxed text-ink">{p.rec}</p></div>}
      <div className="flex items-center gap-3 text-xs">
        {canEdit && <button className="font-semibold text-mint-deep" onClick={() => setEdit(true)}>تعديل البرنامج{editProps.canDelete ? " أو حذفه" : ""}</button>}
        {p.updated_by_name && <span className="text-faint">آخر تحديث: {p.updated_by_name} · {fmtDate(p.updated_at)}</span>}
      </div>
    </div>
  );
}

/* تعديل البرنامج بكل ما يتعلق به، أو إدخال برنامج جديد، أو حذفه (الإضافة والحذف لمشرف اللجنة ومدير المدرسة) */
function ProgramEdit({ p, planId, doms, canDelete, by, onDone, setMsg }) {
  const isNew = !p.id;
  const [x, setX] = useState({ ...p, team: (p.team ?? []).join("\n"), evidence: (p.evidence ?? []).join("\n"), methodsT: (p.methods ?? []).map((m) => m.t).join("\n") });
  const set = (k) => (e) => setX((o) => ({ ...o, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const save = async () => {
    if (!INDICATORS[x.code]) { setMsg({ ok: false, text: "اختر المؤشر." }); return; }
    if (!x.initiative?.trim()) { setMsg({ ok: false, text: "اكتب اسم البرنامج أو إجراء الاستدامة." }); return; }
    const old = new Map((p.methods ?? []).map((m) => [m.t, m]));
    const row = {
      code: x.code, kind: x.kind, current: num(x.current), target: num(x.target), owner: x.owner?.trim() || null,
      initiative: x.initiative.trim(), semester: x.semester || null, team: lines(x.team), follow: x.follow || null,
      period: x.period || null, measure: x.measure || null, needs: x.needs || null, rec: x.rec || null, evidence: lines(x.evidence),
      methods: lines(x.methodsT).map((t) => old.get(t) ?? { t }), updated_by_name: by ?? null, updated_at: new Date().toISOString(),
    };
    setBusy(true);
    const { error } = isNew ? await supabase.from("acc_programs").insert({ ...row, plan_id: planId, sort: 200 })
      : await supabase.from("acc_programs").update(row).eq("id", p.id);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /duplicate|unique/i.test(error.message) ? `للمؤشر \u2066${x.code}\u2069 برنامج في هذه النسخة؛ عدّله بدل إضافة غيره.` : error.message }); return; }
    setMsg({ ok: true, text: isNew ? "أُضيف البرنامج." : "حُفظ البرنامج." }); onDone(true);
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف برنامج المؤشر \u2066${p.code}\u2069`, impact: [`«${p.initiative}» بأساليبه وقياس نواتجه من هذه النسخة.`, "تبقى شواهد المؤشر كما هي."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("acc_programs").delete().eq("id", p.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "حُذف البرنامج." }); onDone(true);
  };
  const F = ({ t, k, area, n }) => (
    <label className="block text-xs text-muted">{t}
      {area ? <textarea className="field mt-1 min-h-[72px]" value={x[k] ?? ""} onChange={set(k)} />
        : <input className="field mt-1" type={n ? "number" : "text"} step={n ? "0.01" : undefined} value={x[k] ?? ""} onChange={set(k)} />}
    </label>
  );
  const plan = x.kind === "plan";
  return (
    <div className="space-y-3 border-t border-line bg-canvas/40 p-4">
      {isNew && <p className="text-sm font-semibold text-ink">برنامج جديد</p>}
      <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
        <label className="block text-xs text-muted">المؤشر
          <select className="field mt-1" value={x.code ?? ""} onChange={set("code")}>
            <option value="">— اختر —</option>
            {CODES.filter((c) => doms.includes(domainOf(c))).map((c) => <option key={c} value={c}>{c} · {INDICATORS[c].slice(0, 70)}</option>)}
          </select></label>
        <label className="block text-xs text-muted">النوع
          <select className="field mt-1" value={x.kind} onChange={set("kind")}>
            <option value="plan">برنامج ضمن الخطة</option><option value="sustain">إجراء استدامة</option>
          </select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {F({ t: plan ? "المبادرة (اسم البرنامج)" : "إجراء الاستدامة", k: "initiative" })}
        {F({ t: "الحالي %", k: "current", n: true })}
        {F({ t: "المستهدف %", k: "target", n: true })}
      </div>
      {!plan && F({ t: "المسؤول", k: "owner" })}
      {plan && <>
        <div className="grid gap-3 sm:grid-cols-2">
          {F({ t: "الفصل الدراسي", k: "semester" })}
          {F({ t: "الفترة الزمنية لقياس النواتج", k: "period" })}
          {F({ t: "الفريق المكلف (سطر لكل جهة)", k: "team", area: true })}
          {F({ t: "الفريق المكلف بالمتابعة", k: "follow" })}
        </div>
        {F({ t: "البرامج وأساليب التنفيذ (سطر لكل بند)", k: "methodsT", area: true })}
        {F({ t: "الأدلة والشواهد المطلوبة (سطر لكل شاهد)", k: "evidence", area: true })}
        {F({ t: "مؤشر القياس", k: "measure", area: true })}
        {F({ t: "الاحتياجات", k: "needs" })}
        {F({ t: "التوصيات والمقترحات العلاجية", k: "rec", area: true })}
        {!isNew && <p className="text-[11px] text-faint">تعديل نص بند يعيد قياسه فارغًا، وتبقى قياسات البنود التي لم تتغير.</p>}
      </>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "…" : isNew ? "إضافة البرنامج" : "حفظ"}</button>
        <button className="rounded-pill border border-line bg-white px-4 py-1.5 text-xs text-muted" onClick={() => onDone(false)}>إلغاء</button>
        {!isNew && canDelete && <button className="ms-auto text-xs font-semibold text-absent" onClick={remove}>حذف البرنامج</button>}
      </div>
    </div>
  );
}
