// src/pages/accreditation/AccEvidence.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import {
  CODES, DOMAINS, DOMAIN_COLOR, STANDARDS, INDICATORS, EV_STATUS, ACC_BUCKET, bidi, domainOf, stdOf, levelOf, fmtPct, fileKind, accUpload, setupMsg,
} from "../../lib/accreditation.js";
import { PORTAL_BY, loadPortalCounts, portalCount, portalKey, portalNoun, sourcesOf } from "../../lib/accPortal.js";
import AccViewer from "./AccViewer.jsx";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   المؤشرات والشواهد (supabase/acc_3.sql): المؤشرات الـ47 بمعاييرها ومجالاتها، ونسبة كل مؤشر
   في آخر تقرير، وشواهده: ملف في المخزن الخاص بحالته
   (مجموع ← مراجَع ← معتمد يعتمده المشرف). العضو يرى مؤشرات مجالاته وحدها ويرفع شواهدها.
   ولكل مؤشر شواهد جاهزة من أعمال البوابة (supabase/acc_6.sql، src/lib/accPortal.js) بعدد ما سُجّل
   هذا العام، تُربط بالشاهد المطلوب في الخطة أو تُضاف شاهدًا، فتُحتسب دون رفع ملف.
   ===================================================================== */


export default function AccEvidence({ me, year, reports, plans }) {
  const { profile } = useSession();
  const [sp, setSp] = useSearchParams();
  const [, setMsg] = useNotice(null);
  const [ev, setEv] = useState(null);
  const [progs, setProgs] = useState([]);
  const [counts, setCounts] = useState({});
  const [dom, setDom] = useState(0);
  const [q, setQ] = useState("");
  const open = sp.get("code");
  const setOpen = (c) => setSp(c ? { tab: "ind", code: c } : { tab: "ind" }, { replace: true });
  const rep = reports.find((r) => r.kind === "external") ?? reports.find((r) => r.kind === "self");
  const plan = plans.find((p) => p.status === "active") ?? plans[0];
  const load = () => supabase.from("acc_evidence").select("*").order("created_at", { ascending: false })
    .then(({ data, error }) => { if (error) setMsg({ ok: false, text: setupMsg(error) }); setEv(data ?? []); });
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // قبل acc_6.sql تفشل الدالة فلا تظهر شواهد البوابة، ويبقى القسم كما هو
  useEffect(() => { loadPortalCounts().then(({ counts: c }) => setCounts(c)); }, []);
  useEffect(() => {
    if (plan) supabase.from("acc_programs").select("code, kind, evidence").eq("plan_id", plan.id).then(({ data }) => setProgs(data ?? []));
  }, [plan]);

  const doms = Object.keys(DOMAINS).map(Number).filter((d) => me.coord || me.domains.includes(d));
  const byCode = useMemo(() => { const m = {}; (ev ?? []).forEach((e) => { (m[e.code] ??= []).push(e); }); return m; }, [ev]);
  const pBy = useMemo(() => Object.fromEntries(progs.map((p) => [p.code, p])), [progs]);
  if (!ev) return <Loader />;
  const codes = CODES.filter((c) => doms.includes(domainOf(c)) && (!dom || domainOf(c) === dom)
    && (!q.trim() || c.includes(q.trim()) || INDICATORS[c].includes(q.trim())));
  // الإنجاز: الشواهد المطلوبة في الخطة وما رُفع منها، لكل مؤشر وللمعروض كله
  const reqOf = (c) => (pBy[c]?.kind === "plan" ? pBy[c].evidence ?? [] : []);
  const doneOf = (c) => reqOf(c).filter((t) => (byCode[c] ?? []).some((e) => e.title.trim() === t.trim())).length;
  const stat = (cs) => {
    const req = cs.reduce((a, c) => a + reqOf(c).length, 0), done = cs.reduce((a, c) => a + doneOf(c), 0);
    const files = cs.flatMap((c) => byCode[c] ?? []);
    return { req, done, left: req - done, pct: req ? Math.round((done / req) * 100) : 0, files: files.length,
      approved: files.filter((e) => e.status === "approved").length, reviewed: files.filter((e) => e.status === "reviewed").length,
      full: cs.filter((c) => reqOf(c).length && doneOf(c) === reqOf(c).length).length, withReq: cs.filter((c) => reqOf(c).length).length,
      portal: cs.filter((c) => sourcesOf(c, counts).some((x) => counts[x.k] > 0)).length,
      empty: cs.filter((c) => !(byCode[c]?.length) && !sourcesOf(c, counts).some((x) => counts[x.k] > 0)).length };
  };
  const all = stat(codes);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {doms.length > 1 && [0, ...doms].map((d) => <button key={d} onClick={() => setDom(d)} className={`rounded-pill border px-3 py-1 text-xs ${dom === d ? (d ? "text-white" : "border-mint-deep bg-mint-tint text-mint-deep") : "border-line bg-white text-muted"}`}
          style={d ? (dom === d ? { background: DOMAIN_COLOR[d], borderColor: DOMAIN_COLOR[d] } : { color: DOMAIN_COLOR[d] }) : undefined}>{d ? DOMAINS[d] : "كل المجالات"}</button>)}
        <input className="field ms-auto w-56 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برمز أو نص" />
      </div>
      <EvStats all={all} doms={doms.filter((d) => !dom || d === dom).map((d) => [d, stat(codes.filter((c) => domainOf(c) === d))])} me={me} setMsg={setMsg} />
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
                    {reqOf(c).length ? (
                      <span className="flex w-24 shrink-0 flex-col items-end gap-1">
                        <span className="num text-[11px] font-bold" style={{ color: DOMAIN_COLOR[d] }}>{doneOf(c)} / {reqOf(c).length}</span>
                        <span className="h-1.5 w-full overflow-hidden rounded-pill bg-canvas"><span className="block h-full rounded-pill" style={{ width: `${(doneOf(c) / reqOf(c).length) * 100}%`, background: DOMAIN_COLOR[d] }} /></span>
                      </span>
                    ) : !n && sourcesOf(c, counts).some((x) => counts[x.k] > 0) ? <span className="chip shrink-0 bg-present/10 text-present">جاهز من البوابة</span>
                      : <span className="chip shrink-0" style={n ? { background: `${DOMAIN_COLOR[d]}18`, color: DOMAIN_COLOR[d] } : undefined}>شواهد {n}</span>}
                  </button>
                  {open === c && <Indicator code={c} list={byCode[c] ?? []} hints={p?.evidence ?? []} me={me} year={year} counts={counts}
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

/* شواهد المؤشر: بطاقات جاهزة للشواهد المطلوبة في خطة التحسين يُرفع ملف كل منها في مكانه،
   ثم ما رُفع زيادة عليها، ثم نموذج شاهد إضافي بعنوان حر */
function Indicator({ code, list, hints, me, year, counts, uid, by, onChange, setMsg }) {
  const color = DOMAIN_COLOR[domainOf(code)];
  const nav = useNavigate();
  const srcs = sourcesOf(code, counts);
  const ready = srcs.filter((x) => counts[x.k] > 0);
  // ربط شاهد بعمل من البوابة: صفّ بلا ملف رابطه portal:<المفتاح>، بعنوان الشاهد المطلوب أو بعنوان المصدر
  const linkPortal = async (title, src) => {
    const { error } = await supabase.from("acc_evidence").insert({ code, academic_year: year, title: title.trim(), link: `portal:${src.k}`,
      notes: `من أعمال البوابة: ${src.t}`, created_by_name: by ?? null });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `رُبط «${title.trim()}» بـ«${src.t}».` }); onChange();
  };
  const [f, setF] = useState({ title: "", notes: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [more, setMore] = useState(!hints.length);
  // مصغّرات الصور بروابط مؤقتة دفعة واحدة
  useEffect(() => {
    const paths = list.filter((e) => fileKind(e.file_path) === "image").map((e) => e.file_path);
    if (!paths.length) return;
    supabase.storage.from(ACC_BUCKET).createSignedUrls(paths, 1800)
      .then(({ data }) => setThumbs(Object.fromEntries((data ?? []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]))));
  }, [list]);
  const slots = hints.map((t) => ({ t, ev: list.filter((e) => e.title.trim() === t.trim()) }));
  const extra = list.filter((e) => !hints.some((t) => t.trim() === e.title.trim()));
  const filled = slots.filter((x) => x.ev.length).length;
  const upload = async (title, fl, notes = "") => {
    if (!title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الشاهد." }); return false; }
    if (!fl) { setMsg({ ok: false, text: "أرفق ملف الشاهد." }); return false; }
    const up = await accUpload(code, fl);
    if (up.error) { setMsg({ ok: false, text: up.error.message }); return false; }
    const { error } = await supabase.from("acc_evidence").insert({ code, academic_year: year, title: title.trim(),
      notes: notes.trim() || null, file_path: up.path, created_by_name: by ?? null });
    if (error) { setMsg({ ok: false, text: error.message }); return false; }
    setMsg({ ok: true, text: `رُفع «${title.trim()}».` }); onChange(); return true;
  };
  const add = async () => {
    setBusy(true);
    if (await upload(f.title, file, f.notes)) { setF({ title: "", notes: "" }); setFile(null); }
    setBusy(false);
  };
  const card = (e) => <EvCard key={e.id} e={e} color={color} thumb={thumbs[e.file_path]} me={me} uid={uid}
    counts={counts} onView={() => setView(e)} onChange={onChange} setMsg={setMsg} />;

  return (
    <div className="space-y-4 border-t border-line bg-canvas/30 px-4 py-3">
      {slots.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold" style={{ color }}>الشواهد المطلوبة في خطة التحسين</p>
            <span className="num text-xs text-muted">رُفع {filled} من {slots.length}</span>
            <span className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-pill bg-white"><span className="block h-full rounded-pill" style={{ width: `${(filled / slots.length) * 100}%`, background: color }} /></span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((x) => (x.ev.length ? x.ev.map(card) : <Slot key={x.t} title={x.t} color={color} ready={ready} counts={counts}
              onUpload={(fl) => upload(x.t, fl)} onLink={(src) => linkPortal(x.t, src)} />))}
          </div>
        </div>
      )}
      {extra.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted">{slots.length ? "شواهد إضافية" : "الشواهد"}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{extra.map(card)}</div>
        </div>
      )}
      {srcs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold" style={{ color }}>جاهز من أعمال البوابة <span className="font-normal text-muted">— ما سُجّل هذا العام، يتحدّث تلقائيًا</span></p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{srcs.map((x) => {
            const n = counts[x.k] ?? 0, linked = list.some((e) => portalKey(e.link) === x.k);
            return (
              <div key={x.k} className={`flex items-center gap-2 rounded-sm2 border bg-white px-3 py-2 ${n ? "" : "opacity-60"}`} style={{ borderColor: n ? `${color}55` : undefined }}>
                <span className="num grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-1.5 text-xs font-bold" style={n ? { background: `${color}18`, color } : undefined}>{n}</span>
                <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-semibold leading-snug text-ink">{x.t}</span>
                  <span className="block text-[10.5px] text-muted">{n ? portalCount(x, n) : x.ever ? "لا عمل مسجّل" : "لا عمل مسجّل هذا العام"}{linked && " · مربوط شاهدًا"}</span></span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <button className="text-[11px] font-semibold" style={{ color }} onClick={() => nav(x.to)}>فتح ←</button>
                  {n > 0 && !linked && <button className="text-[11px] font-semibold text-mint-deep" onClick={() => linkPortal(x.t, x)}>+ شاهدًا</button>}
                </span>
              </div>
            );
          })}</div>
        </div>
      )}
      {view && <AccViewer ev={view} color={color} onClose={() => setView(null)} />}
      {!more ? <button className="text-xs font-semibold" style={{ color }} onClick={() => setMore(true)}>+ شاهد إضافي بعنوان آخر</button> : (
        <div className="space-y-2 rounded-sm2 border border-dashed bg-white p-3" style={{ borderColor: `${color}66` }}>
          <p className="text-xs font-bold" style={{ color }}>+ شاهد {slots.length ? "إضافي" : "جديد"} للمؤشر <span className="num">{code}</span></p>
          <input className="field text-sm" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="عنوان الشاهد" />
          <input type="file" accept="application/pdf,image/*" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <input className="field text-sm" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="ملاحظة (اختياري)" />
          <button className="rounded-pill px-4 py-1.5 text-xs font-semibold text-white" style={{ background: color }} disabled={busy} onClick={add}>{busy ? "جارٍ الرفع…" : "إضافة الشاهد"}</button>
        </div>
      )}
    </div>
  );
}

/* بطاقة شاهد مطلوب لم يُرفع: الرفع من البطاقة نفسها بعنوانها */
function Slot({ title, color, ready, counts, onUpload, onLink }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const fl = e.target.files?.[0]; e.target.value = "";
    if (!fl) return;
    setBusy(true); await onUpload(fl); setBusy(false);
  };
  return (
    <div className="flex min-h-[15rem] flex-col overflow-hidden rounded-card border-2 border-dashed bg-white" style={{ borderColor: `${color}66` }}>
    <label className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center ${busy ? "opacity-60" : "hover:bg-canvas"}`}>
      <input type="file" accept="application/pdf,image/*" className="hidden" disabled={busy} onChange={pick} />
      <span className="grid h-11 w-11 place-items-center rounded-full text-xl font-bold text-white" style={{ background: color }}>{busy ? "…" : "↑"}</span>
      <p className="text-sm font-semibold leading-snug text-ink">{bidi(title)}</p>
      <span className="chip bg-late/10 text-late">لم يُرفع بعد</span>
      <span className="text-[11px] font-semibold" style={{ color }}>{busy ? "جارٍ الرفع…" : "اضغط لرفع الملف (PDF أو صورة)"}</span>
    </label>
    {ready.length > 0 && (
      <select className="field m-2 mt-0 w-auto text-[11.5px]" value="" disabled={busy} aria-label="ربطه بعمل من البوابة"
              onChange={async (e) => { const src = ready.find((x) => x.k === e.target.value); if (src) { setBusy(true); await onLink(src); setBusy(false); } }}>
        <option value="">أو اربطه بعمل من البوابة…</option>
        {ready.map((x) => <option key={x.k} value={x.k}>{x.t} ({counts[x.k]})</option>)}
      </select>
    )}
    </div>
  );
}

/* بطاقة الشاهد: معاينة (صورة مصغّرة أو أيقونة PDF)، والعنوان والملاحظة والحالة، وأزرار العرض والتعديل والحذف */
function EvCard({ e, color, thumb, me, uid, counts, onView, onChange, setMsg }) {
  const kind = fileKind(e.file_path);
  const nav = useNavigate();
  const src = PORTAL_BY[portalKey(e.link)];
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
    const { error } = await supabase.from("acc_evidence").update({ title: x.title.trim(), notes: x.notes.trim() || null, file_path, link: file ? null : e.link }).eq("id", e.id);
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
    else if (src) nav(src.to);
    else if (e.link) window.open(e.link, "_blank", "noopener");
  };
  const act = "rounded-pill border px-3 py-1 text-[11px] font-semibold";

  return (
    <div className="flex flex-col overflow-hidden rounded-card border bg-white shadow-card" style={{ borderColor: `${color}55` }}>
      <button onClick={viewIt} className="relative grid h-32 place-items-center overflow-hidden" style={{ background: `${color}12` }} aria-label={`عرض ${e.title}`}>
        {kind === "image" && thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" />
          : src && !e.file_path ? <span className="grid place-items-center gap-0.5 px-3 text-center" style={{ color }}>
              <b className="num text-3xl leading-none">{counts?.[src.k] ?? "—"}</b>
              <span className="text-[11px] font-semibold">{portalNoun(src, counts?.[src.k] ?? 0)} · من أعمال البوابة</span>
            </span>
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
          <label className="block text-[11px] text-muted">{src && !e.file_path ? "إرفاق ملف بدل الربط (اختياري)" : "استبدال الملف (اختياري)"}
            <input type="file" accept="application/pdf,image/*" className="mt-1 block text-xs" onChange={(v) => setFile(v.target.files?.[0] ?? null)} /></label>
          <div className="flex gap-2">
            <button className="rounded-pill px-3 py-1 text-[11px] font-semibold text-white" style={{ background: color }} disabled={busy} onClick={save}>{busy ? "…" : "حفظ"}</button>
            <button className={`${act} border-line text-muted`} onClick={() => setEdit(false)}>إلغاء</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="text-sm font-semibold leading-snug text-ink">{bidi(e.title)}</p>
          {e.notes && <p className="text-xs text-muted">{bidi(e.notes)}</p>}
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

/* مساعد الشواهد: نسبة الإنجاز والمتبقي وحالات الشواهد لمجالات المستخدم، ولكل مجال شريطه، وتذكير المشرفين */
function EvStats({ all, doms, me, setMsg }) {
  const [busy, setBusy] = useState(false);
  const remind = async () => {
    if (!window.confirm("إرسال تذكير لكل مشرف مجال بعدد الشواهد المطلوبة التي لم يرفعها بعد؟")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("acc_remind");
    setBusy(false);
    if (error) setMsg({ ok: false, text: /acc_remind/.test(error.message) ? "التذكير يحتاج تشغيل supabase/acc_4.sql." : error.message });
    else setMsg({ ok: true, text: data ? `وصل التذكير ${data} من مشرفي المجالات.` : "لا شواهد متبقية عند أي مشرف." });
  };
  const tile = (v, t, c) => (
    <div className="rounded-sm2 bg-white px-3 py-2 text-center shadow-card">
      <p className="num text-xl font-bold" style={{ color: c ?? "rgb(var(--c-ink))" }}>{v}</p><p className="text-[11px] text-muted">{t}</p>
    </div>
  );
  return (
    <section className="card space-y-3 p-4" style={{ background: "linear-gradient(135deg, rgb(var(--c-paper)), rgba(137,215,173,.12))" }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(0,0,0,.07)" strokeWidth="4" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(var(--c-present))" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${all.pct * 0.974} 100`} /></svg>
          <b className="num text-lg text-ink">{all.pct}%</b>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">مساعد الشواهد</p>
          <p className="text-xs leading-relaxed text-muted">الشواهد المطلوبة في خطة التحسين <b className="num text-ink">{all.req}</b>: رُفع منها <b className="num text-ink">{all.done}</b>، وبقي <b className="num text-late">{all.left}</b>.
            اضغط المؤشر لتظهر بطاقات شواهده، وارفع كل ملف في بطاقته أو اربطه بعمل مسجّل في البوابة.</p>
        </div>
        {me.coord && <button className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-mint-deep" disabled={busy} onClick={remind}>{busy ? "…" : "تذكير مشرفي المجالات"}</button>}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {tile(all.left, "المتبقي", "rgb(var(--c-late))")}
        {tile(all.files, "الشواهد المسجّلة")}
        {tile(all.approved, "المعتمد", "rgb(var(--c-present))")}
        {tile(all.reviewed, "المراجَع", "rgb(var(--c-excused))")}
        {tile(`${all.full}/${all.withReq}`, "المؤشرات المكتملة")}
        {tile(all.portal, "مؤشرات لها عمل في البوابة", "rgb(var(--c-present))")}
        {tile(all.empty, "مؤشرات بلا شاهد", "rgb(var(--c-absent))")}
      </div>
      {doms.length > 1 && <div className="space-y-1.5">{doms.map(([d, x]) => (
        <div key={d} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 font-semibold" style={{ color: DOMAIN_COLOR[d] }}>{DOMAINS[d]}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-pill bg-white"><span className="block h-full rounded-pill" style={{ width: `${x.pct}%`, background: DOMAIN_COLOR[d] }} /></span>
          <span className="num w-28 shrink-0 text-end text-muted">{x.done}/{x.req} · بقي {x.left}</span>
        </div>))}</div>}
    </section>
  );
}
