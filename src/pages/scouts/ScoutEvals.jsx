// src/pages/scouts/ScoutEvals.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { todayISO } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import { POSTS, CRITERIA, CRITERIA_MAX, evalTotal, evalRated, weekStart, addDays } from "../../lib/scouts.js";
import { loadTeam } from "./data.js";
import { groupByPatrol } from "./ScoutAttendance.jsx";

/* =====================================================================
   التقييم الأسبوعي (supabase/scouts_6.sql) للقائد ونائبه: كل طليعة وكل عضو بأربعة
   معايير من 10 (الانضباط، إنجاز المهام، المظهر والنظافة، التعاون) وملاحظة.
   ===================================================================== */

const keyOf = (r) => (r.patrol_id ? `p:${r.patrol_id}` : `s:${r.student_id}`);

function Scores({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CRITERIA.map((c) => (
        <label key={c.k} className="text-[10.5px] text-muted">{c.t}
          <input type="number" min="0" max="10" inputMode="numeric" className="field num mt-0.5 !h-8 w-16 !px-2 text-center text-sm"
                 value={value?.[c.k] ?? ""}
                 onChange={(e) => onChange({ ...value, [c.k]: e.target.value === "" ? undefined : Math.min(10, Math.max(0, Number(e.target.value))) })} />
        </label>
      ))}
    </div>
  );
}

export default function ScoutEvals() {
  const { profile } = useSession();
  const [team, setTeam] = useState(null);
  const [week, setWeek] = useState(weekStart(todayISO()));
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState({});         // key ← { scores, note }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadTeam().then((t) => { setTeam(t); if (t.err) setMsg({ ok: false, t: t.err }); }); }, []);
  const load = () => supabase.from("scout_evals").select("*").eq("week_start", week)
    .then(({ data }) => { setSaved(Object.fromEntries((data ?? []).map((r) => [keyOf(r), r]))); setDraft({}); });
  useEffect(() => { setSaved(null); load(); }, [week]);   // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => (team ? groupByPatrol(team.members, team.patrols) : []), [team]);
  if (!team || !saved) return <Loader />;
  const cur = (k) => draft[k] ?? { scores: saved[k]?.scores ?? {}, note: saved[k]?.note ?? "" };
  const put = (k, patch) => setDraft((d) => ({ ...d, [k]: { ...cur(k), ...patch } }));
  const dirty = Object.keys(draft).length;

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      for (const [k, v] of Object.entries(draft)) {
        const [t, id] = k.split(":");
        const row = { week_start: week, scores: v.scores ?? {}, note: v.note?.trim() || null, by_name: profile?.full_name ?? null,
                      updated_at: new Date().toISOString(), patrol_id: t === "p" ? id : null, student_id: t === "s" ? id : null };
        const { error } = saved[k]
          ? await supabase.from("scout_evals").update(row).eq("id", saved[k].id)
          : await supabase.from("scout_evals").insert(row);
        if (error) throw error;
      }
      setMsg({ ok: true, t: `حُفظ تقييم ${dirty} من الطلائع والأعضاء.` });
      load();
    } catch (e) { setMsg({ ok: false, t: e.message }); }
    setBusy(false);
  };

  const Total = ({ k }) => {
    const s = cur(k).scores;
    return evalRated(s) ? <span className="num text-sm font-bold text-mint-deep">{evalTotal(s)} / {CRITERIA_MAX}</span>
                        : <span className="text-[11px] text-faint">لم يُقيَّم</span>;
  };

  return (
    <div className="space-y-4">
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
      <section className="card flex flex-wrap items-center gap-2 p-3">
        <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setWeek(addDays(week, -7))}>→ الأسبوع السابق</button>
        <p className="flex-1 text-center text-sm font-semibold text-ink">أسبوع <span className="num">{fmtDate(week + "T12:00:00")}</span> – <span className="num">{fmtDate(addDays(week, 4) + "T12:00:00")}</span></p>
        <button className="btn-ghost px-3 py-1 text-xs" disabled={week >= weekStart(todayISO())} onClick={() => setWeek(addDays(week, 7))}>الأسبوع التالي ←</button>
      </section>

      <section className="card overflow-hidden">
        <p className="border-b border-line px-4 py-2 text-sm font-semibold text-ink">تقييم الطلائع</p>
        {team.patrols.length === 0 && <p className="px-4 py-4 text-sm text-muted">أضف الطلائع أولًا من تبويب «الهيكل والطلائع».</p>}
        <div className="divide-y divide-line">
          {team.patrols.map((p) => {
            const k = `p:${p.id}`;
            return (
              <div key={p.id} className="space-y-2 border-r-4 px-4 py-3" style={{ borderRightColor: p.color }}>
                <div className="flex items-center gap-2"><p className="flex-1 font-bold" style={{ color: p.color }}>{p.name}</p><Total k={k} /></div>
                <Scores value={cur(k).scores} onChange={(scores) => put(k, { scores })} />
                <input className="field w-full text-sm" value={cur(k).note} placeholder="ملاحظة على أداء الطليعة (اختياري)" onChange={(e) => put(k, { note: e.target.value })} />
              </div>
            );
          })}
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.id} className="card overflow-hidden border-r-4" style={{ borderRightColor: g.color }}>
          <p className="border-b border-line px-4 py-2 text-sm font-bold" style={{ color: g.color }}>تقييم أعضاء {g.name}</p>
          <div className="divide-y divide-line">
            {g.list.map((m) => {
              const k = `s:${m.id}`;
              return (
                <div key={m.id} className="space-y-1.5 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-ink">{m.name}{m.post !== "member" && <span className="text-[11px] font-semibold" style={{ color: g.color }}> · {POSTS[m.post].short}</span>}</p>
                    <Total k={k} />
                  </div>
                  <Scores value={cur(k).scores} onChange={(scores) => put(k, { scores })} />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {dirty > 0 && (
        <div className="sticky bottom-3 z-10 flex justify-center">
          <button className="btn-primary shadow-card" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : `حفظ التقييم (${dirty})`}</button>
        </div>
      )}
    </div>
  );
}
