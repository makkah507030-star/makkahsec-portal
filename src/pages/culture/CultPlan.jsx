// src/pages/culture/CultPlan.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { todayISO } from "../../lib/schoolTime";
import { confirmDanger } from "../../lib/danger";
import { PROGRAMS, STATUS, CULT_BUCKET, dueOf, overdue, setupMsg } from "../../lib/culture.js";
import { MAX_PHOTOS, uploadPhotos, useSignedPhotos, Thumbs } from "../globe/shared.jsx";
import Loader from "../../components/Loader.jsx";

/* الخطة التنفيذية لسفير الثقافة: أنشطة كل برنامج بموعدها وفئتها وآلية تنفيذها، وحالة كل نشاط،
   وتوثيقه (المستفيدون والأثر وحتى 3 صور)، وربطه بحدث في «الأحداث والمناسبات». والسفير يضيف نشاطًا أو يحذفه. */

export default function CultPlan({ me }) {
  const { profile } = useSession();
  const [, setMsg] = useNotice(null);
  const [rows, setRows] = useState(null);
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(null);
  const [prog, setProg] = useState("all");
  const [add, setAdd] = useState(false);
  const urls = useSignedPhotos(rows, CULT_BUCKET);
  const load = () => supabase.from("cult_activities").select("*").order("sort").then(({ data, error }) => {
    if (error) setMsg({ ok: false, text: setupMsg(error) }); setRows(data ?? []);
  });
  useEffect(() => {
    load();
    supabase.from("school_events").select("id, title, event_date").is("cancelled_at", null).order("event_date", { ascending: false }).limit(150)
      .then(({ data }) => setEvents(data ?? []));
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loader />;
  const list = rows.filter((r) => prog === "all" || r.program === prog);
  const by = profile?.full_name ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[["all", "كل البرامج"], ...Object.entries(PROGRAMS).map(([k, p]) => [k, p.t])].map(([k, t]) => (
          <button key={k} onClick={() => setProg(k)} className={`rounded-pill border px-3 py-1 text-xs ${prog === k ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted"}`}>{t}</button>))}
        {me.amb && <button className="ms-auto rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setAdd(!add)}>{add ? "إغلاق" : "+ نشاط"}</button>}
      </div>
      {add && <NewActivity by={by} setMsg={setMsg} onDone={() => { setAdd(false); load(); }} />}
      {prog !== "all" && <p className="rounded-sm2 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-muted"><b style={{ color: PROGRAMS[prog].c }}>{PROGRAMS[prog].t}</b> · {PROGRAMS[prog].axis}: {PROGRAMS[prog].d}</p>}
      <div className="card divide-y divide-line/70 overflow-hidden">{list.map((a) => {
        const p = PROGRAMS[a.program] ?? { t: a.program, c: "#888" }; const late = overdue(a);
        return (
          <div key={a.id}>
            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-start" onClick={() => setOpen(open === a.id ? null : a.id)}>
              <span className="h-9 w-1.5 shrink-0 rounded-pill" style={{ background: p.c }} />
              <span className="min-w-0 flex-1"><span className="block text-[13.5px] text-ink">{a.title}</span>
                <span className="block text-[11px] text-muted">{p.t} · <span className="num">{a.due_date ? fmtDate(a.due_date) : dueOf(a)}</span> · {a.target}{late && <b className="text-absent"> · فات موعده</b>}</span></span>
              <span className={`chip shrink-0 ${STATUS[a.status].c}`}>{STATUS[a.status].t}</span>
            </button>
            {open === a.id && <Activity a={a} me={me} by={by} events={events} urls={urls} setMsg={setMsg} onChange={load} />}
          </div>
        );
      })}</div>
    </div>
  );
}

function Activity({ a, me, by, events, urls, setMsg, onChange }) {
  const [x, setX] = useState({ status: a.status, event_id: a.event_id ?? "", beneficiaries: a.beneficiaries ?? "", outcome: a.outcome ?? "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const photos = files.length ? await uploadPhotos("act", a.id, files, a.photos ?? [], CULT_BUCKET) : a.photos ?? [];
      const { error } = await supabase.from("cult_activities").update({
        status: x.status, event_id: x.event_id || null, beneficiaries: x.beneficiaries === "" ? null : Number(x.beneficiaries),
        outcome: x.outcome.trim() || null, photos, done_at: x.status === "done" ? a.done_at ?? todayISO() : null,
        updated_by_name: by, updated_at: new Date().toISOString(),
      }).eq("id", a.id);
      if (error) throw error;
      setFiles([]); setMsg({ ok: true, text: "حُفظ النشاط." }); onChange();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف النشاط «${a.title}»`, impact: ["يُحذف من الخطة بتوثيقه وصوره."], confirmLabel: "حذف" }))) return;
    if (a.photos?.length) await supabase.storage.from(CULT_BUCKET).remove(a.photos);
    const { error } = await supabase.from("cult_activities").delete().eq("id", a.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  const ev = events.find((e) => e.id === x.event_id);
  return (
    <div className="space-y-3 border-t border-line bg-canvas/40 px-4 py-3">
      {a.mechanism && <p className="text-[12.5px] leading-relaxed text-muted"><b className="text-ink">آلية التنفيذ: </b>{a.mechanism}</p>}
      <div className="flex flex-wrap gap-1.5">{Object.entries(STATUS).map(([k, s]) => (
        <button key={k} onClick={() => setX({ ...x, status: k })} className={`rounded-pill border px-3 py-1 text-xs ${x.status === k ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-muted"}`}>{s.t}</button>))}</div>
      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <label className="text-[11.5px] text-muted">ربطه بحدث في «الأحداث والمناسبات»
          <select className="field mt-1 w-full text-sm" value={x.event_id} onChange={(e) => setX({ ...x, event_id: e.target.value })}>
            <option value="">— بلا حدث —</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}{e.event_date ? ` · ${e.event_date}` : ""}</option>)}
          </select></label>
        <label className="text-[11.5px] text-muted">المستفيدون<input className="field num mt-1 w-full text-sm" dir="ltr" inputMode="numeric" value={x.beneficiaries} onChange={(e) => setX({ ...x, beneficiaries: e.target.value.replace(/\D/g, "") })} /></label>
      </div>
      {ev ? <Link to="/events" className="inline-block text-xs font-semibold text-mint-deep">فتح الحدث «{ev.title}» في الأحداث والمناسبات ←</Link>
        : <Link to="/events" className="inline-block text-xs text-muted">لا حدث مرتبط؟ أنشئه من «الأحداث والمناسبات» ثم اربطه هنا ←</Link>}
      <label className="block text-[11.5px] text-muted">التنفيذ والأثر<textarea className="field mt-1 min-h-[70px] w-full text-sm" value={x.outcome} onChange={(e) => setX({ ...x, outcome: e.target.value })} placeholder="ما نُفّذ، ومن شارك، وما أثره في بيئة العمل…" /></label>
      <Thumbs paths={a.photos} urls={urls} />
      {(a.photos?.length ?? 0) < MAX_PHOTOS && <label className="block text-[11.5px] text-muted">صور التوثيق (حتى {MAX_PHOTOS})
        <input type="file" accept="image/*" multiple className="mt-1 block text-sm" onChange={(e) => setFiles([...(e.target.files ?? [])])} /></label>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "…" : "حفظ"}</button>
        {a.updated_by_name && <span className="text-[11px] text-faint">آخر تحديث: {a.updated_by_name} · {fmtDate(a.updated_at)}</span>}
        {me.amb && <button className="ms-auto text-xs text-absent" onClick={remove}>حذف النشاط</button>}
      </div>
    </div>
  );
}

function NewActivity({ by, setMsg, onDone }) {
  const [x, setX] = useState({ program: "values", title: "", due_date: "", due_label: "", target: "منسوبو المدرسة", mechanism: "" });
  const set = (k) => (e) => setX({ ...x, [k]: e.target.value });
  const save = async () => {
    if (!x.title.trim()) { setMsg({ ok: false, text: "اكتب النشاط." }); return; }
    const { error } = await supabase.from("cult_activities").insert({ ...x, title: x.title.trim(), due_date: x.due_date || null,
      due_label: x.due_label.trim() || null, mechanism: x.mechanism.trim() || null, sort: 100, updated_by_name: by });
    if (error) setMsg({ ok: false, text: error.message }); else onDone();
  };
  return (
    <section className="card grid gap-2 p-4 sm:grid-cols-2">
      <label className="text-[11.5px] text-muted">البرنامج<select className="field mt-1 w-full text-sm" value={x.program} onChange={set("program")}>
        {Object.entries(PROGRAMS).map(([k, p]) => <option key={k} value={k}>{p.t}</option>)}</select></label>
      <label className="text-[11.5px] text-muted">الفئة المستهدفة<input className="field mt-1 w-full text-sm" value={x.target} onChange={set("target")} /></label>
      <label className="text-[11.5px] text-muted sm:col-span-2">النشاط<input className="field mt-1 w-full text-sm" value={x.title} onChange={set("title")} /></label>
      <label className="text-[11.5px] text-muted">التاريخ<input type="date" className="field num mt-1 w-full text-sm" value={x.due_date} onChange={set("due_date")} /></label>
      <label className="text-[11.5px] text-muted">أو الموعد بالوصف (شهر، «وفق المناسبات»)<input className="field mt-1 w-full text-sm" value={x.due_label} onChange={set("due_label")} /></label>
      <label className="text-[11.5px] text-muted sm:col-span-2">آلية التنفيذ<input className="field mt-1 w-full text-sm" value={x.mechanism} onChange={set("mechanism")} /></label>
      <button className="btn-primary w-fit px-4 py-1.5 text-xs" onClick={save}>إضافة النشاط</button>
    </section>
  );
}
