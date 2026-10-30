// src/pages/accreditation/AccEvidence.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import {
  CODES, DOMAINS, DOMAIN_COLOR, STANDARDS, INDICATORS, EV_STATUS, ACC_BUCKET, domainOf, stdOf, levelOf, fmtPct, fileKind, accUpload, setupMsg,
} from "../../lib/accreditation.js";
import AccViewer from "./AccViewer.jsx";
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
        {doms.length > 1 && [0, ...doms].map((d) => <button key={d} onClick={() => setDom(d)} className={`rounded-pill border px-3 py-1 text-xs ${dom === d ? (d ? "text-white" : "border-mint-deep bg-mint-tint text-mint-deep") : "border-line bg-white text-muted"}`}
          style={d ? (dom === d ? { background: DOMAIN_COLOR[d], borderColor: DOMAIN_COLOR[d] } : { color: DOMAIN_COLOR[d] }) : undefined}>{d ? DOMAINS[d] : "كل المجالات"}</button>)}
        <input className="field ms-auto w-56 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برمز أو نص" />
      </div>
      <p className="num text-xs text-muted">{codes.length} مؤشرًا · لها شواهد {covered} · مجموع الشواهد {codes.reduce((s, c) => s + (byCode[c]?.length ?? 0), 0)}</p>
      {doms.filter((d) => !dom || d === dom).map((d) => {
        const list = codes.filter((c) => domainOf(c) === d);
        if (!list.length) return null;
        return (
          <section key={d} className="card overflow-hidden" style={{ borderTop: `4px solid ${DOMAIN_COLOR[d]}` }}>
            <p className="border-b border-line px-4 py-2 text-sm font-bold" style={{ color: DOMAIN_COLOR[d], background: `${DOMAIN_COLOR[d]}10` }}>{DOMAINS[d]}</p>
            <div className="divide-y divide-line/60">{list.map((c) => {
              const v = rep?.scores?.[c]; const lv = levelOf(v); const n = byCode[c]?.length ?? 0; const p = pBy[c];
              return (
                <div key={c}>
                  <button onClick={() => setOpen(open === c ? null : c)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start">
                    <span className="num shrink-0 rounded-sm2 px-2 py-0.5 text-xs font-bold text-white" style={{ background: DOMAIN_COLOR[d] }}>{c}</span>
                    <span className="min-w-0 flex-1"><span className="block text-sm text-ink">{INDICATORS[c]}</span>
                      <span className="block text-[11px] text-faint">{STANDARDS[stdOf(c)]}{p && ` · ${p.kind === "plan" ? "ضمن خطة التحسين" : "استدامة"}`}</span></span>
                    <span className="num shrink-0 text-xs font-bold" style={{ color: lv?.c }}>{fmtPct(v)}</span>
                    <span className="chip shrink-0" style={n ? { background: `${DOMAIN_COLOR[d]}18`, color: DOMAIN_COLOR[d] } : undefined}>شواهد {n}</span>
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
  const color = DOMAIN_COLOR[domainOf(code)];
  const [f, setF] = useState({ title: "", notes: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [thumbs, setThumbs] = useState({});
  // مصغّرات الصور بروابط مؤقتة دفعة واحدة
  useEffect(() => {
    const paths = list.filter((e) => fileKind(e.file_path) === "image").map((e) => e.file_path);
    if (!paths.length) return;
    supabase.storage.from(ACC_BUCKET).createSignedUrls(paths, 1800)
      .then(({ data }) => setThumbs(Object.fromEntries((data ?? []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]))));
  }, [list]);
  const add = async () => {
    if (!f.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الشاهد." }); return; }
    if (!file) { setMsg({ ok: false, text: "أرفق ملف الشاهد." }); return; }
    setBusy(true);
    const up = await accUpload(code, file);
    if (up.error) { setBusy(false); setMsg({ ok: false, text: up.error.message }); return; }
    const { error } = await supabase.from("acc_evidence").insert({ code, academic_year: year, title: f.title.trim(),
      notes: f.notes.trim() || null, file_path: up.path, created_by_name: by ?? null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setF({ title: "", notes: "" }); setFile(null); setMsg({ ok: true, text: "أُضيف الشاهد." }); onChange();
  };

  return (
    <div className="space-y-3 border-t border-line bg-canvas/30 px-4 py-3">
      {list.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => <EvCard key={e.id} e={e} color={color} thumb={thumbs[e.file_path]} me={me} uid={uid}
            onView={() => setView(e)} onChange={onChange} setMsg={setMsg} />)}
        </div>
      )}
      {view && <AccViewer ev={view} color={color} onClose={() => setView(null)} />}
      <div className="space-y-2 rounded-sm2 border border-dashed bg-white p-3" style={{ borderColor: `${color}66` }}>
        <p className="text-xs font-bold" style={{ color }}>+ شاهد جديد للمؤشر {code}</p>
        {hints.length > 0 && <div><p className="text-[11px] text-muted">الشواهد المطلوبة في خطة التحسين — اضغط لتعبئة العنوان:</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{hints.map((h) => <button key={h} onClick={() => setF({ ...f, title: h })} className="rounded-pill border border-line bg-white px-2.5 py-0.5 text-[11px] text-ink">{h}</button>)}</div></div>}
        <input className="field text-sm" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="عنوان الشاهد" />
        <input type="file" accept="application/pdf,image/*" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <input className="field text-sm" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="ملاحظة (اختياري)" />
        <button className="rounded-pill px-4 py-1.5 text-xs font-semibold text-white" style={{ background: color }} disabled={busy} onClick={add}>{busy ? "جارٍ الرفع…" : "إضافة الشاهد"}</button>
      </div>
    </div>
  );
}

/* بطاقة الشاهد: معاينة (صورة مصغّرة أو أيقونة PDF)، والعنوان والملاحظة والحالة، وأزرار العرض والتعديل والحذف */
function EvCard({ e, color, thumb, me, uid, onView, onChange, setMsg }) {
  const kind = fileKind(e.file_path);
  const mine = e.created_by === uid;
  const canEdit = me.coord || (mine && e.status !== "approved");
  const [edit, setEdit] = useState(false);
  const [x, setX] = useState({ title: e.title, notes: e.notes ?? "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!x.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الشاهد." }); return; }
    setBusy(true);
    let file_path = e.file_path;
    if (file) {
      const up = await accUpload(e.code, file);
      if (up.error) { setBusy(false); setMsg({ ok: false, text: up.error.message }); return; }
      file_path = up.path;
    }
    const { error } = await supabase.from("acc_evidence").update({ title: x.title.trim(), notes: x.notes.trim() || null, file_path }).eq("id", e.id);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (file && e.file_path) supabase.storage.from(ACC_BUCKET).remove([e.file_path]);
    setEdit(false); setFile(null); setMsg({ ok: true, text: "حُفظ الشاهد." }); onChange();
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف الشاهد «${e.title}»`, impact: ["يُحذف الشاهد وملفه من القسم."], confirmLabel: "حذف" }))) return;
    if (e.file_path) await supabase.storage.from(ACC_BUCKET).remove([e.file_path]);
    const { error } = await supabase.from("acc_evidence").delete().eq("id", e.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  const setStatus = async (status) => {
    const { error } = await supabase.from("acc_evidence").update({ status }).eq("id", e.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  const viewIt = () => {
    if (e.file_path) onView();
    else if (e.link) window.open(e.link, "_blank", "noopener");
  };
  const act = "rounded-pill border px-3 py-1 text-[11px] font-semibold";

  return (
    <div className="flex flex-col overflow-hidden rounded-card border bg-white shadow-card" style={{ borderColor: `${color}55` }}>
      <button onClick={viewIt} className="relative grid h-32 place-items-center overflow-hidden" style={{ background: `${color}12` }} aria-label={`عرض ${e.title}`}>
        {kind === "image" && thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" />
          : <span className="grid place-items-center gap-1" style={{ color }}>
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>
              <b className="text-xs">{kind === "pdf" ? "PDF" : kind === "image" ? "صورة" : e.link ? "رابط" : "ملف"}</b>
            </span>}
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
        <span className={`chip absolute end-2 top-2 ${EV_STATUS[e.status].c}`}>{EV_STATUS[e.status].t}</span>
      </button>
      {edit ? (
        <div className="space-y-2 p-3">
          <input className="field text-sm" value={x.title} onChange={(v) => setX({ ...x, title: v.target.value })} placeholder="عنوان الشاهد" />
          <input className="field text-sm" value={x.notes} onChange={(v) => setX({ ...x, notes: v.target.value })} placeholder="ملاحظة (اختياري)" />
          <label className="block text-[11px] text-muted">استبدال الملف (اختياري)
            <input type="file" accept="application/pdf,image/*" className="mt-1 block text-xs" onChange={(v) => setFile(v.target.files?.[0] ?? null)} /></label>
          <div className="flex gap-2">
            <button className="rounded-pill px-3 py-1 text-[11px] font-semibold text-white" style={{ background: color }} disabled={busy} onClick={save}>{busy ? "…" : "حفظ"}</button>
            <button className={`${act} border-line text-muted`} onClick={() => setEdit(false)}>إلغاء</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="text-sm font-semibold leading-snug text-ink">{e.title}</p>
          {e.notes && <p className="text-xs text-muted">{e.notes}</p>}
          <p className="mt-auto text-[11px] text-faint">{[e.created_by_name, fmtDate(e.created_at)].filter(Boolean).join(" · ")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button className={act} style={{ borderColor: color, color }} onClick={viewIt}>عرض</button>
            {canEdit && <button className={`${act} border-line text-muted`} onClick={() => setEdit(true)}>تعديل</button>}
            {canEdit && <button className={`${act} border-absent/30 text-absent`} onClick={remove}>حذف</button>}
            {me.coord && <select className="field ms-auto w-auto py-1 text-[11px]" value={e.status} onChange={(v) => setStatus(v.target.value)} aria-label="حالة الشاهد">
              {Object.entries(EV_STATUS).map(([k, st]) => <option key={k} value={k}>{st.t}</option>)}</select>}
          </div>
        </div>
      )}
    </div>
  );
}
