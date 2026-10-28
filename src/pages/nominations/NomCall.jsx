// src/pages/nominations/NomCall.jsx
/* =====================================================================
   تفاصيل إعلان الترشيح لصاحبه: المتقدمون وشروطهم وإجاباتهم، والترشيح للمقابلة بمواعيد
   متتالية تصل إشعاراتها للطالب وولي أمره، وتقييم المقابلة بالمعايير، والقرار بحسب المقاعد،
   وإعلان النتائج (كل طالب وولي أمره نتيجته وحده)، وترقية الاحتياط، وطباعة المحضر.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { printReport, escHtml as e, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { STAGE, RULES, ruleList, callStatus, totalScore, maxScore, notifyInterviews, notifyResults, seatsText, branchesOf, branchName, seatPools } from "../../lib/nominations.js";
import { logos } from "../student-affairs/shared.jsx";
import StudentFileLink from "../../components/StudentFileLink.jsx";
import Loader from "../../components/Loader.jsx";
import { notifyUsers } from "../../lib/referrals.js";

const day = (d) => (d ? fmtDate(String(d).slice(0, 10) + "T12:00:00") : "—");
const when = (ts) => (ts ? new Date(ts).toLocaleString("ar-SA-u-nu-latn-ca-gregory",
  { weekday: "short", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const cls = (a) => `${GRADE_NAMES[a.grade]?.replace(" الثانوي", "") ?? ""} / ${a.class_no ?? "—"}`;
const TABS = [["apps", "المتقدمون"], ["interviews", "المقابلات"], ["decision", "القرار والنتائج"]];

export default function NomCall({ id }) {
  const [call, setCall] = useState(null);
  const [apps, setApps] = useState(null);
  const [tab, setTab] = useState("apps");
  const [msg, setMsg] = useState(null);
  const load = async () => {
    const [c, a] = await Promise.all([
      supabase.from("nom_calls").select("*").eq("id", id).maybeSingle(),
      supabase.rpc("nom_applicants", { p_call: id }),
    ]);
    setCall(c.data ?? false);
    setApps(a.data ?? []);
    if (a.error) setMsg({ ok: false, t: a.error.message });
  };
  useEffect(() => { load(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (call === null || !apps) return <Loader />;
  if (!call) return <p className="card px-4 py-6 text-center text-sm text-muted">الإعلان غير موجود أو لا تملك إدارته.</p>;
  const st = callStatus(call);
  const active = apps.filter((a) => a.stage !== "withdrawn");
  const say = (ok, t) => setMsg({ ok, t });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/nominations" className="text-xs text-muted underline">← الترشيحات</Link>
          <h1 className="mt-1 text-lg font-bold text-ink">{call.title}</h1>
          <p className="text-sm text-muted">{call.unit || "—"} · المقاعد <span className="num">{seatsText(call.seats)}</span>
            {call.seats != null && <> والاحتياط <span className="num">{call.reserve}</span></>}
            {branchesOf(call).length > 0 && <> · الفروع: {branchesOf(call).map((b) => b.name).join("، ")}</>}
            {" · "}التقديم حتى <span className="num">{day(call.closes_on)}</span></p>
          {ruleList(call.rules).length > 0 && <p className="mt-1 text-xs text-faint">الشروط: {ruleList(call.rules).map((k) => `${RULES[k].t} ${call.rules[k]}${RULES[k].unit}`).join(" · ")}</p>}
        </div>
        <span className={`chip ${st.c}`}>{st.t}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[[active.length, "متقدم"], [active.filter((a) => a.interview_at).length, "مرشح للمقابلة"],
          [active.filter((a) => Object.keys(a.scores ?? {}).length).length, "قُيّم"],
          [active.filter((a) => a.stage === "accepted").length, call.seats == null ? "مقبول" : `مقبول من ${call.seats}`], [active.filter((a) => a.stage === "reserve").length, "احتياط"]].map(([v, l]) => (
          <div key={l} className="card px-3 py-2 text-center"><p className="num text-xl font-bold text-ink">{v}</p><p className="text-[11px] text-muted">{l}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[...TABS, ...(call.staff_lead ? [["staff", "ترشّح المعلمين"]] : [])].map(([k, t]) => (
          <button key={k} onClick={() => { setTab(k); setMsg(null); }}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>{t}</button>
        ))}
      </div>
      {msg && <p className={`rounded-card px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}

      {tab === "apps" && <Applicants call={call} apps={apps} reload={load} say={say} />}
      {tab === "interviews" && <Interviews call={call} apps={active.filter((a) => a.interview_at)} reload={load} say={say} />}
      {tab === "decision" && <Decision call={call} apps={active} reload={load} say={say} />}
      {tab === "staff" && <StaffLeads call={call} say={say} />}
    </div>
  );
}

/* ——— ترشّح المعلمين لقيادة الفريق (supabase/nominations_7.sql) ——— */
const LEAD_STAGE = {
  applied:  { t: "مترشّح", c: "bg-mint-tint text-mint-deep" },
  accepted: { t: "مقبول", c: "bg-present/10 text-present" },
  rejected: { t: "معتذر", c: "bg-absent/10 text-absent" },
};
function StaffLeads({ call, say }) {
  const [rows, setRows] = useState(null);
  const load = () => supabase.from("nom_staff_apps").select("*").eq("call_id", call.id).neq("stage", "withdrawn").order("created_at")
    .then(({ data, error }) => { if (error) say(false, /nom_staff_apps|schema cache|relation/i.test(error.message) ? "يحتاج تشغيل supabase/nominations_7.sql." : error.message); setRows(data ?? []); });
  useEffect(() => { load(); }, [call.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loader />;
  const decide = async (r, stage) => {
    const { error } = await supabase.from("nom_staff_apps").update({ stage, decided_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { say(false, error.message); return; }
    await notifyUsers([r.user_id], `ترشّحك لـ«${call.staff_lead}»`, stage === "accepted"
      ? `نبارك اختيارك ${call.staff_lead} في «${call.title}». سيتواصل معك ${call.owner_name || "صاحب الإعلان"} لبدء العمل.`
      : `نشكر ترشّحك لـ«${call.staff_lead}» في «${call.title}». وقع الاختيار هذه المرة على زميل آخر، ونقدّر مبادرتك.`, "/");
    say(true, stage === "accepted" ? `اختير ${r.full_name} ${call.staff_lead}، ووصله إشعار. أسند له دوره من شاشة الصلاحيات إن لزم.` : `أُبلغ ${r.full_name} بالاعتذار.`);
    load();
  };
  if (!rows.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لا مترشّحين لـ«{call.staff_lead}» بعد. يظهر الإعلان في رئيسية المعلمين والإداريين ما دام التقديم مفتوحًا.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="card space-y-2 p-4">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-semibold text-ink">{r.full_name}</p>
            <span className={`chip ${LEAD_STAGE[r.stage]?.c}`}>{LEAD_STAGE[r.stage]?.t}</span>
          </div>
          {r.note && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{r.note}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-faint">ترشّح {day(r.created_at)}</span>
            {r.stage !== "accepted" && <button className="btn-primary ms-auto px-3 py-1 text-xs" onClick={() => decide(r, "accepted")}>اختياره {call.staff_lead}</button>}
            {r.stage === "applied" && <button className="rounded-pill border border-line px-3 py-1 text-muted hover:bg-canvas" onClick={() => decide(r, "rejected")}>اعتذار</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ——— المتقدمون: الشروط والإجابات، والترشيح للمقابلة ——— */
function Applicants({ call, apps, reload, say }) {
  const [sel, setSel] = useState(new Set());
  const [open, setOpen] = useState(null);
  const [plan, setPlan] = useState(null);
  const [br, setBr] = useState("all");            // تصفية بالفرع
  const branches = branchesOf(call);
  const all = apps.filter((a) => a.stage !== "withdrawn");
  const list = br === "all" ? all : all.filter((a) => a.branch === br);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const needOk = call.guardian_ok;

  const schedule = async () => {
    const ids = list.filter((a) => sel.has(a.id)).map((a) => a.id);
    const start = new Date(`${plan.date}T${plan.time}:00`).toISOString();
    const { error } = await supabase.rpc("nom_schedule", { p_call: call.id, p_apps: ids, p_start: start, p_minutes: Number(plan.minutes), p_place: plan.place });
    if (error) { say(false, error.message); return; }
    const { data } = await supabase.rpc("nom_applicants", { p_call: call.id });
    await notifyInterviews(call, (data ?? []).filter((a) => ids.includes(a.id)));
    say(true, `رُشّح ${ids.length} للمقابلة، ووصل كلًّا منهم وولي أمره إشعار بموعده ومكانه.`);
    setSel(new Set()); setPlan(null); reload();
  };

  if (!all.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لا متقدمين بعد. يظهر الإعلان للطلاب في «فرص المشاركة» ما دام التقديم مفتوحًا.</p>;
  return (
    <div className="space-y-3">
      {branches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[["all", "كل الفروع", all.length], ...branches.map((b) => [b.id, b.name, all.filter((a) => a.branch === b.id).length])].map(([k, t, n]) => (
            <button key={k} onClick={() => { setBr(k); setSel(new Set()); }}
              className={`rounded-pill px-3 py-1 text-xs font-medium ${br === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{t} <span className="num">({n})</span></button>
          ))}
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="bg-canvas text-right text-xs text-muted">
            <th className="p-2"><input type="checkbox" checked={sel.size === list.length} onChange={(e) => setSel(e.target.checked ? new Set(list.map((a) => a.id)) : new Set())} /></th>
            <th className="p-2">الطالب</th>{branches.length > 0 && <th className="p-2">الفرع</th>}<th className="p-2">الصف/الفصل</th><th className="p-2">الحضور</th><th className="p-2">أعلى مخالفة</th><th className="p-2">متوسط الاختبارات</th>
            {needOk && <th className="p-2">ولي الأمر</th>}<th className="p-2">الحالة</th><th className="p-2" />
          </tr></thead>
          <tbody className="divide-y divide-line/60">
            {list.map((a) => (
              <FragmentRow key={a.id} a={a} call={call} needOk={needOk} checked={sel.has(a.id)} onCheck={() => toggle(a.id)}
                open={open === a.id} onOpen={() => setOpen(open === a.id ? null : a.id)} />
            ))}
          </tbody>
        </table>
      </div>
      {sel.size > 0 && !plan && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setPlan({ date: new Date().toISOString().slice(0, 10), time: "09:00", minutes: call.slot_minutes, place: call.interview_place ?? "" })}>
            ترشيح {sel.size} للمقابلة</button>
          <button className="rounded-pill border border-line px-4 py-2 text-sm text-muted hover:bg-canvas"
            onClick={async () => { await supabase.rpc("nom_set_stage", { p_apps: [...sel], p_stage: "rejected" }); setSel(new Set()); reload(); }}>
            استبعاد (غير مقبول)</button>
        </div>
      )}
      {plan && (
        <div className="card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">مواعيد المقابلات: {sel.size} طلاب، كل مقابلة {plan.minutes} دقيقة بالترتيب</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs text-muted">اليوم<input type="date" className="field mt-1" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} /></label>
            <label className="text-xs text-muted">بداية أول مقابلة<input type="time" className="field mt-1" value={plan.time} onChange={(e) => setPlan({ ...plan, time: e.target.value })} /></label>
            <label className="text-xs text-muted">مدة كل مقابلة<input type="number" min="1" className="field mt-1" value={plan.minutes} onChange={(e) => setPlan({ ...plan, minutes: e.target.value })} /></label>
            <label className="text-xs text-muted">المكان<input className="field mt-1" value={plan.place} onChange={(e) => setPlan({ ...plan, place: e.target.value })} /></label>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={schedule}>اعتماد المواعيد وإرسالها</button>
            <button className="text-sm text-muted underline" onClick={() => setPlan(null)}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ a, call, needOk, checked, onCheck, open, onOpen }) {
  const e = a.eligibility ?? {};
  const s = STAGE[a.stage] ?? STAGE.applied;
  return (
    <>
      <tr className={checked ? "bg-mint-tint/40" : ""}>
        <td className="p-2"><input type="checkbox" checked={checked} onChange={onCheck} /></td>
        <td className="p-2 font-semibold text-ink"><StudentFileLink id={a.student_id}>{a.name}</StudentFileLink></td>
        {branchesOf(call).length > 0 && <td className="p-2 text-xs text-ink">{branchName(call, a.branch) || "—"}</td>}
        <td className="num p-2 text-muted">{cls(a)}</td>
        <td className="num p-2">{e.attend != null ? `${e.attend}%` : "—"}</td>
        <td className="num p-2">{e.max_degree || "لا يوجد"}</td>
        <td className="num p-2">{e.avg != null ? `${e.avg}%` : "—"}</td>
        {needOk && <td className="p-2 text-xs">{a.guardian_ok_at ? <span className="text-present">وافق</span> : <span className="text-late">بانتظاره</span>}</td>}
        <td className="p-2"><span className={`chip ${s.c}`}>{s.t}</span>{a.interview_at && <span className="num block text-[11px] text-muted">{when(a.interview_at)}</span>}</td>
        <td className="p-2 text-left"><button className="text-xs text-mint-deep underline" onClick={onOpen}>{open ? "إخفاء" : "الإجابات"}</button></td>
      </tr>
      {open && (
        <tr><td colSpan={(needOk ? 9 : 8) + (branchesOf(call).length ? 1 : 0)} className="bg-canvas/60 px-4 py-3 text-sm">
          {(call.questions ?? []).length ? call.questions.map((q) => (
            <p key={q.id} className="mb-1"><span className="text-muted">{q.q}: </span><span className="text-ink">{a.answers?.[q.id] || "—"}</span></p>
          )) : <p className="text-muted">لا أسئلة في الإعلان.</p>}
          <p className="mt-1 text-[11px] text-faint">قدّم <span className="num">{when(a.created_at)}</span></p>
        </td></tr>
      )}
    </>
  );
}

/* ——— المقابلات: درجة كل معيار وملاحظة ——— */
function Interviews({ call, apps, reload, say }) {
  const list = [...apps].sort((a, b) => a.interview_at.localeCompare(b.interview_at));
  const max = maxScore(call.criteria);
  if (!list.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لم يُرشَّح أحد للمقابلة بعد. اختر المتقدمين من تبويب «المتقدمون».</p>;
  return (
    <div className="space-y-2">
      {list.map((a) => <ScoreRow key={a.id} a={a} call={call} max={max} reload={reload} say={say} />)}
    </div>
  );
}

function ScoreRow({ a, call, max, reload, say }) {
  const [sc, setSc] = useState(a.scores ?? {});
  const [note, setNote] = useState(a.interview_note ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(sc) !== JSON.stringify(a.scores ?? {}) || note !== (a.interview_note ?? "");
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("nom_score", { p_app: a.id, p_scores: sc, p_note: note });
    setBusy(false);
    if (error) say(false, error.message); else reload();
  };
  return (
    <div className="card space-y-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm"><b className="text-ink"><StudentFileLink id={a.student_id}>{a.name}</StudentFileLink></b>
          <span className="text-muted"> · {cls(a)}{a.branch && ` · ${branchName(call, a.branch)}`} · <span className="num">{when(a.interview_at)}</span>{a.interview_place && ` · ${a.interview_place}`}</span></p>
        <span className="num text-sm font-bold text-mint-deep">{totalScore(sc, call.criteria)} / {max}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {(call.criteria ?? []).map((k) => (
          <label key={k.id} className="text-[11px] text-muted">{k.name} <span className="num">({k.max})</span>
            <input type="number" min="0" max={k.max} className="field mt-0.5 w-24" value={sc[k.id] ?? ""}
              onChange={(e) => setSc({ ...sc, [k.id]: e.target.value === "" ? undefined : Math.min(Number(k.max), Math.max(0, Number(e.target.value))) })} />
          </label>
        ))}
        <input className="field min-w-[12rem] flex-1" placeholder="ملاحظة المقابلة" value={note} onChange={(e) => setNote(e.target.value)} />
        {dirty && <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "…" : "حفظ"}</button>}
      </div>
    </div>
  );
}

/* ——— القرار: ترتيب بالدرجة، واقتراح بحسب المقاعد (لكل فرع إن كانت للإعلان فروع)، وإعلان النتائج.
   المقاعد المفتوحة: يُقبل كل من اكتمل طلبه، ولا احتياط ——— */
function Decision({ call, apps, reload, say }) {
  const ranked = useMemo(() => [...apps].filter((a) => a.stage !== "applied" || a.interview_at)
    .sort((a, b) => totalScore(b.scores, call.criteria) - totalScore(a.scores, call.criteria)), [apps, call]);
  const max = maxScore(call.criteria);
  const published = !!call.results_at;
  // من قدّم قبل إضافة الفروع يظهر في «بلا فرع»، ولا يشمله الاقتراح
  const ids = new Set(branchesOf(call).map((b) => b.id));
  const pools = [...seatPools(call), ...(ids.size ? [{ id: "none", name: "بلا فرع", seats: null, reserve: 0, manual: true }] : [])];
  const inPool = (p) => (!ids.size ? ranked : p.id === "none" ? ranked.filter((a) => !ids.has(a.branch)) : ranked.filter((a) => a.branch === p.id));

  const setStage = async (ids, stage) => {
    const { error } = await supabase.rpc("nom_set_stage", { p_apps: ids, p_stage: stage });
    if (error) say(false, error.message); else reload();
  };
  const suggest = async () => {
    let nAcc = 0, nRes = 0;
    for (const p of pools.filter((x) => !x.manual)) {
      const list = inPool(p);
      const ok = list.filter((a) => !call.guardian_ok || a.guardian_ok_at);
      const acc = p.seats == null ? ok : ok.slice(0, p.seats);
      const res = p.seats == null ? [] : ok.slice(p.seats, p.seats + p.reserve);
      const rest = list.filter((a) => !acc.includes(a) && !res.includes(a));
      for (const [l, stage] of [[acc, "accepted"], [res, "reserve"], [rest, "rejected"]])
        if (l.length) await supabase.rpc("nom_set_stage", { p_apps: l.map((a) => a.id), p_stage: stage });
      nAcc += acc.length; nRes += res.length;
    }
    say(true, `طُبّق الاقتراح: ${nAcc} مقبول و${nRes} احتياط. راجعه ثم أعلن النتائج.`);
    reload();
  };
  const publish = async () => {
    const decided = apps.filter((a) => ["accepted", "reserve", "rejected"].includes(a.stage));
    if (!window.confirm(`إعلان النتائج؟ يصل كل طالب (${decided.length}) وولي أمره نتيجته وحده، ولا يمكن التراجع عن الإعلان.`)) return;
    const { data, error } = await supabase.rpc("nom_publish", { p_call: call.id });
    if (error) { say(false, error.message); return; }
    await notifyResults(call, decided);
    say(true, `أُعلنت النتائج وأُشعر الطلاب وأولياء أمورهم${data ? `، وأُضيف ${data} إلى الفريق الكشفي` : ""}.`);
    reload();
  };
  const promote = async (a) => {
    await setStage([a.id], "accepted");
    await notifyResults(call, [{ ...a, stage: "accepted" }]);
    say(true, `رُقّي ${a.name} من الاحتياط إلى مقبول وأُشعر هو وولي أمره.`);
  };
  const planText = pools.filter((p) => !p.manual).map((p) => `${p.name ? `${p.name}: ` : ""}${p.seats == null ? "مقاعد مفتوحة" : `${p.seats} مقبول + ${p.reserve} احتياط`}`).join(" · ");

  if (!ranked.length) return <p className="card px-4 py-8 text-center text-sm text-muted">القرار بعد ترشيح المتقدمين للمقابلة وتقييمهم.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!published && <button className="rounded-pill border border-mint-deep px-4 py-2 text-sm font-medium text-mint-deep hover:bg-mint-tint" onClick={suggest}>
          اقتراح القرار بالدرجات ({planText})</button>}
        {!published && <button className="btn-primary" onClick={publish}>إعلان النتائج</button>}
        <button className="rounded-pill border border-line px-4 py-2 text-sm text-muted hover:bg-canvas" onClick={() => printMinutes(call, ranked)}>طباعة محضر الترشيح</button>
      </div>
      {call.guardian_ok && <p className="text-xs text-faint">الاقتراح يتجاوز من لم يوافق ولي أمره بعد.</p>}
      {pools.map((p) => {
        const list = inPool(p);
        if (ids.size && !list.length) return null;
        const accepted = list.filter((a) => a.stage === "accepted").length;
        return (
          <div key={p.id ?? "all"} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 px-1">
              {p.name && <p className="text-sm font-bold text-ink">{p.name}</p>}
              <span className={`text-xs ${p.seats != null && accepted > p.seats ? "text-absent" : "text-muted"}`}>
                المقبولون <span className="num">{accepted}</span>{p.seats == null ? " · المقاعد مفتوحة" : <> من <span className="num">{p.seats}</span> مقعدًا</>}</span>
            </div>
            <div className="card divide-y divide-line/60">
              {list.map((a, i) => {
                const s = STAGE[a.stage] ?? STAGE.applied;
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="num w-6 text-center text-sm font-bold text-faint">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink"><StudentFileLink id={a.student_id}>{a.name}</StudentFileLink></p>
                      <p className="text-[11px] text-muted">{cls(a)}{a.interview_note && ` · ${a.interview_note}`}</p>
                    </div>
                    <span className="num text-sm font-bold text-mint-deep">{totalScore(a.scores, call.criteria)} / {max}</span>
                    {published ? (
                      <>
                        <span className={`chip ${s.c}`}>{s.t}</span>
                        {a.stage === "reserve" && <button className="text-xs text-mint-deep underline" onClick={() => promote(a)}>ترقية إلى مقبول</button>}
                      </>
                    ) : (
                      <select className={`rounded-sm2 border border-line bg-white px-2 py-1 text-xs font-semibold ${s.c}`} value={a.stage}
                        onChange={(e) => setStage([a.id], e.target.value)}>
                        {["shortlisted", "accepted", ...(p.seats == null ? [] : ["reserve"]), "rejected"].map((k) => <option key={k} value={k}>{STAGE[k].t}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function printMinutes(call, ranked) {
  // المحضر HTML جاهز (sections.html): القيم من البيانات تُهرَّب بـ e
  const head = (call.criteria ?? []).map((k) => `<th>${e(k.name)} (${e(k.max)})</th>`).join("");
  const hasBr = branchesOf(call).length > 0;
  const rows = ranked.map((a, i) => `<tr><td>${i + 1}</td><td>${e(a.name)}</td>${hasBr ? `<td>${e(branchName(call, a.branch) || "—")}</td>` : ""}<td>${e(cls(a))}</td>${(call.criteria ?? []).map((k) => `<td>${e(a.scores?.[k.id] ?? "—")}</td>`).join("")}
    <td><b>${e(totalScore(a.scores, call.criteria))}</b></td><td>${e(STAGE[a.stage]?.t ?? "")}</td></tr>`).join("");
  const html = `
    <table class="kv"><tr><th>الإعلان</th><td>${e(call.title)}</td></tr><tr><th>الجهة</th><td>${e(call.unit ?? "—")}</td></tr>
      <tr><th>المقاعد</th><td>${e(seatsText(call.seats))}${call.seats != null ? ` والاحتياط ${e(call.reserve)}` : ""}</td></tr>
      ${hasBr ? `<tr><th>الفروع</th><td>${branchesOf(call).map((b) => `${e(b.name)} (${e(seatsText(b.seats))})`).join("، ")}</td></tr>` : ""}
      <tr><th>فترة التقديم</th><td>${day(call.opens_on)} — ${day(call.closes_on)}</td></tr></table>
    <p class="sec-h">نتائج المقابلات والقرار <span class="c">(${ranked.length})</span></p>
    <table><thead><tr><th>م</th><th>الطالب</th>${hasBr ? "<th>الفرع</th>" : ""}<th>الصف/الفصل</th>${head}<th>المجموع (${maxScore(call.criteria)})</th><th>القرار</th></tr></thead><tbody>${rows}</tbody></table>`;
  printReport({
    title: `محضر الترشيح — ${call.title}`,
    sections: [{ title: `محضر الترشيح — ${call.title}`, subtitle: call.unit ?? "", html }],
    ...logos(), signatures: [{ title: "مسؤول الإعلان", name: call.owner_name }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
  });
}
