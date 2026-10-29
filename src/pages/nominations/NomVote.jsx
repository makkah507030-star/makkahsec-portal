// src/pages/nominations/NomVote.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDateTime } from "../../lib/dates";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { VOTE_MODE, isOpen, pollState, setupMsg } from "../../lib/polls.js";
import { branchesOf, branchName, seatPools, totalScore, maxScore } from "../../lib/nominations.js";
import PollResults, { usePollResults } from "../polls/PollResults.jsx";

/* =====================================================================
   تبويب «التصويت» في إعلان الترشيح (supabase/polls_1..2.sql) حين يكون وضعه استئناسيًا أو حاسمًا:
   تختار اللجنة من يدخل التصويت، ويصوّت طلاب صفوف الإعلان اقتراعًا سريًا، والنتيجة للجنة وحدها.
   • استئناسي: الأصوات رقم مساعد بجانب درجة المقابلة، والقرار للجنة من «القرار والنتائج».
   • حاسم: بعد الإغلاق تعتمد اللجنة النتيجة فيُقبل الأعلى أصواتًا بعدد المقاعد في كل فرع، ثم الاحتياط.
   ===================================================================== */

const pad = (n) => String(n).padStart(2, "0");
const local = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const cls = (a) => `${GRADE_NAMES[a.grade]?.replace(" الثانوي", "") ?? ""} / ${a.class_no ?? "—"}`;

export default function NomVote({ call, apps, reload, say }) {
  const { profile } = useSession();
  const [poll, setPoll] = useState(undefined);
  const [k, setK] = useState(0);
  const load = () => supabase.from("polls").select("*").eq("nom_call_id", call.id).is("cancelled_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
    .then(({ data, error }) => { if (error) say(false, setupMsg(error)); setPoll(data ?? null); });
  useEffect(() => { load(); }, [call.id, k]);   // eslint-disable-line react-hooks/exhaustive-deps
  const mode = VOTE_MODE[call.vote_mode];
  if (poll === undefined) return null;

  return (
    <div className="space-y-3">
      <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-sm text-mint-deep"><b>{mode.t}:</b> {mode.hint}</p>
      {poll ? <Running call={call} apps={apps} poll={poll} reload={reload} say={say} onChange={() => setK((x) => x + 1)} />
        : <Create call={call} apps={apps} say={say} by={profile?.full_name} onDone={() => setK((x) => x + 1)} />}
    </div>
  );
}

function Create({ call, apps, say, by, onDone }) {
  // المؤهلون مبدئيًا: من رُشّح للمقابلة، ولا يدخل من استُبعد
  const pool = apps.filter((a) => a.stage !== "rejected");
  const [sel, setSel] = useState(() => new Set(pool.filter((a) => a.interview_at || a.stage === "shortlisted").map((a) => a.id)));
  const [opens, setOpens] = useState(local(Date.now()));
  const [closes, setCloses] = useState(local(Date.now() + 2 * 864e5));
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSel((x) => { const y = new Set(x); y.has(id) ? y.delete(id) : y.add(id); return y; });

  const create = async () => {
    const list = pool.filter((a) => sel.has(a.id));
    if (list.length < 2) { say(false, "اختر مرشحَين على الأقل."); return; }
    if (new Date(closes) <= new Date(opens)) { say(false, "موعد الإغلاق قبل الفتح."); return; }
    setBusy(true);
    const { data, error } = await supabase.from("polls").insert({
      kind: "election", title: `انتخاب: ${call.title}`, body: call.unit ? `${call.unit} — اختر مرشحًا واحدًا.` : "اختر مرشحًا واحدًا.",
      audience: ["student"], grades: call.grades?.length === 3 ? [] : call.grades ?? [], max_choices: 1,
      opens_at: new Date(opens).toISOString(), closes_at: new Date(closes).toISOString(), results: "owner",
      published: true, nom_call_id: call.id, created_by_name: by ?? null,
    }).select("id").single();
    if (error) { setBusy(false); say(false, setupMsg(error)); return; }
    const { error: e2 } = await supabase.from("poll_options").insert(list.map((a, i) => ({
      poll_id: data.id, label: a.name, note: [cls(a), branchName(call, a.branch)].filter(Boolean).join(" · "), app_id: a.id, sort: i,
    })));
    setBusy(false);
    if (e2) { say(false, e2.message); return; }
    say(true, `فُتح التصويت لـ${list.length} مرشحين حتى ${fmtDateTime(new Date(closes))}، ويظهر للطلاب في «التصويت والاستطلاعات» وفي رئيسيتهم.`);
    onDone();
  };

  if (!pool.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لا متقدمين بعد.</p>;
  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm font-semibold text-ink">من يدخل التصويت <span className="font-normal text-muted">— تختارهم اللجنة</span></p>
      <div className="grid gap-1 sm:grid-cols-2">
        {pool.map((a) => (
          <label key={a.id} className="flex items-center gap-2 rounded-sm2 px-2 py-1.5 text-sm hover:bg-canvas">
            <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} />
            <span className="min-w-0 flex-1 truncate text-ink">{a.name}</span>
            <span className="text-[11px] text-muted">{cls(a)}{branchName(call, a.branch) && ` · ${branchName(call, a.branch)}`}</span>
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">يُفتح<input type="datetime-local" className="field mt-1" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
        <label className="text-xs text-muted">يُغلق<input type="datetime-local" className="field mt-1" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
      </div>
      <p className="text-[11px] text-faint">يصوّت طلاب صفوف الإعلان اقتراعًا سريًا بصوت واحد، والنتيجة للجنة وحدها. ولا تُعدَّل قائمة المرشحين بعد أول صوت.</p>
      <button className="btn-primary" disabled={busy || sel.size < 2} onClick={create}>فتح التصويت ({sel.size} مرشحين)</button>
    </div>
  );
}

function Running({ call, apps, poll, reload, say, onChange }) {
  const { rows, err } = usePollResults(poll.id);
  const st = pollState(poll);
  const open = isOpen(poll);
  const byApp = useMemo(() => Object.fromEntries((rows ?? []).map((r) => [r.app_id, r.votes])), [rows]);
  const max = maxScore(call.criteria);
  const cand = apps.filter((a) => a.id in byApp).sort((a, b) => (byApp[b.id] - byApp[a.id]) || (totalScore(b.scores, call.criteria) - totalScore(a.scores, call.criteria)));
  const decisive = call.vote_mode === "decisive";
  const ids = new Set(branchesOf(call).map((b) => b.id));
  const pools = seatPools(call);
  const inPool = (p) => (!ids.size ? cand : cand.filter((a) => a.branch === p.id));

  const approve = async () => {
    // تعادل عند حد المقاعد يُحسم بقرار اللجنة يدويًا
    for (const p of pools) {
      const l = inPool(p);
      if (p.seats != null && l.length > p.seats && byApp[l[p.seats - 1]?.id] === byApp[l[p.seats]?.id]) {
        say(false, `تعادل عند آخر مقعد${p.name ? ` في «${p.name}»` : ""}؛ احسمه من «القرار والنتائج» يدويًا.`); return;
      }
    }
    if (!window.confirm("اعتماد نتيجة التصويت؟ يُقبل الأعلى أصواتًا بعدد المقاعد، ثم الاحتياط، ثم تعلن النتائج من «القرار والنتائج».")) return;
    let nAcc = 0;
    for (const p of pools) {
      const l = inPool(p);
      const acc = p.seats == null ? l : l.slice(0, p.seats);
      const res = p.seats == null ? [] : l.slice(p.seats, p.seats + p.reserve);
      const rest = l.filter((a) => !acc.includes(a) && !res.includes(a));
      for (const [g, stage] of [[acc, "accepted"], [res, "reserve"], [rest, "rejected"]])
        if (g.length) await supabase.rpc("nom_set_stage", { p_apps: g.map((a) => a.id), p_stage: stage });
      nAcc += acc.length;
    }
    await supabase.from("polls").update({ approved_at: new Date().toISOString() }).eq("id", poll.id);
    say(true, `اعتُمدت النتيجة: ${nAcc} مقبولين. أعلن النتائج من «القرار والنتائج».`);
    reload(); onChange();
  };
  const closeNow = async () => {
    if (!window.confirm("إغلاق التصويت الآن؟")) return;
    await supabase.from("polls").update({ closes_at: new Date().toISOString() }).eq("id", poll.id); onChange();
  };

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold text-ink">{poll.title}</p>
        <span className={`chip ${poll.approved_at ? "bg-present/10 text-present" : st.c}`}>{poll.approved_at ? "اعتُمدت النتيجة" : st.t}</span>
      </div>
      <p className="text-xs text-muted">من {fmtDateTime(poll.opens_at)} إلى {fmtDateTime(poll.closes_at)}</p>
      {err ? <p className="text-sm text-absent">{err}</p> : <PollResults rows={rows} showTurnout />}
      {cand.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">المرشح</th><th className="p-2">الأصوات</th>
              <th className="p-2">درجة المقابلة</th><th className="p-2">الحالة</th></tr></thead>
            <tbody className="divide-y divide-line/60">{cand.map((a) => (
              <tr key={a.id}><td className="p-2 text-ink">{a.name}<span className="ms-1 text-[11px] text-muted">{cls(a)}</span></td>
                <td className="num p-2 font-bold text-ink">{byApp[a.id]}</td>
                <td className="num p-2 text-muted">{Object.keys(a.scores ?? {}).length ? `${totalScore(a.scores, call.criteria)}/${max}` : "—"}</td>
                <td className="p-2 text-xs text-muted">{{ accepted: "مقبول", reserve: "احتياط", rejected: "غير مقبول" }[a.stage] ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {open && <button className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted hover:bg-canvas" onClick={closeNow}>إغلاق التصويت الآن</button>}
        {decisive && !open && !poll.approved_at && !call.results_at && <button className="btn-primary px-4 py-1.5 text-xs" onClick={approve}>اعتماد نتيجة التصويت</button>}
      </div>
      {!decisive && !open && <p className="text-xs text-faint">التصويت استئناسي: القرار للجنة من تبويب «القرار والنتائج».</p>}
    </div>
  );
}
