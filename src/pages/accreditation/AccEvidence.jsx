// src/pages/accreditation/AccEvidence.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import {
  CODES, DOMAINS, STANDARDS, INDICATORS, EV_STATUS, domainOf, stdOf, levelOf, fmtPct, accUpload, accOpen, setupMsg,
} from "../../lib/accreditation.js";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   المؤشرات والشواهد (supabase/acc_3.sql): المؤشرات الـ47 بمعاييرها ومجالاتها، ونسبة كل مؤشر
   في آخر تقرير، وشواهده: ملف في المخزن الخاص بحالته
   (مجموع ← مراجَع ← معتمد يعتمده المشرف). العضو يرى مؤشرات مجالاته وحدها ويرفع شواهدها.
   ===================================================================== */


export default function AccEvidence({ me, year, reports, plans }) {
  const { profile } = useSession();
  const [sp, setSp] = useSearchParams();
  const [, setMsg] = useNotice(null);
  const [ev, setEv] = useState(null);
  const [progs, setProgs] = useState([]);
  const [dom, setDom] = useState(0);
  const [q, setQ] = useState("");
  const open = sp.get("code");
  const setOpen = (c) => setSp(c ? { tab: "ind", code: c } : { tab: "ind" }, { replace: true });
  const rep = reports.find((r) => r.kind === "external") ?? reports.find((r) => r.kind === "self");
  const plan = plans.find((p) => p.status === "active") ?? plans[0];
  const load = () => supabase.from("acc_evidence").select("*").order("created_at", { ascending: false })
    .then(({ data, error }) => { if (error) setMsg({ ok: false, text: setupMsg(error) }); setEv(data ?? []); });
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (plan) supabase.from("acc_programs").select("code, kind, evidence").eq("plan_id", plan.id).then(({ data }) => setProgs(data ?? []));
  }, [plan]);

  const doms = Object.keys(DOMAINS).map(Number).filter((d) => me.coord || me.domains.includes(d));
  const byCode = useMemo(() => { const m = {}; (ev ?? []).forEach((e) => { (m[e.code] ??= []).push(e); }); return m; }, [ev]);
  const pBy = useMemo(() => Object.fromEntries(progs.map((p) => [p.code, p])), [progs]);
  if (!ev) return <Loader />;
  const codes = CODES.filter((c) => doms.includes(domainOf(c)) && (!dom || domainOf(c) === dom)
    && (!q.trim() || c.includes(q.trim()) || INDICATORS[c].includes(q.trim())));
  const covered = codes.filter((c) => byCode[c]?.length).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {doms.length > 1 && [0, ...doms].map((d) => <button key={d} onClick={() => setDom(d)} className={`rounded-pill border px-3 py-1 text-xs ${dom === d ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted"}`}>{d ? DOMAINS[d] : "كل المجالات"}</button>)}
        <input className="field ms-auto w-56 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برمز أو نص" />
      </div>
      <p className="num text-xs text-muted">{codes.length} مؤشرًا · لها شواهد {covered} · مجموع الشواهد {codes.reduce((s, c) => s + (byCode[c]?.length ?? 0), 0)}</p>
      {doms.filter((d) => !dom || d === dom).map((d) => {
        const list = codes.filter((c) => domainOf(c) === d);
        if (!list.length) return null;
        return (
          <section key={d} className="card overflow-hidden">
            <p className="border-b border-line bg-canvas/60 px-4 py-2 text-sm font-bold text-mint-deep">{DOMAINS[d]}</p>
            <div className="divide-y divide-line/60">{list.map((c) => {
              const v = rep?.scores?.[c]; const lv = levelOf(v); const n = byCode[c]?.length ?? 0; const p = pBy[c];
              return (
                <div key={c}>
                  <button onClick={() => setOpen(open === c ? null : c)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start">
                    <span className="num w-16 shrink-0 text-sm font-bold text-ink">{c}</span>
                    <span className="min-w-0 flex-1"><span className="block text-sm text-ink">{INDICATORS[c]}</span>
                      <span className="block text-[11px] text-faint">{STANDARDS[stdOf(c)]}{p && ` · ${p.kind === "plan" ? "ضمن خطة التحسين" : "استدامة"}`}</span></span>
                    <span className="num shrink-0 text-xs font-bold" style={{ color: lv?.c }}>{fmtPct(v)}</span>
                    <span className={`chip shrink-0 ${n ? "bg-mint-tint text-mint-deep" : "bg-canvas text-faint"}`}>شواهد {n}</span>
                  </button>
                  {open === c && <Indicator code={c} list={byCode[c] ?? []} hints={p?.evidence ?? []} me={me} year={year}
                    uid={profile?.id} by={profile?.full_name} onChange={load} setMsg={setMsg} />}
                </div>
              );
            })}</div>
          </section>
        );
      })}
    </div>
  );
}

function Indicator({ code, list, hints, me, year, uid, by, onChange, setMsg }) {
  const [f, setF] = useState({ title: "", notes: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!f.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الشاهد." }); return; }
    if (!file) { setMsg({ ok: false, text: "أرفق ملف الشاهد." }); return; }
    setBusy(true);
    let file_path = null;
    if (file) {
      const up = await accUpload(code, file);
      if (up.error) { setBusy(false); setMsg({ ok: false, text: up.error.message }); return; }
      file_path = up.path;
    }
    const { error } = await supabase.from("acc_evidence").insert({ code, academic_year: year, title: f.title.trim(),
      notes: f.notes.trim() || null, file_path, created_by_name: by ?? null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setF({ title: "", notes: "" }); setFile(null); setMsg({ ok: true, text: "أُضيف الشاهد." }); onChange();
  };
  const setStatus = async (e, status) => {
    const { error } = await supabase.from("acc_evidence").update({ status }).eq("id", e.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  const remove = async (e) => {
    if (!(await confirmDanger({ title: `حذف الشاهد «${e.title}»`, impact: ["يُحذف الشاهد وملفه من القسم."], confirmLabel: "حذف" }))) return;
    if (e.file_path) await supabase.storage.from("accreditation").remove([e.file_path]);
    const { error } = await supabase.from("acc_evidence").delete().eq("id", e.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  const openIt = async (e) => {
    if (e.link && !e.file_path) { window.open(e.link, "_blank", "noopener"); return; }
    const err = await accOpen(e.file_path); if (err) setMsg({ ok: false, text: err.message });
  };

  return (
    <div className="space-y-3 border-t border-line bg-canvas/30 px-4 py-3">
      {list.length > 0 && <div className="divide-y divide-line/60 rounded-sm2 border border-line bg-white">{list.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <button className="min-w-0 flex-1 text-start" onClick={() => openIt(e)}>
            <span className="block font-medium text-mint-deep underline-offset-2 hover:underline">{e.title}</span>
            <span className="block text-[11px] text-faint">{[e.created_by_name, fmtDate(e.created_at)].filter(Boolean).join(" · ")}</span>
            {e.notes && <span className="block text-xs text-muted">{e.notes}</span>}
          </button>
          <span className={`chip ${EV_STATUS[e.status].c}`}>{EV_STATUS[e.status].t}</span>
          {me.coord && <select className="field w-auto py-1 text-xs" value={e.status} onChange={(x) => setStatus(e, x.target.value)}>
            {Object.entries(EV_STATUS).map(([k, s]) => <option key={k} value={k}>{s.t}</option>)}</select>}
          {(me.coord || (e.created_by === uid && e.status !== "approved")) && <button className="text-[11px] text-absent" onClick={() => remove(e)}>حذف</button>}
        </div>
      ))}</div>}
      {hints.length > 0 && <div><p className="text-[11px] text-muted">الشواهد المطلوبة في خطة التحسين — اضغط لتعبئة العنوان:</p>
        <div className="mt-1 flex flex-wrap gap-1.5">{hints.map((h) => <button key={h} onClick={() => setF({ ...f, title: h })} className="rounded-pill border border-line bg-white px-2.5 py-0.5 text-[11px] text-ink">{h}</button>)}</div></div>}
      <input className="field text-sm" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="عنوان الشاهد" />
      <input type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <input className="field text-sm" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="ملاحظة (اختياري)" />
      <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={add}>{busy ? "جارٍ الرفع…" : "إضافة الشاهد"}</button>
    </div>
  );
}
