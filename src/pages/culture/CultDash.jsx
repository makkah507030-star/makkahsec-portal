// src/pages/culture/CultDash.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { countAr } from "../../lib/arabicCount.js";
import { PROGRAMS, STATUS, WORK_KINDS, dueOf, overdue, setupMsg } from "../../lib/culture.js";
import Loader from "../../components/Loader.jsx";

/* لوحة التنفيذ: مؤشرات الخطة (الإجمالي والمكتمل وقيد التنفيذ ونسبة الإنجاز)، وتوزيع الحالات، وكل برنامج
   بإنجازه، والتنبيهات (المتأخرة عن موعدها والمتعثرة)، وأعمال البرامج، وأدوات البوابة المرتبطة بالمشروع */

const TOOLS = [
  ["/events", "الأحداث والمناسبات", "أنشئ حدثًا لنشاط اليوم العالمي أو الملتقى، واربطه بالنشاط في الخطة"],
  ["/studio", "استوديو البوابة", "بطاقات التهنئة والتعزية ومنشورات التوعية بهوية المدرسة"],
  ["/forms", "النماذج والشهادات", "شهادات الشكر لأصحاب المبادرات والموظف المتميز"],
  ["/polls", "التصويت والاستطلاعات", "استطلاع رأي الموظفين للتغذية الراجعة الشهرية"],
  ["/accreditation", "التقويم والاعتماد", "أعمال الثقافة شواهدُ جاهزة لمؤشرات المجتمع المدرسي والمناخ الآمن"],
];

// أعمال كل برنامج في البوابة خارج أنشطة الخطة: الرسائل للموظفين، واللقاءات، وبطاقات «نهتم بك»، وتهيئة الجدد، والأفكار
const WORK_OF = {
  comm: (d) => d.meet.length + d.msgs.filter((m) => m.program === "comm").length,
  care: (d) => d.occ.filter((x) => x.sent_at).length + d.msgs.filter((m) => m.program === "care").length,
  hayyak: (d) => d.onb.length + d.msgs.filter((m) => m.program === "hayyak").length,
  innov: (d) => d.ideas.length + d.msgs.filter((m) => m.program === "innov").length,
};
["rafah", "takafu", "values", "mazaya", "ohi"].forEach((k) => { WORK_OF[k] = (d) => d.msgs.filter((m) => m.program === k).length; });
const WORK_LABEL = { comm: "اللقاءات والرسائل", care: "البطاقات والرسائل", hayyak: "الموظفون الجدد والرسائل", innov: "الأفكار والرسائل",
  rafah: "الرسائل", takafu: "الرسائل", values: "الرسائل", mazaya: "الرسائل", ohi: "الرسائل" };

export default function CultDash({ go }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    Promise.all([
      supabase.from("cult_activities").select("*").order("sort"),
      supabase.from("cult_meetings").select("kind"),
      supabase.from("cult_occasions").select("sent_at"),
      supabase.from("cult_onboard").select("checks"),
      supabase.from("cult_ideas").select("status"),
      supabase.from("cult_messages").select("program"),
      supabase.rpc("cult_team_works"),
    ]).then(([a, m, o, b, i, g, w]) => {
      if (a.error) { setErr(setupMsg(a.error)); setD({}); return; }
      setD({ acts: a.data ?? [], meet: m.data ?? [], occ: o.data ?? [], onb: b.data ?? [], ideas: i.data ?? [], msgs: g.data ?? [], works: w.data ?? [] });
    });
  }, []);
  if (!d) return <Loader />;
  if (err) return <p className="card px-4 py-6 text-sm text-absent">{err}</p>;

  const acts = d.acts;
  const n = (s) => acts.filter((x) => x.status === s).length;
  const pct = acts.length ? Math.round((n("done") / acts.length) * 100) : 0;
  const late = acts.filter((x) => overdue(x));
  const stuck = acts.filter((x) => x.status === "stuck");
  const tile = (v, t, c) => (
    <div className="rounded-sm2 border border-line bg-white px-3 py-2.5 text-center">
      <p className="num text-2xl font-bold" style={{ color: c ?? "rgb(var(--c-ink))" }}>{v}</p><p className="text-[12px] text-muted">{t}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tile(acts.length, "إجمالي الأنشطة")}
          {tile(n("done"), "مكتمل", "rgb(var(--c-present))")}
          {tile(n("doing"), "قيد التنفيذ", "rgb(var(--c-excused))")}
          {tile(`${pct}%`, "نسبة الإنجاز", "rgb(var(--c-mint-deep))")}
        </div>
        <div className="flex h-3 overflow-hidden rounded-pill bg-canvas">
          {Object.entries(STATUS).map(([k, s]) => n(k) ? <span key={k} style={{ width: `${(n(k) / acts.length) * 100}%`, background: s.bar }} title={`${s.t}: ${n(k)}`} /> : null)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
          {Object.entries(STATUS).map(([k, s]) => <span key={k}><i className="me-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: s.bar }} />{s.t} <b className="num text-ink">{n(k)}</b></span>)}
        </div>
      </section>

      {(late.length > 0 || stuck.length > 0) && (
        <section className="card space-y-2 border-absent/30 p-4">
          <h2 className="text-sm font-bold text-absent">تنبيهات ومتابعة</h2>
          <p className="text-[12px] text-muted">{late.length ? `${countAr(late.length, "activity")} فات موعدها ولم تكتمل` : ""}{late.length && stuck.length ? " · " : ""}{stuck.length ? `متعثر: ${stuck.length}` : ""}. حدّث حالتها ووثّق تنفيذها أو أجّلها.</p>
          <ul className="space-y-1 text-[13px]">{[...stuck, ...late.filter((x) => x.status !== "stuck")].slice(0, 8).map((x) => (
            <li key={x.id} className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PROGRAMS[x.program]?.c }} />
              <span className="min-w-0 flex-1 truncate text-ink">{x.title}</span><span className="num shrink-0 text-[11px] text-muted">{dueOf(x)}</span>
              <span className={`chip shrink-0 ${STATUS[x.status].c}`}>{STATUS[x.status].t}</span></li>))}</ul>
          <button className="text-xs font-semibold text-mint-deep" onClick={() => go("plan")}>فتح الخطة التنفيذية ←</button>
        </section>
      )}

      {/* إنجاز البرامج: الشريط بكل حالات أنشطة الخطة (المكتمل بلون البرنامج، وقيد التنفيذ بدرجته الفاتحة،
          والمتعثر والمؤجل بلونيهما)، والنسبة للمكتمل، وتحتها ما يحتاج متابعة وأعمال البرنامج في البوابة */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
          <h2 className="me-auto text-sm font-bold text-ink">إنجاز البرامج</h2>
          {[["مكتمل", 1], ["قيد التنفيذ", 0.4]].map(([t, o]) => (
            <span key={t} className="flex items-center gap-1 text-[11px] text-muted"><i className="inline-block h-2 w-3 rounded-full bg-mint-deep" style={{ opacity: o }} />{t}</span>))}
          {["stuck", "later"].map((k) => (
            <span key={k} className="flex items-center gap-1 text-[11px] text-muted"><i className="inline-block h-2 w-3 rounded-full" style={{ background: STATUS[k].bar }} />{STATUS[k].t}</span>))}
        </div>
        <div className="divide-y divide-line/70">{Object.entries(PROGRAMS).map(([k, p]) => {
          const xs = acts.filter((x) => x.program === k); if (!xs.length) return null;
          const c = (st) => xs.filter((x) => x.status === st).length;
          const done = c("done"), v = Math.round((done / xs.length) * 100);
          const seg = [["done", p.c, 1], ["doing", p.c, 0.4], ["stuck", STATUS.stuck.bar, 1], ["later", STATUS.later.bar, 1]];
          const lateN = xs.filter((x) => overdue(x)).length;
          const work = WORK_OF[k]?.(d) ?? 0;
          const notes = [c("doing") && `قيد التنفيذ: ${c("doing")}`, c("stuck") && `متعثر: ${c("stuck")}`,
                         lateN && `فات موعده: ${lateN}`, work && `${WORK_LABEL[k]}: ${work}`].filter(Boolean);
          return (
            <button key={k} type="button" onClick={() => go("plan")} className="block w-full px-4 py-2.5 text-start hover:bg-canvas/60">
              <span className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-bold" style={{ color: p.c }}>{p.t}</span>
                <span className="flex h-2.5 flex-1 overflow-hidden rounded-pill bg-canvas">
                  {seg.map(([st, col, o]) => c(st) ? <span key={st} title={`${STATUS[st].t}: ${c(st)}`}
                    style={{ width: `${(c(st) / xs.length) * 100}%`, background: col, opacity: o }} /> : null)}
                </span>
                <span className="flex w-16 shrink-0 flex-col items-end leading-tight">
                  <b className="num text-[14px]" style={{ color: v ? p.c : "rgb(var(--c-muted))" }}>{v}%</b>
                  <span className="text-[11px] text-muted"><span className="num">{done}</span> من <span className="num">{xs.length}</span></span>
                </span>
              </span>
              {notes.length > 0 && (
                <span className="mt-1 block text-[11px] text-muted sm:ps-[7.75rem]">
                  {notes.map((t, i) => <span key={t} className={/متعثر|فات/.test(t) ? "text-absent" : ""}>{i ? " · " : ""}{t}</span>)}
                </span>
              )}
            </button>
          );
        })}</div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tile(d.msgs.length, "رسائل للموظفين", "#7258A4")}
        {tile(d.meet.length, "لقاءات التواصل الملهم")}
        {tile(d.occ.filter((x) => x.sent_at).length, "بطاقات «نهتم بك» المرسلة")}
        {tile(d.onb.length, "موظفون جدد في «حيّاك»")}
        {tile(d.ideas.length, "أفكار الموظفين")}
      </section>

      <Team works={d.works} />

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-bold text-ink">أدوات البوابة للمشروع</h2>
        <div className="grid gap-2 sm:grid-cols-2">{TOOLS.map(([to, t, d2]) => (
          <Link key={to} to={to} className="rounded-sm2 border border-line bg-white px-3 py-2 hover:bg-canvas">
            <b className="block text-[13px] text-mint-deep">{t} ←</b><span className="text-[11.5px] text-muted">{d2}</span>
          </Link>))}</div>
      </section>
    </div>
  );
}

/* إسهام أعضاء الفريق (cult_7.sql ← cult_team_works): أعمال كل عضو بأنواعها في شريط ملوّن، وهي نفسها شواهده */
function Team({ works }) {
  const people = [...new Map(works.map((w) => [w.user_id, { id: w.user_id, name: w.full_name, role: w.role, by: {} }])).values()];
  works.forEach((w) => { people.find((p) => p.id === w.user_id).by[w.kind] = Number(w.n); });
  people.forEach((p) => { p.total = Object.values(p.by).reduce((a, v) => a + v, 0); });
  people.sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...people.map((p) => p.total));
  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-sm font-bold text-ink">إسهام أعضاء الفريق</h2>
        <p className="text-[11.5px] text-muted">أعمال كل عضو هذا العام، وتصل شواهدَ في ملف أدائه الوظيفي («أعمال فريق الثقافة المؤسسية»).</p>
      </div>
      {people.length === 0 ? <p className="text-sm text-muted">لم يُسجَّل عمل باسم أحد الأعضاء بعد.</p> : (
        <div className="space-y-2">{people.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-[12.5px] text-ink" title={p.name}>{p.name}{p.role === "ambassador" && <span className="text-[10.5px] text-muted"> · السفير</span>}</span>
            <span className="flex h-3 flex-1 overflow-hidden rounded-pill bg-canvas">
              <span className="flex h-full" style={{ width: `${(p.total / max) * 100}%` }}>
                {Object.entries(WORK_KINDS).map(([k, w]) => p.by[k] ? <span key={k} title={`${w.t}: ${p.by[k]}`} style={{ flex: p.by[k], background: w.c }} /> : null)}
              </span>
            </span>
            <span className="num w-8 shrink-0 text-end text-xs font-bold text-ink">{p.total}</span>
          </div>))}</div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {Object.values(WORK_KINDS).map((w) => <span key={w.t}><i className="me-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: w.c }} />{w.t}</span>)}
      </div>
    </section>
  );
}
