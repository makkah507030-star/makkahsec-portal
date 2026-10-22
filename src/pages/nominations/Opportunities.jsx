// src/pages/nominations/Opportunities.jsx
/* =====================================================================
   فرص المشاركة — للطالب: الإعلانات المفتوحة لصفه (اللجنة الإعلامية، الفريق الكشفي…)
   وشروطها ومهامها، والتقديم، ومتابعة طلبه وموعد مقابلته ونتيجته. ولولي الأمر: طلبات
   أبنائه وموافقته إن اشترطها الإعلان. النتيجة تظهر لكل طالب وولي أمره وحده.
   ===================================================================== */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import { STAGE, RULES, ruleList, callStatus } from "../../lib/nominations.js";
import Loader from "../../components/Loader.jsx";
import { Icon } from "../../components/Layout.jsx";

const day = (d) => (d ? fmtDate(String(d).slice(0, 10) + "T12:00:00") : "—");
const when = (ts) => new Date(ts).toLocaleString("ar-SA-u-nu-latn-ca-gregory",
  { weekday: "long", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" });
const lines = (t) => (t ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

export default function Opportunities() {
  const { effectiveRole } = useSession();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">فرص المشاركة</h1>
        <p className="text-sm text-muted">{effectiveRole === "guardian"
          ? "طلبات أبنائك للانضمام إلى لجان المدرسة وفرقها، ومواعيد مقابلاتهم ونتائجها."
          : "انضم إلى لجان المدرسة وفرقها: اقرأ الشروط والمهام، وقدّم، وتابع طلبك."}</p>
      </div>
      {effectiveRole === "guardian" ? <GuardianView /> : <StudentView />}
    </div>
  );
}

function StudentView() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const load = () => supabase.rpc("nom_student_calls").then(({ data, error }) => { if (error) setErr(error.message); setRows(data ?? []); });
  useEffect(() => { load(); }, []);
  if (!rows) return <Loader />;
  if (err) return <p className="card px-4 py-6 text-center text-sm text-muted">لا فرص متاحة الآن.</p>;
  if (!rows.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لا إعلانات مفتوحة لصفك الآن. تابع هذه الصفحة، فتصلك الفرص الجديدة هنا.</p>;
  const mine = rows.filter((r) => r.app), avail = rows.filter((r) => !r.app);
  return (
    <div className="space-y-5">
      {mine.length > 0 && <section className="space-y-2"><h2 className="text-sm font-bold text-muted">طلباتي</h2>
        {mine.map((r) => <MyApp key={r.call.id} r={r} reload={load} />)}</section>}
      {avail.length > 0 && <section className="space-y-2"><h2 className="text-sm font-bold text-muted">فرص مفتوحة</h2>
        {avail.map((r) => <CallCard key={r.call.id} r={r} open={open === r.call.id} onOpen={() => setOpen(open === r.call.id ? null : r.call.id)} reload={load} />)}</section>}
    </div>
  );
}

function Terms({ c, e }) {
  const rules = ruleList(c.rules);
  return (
    <div className="space-y-3 text-sm">
      {c.body && <p className="leading-relaxed text-ink">{c.body}</p>}
      {lines(c.tasks).length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">المهام</p>
        <ul className="list-inside list-disc space-y-0.5 text-ink">{lines(c.tasks).map((t) => <li key={t}>{t}</li>)}</ul></div>}
      {rules.length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">الشروط</p>
        <ul className="space-y-1">{rules.map((k) => {
          const R = RULES[k], ok = !(e?.fails ?? []).includes(R.fail), v = R.val(e);
          return (
            <li key={k} className={`flex items-center gap-2 ${ok ? "text-present" : "text-absent"}`}>
              <Icon name={ok ? "check" : "userX"} className="h-4 w-4" />
              <span>{R.t} <span className="num">{c.rules[k]}{R.unit}</span>
                <span className="text-xs text-muted"> — لديك: <span className="num">{v == null ? "—" : k === "max_degree" ? (v || "لا مخالفات") : `${v}${R.unit}`}</span></span></span>
            </li>
          );
        })}</ul></div>}
      {lines(c.special_terms).length > 0 && <div><p className="mb-1 text-xs font-semibold text-muted">شروط خاصة</p>
        <ul className="list-inside list-disc space-y-0.5 text-ink">{lines(c.special_terms).map((t) => <li key={t}>{t}</li>)}</ul></div>}
      <p className="text-xs text-muted">المقاعد <span className="num">{c.seats}</span> · آخر موعد للتقديم <span className="num">{day(c.closes_on)}</span>
        {c.guardian_ok && " · يشترط موافقة ولي الأمر من حسابه"}</p>
    </div>
  );
}

function CallCard({ r, open, onOpen, reload }) {
  const c = r.call, e = r.eligibility;
  const [ans, setAns] = useState({});
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const needAck = lines(c.special_terms).length > 0;
  const missing = (c.questions ?? []).some((q) => !String(ans[q.id] ?? "").trim());
  const apply = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("nom_apply", { p_call: c.id, p_answers: ans });
    setBusy(false);
    if (error) setErr(error.message); else reload();
  };
  return (
    <div className="card p-4">
      <button className="flex w-full items-start gap-3 text-right" onClick={onOpen}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-mint-deep"><Icon name="megaphone" className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{c.title}</p>
          <p className="text-xs text-muted">{c.unit || ""}{c.unit ? " · " : ""}حتى <span className="num">{day(c.closes_on)}</span></p>
        </div>
        <span className={`chip shrink-0 ${e?.ok ? "bg-mint-tint text-mint-deep" : "bg-absent/10 text-absent"}`}>{e?.ok ? "تنطبق عليك الشروط" : "لا تنطبق الشروط"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <Terms c={c} e={e} />
          {e?.ok ? (
            <div className="space-y-3 rounded-sm2 bg-canvas/60 p-3">
              {(c.questions ?? []).map((q) => (
                <label key={q.id} className="block text-xs font-medium text-muted">{q.q}
                  {q.kind === "choice" ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(q.options ?? []).map((o) => (
                        <button key={o} type="button" onClick={() => setAns({ ...ans, [q.id]: o })}
                          className={`rounded-pill px-3 py-1 text-xs ${ans[q.id] === o ? "bg-mint-deep text-white" : "border border-line bg-white text-ink"}`}>{o}</button>
                      ))}
                    </div>
                  ) : <textarea className="field mt-1 min-h-[60px]" value={ans[q.id] ?? ""} onChange={(ev) => setAns({ ...ans, [q.id]: ev.target.value })} />}
                </label>
              ))}
              {needAck && <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={ack} onChange={(ev) => setAck(ev.target.checked)} /> أقرّ بأن الشروط الخاصة تنطبق عليّ، وألتزم بالمهام إن قُبلت.</label>}
              {err && <p className="text-sm text-absent">{err}</p>}
              <button className="btn-primary w-full" disabled={busy || missing || (needAck && !ack)} onClick={apply}>{busy ? "جارٍ التقديم…" : "تقديم الطلب"}</button>
            </div>
          ) : <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">لا يمكنك التقديم على هذا الإعلان لأن بعض شروطه لا تنطبق عليك حاليًا.</p>}
        </div>
      )}
    </div>
  );
}

function AppStatus({ c, a }) {
  const s = STAGE[a.stage] ?? STAGE.applied;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${s.c}`}>{s.t}</span>
        {c.guardian_ok && <span className={`chip ${a.guardian_ok_at ? "bg-present/10 text-present" : "bg-late/10 text-late"}`}>{a.guardian_ok_at ? "وافق ولي الأمر" : "بانتظار موافقة ولي الأمر"}</span>}
      </div>
      {a.interview_at && a.stage !== "withdrawn" && !["accepted", "rejected", "reserve"].includes(a.stage) && (
        <p className="flex items-center gap-2 rounded-sm2 bg-excused/10 px-3 py-2 text-sm text-ink">
          <Icon name="calendar" className="h-4 w-4 text-excused" /> المقابلة: {when(a.interview_at)}{a.interview_place && ` — ${a.interview_place}`}</p>
      )}
      {a.stage === "accepted" && <p className="rounded-sm2 bg-present/10 px-3 py-2 text-sm text-present">مبارك! قُبلت في «{c.title}». سيتواصل معك المسؤول لبدء المهام.</p>}
      {a.stage === "reserve" && <p className="rounded-sm2 bg-late/10 px-3 py-2 text-sm text-late">أنت في قائمة الاحتياط، وتُبلَّغ إن شغر مقعد.</p>}
      {a.stage === "rejected" && <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">نشكرك على تقديمك. لم تُقبل هذه المرة، ونتطلع لمشاركتك في فرص قادمة.</p>}
    </div>
  );
}

function MyApp({ r, reload }) {
  const c = r.call, a = r.app;
  const canWithdraw = !c.results_at && a.stage !== "withdrawn" && callStatus(c).k !== "done";
  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-semibold text-ink">{c.title}</p><p className="text-xs text-muted">قدّمت <span className="num">{day(a.created_at)}</span></p></div>
        {canWithdraw && <button className="text-xs text-muted underline" onClick={async () => {
          if (window.confirm("الانسحاب من هذا الطلب؟")) { await supabase.rpc("nom_withdraw", { p_call: c.id }); reload(); }
        }}>انسحاب</button>}
      </div>
      <AppStatus c={c} a={a} />
    </div>
  );
}

function GuardianView() {
  const [rows, setRows] = useState(null);
  const load = () => supabase.rpc("nom_guardian_calls").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  if (!rows) return <Loader />;
  if (!rows.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لا طلبات لأبنائك حاليًا. حين يقدّم ابنك على لجنة أو فريق في المدرسة يظهر طلبه هنا.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.app.id} className="card space-y-2 p-4">
          <p className="font-semibold text-ink">{r.call.title} <span className="text-sm font-normal text-muted">— {r.student}</span></p>
          {r.call.body && <p className="text-sm text-muted">{r.call.body}</p>}
          <AppStatus c={r.call} a={r.app} />
          {r.call.guardian_ok && !r.app.guardian_ok_at && r.app.stage !== "withdrawn" && (
            <button className="btn-primary" onClick={async () => { await supabase.rpc("nom_guardian_ok", { p_app: r.app.id }); load(); }}>
              أوافق على مشاركة ابني</button>
          )}
        </div>
      ))}
    </div>
  );
}
