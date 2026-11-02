// src/pages/culture/CultLogs.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { todayISO } from "../../lib/schoolTime";
import { confirmDanger } from "../../lib/danger";
import { sendPush } from "../../lib/pushSend.js";
import { MEETINGS, OCCASIONS, ONBOARD, PROGRAMS, setupMsg, cardInit } from "../../lib/culture.js";
import Loader from "../../components/Loader.jsx";
import { CardMaker, SendPreview } from "./CultCard.jsx";

/* سجلات البرامج: «التواصل الملهم» (اللقاءات)، و«نهتم بك» (مناسبات الموظفين وبطاقاتها إشعارًا لصاحبها)،
   و«حيّاك» (تهيئة الموظف الجديد بمهامها على مراحلها). يوثّقها الفريق، ويرسل السفير البطاقات. */

const lbl = "text-[11.5px] text-muted";
const Intro = ({ p }) => (
  <p className="rounded-sm2 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-muted">
    <b style={{ color: PROGRAMS[p].c }}>{PROGRAMS[p].t}</b> · {PROGRAMS[p].d}
  </p>
);

function useRows(table, order) {
  const [, setMsg] = useNotice(null);
  const [rows, setRows] = useState(null);
  const load = () => supabase.from(table).select("*").order(order, { ascending: false }).then(({ data, error }) => {
    if (error) setMsg({ ok: false, text: setupMsg(error) }); setRows(data ?? []);
  });
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async (id, title) => {
    if (!(await confirmDanger({ title: `حذف «${title}»`, impact: ["يُحذف من السجل نهائيًا."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setMsg({ ok: false, text: error.message }); else load();
  };
  return { rows, load, remove, setMsg };
}

function useStaff() {
  const [staff, setStaff] = useState([]);
  useEffect(() => { supabase.rpc("cult_staff").then(({ data }) => setStaff(data ?? [])); }, []);
  return staff;
}

/* ============================ التواصل الملهم ============================ */
export function CultMeetings() {
  const { profile } = useSession();
  const { rows, load, remove, setMsg } = useRows("cult_meetings", "held_on");
  const [x, setX] = useState({ kind: "coffee", held_on: todayISO(), title: "", attendees: "", notes: "" });
  const set = (k) => (e) => setX({ ...x, [k]: e.target.value });
  if (!rows) return <Loader />;
  const save = async () => {
    const { error } = await supabase.from("cult_meetings").insert({
      kind: x.kind, held_on: x.held_on, title: x.title.trim() || MEETINGS[x.kind].t,
      attendees: x.attendees === "" ? null : Number(x.attendees), notes: x.notes.trim() || null, created_by_name: profile?.full_name ?? null,
    });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setX({ ...x, title: "", attendees: "", notes: "" }); setMsg({ ok: true, text: "سُجّل اللقاء." }); load();
  };
  const count = (k) => rows.filter((r) => r.kind === k).length;
  return (
    <div className="space-y-3">
      <Intro p="comm" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(MEETINGS).map(([k, m]) => (
        <button key={k} onClick={() => setX({ ...x, kind: k })} className={`rounded-sm2 border px-3 py-2 text-start ${x.kind === k ? "border-mint-deep bg-mint-tint" : "border-line bg-white"}`}>
          <b className="block text-[12.5px] text-ink">{m.t} <span className="num text-mint-deep">{count(k)}</span></b>
          <span className="text-[11px] leading-snug text-muted">{m.d}</span>
        </button>))}</div>
      <section className="card grid gap-2 p-4 sm:grid-cols-[1fr_150px_110px]">
        <label className={lbl}>عنوان اللقاء أو موضوعه<input className="field mt-1 w-full text-sm" value={x.title} onChange={set("title")} placeholder={MEETINGS[x.kind].t} /></label>
        <label className={lbl}>التاريخ<input type="date" className="field num mt-1 w-full text-sm" value={x.held_on} onChange={set("held_on")} /></label>
        <label className={lbl}>الحضور<input className="field num mt-1 w-full text-sm" dir="ltr" inputMode="numeric" value={x.attendees} onChange={(e) => setX({ ...x, attendees: e.target.value.replace(/\D/g, "") })} /></label>
        <label className={`${lbl} sm:col-span-3`}>ما دار في اللقاء وما خرج به<textarea className="field mt-1 min-h-[60px] w-full text-sm" value={x.notes} onChange={set("notes")} /></label>
        <button className="btn-primary w-fit px-4 py-1.5 text-xs" onClick={save}>تسجيل اللقاء</button>
      </section>
      <div className="card divide-y divide-line/70 overflow-hidden">
        {rows.length ? rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] text-ink">{r.title}</span>
              <span className="block text-[11px] text-muted">{MEETINGS[r.kind]?.t} · <span className="num">{fmtDate(r.held_on)}</span>{r.attendees != null && <> · الحضور <span className="num">{r.attendees}</span></>}{r.created_by_name && ` · ${r.created_by_name}`}</span>
              {r.notes && <span className="mt-1 block whitespace-pre-line text-[12px] leading-relaxed text-muted">{r.notes}</span>}
            </span>
            <button className="shrink-0 text-[11px] text-absent" onClick={() => remove(r.id, r.title)}>حذف</button>
          </div>)) : <p className="px-4 py-6 text-center text-sm text-muted">لا لقاءات مسجلة بعد.</p>}
      </div>
    </div>
  );
}

/* ============================ نهتم بك ============================ */
export function CultCare({ me }) {
  const { profile } = useSession();
  const staff = useStaff();
  const { rows, load, remove, setMsg } = useRows("cult_occasions", "held_on");
  const [x, setX] = useState({ user_id: "", kind: "achievement", held_on: todayISO(), message: "" });
  const [busy, setBusy] = useState(null);
  const [card, setCard] = useState(null);
  const [preview, setPreview] = useState(null);   // { row } لمناسبة محفوظة، أو { fresh: true } لمناسبة جديدة
  if (!rows) return <Loader />;
  const person = staff.find((s) => s.id === x.user_id);
  // ما يُعرض في المعاينة: البطاقة بنصها، والإشعار بعنوانه، والمستلم
  const previewOf = (kind, name, message) => ({
    card: { ...cardInit("occasion", kind, name), name, body: message },
    notif: { title: `نهتم بك · ${OCCASIONS[kind]?.t ?? "مناسبة"}`, body: message },
    to: `${name} — في جرس البوابة وعلى جواله`,
  });
  const ask = () => {
    if (!person) { setMsg({ ok: false, text: "اختر صاحب المناسبة." }); return; }
    if (!x.message.trim()) { setMsg({ ok: false, text: "اكتب نص البطاقة." }); return; }
    setPreview({ fresh: true, ...previewOf(x.kind, person.full_name, x.message.trim()) });
  };
  const pick = (patch) => {
    const y = { ...x, ...patch }; const p = staff.find((s) => s.id === y.user_id);
    setX({ ...y, message: p ? OCCASIONS[y.kind].msg(p.full_name.split(" ").slice(0, 2).join("\u00A0")) : y.message });
  };
  // البطاقة إشعار لصاحب المناسبة في الجرس وجواله، ولا يرسلها إلا السفير
  const send = async (r) => {
    if (!r.user_id) { setMsg({ ok: false, text: "صاحب المناسبة ليس من حسابات البوابة؛ أرسل البطاقة من الاستوديو." }); return false; }
    const { data: nid, error } = await supabase.rpc("cult_notify", { p_title: `نهتم بك · ${OCCASIONS[r.kind]?.t ?? "مناسبة"}`, p_body: r.message, p_user_ids: [r.user_id] });
    if (error) { setMsg({ ok: false, text: error.message }); return false; }
    sendPush(nid);
    await supabase.from("cult_occasions").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
    return true;
  };
  const save = async (andSend) => {
    if (!person) { setMsg({ ok: false, text: "اختر صاحب المناسبة." }); return; }
    if (!x.message.trim()) { setMsg({ ok: false, text: "اكتب نص البطاقة." }); return; }
    setBusy("new");
    const { data, error } = await supabase.from("cult_occasions").insert({
      user_id: person.id, person_name: person.full_name, kind: x.kind, held_on: x.held_on, message: x.message.trim(), created_by_name: profile?.full_name ?? null,
    }).select().single();
    if (error) setMsg({ ok: false, text: error.message });
    else {
      const ok = andSend ? await send(data) : true;
      if (ok) setMsg({ ok: true, text: andSend ? `أُرسلت البطاقة إلى ${person.full_name}.` : "سُجّلت المناسبة." });
      setX({ ...x, user_id: "", message: "" }); load();
    }
    setBusy(null);
  };
  const resend = async (r) => { setBusy(r.id); if (await send(r)) { setMsg({ ok: true, text: `أُرسلت البطاقة إلى ${r.person_name}.` }); load(); } setBusy(null); };
  const confirm = async () => {
    if (preview.fresh) await save(true); else await resend(preview.row);
    setPreview(null);
  };

  return (
    <div className="space-y-3">
      <Intro p="care" />
      <section className="card space-y-2 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px]">
          <label className={lbl}>صاحب المناسبة<select className="field mt-1 w-full text-sm" value={x.user_id} onChange={(e) => pick({ user_id: e.target.value })}>
            <option value="">— اختر من الموظفين —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>
          <label className={lbl}>المناسبة<select className="field mt-1 w-full text-sm" value={x.kind} onChange={(e) => pick({ kind: e.target.value })}>
            {["سعيدة", "إنسانية"].map((g) => <optgroup key={g} label={`مناسبات ${g}`}>{Object.entries(OCCASIONS).filter(([, o]) => o.g === g).map(([k, o]) => <option key={k} value={k}>{o.t}</option>)}</optgroup>)}</select></label>
          <label className={lbl}>التاريخ<input type="date" className="field num mt-1 w-full text-sm" value={x.held_on} onChange={(e) => setX({ ...x, held_on: e.target.value })} /></label>
        </div>
        <label className={`block ${lbl}`}>نص البطاقة (مقترح يُعدَّل)<textarea className="field mt-1 min-h-[70px] w-full text-sm" value={x.message} onChange={(e) => setX({ ...x, message: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2">
          {me.amb && <button className="btn-primary px-4 py-1.5 text-xs" disabled={!!busy} onClick={ask}>{busy === "new" ? "…" : "معاينة وإرسال إشعار"}</button>}
          <button className="btn-ghost px-4 py-1.5 text-xs" disabled={!!busy} onClick={() => save(false)}>حفظ دون إرسال</button>
          <button className="rounded-pill bg-[#25D366] px-4 py-1.5 text-xs font-bold text-white" onClick={() => person ? setCard({ kind: "occasion", sub: x.kind, name: person.full_name, mobile: person.mobile, body: x.message || undefined }) : setMsg({ ok: false, text: "اختر صاحب المناسبة." })}>بطاقة واتساب</button>
        </div>
        <p className="text-[11px] text-faint">الإشعار يصل جرس صاحب المناسبة وجواله في البوابة. و«بطاقة واتساب» صورة بهوية المدرسة تُرسل في قروب العمل أو على الخاص.</p>
      </section>
      <div className="card divide-y divide-line/70 overflow-hidden">
        {rows.length ? rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] text-ink">{r.person_name} · {OCCASIONS[r.kind]?.t ?? r.kind}</span>
              <span className="block text-[11px] text-muted"><span className="num">{fmtDate(r.held_on)}</span>{r.created_by_name && ` · ${r.created_by_name}`}</span>
              {r.message && <span className="mt-1 block text-[12px] leading-relaxed text-muted">{r.message}</span>}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              {r.sent_at ? <span className="chip bg-present/10 text-present">أُرسل الإشعار · <span className="num">{fmtDate(r.sent_at)}</span></span>
                : me.amb ? <button className="text-[11.5px] font-semibold text-mint-deep" disabled={!!busy} onClick={() => setPreview({ row: r, ...previewOf(r.kind, r.person_name, r.message ?? "") })}>{busy === r.id ? "…" : "إرسال إشعار"}</button>
                : <span className="chip bg-canvas text-muted">لم تُرسل</span>}
              <button className="text-[11.5px] font-semibold text-[#128C7E]" onClick={() => setCard({ kind: "occasion", sub: r.kind, name: r.person_name, mobile: staff.find((s) => s.id === r.user_id)?.mobile, body: r.message || undefined })}>بطاقة واتساب</button>
              <button className="text-[11px] text-absent" onClick={() => remove(r.id, `${r.person_name} · ${OCCASIONS[r.kind]?.t ?? ""}`)}>حذف</button>
            </span>
          </div>)) : <p className="px-4 py-6 text-center text-sm text-muted">لا مناسبات مسجلة بعد.</p>}
      </div>
      {card && <CardMaker init={card} onClose={() => setCard(null)} />}
      {preview && <SendPreview card={preview.card} notif={preview.notif} to={preview.to} busy={!!busy} onConfirm={confirm} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ============================ حيّاك ============================ */
const STAGES = [...new Set(ONBOARD.map((o) => o.s))];

export function CultOnboard() {
  const { profile } = useSession();
  const staff = useStaff();
  const { rows, load, remove, setMsg } = useRows("cult_onboard", "joined_on");
  const [x, setX] = useState({ user_id: "", joined_on: todayISO(), mentor_name: "" });
  const [open, setOpen] = useState(null);
  if (!rows) return <Loader />;
  const save = async () => {
    const p = staff.find((s) => s.id === x.user_id);
    if (!p) { setMsg({ ok: false, text: "اختر الموظف الجديد." }); return; }
    const { data, error } = await supabase.from("cult_onboard").insert({
      user_id: p.id, person_name: p.full_name, joined_on: x.joined_on, mentor_name: x.mentor_name || null, created_by_name: profile?.full_name ?? null,
    }).select("id").single();
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setX({ ...x, user_id: "", mentor_name: "" }); setOpen(data.id); load();
  };
  return (
    <div className="space-y-3">
      <Intro p="hayyak" />
      <section className="card grid gap-2 p-4 sm:grid-cols-[1fr_150px_1fr_auto] sm:items-end">
        <label className={lbl}>الموظف الجديد<select className="field mt-1 w-full text-sm" value={x.user_id} onChange={(e) => setX({ ...x, user_id: e.target.value })}>
          <option value="">— اختر —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>
        <label className={lbl}>تاريخ المباشرة<input type="date" className="field num mt-1 w-full text-sm" value={x.joined_on} onChange={(e) => setX({ ...x, joined_on: e.target.value })} /></label>
        <label className={lbl}>الموظف الموجه<select className="field mt-1 w-full text-sm" value={x.mentor_name} onChange={(e) => setX({ ...x, mentor_name: e.target.value })}>
          <option value="">— لاحقًا —</option>{staff.map((s) => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}</select></label>
        <button className="btn-primary px-4 py-1.5 text-xs" onClick={save}>بدء التهيئة</button>
      </section>
      <div className="card divide-y divide-line/70 overflow-hidden">
        {rows.length ? rows.map((r) => {
          const done = ONBOARD.filter((o) => r.checks?.[o.k]).length;
          return (
            <div key={r.id}>
              <button className="flex w-full items-center gap-3 px-4 py-2.5 text-start" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] text-ink">{r.person_name}</span>
                  <span className="block text-[11px] text-muted">باشر <span className="num">{fmtDate(r.joined_on)}</span>{r.mentor_name && ` · الموجه: ${r.mentor_name}`}</span></span>
                <span className="h-2 w-24 shrink-0 overflow-hidden rounded-pill bg-canvas"><span className="block h-full rounded-pill bg-mint-deep" style={{ width: `${(done / ONBOARD.length) * 100}%` }} /></span>
                <span className="num w-12 shrink-0 text-end text-xs text-muted">{done}/{ONBOARD.length}</span>
              </button>
              {open === r.id && <Onboard r={r} mobile={staff.find((s) => s.id === r.user_id)?.mobile} setMsg={setMsg} onChange={load} onRemove={() => remove(r.id, r.person_name)} />}
            </div>
          );
        }) : <p className="px-4 py-6 text-center text-sm text-muted">لا موظفين جدد في التهيئة.</p>}
      </div>
    </div>
  );
}

function Onboard({ r, mobile, setMsg, onChange, onRemove }) {
  const [card, setCard] = useState(false);
  const [checks, setChecks] = useState(r.checks ?? {});
  const [notes, setNotes] = useState(r.notes ?? "");
  const persist = async (patch) => {
    const { error } = await supabase.from("cult_onboard").update(patch).eq("id", r.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChange();
  };
  const toggle = (k) => { const c = { ...checks }; if (c[k]) delete c[k]; else c[k] = todayISO(); setChecks(c); persist({ checks: c }); };
  return (
    <div className="space-y-3 border-t border-line bg-canvas/40 px-4 py-3">
      {STAGES.map((s) => (
        <div key={s}>
          <p className="mb-1 text-[11.5px] font-bold text-mint-deep">{s}</p>
          <div className="space-y-1">{ONBOARD.filter((o) => o.s === s).map((o) => (
            <label key={o.k} className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-relaxed text-ink">
              <input type="checkbox" className="mt-1" checked={!!checks[o.k]} onChange={() => toggle(o.k)} />
              <span className={checks[o.k] ? "text-muted line-through" : ""}>{o.t}</span>
              {checks[o.k] && <span className="num ms-auto shrink-0 text-[10.5px] text-faint">{fmtDate(checks[o.k])}</span>}
            </label>))}</div>
        </div>))}
      <label className={`block ${lbl}`}>ملاحظات التهيئة<textarea className="field mt-1 min-h-[56px] w-full text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="flex items-center gap-2">
        <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => persist({ notes: notes.trim() || null })}>حفظ الملاحظات</button>
        <button className="rounded-pill bg-[#25D366] px-4 py-1.5 text-xs font-bold text-white" onClick={() => setCard(true)}>بطاقة ترحيب واتساب</button>
        {card && <CardMaker init={{ kind: "welcome", name: r.person_name, mobile }} onClose={() => setCard(false)} />}
        <button className="ms-auto text-xs text-absent" onClick={onRemove}>حذف</button>
      </div>
    </div>
  );
}
