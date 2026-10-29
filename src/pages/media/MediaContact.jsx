// src/pages/media/MediaContact.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   التواصل مع المركز الإعلامي (supabase/media_5.sql): لكل الفئات طلب تغطية أو اقتراح أو مشاركة،
   ومحادثة داخل كل طلب. والمركز (صاحب صلاحية الاستوديو ورئيسه) يرى الوارد ويرد ويغيّر الحالة.
   ===================================================================== */

export const KIND = {
  coverage:   { t: "طلب تغطية", hint: "فعالية أو نشاط تريد تصويره وتوثيقه" },
  suggestion: { t: "اقتراح",    hint: "فكرة لبرنامج أو مادة أو تحسين" },
  share:      { t: "مشاركة",    hint: "قصة أو إنجاز أو موهبة تستحق الظهور" },
  other:      { t: "أخرى",      hint: "" },
};
const STATUS = {
  new:      { t: "جديد",        c: "bg-mint-tint text-mint-deep" },
  accepted: { t: "مقبول",       c: "bg-late/10 text-late" },
  done:     { t: "منجز",        c: "bg-present/10 text-present" },
  declined: { t: "اعتذر المركز", c: "bg-absent/10 text-absent" },
};
const ROLE = { student: "طالب", guardian: "ولي أمر", teacher: "معلم", admin: "إداري" };
const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`;
const when = (ts) => new Date(ts).toLocaleString("ar-SA-u-nu-latn-ca-gregory", { weekday: "short", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" });
const BLANK = { kind: "coverage", title: "", body: "", date: "", time: "", place: "" };

export default function MediaContact() {
  const { profile, effectiveRole } = useSession();
  const [params] = useSearchParams();
  const [center, setCenter] = useState(false);
  const [box, setBox] = useState(params.get("center") ? "in" : "mine");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => { supabase.rpc("media_center").then(({ data }) => setCenter(!!data)); }, []);
  useEffect(() => {
    supabase.from("media_requests").select("*").order("created_at", { ascending: false }).limit(300).then(({ data, error }) => {
      if (error) setErr(/media_requests|schema cache|relation/i.test(error.message) ? "التواصل يحتاج تشغيل supabase/media_5.sql مرة واحدة في Supabase ← SQL Editor." : error.message);
      setRows(data ?? []);
    });
  }, [reload]);
  if (!rows) return <Loader />;
  const me = profile?.id;
  const mine = rows.filter((r) => r.created_by === me);
  const inbox = rows.filter((r) => r.created_by !== me);
  const list = center && box === "in" ? inbox : mine;

  const send = async () => {
    setBusy(true); setErr("");
    const event_at = f.kind === "coverage" && f.date ? new Date(`${f.date}T${f.time || "08:00"}:00`).toISOString() : null;
    const { error } = await supabase.from("media_requests").insert({ kind: f.kind, title: f.title.trim(), body: f.body.trim() || null,
      event_at, place: f.kind === "coverage" ? f.place.trim() || null : null,
      created_by_name: profile?.full_name ?? null, created_by_role: ROLE[effectiveRole] ?? null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setF(BLANK); setBox("mine"); setReload((x) => x + 1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">التواصل مع المركز الإعلامي</h1>
        <p className="mt-1 text-sm text-muted">اطلب تغطية فعالية، أو اقترح فكرة، أو شارك قصة تستحق الظهور في «معرض المدرسة»، ويرد عليك رئيس المركز هنا.</p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {center && (
        <div className="flex gap-1.5">
          <button className={pill(box === "in")} onClick={() => setBox("in")}>الوارد للمركز <span className="num">({inbox.filter((r) => r.status === "new").length} جديد)</span></button>
          <button className={pill(box === "mine")} onClick={() => setBox("mine")}>طلباتي</button>
        </div>
      )}

      {box === "mine" && (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">طلب جديد</p>
          <div className="flex flex-wrap gap-1.5">{Object.entries(KIND).map(([k, v]) => <button key={k} className={pill(f.kind === k)} onClick={() => setF({ ...f, kind: k })}>{v.t}</button>)}</div>
          {KIND[f.kind].hint && <p className="text-xs text-faint">{KIND[f.kind].hint}</p>}
          <input className="field w-full" value={f.title} maxLength={90} placeholder={f.kind === "coverage" ? "الفعالية (مثل: حفل تكريم المتفوقين)" : "العنوان"} onChange={(e) => setF({ ...f, title: e.target.value })} />
          {f.kind === "coverage" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs text-muted">اليوم<input type="date" className="field mt-1" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
              <label className="text-xs text-muted">الوقت<input type="time" className="field mt-1" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
              <label className="text-xs text-muted">المكان<input className="field mt-1" value={f.place} maxLength={60} placeholder="المسرح" onChange={(e) => setF({ ...f, place: e.target.value })} /></label>
            </div>
          )}
          <textarea className="field w-full" rows={3} value={f.body} maxLength={800} placeholder="التفاصيل" onChange={(e) => setF({ ...f, body: e.target.value })} />
          <button className="btn-primary" disabled={busy || !f.title.trim() || (f.kind === "coverage" && !f.date)} onClick={send}>إرسال إلى المركز</button>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink">{center && box === "in" ? "طلبات المركز" : "طلباتي"} <span className="num text-muted">({list.length})</span></p>
        {list.length ? list.map((r) => (
          <Request key={r.id} r={r} center={center && box === "in"} open={open === r.id} onOpen={() => setOpen(open === r.id ? null : r.id)}
                   onChange={() => setReload((x) => x + 1)} />
        )) : <p className="card px-4 py-8 text-center text-sm text-muted">لا طلبات بعد.</p>}
      </section>
    </div>
  );
}

function Request({ r, center, open, onOpen, onChange }) {
  const { profile } = useSession();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => supabase.from("media_request_msgs").select("*").eq("request_id", r.id).order("at").then(({ data }) => setMsgs(data ?? []));
  useEffect(() => { if (open) load(); }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps
  const reply = async () => {
    setBusy(true);
    await supabase.from("media_request_msgs").insert({ request_id: r.id, body: text.trim(), by_name: profile?.full_name ?? null, from_center: center });
    setBusy(false); setText(""); load();
  };
  const setStatus = async (status) => { await supabase.from("media_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", r.id); onChange(); };

  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-start gap-2 px-4 py-3 text-right" onClick={onOpen}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{r.title}</p>
          <p className="text-xs text-muted">{KIND[r.kind]?.t}{center && r.created_by_name ? ` · ${r.created_by_name}${r.created_by_role ? ` (${r.created_by_role})` : ""}` : ""} · {fmtDate(r.created_at)}</p>
          {r.event_at && <p className="mt-0.5 text-xs text-ink">الموعد: <span className="num">{when(r.event_at)}</span>{r.place ? ` · ${r.place}` : ""}</p>}
        </div>
        <span className={`chip shrink-0 ${STATUS[r.status]?.c}`}>{STATUS[r.status]?.t}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-line bg-canvas/50 px-4 py-3">
          {r.body && <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{r.body}</p>}
          {!msgs ? <Loader /> : msgs.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${m.from_center ? "me-auto bg-mint-tint text-ink" : "ms-auto bg-white text-ink"}`}>
              <p className="text-[11px] font-semibold text-muted">{m.from_center ? `المركز الإعلامي · ${m.by_name ?? ""}` : m.by_name}</p>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="num mt-0.5 text-[10px] text-faint">{when(m.at)}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input className="field flex-1" value={text} maxLength={600} placeholder={center ? "رد المركز" : "رسالة إلى المركز"} onChange={(e) => setText(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && text.trim() && !busy) reply(); }} />
            <button className="btn-primary px-4" disabled={busy || !text.trim()} onClick={reply}>إرسال</button>
          </div>
          {center && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-muted">الحالة:</span>
              {Object.entries(STATUS).map(([k, v]) => <button key={k} className={pill(r.status === k)} onClick={() => setStatus(k)}>{v.t}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
