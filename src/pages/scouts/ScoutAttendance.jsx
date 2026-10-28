// src/pages/scouts/ScoutAttendance.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { todayISO } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import { POSTS, ATT_KIND, ATT_STATUS } from "../../lib/scouts.js";
import { loadTeam } from "./data.js";

/* =====================================================================
   تحضير الفريق الكشفي (supabase/scouts_6.sql) للقائد ونائبه: الاصطفاف الصباحي
   والفسحة لأي يوم، مجمّعًا بالطلائع، وما سجّله العرفاء من حساباتهم ظاهر باسمهم.
   وصلاحية التحضير للعريف الأول ونائبه وعرفاء الطلائع ونوابهم، يسحبها القائد.
   ===================================================================== */

export function groupByPatrol(members, patrols) {
  const lead = members.filter((m) => ["chief", "chief_deputy"].includes(m.post));
  const groups = [];
  if (lead.length) groups.push({ id: "lead", name: "قيادة الفريق", color: "#B8912F", list: lead });
  patrols.forEach((p) => {
    const list = members.filter((m) => m.patrol_id === p.id)
      .sort((a, b) => ["patrol_leader", "patrol_deputy", "member"].indexOf(a.post) - ["patrol_leader", "patrol_deputy", "member"].indexOf(b.post));
    if (list.length) groups.push({ id: p.id, name: p.name, color: p.color, list });
  });
  const rest = members.filter((m) => !m.patrol_id && !["chief", "chief_deputy"].includes(m.post));
  if (rest.length) groups.push({ id: "rest", name: "بلا طليعة", color: "#8A9A91", list: rest });
  return groups;
}

export default function ScoutAttendance() {
  const { profile } = useSession();
  const [team, setTeam] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [kind, setKind] = useState("lineup");
  const [saved, setSaved] = useState(null);       // student_id ← {status, by_name}
  const [marks, setMarks] = useState({});         // تعديلات غير محفوظة
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadTeamNow = () => loadTeam().then((t) => { setTeam(t); if (t.err) setMsg({ ok: false, t: t.err }); });
  useEffect(() => { loadTeamNow(); }, []);
  const loadMarks = () => supabase.from("scout_attendance").select("student_id, status, by_name").eq("att_date", date).eq("kind", kind)
    .then(({ data }) => { setSaved(Object.fromEntries((data ?? []).map((r) => [r.student_id, r]))); setMarks({}); });
  useEffect(() => { setSaved(null); loadMarks(); }, [date, kind]);   // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => (team ? groupByPatrol(team.members, team.patrols) : []), [team]);
  if (!team || !saved) return <Loader />;
  const statusOf = (id) => marks[id] ?? saved[id]?.status ?? null;
  const dirty = Object.keys(marks).length;
  const counts = Object.fromEntries(Object.keys(ATT_STATUS).map((k) => [k, team.members.filter((m) => statusOf(m.id) === k).length]));
  const takers = team.members.filter((m) => m.post !== "member");

  const save = async () => {
    setBusy(true); setMsg(null);
    const rows = Object.entries(marks).map(([student_id, status]) => ({ att_date: date, kind, student_id, status, by_name: profile?.full_name ?? null, at: new Date().toISOString() }));
    const { error } = await supabase.from("scout_attendance").upsert(rows, { onConflict: "att_date,kind,student_id" });
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message }); return; }
    setMsg({ ok: true, t: `حُفظ تحضير ${ATT_KIND[kind]} لـ${rows.length} أعضاء.` });
    loadMarks();
  };
  const toggleTaker = async (m) => {
    const { error } = await supabase.from("scout_members").update({ can_attend: !m.can_attend }).eq("student_id", m.id);
    if (error) setMsg({ ok: false, t: error.message }); else loadTeamNow();
  };

  return (
    <div className="space-y-4">
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(ATT_KIND).map(([k, t]) => (
            <button key={k} onClick={() => setKind(k)}
                    className={`rounded-pill px-4 py-1.5 text-sm font-semibold ${kind === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{t}</button>
          ))}
          <input type="date" className="field num ms-auto w-auto" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {Object.entries(ATT_STATUS).map(([k, s]) => (
            <div key={k} className={`rounded-sm2 py-1.5 ${s.soft}`}><p className="num text-lg font-bold">{counts[k]}</p><p className="text-[11px]">{s.t}</p></div>
          ))}
        </div>
        <p className="text-[11px] text-muted">{fmtDate(date + "T12:00:00")} · لم يُحضَّر <span className="num">{team.members.length - Object.values(counts).reduce((a, b) => a + b, 0)}</span> من <span className="num">{team.members.length}</span></p>
      </section>

      {groups.map((g) => (
        <section key={g.id} className="card overflow-hidden border-r-4" style={{ borderRightColor: g.color }}>
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <p className="flex-1 text-sm font-bold" style={{ color: g.color }}>{g.name} <span className="num text-xs font-normal text-muted">({g.list.length})</span></p>
            <button className="text-xs font-semibold text-present" onClick={() => setMarks((x) => ({ ...x, ...Object.fromEntries(g.list.map((m) => [m.id, "present"])) }))}>الكل حاضر</button>
          </div>
          <div className="divide-y divide-line">
            {g.list.map((m) => {
              const st = statusOf(m.id);
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{m.name}{m.post !== "member" && <span className="text-[11px] font-semibold" style={{ color: g.color }}> · {POSTS[m.post].short}</span>}</p>
                    {saved[m.id]?.by_name && !marks[m.id] && <p className="text-[10.5px] text-faint">سجّله: {saved[m.id].by_name}</p>}
                  </div>
                  <div className="flex gap-1">
                    {Object.entries(ATT_STATUS).map(([k, s]) => (
                      <button key={k} onClick={() => setMarks((x) => ({ ...x, [m.id]: k }))}
                              className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${st === k ? s.c : "border border-line bg-white text-muted"}`}>{s.t}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {!team.members.length && <p className="card px-4 py-8 text-center text-sm text-muted">لا أعضاء في الفريق بعد.</p>}

      {dirty > 0 && (
        <div className="sticky bottom-3 z-10 flex justify-center">
          <button className="btn-primary shadow-card" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : `حفظ تحضير ${dirty} أعضاء`}</button>
        </div>
      )}

      {takers.length > 0 && (
        <section className="card p-4">
          <p className="text-sm font-semibold text-ink">صلاحية التحضير من حساب الطالب</p>
          <p className="mb-2 text-[11px] text-muted">العريف الأول ونائبه يحضّران الفريق كله، وعريف الطليعة ونائبه طليعتهم، لليوم فقط. أوقف الصلاحية لمن لا تريده يحضّر.</p>
          <div className="divide-y divide-line">
            {takers.map((m) => (
              <label key={m.id} className="flex items-center gap-2 py-1.5 text-sm text-ink">
                <input type="checkbox" checked={m.can_attend} onChange={() => toggleTaker(m)} />
                <span className="flex-1">{m.name}</span>
                <span className="text-[11px] text-muted">{POSTS[m.post].t}{m.patrol_id ? ` · ${team.patrols.find((p) => p.id === m.patrol_id)?.name ?? ""}` : ""}</span>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
