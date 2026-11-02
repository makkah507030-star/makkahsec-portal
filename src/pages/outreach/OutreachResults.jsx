// src/pages/outreach/OutreachResults.jsx
// المتابعة: الاطلاع والإقرار والإجابة لكل فئة وصف وفصل، وتذكير من لم يستجب. والنتائج: تحليل كل
// سؤال (نسب الخيارات، ومتوسط المقياس وتوزيعه، والإجابات النصية)، بتصفية الصف، والتصدير إلى Excel.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { notify } from "../../lib/notice";
import { countAr } from "../../lib/arabicCount.js";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { exportToExcel } from "../../lib/exportUtils.js";
import Loader from "../../components/Loader.jsx";
import { QTYPES } from "../../lib/outreach.js";

const KIND_T = { student: "الطلاب", guardian: "أولياء الأمور", staff: "المنسوبون" };
const pc = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const Bar = ({ p, c = "#3E6350" }) => <div className="h-2 overflow-hidden rounded-pill bg-line/50"><div className="h-full rounded-pill" style={{ width: `${p}%`, background: c }} /></div>;

export function useRecipients(id) {
  const [rows, setRows] = useState(null);
  const load = () => supabase.from("outreach_recipients").select("kind, grade, class_no, read_at, ack_at, answered_at, remind_count").eq("item_id", id)
    .then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  return [rows, load];
}

export function Follow({ item }) {
  const [rows, reload] = useRecipients(item.id);
  const [busy, setBusy] = useState(false);
  if (!rows) return <Loader />;
  const survey = item.kind === "survey";
  const done = (r) => (survey ? r.answered_at : item.needs_ack ? r.ack_at : r.read_at);
  const doneT = survey ? "أجاب" : item.needs_ack ? "أقرّ بالاطلاع" : "اطّلع";
  const groups = [];
  rows.forEach((r) => {
    const key = r.kind === "staff" ? "staff" : `${r.kind}-${r.grade}-${r.class_no}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push(g = { key, kind: r.kind, grade: r.grade, class_no: r.class_no, n: 0, read: 0, done: 0 });
    g.n++; if (r.read_at) g.read++; if (done(r)) g.done++;
  });
  groups.sort((a, b) => a.kind.localeCompare(b.kind) || (a.grade ?? 0) - (b.grade ?? 0) || (a.class_no ?? 0) - (b.class_no ?? 0));
  const tot = { n: rows.length, read: rows.filter((r) => r.read_at).length, done: rows.filter(done).length };
  const remind = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("outreach_remind", { p_id: item.id });
    setBusy(false);
    if (error) notify({ ok: false, text: error.message }); else { notify({ ok: true, text: `وصل التذكير إلى ${countAr(data, "beneficiary", { acc: true })}.` }); reload(); }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["وصلتهم", tot.n, 100], ["فتحوها", tot.read, pc(tot.read, tot.n)], [doneT, tot.done, pc(tot.done, tot.n)]].map(([t, v, p]) => (
          <div key={t} className="card p-4"><p className="text-xs text-muted">{t}</p>
            <p className="mt-0.5 flex items-baseline gap-2"><b className="num text-2xl text-ink">{v}</b>{t !== "وصلتهم" && <span className="num text-sm font-semibold text-mint-deep">{p}%</span>}</p>
            {t !== "وصلتهم" && <div className="mt-2"><Bar p={p} /></div>}</div>))}
      </div>
      {tot.n > tot.done && (survey || item.needs_ack || tot.n > tot.read) && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <p className="min-w-0 flex-1 text-sm text-ink">لم {survey ? "يُجب" : item.needs_ack ? "يُقرّ" : "يفتحها"} بعد <b className="num">{tot.n - tot.done}</b>. يصلهم تذكير في الجرس والجوال.</p>
          <button className="btn-primary" disabled={busy} onClick={remind}>{busy ? "…" : "تذكير من لم يستجب"}</button>
        </div>)}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2.5">الفئة</th><th className="p-2.5">العدد</th><th className="p-2.5">فتحوها</th><th className="p-2.5">{doneT}</th><th className="w-1/3 p-2.5">النسبة</th></tr></thead>
          <tbody className="divide-y divide-line/60">{groups.map((g) => (
            <tr key={g.key}><td className="p-2.5 text-ink">{KIND_T[g.kind]}{g.kind !== "staff" && <span className="text-muted"> · {GRADE_NAMES[g.grade]} / {g.class_no}</span>}</td>
              <td className="num p-2.5">{g.n}</td><td className="num p-2.5">{g.read}</td><td className="num p-2.5 font-semibold text-mint-deep">{g.done}</td>
              <td className="p-2.5"><div className="flex items-center gap-2"><div className="flex-1"><Bar p={pc(g.done, g.n)} /></div><span className="num w-10 text-xs text-muted">{pc(g.done, g.n)}%</span></div></td></tr>))}
          </tbody>
        </table>
        {!groups.length && <p className="px-4 py-6 text-center text-sm text-muted">لم تُرسل بعد.</p>}
      </div>
    </div>
  );
}

const COLORS = ["#3E6350", "#3F6B99", "#9A6A1F", "#7A4FB5", "#2F7F7A", "#A86068", "#5F8A3A", "#4A5866"];

export function Results({ item }) {
  const [ans, setAns] = useState(null);
  const [grade, setGrade] = useState(0);
  const [kind, setKind] = useState("all");
  useEffect(() => { supabase.from("outreach_answers").select("*").eq("item_id", item.id).order("created_at").then(({ data }) => setAns(data ?? [])); }, [item.id]);
  const shown = useMemo(() => (ans ?? []).filter((a) => (!grade || a.grade === grade) && (kind === "all" || a.kind === kind)), [ans, grade, kind]);
  if (!ans) return <Loader />;
  if (!ans.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لا إجابات بعد. تظهر النتائج هنا لحظة وصول أول إجابة.</p>;
  const grades = [...new Set(ans.map((a) => a.grade).filter(Boolean))].sort();
  const kinds = [...new Set(ans.map((a) => a.kind))];

  const exportX = () => exportToExcel(shown.map((a, i) => ({
    "م": i + 1, "الفئة": KIND_T[a.kind] ?? "", "الصف": GRADE_NAMES[a.grade] ?? "", "الفصل": a.class_no ?? "",
    ...Object.fromEntries(item.questions.map((q, n) => {
      const v = a.answers[q.id];
      return [`${n + 1}. ${q.q}`.slice(0, 80), Array.isArray(v) ? v.join("، ") : q.type === "scale" && v ? `${v} - ${QTYPES.scale.scale[v - 1]}` : v ?? ""];
    })),
    "وقت الإجابة": new Date(a.created_at).toLocaleString("ar-SA-u-ca-gregory"),
  })), `نتائج ${item.title}`, "الإجابات");

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <b className="num text-ink">{shown.length}</b><span className="text-sm text-muted">إجابة</span>
        <span className="flex-1" />
        {kinds.length > 1 && <select className="field w-auto py-1.5 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">كل الفئات</option>{kinds.map((k) => <option key={k} value={k}>{KIND_T[k]}</option>)}</select>}
        {grades.length > 1 && <select className="field w-auto py-1.5 text-sm" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
          <option value={0}>كل الصفوف</option>{grades.map((g) => <option key={g} value={g}>{GRADE_NAMES[g]}</option>)}</select>}
        <button className="btn-ghost" onClick={exportX}>تصدير Excel</button>
      </div>
      {item.questions.map((q, n) => {
        const vals = shown.map((a) => a.answers[q.id]).filter((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length));
        return (
          <section key={q.id} className="card space-y-3 p-4">
            <div className="flex items-start gap-2"><span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-deep text-xs font-bold text-white">{n + 1}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold leading-relaxed text-ink">{q.q}</p>
                <p className="text-[11.5px] text-muted">{QTYPES[q.type].t} · أجاب {vals.length} من {shown.length}</p></div></div>
            {["single", "multi", "yesno"].includes(q.type) && (() => {
              const opts = q.type === "yesno" ? QTYPES.yesno.fixed : q.options;
              const cnt = opts.map((o) => vals.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length);
              const max = Math.max(1, ...cnt);
              return <div className="space-y-2">{opts.map((o, i) => (
                <div key={o}><div className="mb-0.5 flex justify-between gap-2 text-sm"><span className="text-ink">{o}{cnt[i] === max && cnt[i] > 0 && <span className="mr-1.5 text-[10.5px] font-bold text-mint-deep">الأعلى</span>}</span>
                  <span className="num text-muted">{cnt[i]} · {pc(cnt[i], vals.length)}%</span></div><Bar p={pc(cnt[i], vals.length)} c={COLORS[i % COLORS.length]} /></div>))}</div>;
            })()}
            {q.type === "scale" && (() => {
              const cnt = [1, 2, 3, 4, 5].map((s) => vals.filter((v) => v === s).length);
              const avg = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
              return (
                <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  <div className="rounded-sm2 bg-mint-tint p-3 text-center"><b className="num block text-3xl text-mint-deep">{avg.toFixed(2)}</b>
                    <span className="text-xs text-muted">المتوسط من 5</span><span className="block text-[11px] text-mint-deep">موافقة <span className="num">{pc(cnt[3] + cnt[4], vals.length)}%</span></span></div>
                  <div className="space-y-1.5">{QTYPES.scale.scale.map((t, i) => (
                    <div key={t} className="flex items-center gap-2 text-[12.5px]"><span className="w-28 shrink-0 text-muted">{t}</span>
                      <div className="flex-1"><Bar p={pc(cnt[i], vals.length)} c={["#B4661E", "#C9A04A", "#9AA6A0", "#5F8A3A", "#3E6350"][i]} /></div>
                      <span className="num w-14 text-left text-muted">{cnt[i]} · {pc(cnt[i], vals.length)}%</span></div>))}</div>
                </div>);
            })()}
            {(q.type === "text" || q.type === "long") && (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">{vals.map((v, i) => (
                <li key={i} className="whitespace-pre-line rounded-sm2 bg-canvas px-3 py-2 text-sm text-ink">{v}</li>))}
                {!vals.length && <li className="text-sm text-muted">لا إجابات.</li>}</ul>)}
          </section>
        );
      })}
    </div>
  );
}
