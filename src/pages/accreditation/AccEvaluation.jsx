// src/pages/accreditation/AccEvaluation.jsx
import { countAr } from "../../lib/arabicCount.js";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import {
  CODES, DOMAINS, STANDARDS, INDICATORS, NEW_CODES, PHASES, PLAN_BELOW, REPORT_KIND, analyze, domainOf, levelOf, fmtPct, accUpload, accOpen,
} from "../../lib/accreditation.js";

/* =====================================================================
   التقويم الذاتي والتقويم الخارجي: لكل منهما خطواته (PHASES) يتابعها المشرف، وتقريره يُرفع
   ملفًا وتُدخل نسب مؤشراته (أو تُلصق من التقرير)، فيحلّله القسم: الأداء العام ومستواه، والمجالات
   والمعايير، والتوزيع على المستويات، والأدنى والأعلى، وما دون التقدم. والخارجي يُقارن بالذاتي.
   أدوات التقويم نفسها في منصة تميز؛ هنا التنظيم والنتيجة فقط.
   ===================================================================== */

const T = { self: "التقويم الذاتي", external: "التقويم الخارجي" };
const HINT = {
  self: "تنفذه المدرسة بفريقها وأدواتها في منصة تميز، ثم تُرفع نتيجته هنا للتحليل وبناء خطة التحسين.",
  external: "تنفذه الإجراءات نفسها بفريق من خارج المدرسة بأدواته. المهم هنا تقرير ما بعد الزيارة: يُرفع ويُحلَّل ويُقارن بالتقويم الذاتي، ثم تُحدَّث خطة التحسين.",
};

export default function AccEvaluation({ kind, me, year, reports, reload }) {
  const { profile } = useSession();
  const [, setMsg] = useNotice(null);
  const mine = reports.filter((r) => r.kind === kind);
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const r = mine.find((x) => x.id === sel) ?? mine[0];
  const self = reports.find((x) => x.kind === "self");

  return (
    <div className="space-y-4">
      <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">{HINT[kind]}</p>
      <Steps kind={kind} me={me} year={year} by={profile?.full_name} setMsg={setMsg} />
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-sm font-semibold text-ink">{REPORT_KIND[kind]}</p>
          {me.coord && !edit && <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setEdit({ kind, academic_year: year, title: `${REPORT_KIND[kind]} ${year}هـ`, scores: {} })}>+ رفع تقرير</button>}
        </div>
        {mine.length > 1 && <div className="flex flex-wrap gap-1.5">{mine.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-pill border px-3 py-1 text-xs ${x.id === r?.id ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted"}`}>{x.title}</button>))}</div>}
        {edit && <ReportEdit x={edit} by={profile?.full_name} setMsg={setMsg} onDone={(id) => { setEdit(null); if (id) { setSel(id); reload(); } }} />}
        {!edit && !r && <p className="py-4 text-center text-sm text-muted">لم يُرفع {REPORT_KIND[kind]} بعد.</p>}
        {!edit && r && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>{r.report_date ? `تاريخه ${fmtDate(r.report_date)}` : `أُضيف ${fmtDate(r.created_at)}`}{r.created_by_name && ` · ${r.created_by_name}`}</span>
            {r.file_path && <button className="font-semibold text-mint-deep" onClick={async () => { const e = await accOpen(r.file_path); if (e) setMsg({ ok: false, text: e.message }); }}>فتح ملف التقرير</button>}
            {me.coord && <button className="font-semibold text-muted" onClick={() => setEdit(r)}>تعديل النسب</button>}
          </div>
        )}
      </section>
      {!edit && r && <Analysis r={r} cmp={kind === "external" ? self : null} me={me} />}
    </div>
  );
}

function Steps({ kind, me, year, by, setMsg }) {
  const [rows, setRows] = useState(null);
  const load = () => supabase.from("acc_steps").select("*").eq("academic_year", year).eq("kind", kind).then(({ data }) => setRows(Object.fromEntries((data ?? []).map((x) => [x.step, x]))));
  useEffect(() => { load(); }, [kind, year]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return null;
  const all = PHASES[kind].flatMap((p) => p.steps);
  const done = all.filter((s) => rows[s]?.done_at).length;
  const toggle = async (step) => {
    if (!me.coord) return;
    const on = !rows[step]?.done_at;
    const { error } = await supabase.from("acc_steps").upsert({ academic_year: year, kind, step, done_at: on ? new Date().toISOString() : null, done_by_name: on ? by ?? null : null });
    if (error) setMsg({ ok: false, text: error.message }); else load();
  };
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold text-ink">مراحل {T[kind]}</p>
        <span className="num text-xs text-muted">{done} من {all.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PHASES[kind].map((ph, i) => (
          <div key={ph.t} className="rounded-sm2 border border-line p-3">
            <p className="mb-2 text-xs font-bold text-mint-deep">{i + 1}. {ph.t}</p>
            <div className="space-y-1">{ph.steps.map((s) => {
              const d = rows[s]?.done_at;
              return (
                <button key={s} disabled={!me.coord} onClick={() => toggle(s)} className="flex w-full items-start gap-2 text-start text-[13px]">
                  <span className={d ? "text-present" : "text-faint"}>{d ? "✓" : "○"}</span>
                  <span className={d ? "text-ink" : "text-muted"}>{s}{d && <span className="block text-[10.5px] text-faint">{fmtDate(d)}</span>}</span>
                </button>
              );
            })}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// لصق من التقرير: كل رمز يليه رقمه، مثل «4-1-1-2 … 53.25%»
const parsePaste = (t) => {
  const out = {};
  for (const m of String(t).matchAll(/([1-4]-\d-\d-\d)[^\d]{0,80}?(\d{1,3}(?:\.\d{1,2})?)\s*%?/g)) if (INDICATORS[m[1]] && +m[2] <= 100) out[m[1]] = +m[2];
  return out;
};

function ReportEdit({ x, by, setMsg, onDone }) {
  const [f, setF] = useState({ ...x, scores: { ...x.scores } });
  const [file, setFile] = useState(null);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const setS = (c, v) => setF((o) => { const s = { ...o.scores }; if (v === "") delete s[c]; else s[c] = Number(v); return { ...o, scores: s }; });
  const n = CODES.filter((c) => f.scores[c] != null).length;
  const save = async () => {
    if (!f.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان التقرير." }); return; }
    setBusy(true);
    let file_path = f.file_path ?? null;
    if (file) {
      const up = await accUpload("reports", file);
      if (up.error) { setBusy(false); setMsg({ ok: false, text: up.error.message }); return; }
      file_path = up.path;
    }
    const row = { title: f.title.trim(), report_date: f.report_date || null, scores: f.scores, notes: f.notes || null, file_path, updated_at: new Date().toISOString() };
    const { data, error } = f.id ? await supabase.from("acc_reports").update(row).eq("id", f.id).select("id").single()
      : await supabase.from("acc_reports").insert({ ...row, kind: f.kind, academic_year: f.academic_year, created_by_name: by ?? null }).select("id").single();
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "حُفظ التقرير وحُلّلت نسبه." }); onDone(data.id);
  };
  return (
    <div className="space-y-3 rounded-sm2 border border-line bg-canvas/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_170px]">
        <input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="عنوان التقرير" />
        <input type="date" className="field" value={f.report_date ?? ""} onChange={(e) => setF({ ...f, report_date: e.target.value })} />
      </div>
      <label className="block text-xs text-muted">ملف التقرير (PDF){f.file_path && " — مرفوع، واختر ملفًا لاستبداله"}
        <input type="file" accept="application/pdf,image/*" className="mt-1 block text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <div>
        <p className="text-xs text-muted">لصق سريع: انسخ جدول المؤشرات من التقرير والصقه، فتُلتقط الرموز ونسبها</p>
        <div className="mt-1 flex gap-2">
          <textarea className="field min-h-[56px] flex-1 text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="1-1-1-1  75.25%  …" />
          <button className="rounded-pill border border-line bg-white px-3 text-xs text-mint-deep" onClick={() => { const s = parsePaste(paste); setF((o) => ({ ...o, scores: { ...o.scores, ...s } })); setMsg({ ok: true, text: `التُقطت ${countAr(Object.keys(s).length, "ratio")}.` }); setPaste(""); }}>التقاط</button>
        </div>
      </div>
      <label className="block text-xs text-muted">الأداء العام الرسمي كما في التقرير % (يُقدَّم على المحسوب من النسب)
        <input type="number" step="0.01" className="field mt-1 w-40" value={f.scores._overall ?? ""} onChange={(e) => setS("_overall", e.target.value)} /></label>
      <p className="text-xs text-muted">نسب المؤشرات <span className="num">({n} من {CODES.length})</span> — يُترك المستحدث بلا قياس فارغًا</p>
      {Object.keys(DOMAINS).map((d) => (
        <div key={d}>
          <p className="mb-1 text-xs font-bold text-mint-deep">{DOMAINS[d]}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
            {CODES.filter((c) => domainOf(c) === +d).map((c) => (
              <label key={c} title={INDICATORS[c]} className="flex items-center gap-1 rounded-sm2 border border-line bg-white px-2 py-1">
                <span className="num shrink-0 text-[11px] text-muted">{c}</span>
                <input type="number" step="0.01" min="0" max="100" className="num w-full min-w-0 bg-transparent text-end text-sm outline-none"
                  value={f.scores[c] ?? ""} onChange={(e) => setS(c, e.target.value)} placeholder={NEW_CODES.includes(c) ? "مستحدث" : ""} />
              </label>
            ))}
          </div>
        </div>
      ))}
      <textarea className="field min-h-[48px] text-sm" value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="ملاحظات (اختياري)" />
      <div className="flex gap-2">
        <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "…" : "حفظ وتحليل"}</button>
        <button className="rounded-pill border border-line bg-white px-4 py-1.5 text-xs text-muted" onClick={() => onDone(null)}>إلغاء</button>
      </div>
    </div>
  );
}

function Analysis({ r, cmp, me }) {
  const a = useMemo(() => analyze(r.scores), [r.scores]);
  const c = useMemo(() => (cmp ? analyze(cmp.scores) : null), [cmp]);
  const lv = levelOf(a.overall);
  const total = a.dist.reduce((s, x) => s + x.n, 0) || 1;
  const sees = (code) => me.coord || me.domains.includes(domainOf(code));
  if (!a.measured) return <p className="card px-4 py-6 text-center text-sm text-muted">لم تُدخل نسب المؤشرات بعد.</p>;
  const delta = c ? CODES.filter((x) => r.scores[x] != null && cmp.scores[x] != null).map((x) => [x, Math.round((r.scores[x] - cmp.scores[x]) * 100) / 100]).sort((p, q) => p[1] - q[1]) : [];
  const Bar = ({ v, l }) => <span className="h-2 flex-1 overflow-hidden rounded-pill bg-canvas"><span className="block h-full rounded-pill" style={{ width: `${v ?? 0}%`, background: l?.c }} /></span>;

  return (
    <div className="space-y-4">
      <section className="card grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
        <div className="text-center">
          <p className="text-xs text-muted">الأداء العام</p>
          <p className="num text-4xl font-bold" style={{ color: lv?.c }}>{fmtPct(a.overall)}</p>
          <p className="text-sm font-semibold" style={{ color: lv?.c }}>{lv?.t}</p>
          {a.official && a.calc != null && a.calc !== a.overall && <p className="mt-1 text-[11px] text-faint">الرسمي في التقرير؛ المحسوب من النسب <span className="num">{a.calc}%</span></p>}
          {c && <p className="mt-1 text-xs text-muted">الذاتي <span className="num">{fmtPct(c.overall)}</span></p>}
          <p className="num mt-1 text-[11px] text-faint">{countAr(a.measured, "indicator")} مقاسة</p>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex h-5 overflow-hidden rounded-pill">{a.dist.filter((x) => x.n).map((x) => (
              <span key={x.t} className="num grid place-items-center text-[10.5px] font-bold text-white" style={{ width: `${(x.n / total) * 100}%`, background: x.c }}>{x.n}</span>))}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">{a.dist.map((x) => <span key={x.t}><span className="inline-block h-2 w-2 rounded-full" style={{ background: x.c }} /> {x.t} <span className="num">{x.n}</span></span>)}</div>
          </div>
          {Object.keys(DOMAINS).map((d) => (
            <div key={d} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 text-ink">{DOMAINS[d]}</span><Bar v={a.byDomain[d]} l={levelOf(a.byDomain[d])} />
              <span className="num w-24 shrink-0 text-end text-xs text-muted">{fmtPct(a.byDomain[d])}{c && <> · ذاتي {fmtPct(c.byDomain[d])}</>}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-4">
        <p className="mb-2 text-sm font-semibold text-ink">المعايير</p>
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">{Object.keys(STANDARDS).map((s) => (
          <div key={s} className="flex items-center gap-2 text-[13px]"><span className="w-44 shrink-0 truncate text-ink">{STANDARDS[s]}</span><Bar v={a.byStd[s]} l={levelOf(a.byStd[s])} /><span className="num w-12 text-end text-xs text-muted">{fmtPct(a.byStd[s])}</span></div>))}</div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <List t="أولويات التحسين (الأدنى)" codes={a.low} r={r} c="text-absent" sees={sees} />
        <List t="جوانب القوة (الأعلى)" codes={a.high} r={r} c="text-present" sees={sees} />
      </div>
      <section className="card p-4">
        <p className="mb-2 text-sm font-semibold text-ink">دون مستوى التقدم ({PLAN_BELOW}%) <span className="num text-muted">({a.below.length})</span> — مرشحة لخطة التحسين</p>
        <div className="flex flex-wrap gap-1.5">{a.below.map((x) => <span key={x} title={INDICATORS[x]} className="rounded-pill border border-line px-2.5 py-1 text-xs"><span className="num font-bold">{x}</span> · <span className="num" style={{ color: levelOf(r.scores[x])?.c }}>{r.scores[x]}%</span></span>)}</div>
      </section>
      {c && delta.length > 0 && (
        <section className="card overflow-hidden">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">المقارنة بالتقويم الذاتي — مرتبة من أكبر انخفاض</p>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0"><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">الرمز</th><th className="p-2">المؤشر</th><th className="p-2">الذاتي</th><th className="p-2">الخارجي</th><th className="p-2">الفرق</th></tr></thead>
              <tbody className="divide-y divide-line/60">{delta.filter(([x]) => sees(x)).map(([x, d]) => (
                <tr key={x}><td className="num p-2 font-bold">{x}</td><td className="p-2 text-xs text-muted">{INDICATORS[x]}</td>
                  <td className="num p-2">{cmp.scores[x]}%</td><td className="num p-2" style={{ color: levelOf(r.scores[x])?.c }}>{r.scores[x]}%</td>
                  <td className={`num p-2 font-bold ${d < 0 ? "text-absent" : d > 0 ? "text-present" : "text-muted"}`}>{d > 0 ? "+" : ""}{d}</td></tr>))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function List({ t, codes, r, c, sees }) {
  return (
    <section className="card p-4">
      <p className="mb-2 text-sm font-semibold text-ink">{t}</p>
      <div className="space-y-1.5">{codes.filter(sees).map((x) => (
        <div key={x} className="flex gap-2 text-[13px]"><span className="num shrink-0 font-bold text-ink">{x}</span><span className="flex-1 text-muted">{INDICATORS[x]}</span><span className={`num shrink-0 font-bold ${c}`}>{r.scores[x]}%</span></div>))}</div>
    </section>
  );
}
