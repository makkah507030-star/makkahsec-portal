// src/pages/science/SciReports.jsx
// تقارير مختبر العلوم للمحضر والإدارة: نسبة تنفيذ التجارب لكل مقرر وفصوله، وأسباب عدم التنفيذ، والحجز
// والتجهيز، وحالة العهدة — على الشاشة، وتقرير تشغيل المختبر بهوية البوابة، والخطط والسجلات للطباعة.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Loader from "../../components/Loader.jsx";
import { REASON, labOf, coursesOf, setupMsg } from "../../lib/sciLab.js";
import { summaryPages } from "./SciDocs.jsx";

const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export default function SciReports({ lab, exps, classes, onPrint }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const ids = exps.map((e) => e.id);
      const since = new Date(Date.now() - 300 * 864e5).toISOString().slice(0, 10);
      const [r, b, inv] = await Promise.all([
        ids.length ? supabase.from("sci_runs").select("experiment_id, class_id, outcome, reason").in("experiment_id", ids) : { data: [] },
        supabase.from("sci_bookings").select("prep, booking_date").eq("lab", lab).gte("booking_date", since),
        supabase.from("sci_inventory").select("status, expiry").eq("lab", lab),
      ]);
      const e0 = r.error || b.error || inv.error;
      if (e0) { setErr(setupMsg(e0)); return; }
      const runs = r.data ?? [], expOf = Object.fromEntries(exps.map((e) => [e.id, e]));
      const courses = coursesOf(exps).map((course) => {
        const list = exps.filter((e) => e.course === course && e.is_active);
        const grade = list[0]?.grade;
        const nCls = new Set(classes.filter((c) => c.grade === grade).map((c) => c.class_id)).size;
        const rs = runs.filter((x) => expOf[x.experiment_id]?.course === course);
        return { course, exps: list.length, classes: nCls, lab: rs.filter((x) => x.outcome === "lab").length,
          virtual: rs.filter((x) => x.outcome === "virtual").length, not: rs.filter((x) => x.outcome === "not_done").length };
      });
      const soon = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
      const items = inv.data ?? [], bks = b.data ?? [];
      setSt({
        courses, planned: courses.reduce((a, c) => a + c.exps * c.classes, 0),
        done: runs.filter((x) => x.outcome !== "not_done").length, virtual: runs.filter((x) => x.outcome === "virtual").length,
        reasons: Object.entries(REASON).map(([k, l]) => ({ k, l, v: runs.filter((x) => x.outcome === "not_done" && x.reason === k).length })),
        bookings: bks.length, ready: bks.filter((x) => x.prep === "ready").length, prep: { issue: bks.filter((x) => x.prep === "issue").length },
        inv: { total: items.length, ok: items.filter((x) => x.status === "ok").length, damaged: items.filter((x) => x.status === "damaged").length,
          missing: items.filter((x) => x.status === "missing").length, expiring: items.filter((x) => x.expiry && x.expiry <= soon).length },
      });
    })();
  }, [lab, exps, classes]);

  if (err) return <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>;
  if (!st) return <Loader />;
  const L = labOf(lab);
  const card = (v, t, s) => (
    <div className="card p-4"><p className="num text-2xl font-bold text-mint-deep">{v}</p><p className="text-sm font-semibold text-ink">{t}</p>{s && <p className="text-xs text-muted">{s}</p>}</div>
  );
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => onPrint({ title: `تقرير تشغيل ${L.name}`, pages: (theme, s, year) => summaryPages({ lab: L, st, theme, year, s }) })}>
          تقرير تشغيل المختبر PDF</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {card(`${pctOf(st.done, st.planned)}%`, "نسبة تنفيذ التجارب", `${st.done} من ${st.planned} لفصول المواد`)}
        {card(st.virtual, "تجربة افتراضية")}
        {card(st.bookings, "حصة محجوزة", `جُهّز منها ${st.ready}`)}
        {card(st.inv.total, "صنفًا في العهدة", `${st.inv.damaged + st.inv.missing} تالف أو ناقص · ${st.inv.expiring} تنتهي صلاحيته قريبًا`)}
      </div>
      <section className="card overflow-hidden">
        <p className="border-b border-line/60 bg-canvas px-4 py-2 text-sm font-bold text-ink">التنفيذ لكل مقرر</p>
        <div className="divide-y divide-line/60">
          {st.courses.map((c) => {
            const p = pctOf(c.lab + c.virtual, c.exps * c.classes);
            return (
              <div key={c.course} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{c.course}</p>
                  <p className="text-xs text-muted"><span className="num">{c.exps}</span> تجربة × <span className="num">{c.classes}</span> فصول · في المختبر <span className="num">{c.lab}</span> · افتراضية <span className="num">{c.virtual}</span> · لم تُنفّذ <span className="num">{c.not}</span></p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-mint-deep" style={{ width: `${p}%` }} /></div>
                  <span className="num w-10 text-xs font-semibold text-mint-deep">{p}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {st.reasons.some((r) => r.v) && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-bold text-ink">أسباب عدم التنفيذ</p>
          {st.reasons.filter((r) => r.v).map((r) => <p key={r.k} className="text-sm text-ink">{r.l}: <b className="num">{r.v}</b></p>)}
        </section>
      )}
    </div>
  );
}
