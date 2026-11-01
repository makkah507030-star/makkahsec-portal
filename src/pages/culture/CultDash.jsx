// src/pages/culture/CultDash.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { countAr } from "../../lib/arabicCount.js";
import { PROGRAMS, STATUS, dueOf, overdue, setupMsg } from "../../lib/culture.js";
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
    ]).then(([a, m, o, b, i]) => {
      if (a.error) { setErr(setupMsg(a.error)); setD({}); return; }
      setD({ acts: a.data ?? [], meet: m.data ?? [], occ: o.data ?? [], onb: b.data ?? [], ideas: i.data ?? [] });
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

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-2.5 text-sm font-bold text-ink">إنجاز البرامج</h2>
        <div className="divide-y divide-line/70">{Object.entries(PROGRAMS).map(([k, p]) => {
          const xs = acts.filter((x) => x.program === k); if (!xs.length) return null;
          const done = xs.filter((x) => x.status === "done").length, v = Math.round((done / xs.length) * 100);
          return (
            <div key={k} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-28 shrink-0 text-sm font-bold" style={{ color: p.c }}>{p.t}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-pill bg-canvas"><span className="block h-full rounded-pill" style={{ width: `${v}%`, background: p.c }} /></span>
              <span className="w-20 shrink-0 text-end text-xs text-muted"><b className="num text-ink">{done}</b> من <span className="num">{xs.length}</span></span>
            </div>
          );
        })}</div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile(d.meet.length, "لقاءات التواصل الملهم")}
        {tile(d.occ.filter((x) => x.sent_at).length, "بطاقات «نهتم بك» المرسلة")}
        {tile(d.onb.length, "موظفون جدد في «حيّاك»")}
        {tile(d.ideas.length, "أفكار الموظفين")}
      </section>

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
