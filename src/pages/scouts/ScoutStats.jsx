// src/pages/scouts/ScoutStats.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { printReport, escHtml as e, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { logos } from "../student-affairs/shared.jsx";
import { useScoutLeader } from "../../lib/scoutLeader.js";
import Loader from "../../components/Loader.jsx";
import { POSTS, CRITERIA, CRITERIA_MAX, evalTotal, evalRated, attendPct, weekStart, addDays } from "../../lib/scouts.js";
import { loadTeam } from "./data.js";

/* =====================================================================
   تقرير الفريق الكشفي: ترتيب الطلائع من الأفضل إلى الأقل بمتوسط تقييمها الأسبوعي،
   ومعه حضور أعضائها، وتقييم كل عضو وحضوره، للفترة المختارة، وطباعته.
   ===================================================================== */

const PERIODS = [["4", "آخر 4 أسابيع"], ["8", "آخر 8 أسابيع"], ["all", "منذ البداية"]];
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const pctOf = (scores) => Math.round((100 * evalTotal(scores)) / CRITERIA_MAX);
const cAvg = (rows, k) => { const v = rows.map((r) => Number(r.scores?.[k])).filter((x) => !Number.isNaN(x)); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
const pctText = (v) => (v == null ? "—" : `${v}%`);
const tone = (v) => (v == null ? "text-faint" : v >= 85 ? "text-present" : v >= 65 ? "text-late" : "text-absent");

export default function ScoutStats() {
  const leader = useScoutLeader();
  const [team, setTeam] = useState(null);
  const [period, setPeriod] = useState("4");
  const [data, setData] = useState(null);
  useEffect(() => { loadTeam().then(setTeam); }, []);
  const from = period === "all" ? "2000-01-01" : addDays(weekStart(todayISO()), -7 * (Number(period) - 1));
  useEffect(() => {
    setData(null);
    Promise.all([
      supabase.from("scout_evals").select("*").gte("week_start", from),
      supabase.from("scout_attendance").select("student_id, status, att_date, kind").gte("att_date", from).limit(20000),
    ]).then(([ev, at]) => setData({ evals: (ev.data ?? []).filter((r) => evalRated(r.scores)), att: at.data ?? [] }));
  }, [from]);

  const rep = useMemo(() => {
    if (!team || !data) return null;
    const attOf = (ids) => attendPct(data.att.filter((a) => ids.includes(a.student_id)));
    const members = team.members.map((m) => {
      const ev = data.evals.filter((r) => r.student_id === m.id);
      const marks = data.att.filter((a) => a.student_id === m.id);
      return { ...m, evalPct: avg(ev.map((r) => pctOf(r.scores))), weeks: ev.length, att: attendPct(marks),
               absent: marks.filter((a) => a.status === "absent").length, patrol: team.patrols.find((p) => p.id === m.patrol_id) };
    }).sort((a, b) => (b.evalPct ?? -1) - (a.evalPct ?? -1) || (b.att ?? -1) - (a.att ?? -1));
    const patrols = team.patrols.map((p) => {
      const ev = data.evals.filter((r) => r.patrol_id === p.id);
      const ids = team.members.filter((m) => m.patrol_id === p.id).map((m) => m.id);
      return { ...p, evalPct: avg(ev.map((r) => pctOf(r.scores))), weeks: ev.length, att: attOf(ids), size: ids.length,
               crit: Object.fromEntries(CRITERIA.map((c) => [c.k, cAvg(ev, c.k)])),
               membersPct: avg(members.filter((m) => m.patrol_id === p.id && m.evalPct != null).map((m) => m.evalPct)) };
    }).sort((a, b) => (b.evalPct ?? -1) - (a.evalPct ?? -1) || (b.att ?? -1) - (a.att ?? -1));
    const rated = patrols.filter((p) => p.evalPct != null);
    return { members, patrols, best: rated[0], worst: rated.length > 1 ? rated[rated.length - 1] : null, teamAtt: attendPct(data.att) };
  }, [team, data]);

  if (!rep) return <Loader />;
  const period_t = PERIODS.find((p) => p[0] === period)[1];

  const print = () => {
    const prow = rep.patrols.map((p, i) => `<tr><td>${i + 1}</td><td><b>${e(p.name)}</b></td><td>${e(p.size)}</td>
      ${CRITERIA.map((c) => `<td>${e(p.crit[c.k] ?? "—")}</td>`).join("")}<td><b>${e(pctText(p.evalPct))}</b></td><td>${e(pctText(p.att))}</td></tr>`).join("");
    const mrow = rep.members.map((m, i) => `<tr><td>${i + 1}</td><td>${e(m.name)}</td><td>${e(m.cls)}</td><td>${e(m.patrol?.name ?? "—")}</td>
      <td>${e(POSTS[m.post].short)}</td><td><b>${e(pctText(m.evalPct))}</b></td><td>${e(pctText(m.att))}</td><td>${e(m.absent)}</td></tr>`).join("");
    const html = `<table class="kv"><tr><th>الفترة</th><td>${e(period_t)}${period === "all" ? "" : ` (من ${e(fmtDate(from + "T12:00:00"))})`}</td></tr>
      <tr><th>أفضل طليعة</th><td>${e(rep.best ? `${rep.best.name} — ${pctText(rep.best.evalPct)}` : "—")}</td></tr>
      <tr><th>أقل طليعة</th><td>${e(rep.worst ? `${rep.worst.name} — ${pctText(rep.worst.evalPct)}` : "—")}</td></tr>
      <tr><th>حضور الفريق</th><td>${e(pctText(rep.teamAtt))}</td></tr></table>
      <p class="sec-h">ترتيب الطلائع</p><table><thead><tr><th>م</th><th>الطليعة</th><th>الأعضاء</th>${CRITERIA.map((c) => `<th>${e(c.t)} (10)</th>`).join("")}<th>التقييم</th><th>الحضور</th></tr></thead><tbody>${prow}</tbody></table>
      <p class="sec-h">تقييم الأعضاء</p><table><thead><tr><th>م</th><th>العضو</th><th>الفصل</th><th>الطليعة</th><th>المنصب</th><th>التقييم</th><th>الحضور</th><th>الغياب</th></tr></thead><tbody>${mrow}</tbody></table>`;
    printReport({ title: "تقرير الفريق الكشفي", sections: [{ title: "تقرير الفريق الكشفي: الطلائع والأعضاء", subtitle: period_t, html }],
      ...logos(), signatures: [{ title: "القائد الكشفي", name: leader?.full_name ?? "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }] });
  };

  const Card = ({ p, label, c }) => (
    <div className="card flex-1 border-t-4 p-4" style={{ borderTopColor: p?.color ?? "#ccc" }}>
      <p className={`text-xs font-semibold ${c}`}>{label}</p>
      {p ? (<><p className="mt-1 text-lg font-bold" style={{ color: p.color }}>{p.name}</p>
        <p className="text-sm text-muted">التقييم <b className={`num ${tone(p.evalPct)}`}>{pctText(p.evalPct)}</b> · الحضور <b className="num">{pctText(p.att)}</b></p></>)
        : <p className="mt-1 text-sm text-faint">لا تقييمات في هذه الفترة.</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map(([k, t]) => (
          <button key={k} onClick={() => setPeriod(k)} className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${period === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{t}</button>
        ))}
        <button className="btn-ghost ms-auto px-4 py-1.5 text-xs" onClick={print}>طباعة التقرير</button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Card p={rep.best} label="🏆 أفضل طليعة" c="text-present" />
        <Card p={rep.worst} label="الأقل في التقييم" c="text-absent" />
        <div className="card flex-1 p-4"><p className="text-xs font-semibold text-muted">حضور الفريق</p>
          <p className={`num mt-1 text-2xl font-bold ${tone(rep.teamAtt)}`}>{pctText(rep.teamAtt)}</p>
          <p className="text-[11px] text-muted">الاصطفاف والفسحة · المستأذن لا يُحتسب</p></div>
      </div>

      <section className="card overflow-x-auto">
        <p className="border-b border-line px-4 py-2 text-sm font-semibold text-ink">ترتيب الطلائع</p>
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">م</th><th className="p-2">الطليعة</th>
            {CRITERIA.map((c) => <th key={c.k} className="p-2 text-center">{c.t}</th>)}<th className="p-2 text-center">التقييم</th><th className="p-2 text-center">تقييم أعضائها</th><th className="p-2 text-center">الحضور</th></tr></thead>
          <tbody className="divide-y divide-line/60">
            {rep.patrols.map((p, i) => (
              <tr key={p.id}><td className="num p-2 text-faint">{i + 1}</td><td className="p-2 font-bold" style={{ color: p.color }}>{p.name}</td>
                {CRITERIA.map((c) => <td key={c.k} className="num p-2 text-center">{p.crit[c.k] ?? "—"}</td>)}
                <td className={`num p-2 text-center font-bold ${tone(p.evalPct)}`}>{pctText(p.evalPct)}</td>
                <td className="num p-2 text-center">{pctText(p.membersPct)}</td><td className="num p-2 text-center">{pctText(p.att)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <p className="border-b border-line px-4 py-2 text-sm font-semibold text-ink">تقييم الأعضاء <span className="text-xs font-normal text-muted">(من الأعلى إلى الأقل)</span></p>
        <table className="w-full min-w-[600px] text-sm">
          <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">م</th><th className="p-2">العضو</th><th className="p-2">الطليعة</th>
            <th className="p-2 text-center">التقييم</th><th className="p-2 text-center">أسابيع مقيَّمة</th><th className="p-2 text-center">الحضور</th><th className="p-2 text-center">الغياب</th></tr></thead>
          <tbody className="divide-y divide-line/60">
            {rep.members.map((m, i) => (
              <tr key={m.id}><td className="num p-2 text-faint">{i + 1}</td>
                <td className="p-2 text-ink">{m.name}{m.post !== "member" && <span className="text-[11px] text-muted"> · {POSTS[m.post].short}</span>}</td>
                <td className="p-2 text-xs" style={{ color: m.patrol?.color }}>{m.patrol?.name ?? "—"}</td>
                <td className={`num p-2 text-center font-bold ${tone(m.evalPct)}`}>{pctText(m.evalPct)}</td>
                <td className="num p-2 text-center">{m.weeks}</td><td className={`num p-2 text-center ${tone(m.att)}`}>{pctText(m.att)}</td>
                <td className="num p-2 text-center">{m.absent}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
