// src/pages/Repairs.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { useNotice } from "../lib/useNotice.js";
import { fmtDateTime } from "../lib/dates";
import { confirmDanger } from "../lib/danger";
import { notifyUsers } from "../lib/referrals";
import { refreshNavBadges } from "../lib/navBadges.js";
import { MAX_PHOTOS, uploadPhotos, useSignedPhotos, Thumbs } from "./globe/shared.jsx";
import Loader from "../components/Loader.jsx";
import { friendlyError } from "../lib/friendlyError.js";

/* =====================================================================
   بلاغات الصيانة (supabase/maint_1.sql): يرفع المعلم أو الإداري بلاغًا بمكان العطل ونوعه
   ودرجة استعجاله وصوره، فيصل المساعد الإداري 3 إشعارًا في الجرس والجوال، ويتابعه
   (قيد المعالجة، رُفع للصيانة الخارجية، تم الإصلاح، مرفوض) فيُشعَر صاحب البلاغ بكل تحديث.
   ويطّلع ويتابع أيضًا وكيل الشؤون المدرسية والمدير والدعم الفني.
   ===================================================================== */

export const MAINT_BUCKET = "maintenance";
const PLACES = ["فصل دراسي", "مختبر أو معمل", "دورات المياه", "ممر أو درج", "الساحة أو الملعب", "مكتب إداري", "غرفة المعلمين", "المصلى", "المقصف", "أخرى"];
const CATEGORIES = ["كهرباء وإنارة", "تكييف", "سباكة ومياه", "أبواب ونوافذ", "أثاث", "سبورة أو جهاز عرض", "دهان وجدران", "نظافة", "أمن وسلامة", "أخرى"];
export const MAINT_STATUS = {
  new: { t: "جديد", c: "bg-excused/10 text-excused" },
  in_progress: { t: "قيد المعالجة", c: "bg-late/10 text-late" },
  external: { t: "رُفع للصيانة الخارجية", c: "bg-mint-tint text-mint-deep" },
  resolved: { t: "تم الإصلاح", c: "bg-present/10 text-present" },
  rejected: { t: "مرفوض", c: "bg-canvas text-muted" },
};
const OPEN = ["new", "in_progress", "external"];
const setupMsg = (e) => (/maint_|schema cache|does not exist/i.test(e?.message ?? "")
  ? "الميزة لم تُفعّل بعد: شغّل ملف supabase/maint_1.sql في Supabase ← SQL Editor." : e?.message ?? "تعذّر التحميل.");
const chip = (on) => `rounded-pill border px-3 py-1.5 text-xs transition-colors ${on ? "border-mint-deep bg-mint-deep font-semibold text-white" : "border-line bg-white text-ink hover:border-mint-deep"}`;

export default function Repairs() {
  const { profile, adminRoles } = useSession();
  const handler = (adminRoles ?? []).some((r) => ["clerk_3", "deputy_school", "principal", "tech_support"].includes(r));
  const [sp, setSp] = useSearchParams();
  const tabs = handler ? [["all", "البلاغات"], ["new", "بلاغ جديد"], ["mine", "بلاغاتي"]] : [["new", "بلاغ جديد"], ["mine", "بلاغاتي"]];
  const tab = tabs.some(([k]) => k === sp.get("tab")) ? sp.get("tab") : tabs[0][0];
  const go = (k) => setSp({ tab: k }, { replace: true });
  const [, setMsg] = useNotice(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = () => supabase.from("maint_tickets").select("*").order("created_at", { ascending: false }).limit(500)
    .then(({ data, error }) => { setErr(error ? setupMsg(error) : ""); setRows(data ?? []); });
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">بلاغات الصيانة</h1>
        <p className="mt-1 text-sm text-muted">بلّغ عن أي عطل في المدرسة بمكانه وصورته، فيصل المساعد الإداري المسؤول عن الصيانة، ويصلك إشعار بكل تحديث حتى إصلاحه.</p>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map(([k, t]) => (
          <button key={k} onClick={() => go(k)} className={`shrink-0 rounded-pill px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {t}{k === "all" && rows ? ` (${rows.filter((r) => OPEN.includes(r.status)).length})` : ""}
          </button>))}
      </div>
      {err ? <p className="card px-4 py-6 text-sm text-absent">{err}</p>
        : !rows ? <Loader />
        : tab === "new" ? <NewTicket profile={profile} setMsg={setMsg} onDone={() => { load(); go("mine"); }} />
        : <List rows={tab === "mine" ? rows.filter((r) => r.reported_by === profile?.id) : rows} manage={tab === "all"} me={profile} setMsg={setMsg} onChange={load} />}
    </div>
  );
}

function NewTicket({ profile, setMsg, onDone }) {
  const [x, setX] = useState({ place_kind: "", place: "", category: "", urgent: false, description: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!x.place_kind || !x.category) { setMsg({ ok: false, text: "اختر مكان العطل ونوعه." }); return; }
    if (!x.place.trim() && !x.description.trim()) { setMsg({ ok: false, text: "حدّد المكان (رقم الفصل أو اسمه) أو صف العطل." }); return; }
    setBusy(true);
    try {
      const photos = files.length ? await uploadPhotos("t", crypto.randomUUID(), files, [], MAINT_BUCKET) : [];
      const { data, error } = await supabase.from("maint_tickets").insert({
        place_kind: x.place_kind, place: x.place.trim() || null, category: x.category, urgent: x.urgent,
        description: x.description.trim() || null, photos, reporter_name: profile?.full_name ?? null,
      }).select("id").single();
      if (error) throw error;
      const { data: ids } = await supabase.rpc("maint_recipient_ids");
      await notifyUsers(ids ?? [], `${x.urgent ? "بلاغ صيانة عاجل" : "بلاغ صيانة"} رقم ${data.id}: ${x.category}`,
        [`${x.place_kind}${x.place.trim() ? ` · ${x.place.trim()}` : ""}`, x.description.trim(), profile?.full_name ? `المبلّغ: ${profile.full_name}` : ""].filter(Boolean).join(" — "),
        `/repairs?tab=all&open=${data.id}`);
      setMsg({ ok: true, text: `رُفع البلاغ رقم ${data.id}، ووصل المساعد الإداري المسؤول عن الصيانة.` });
      onDone();
    } catch (e) { setMsg({ ok: false, text: setupMsg(e) }); }
    setBusy(false);
  };
  const set = (k) => (e) => setX({ ...x, [k]: e.target.value });
  return (
    <section className="card space-y-4 p-4">
      <div><p className="label">مكان العطل</p>
        <div className="flex flex-wrap gap-1.5">{PLACES.map((p) => <button key={p} type="button" className={chip(x.place_kind === p)} onClick={() => setX({ ...x, place_kind: p })}>{p}</button>)}</div></div>
      <label className="block"><span className="label">تحديد المكان</span>
        <input className="field" maxLength={80} placeholder="مثل: فصل 203، دورة مياه الدور الثاني، مختبر الكيمياء" value={x.place} onChange={set("place")} /></label>
      <div><p className="label">نوع العطل</p>
        <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button key={c} type="button" className={chip(x.category === c)} onClick={() => setX({ ...x, category: c })}>{c}</button>)}</div></div>
      <label className="block"><span className="label">وصف العطل</span>
        <textarea className="field min-h-[80px]" maxLength={600} placeholder="ما المشكلة؟ ومنذ متى؟" value={x.description} onChange={set("description")} /></label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={x.urgent} onChange={(e) => setX({ ...x, urgent: e.target.checked })} />
        <span>عاجل <span className="text-xs text-muted">(خطر على السلامة، أو يعطّل الدراسة)</span></span>
      </label>
      <label className="block text-[12px] text-muted">صور العطل (حتى {MAX_PHOTOS})
        <input type="file" accept="image/*" multiple className="mt-1 block text-sm" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, MAX_PHOTOS))} /></label>
      <button className="btn-primary px-5 py-2 text-sm" disabled={busy} onClick={send}>{busy ? "…" : "رفع البلاغ"}</button>
    </section>
  );
}

function List({ rows, manage, me, setMsg, onChange }) {
  const [sp] = useSearchParams();
  const [open, setOpen] = useState(Number(sp.get("open")) || null);
  const [st, setSt] = useState(manage ? "open" : "all");
  const urls = useSignedPhotos(rows, MAINT_BUCKET);
  const list = useMemo(() => rows.filter((r) => st === "all" || (st === "open" ? OPEN.includes(r.status) : r.status === st))
    .sort((a, b) => (manage ? (OPEN.includes(b.status) && b.urgent) - (OPEN.includes(a.status) && a.urgent) : 0)), [rows, st, manage]);
  const n = (k) => rows.filter((r) => (k === "open" ? OPEN.includes(r.status) : r.status === k)).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {[["open", "المفتوحة"], ...Object.entries(MAINT_STATUS).map(([k, s]) => [k, s.t]), ["all", "الكل"]].map(([k, t]) => (
          <button key={k} className={chip(st === k)} onClick={() => setSt(k)}>{t} <span className="num">{k === "all" ? rows.length : n(k)}</span></button>))}
      </div>
      <div className="card divide-y divide-line/70 overflow-hidden">
        {list.length ? list.map((r) => (
          <div key={r.id}>
            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-start" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className="num shrink-0 text-xs text-faint">#{r.id}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] text-ink">{r.category} · {r.place_kind}{r.place ? ` · ${r.place}` : ""}</span>
                <span className="block text-[11px] text-muted">{manage && r.reporter_name ? `${r.reporter_name} · ` : ""}<span className="num">{fmtDateTime(r.created_at)}</span></span>
              </span>
              {r.urgent && OPEN.includes(r.status) && <span className="chip shrink-0 bg-absent/10 text-absent">عاجل</span>}
              <span className={`chip shrink-0 ${MAINT_STATUS[r.status].c}`}>{MAINT_STATUS[r.status].t}</span>
            </button>
            {open === r.id && <Ticket r={r} manage={manage} me={me} urls={urls} setMsg={setMsg} onChange={onChange} />}
          </div>)) : <p className="px-4 py-6 text-center text-sm text-muted">لا بلاغات هنا.</p>}
      </div>
    </div>
  );
}

function Ticket({ r, manage, me, urls, setMsg, onChange }) {
  const [status, setStatus] = useState(r.status === "new" ? "in_progress" : r.status);
  const [note, setNote] = useState(r.resolution ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("maint_tickets").update({
      status, resolution: note.trim() || null, handler_name: me?.full_name ?? null, updated_at: new Date().toISOString(),
      resolved_at: status === "resolved" ? r.resolved_at ?? new Date().toISOString() : null,
    }).eq("id", r.id);
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); setBusy(false); return; }
    if (status !== r.status || (note.trim() && note.trim() !== (r.resolution ?? ""))) {
      await notifyUsers([r.reported_by], `بلاغ الصيانة رقم ${r.id}: ${MAINT_STATUS[status].t}`,
        [`${r.category} · ${r.place_kind}${r.place ? ` · ${r.place}` : ""}`, note.trim()].filter(Boolean).join(" — "), `/repairs?tab=mine&open=${r.id}`);
    }
    setMsg({ ok: true, text: "حُفظ التحديث، ووصل صاحب البلاغ إشعار به." }); setBusy(false); onChange(); refreshNavBadges?.();
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف بلاغ الصيانة رقم ${r.id}`, impact: ["يُحذف البلاغ وصوره."], confirmLabel: "حذف" }))) return;
    if (r.photos?.length) await supabase.storage.from(MAINT_BUCKET).remove(r.photos);
    const { error } = await supabase.from("maint_tickets").delete().eq("id", r.id);
    if (error) setMsg({ ok: false, text: friendlyError(error.message) }); else onChange();
  };
  const canDelete = r.reported_by === me?.id ? r.status === "new" : false;
  return (
    <div className="space-y-3 border-t border-line bg-canvas/40 px-4 py-3 text-[13px]">
      {r.description && <p className="whitespace-pre-line leading-relaxed text-ink">{r.description}</p>}
      <Thumbs paths={r.photos} urls={urls} />
      {!manage && (r.resolution || r.handler_name) && <p className="rounded-sm2 bg-white px-3 py-2 text-ink">
        <b className="text-mint-deep">رد المتابع{r.handler_name ? ` (${r.handler_name})` : ""}: </b>{r.resolution ?? MAINT_STATUS[r.status].t}</p>}
      {r.resolved_at && <p className="text-[11.5px] text-muted">أُصلح في <span className="num">{fmtDateTime(r.resolved_at)}</span></p>}
      {manage && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">{Object.entries(MAINT_STATUS).filter(([k]) => k !== "new").map(([k, s]) => (
            <button key={k} className={chip(status === k)} onClick={() => setStatus(k)}>{s.t}</button>))}</div>
          <textarea className="field min-h-[60px] w-full text-sm" maxLength={500} placeholder="الإجراء المتخذ أو سبب الرفض (يصل صاحب البلاغ)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "…" : "حفظ وإشعار المبلّغ"}</button>
            {r.handler_name && <span className="text-[11px] text-faint">آخر متابعة: {r.handler_name} · <span className="num">{fmtDateTime(r.updated_at)}</span></span>}
          </div>
        </div>
      )}
      {canDelete && <button className="text-xs text-absent" onClick={remove}>حذف البلاغ</button>}
    </div>
  );
}
