import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { supabase } from "../lib/supabase";
import { GRADE_NAMES, todayISO } from "../lib/schoolTime";
import { fmtDate, fmtDateTime } from "../lib/dates";
import { shrinkImage } from "../lib/imageResize.js";
import { printReport, PRINCIPAL_NAME } from "../lib/exportUtils";
import Loader from "../components/Loader.jsx";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   التوجيه الطلابي — بقية الصفحة (supabase/guidance_3.sql و guidance_4.sql):
   • الخطة والبرامج: برامج الصف بموعدها. يُنفَّذ البرنامج حدثًا في «الأحداث
     والمناسبات» أو يُربط بحدث نُفّذ (guidance_5.sql)، فيُعدّ منفَّذًا حين يُعتمد
     حدثه ومستفيدوه طلابه؛ أو يوثَّق تنفيذه يدويًا بالمستفيدين والأثر والصور.
   • طلبات المقابلة: من الطالب أو ولي أمره، يحدد الموجه موعدها أو يرد.
   • التقرير الشهري: أرقام عمل الموجه في الشهر، مطبوعًا بتوقيعه وتوقيع المدير.
   ===================================================================== */

const BUCKET = "guidance-files";
const MAX_PHOTOS = 3;
export const PROGRAM_KIND = { awareness: "توعوي", preventive: "وقائي", developmental: "نمائي", remedial: "علاجي" };
const PRESETS = [
  ["الأسبوع التمهيدي للطلاب المستجدين", "developmental"], ["التهيئة للاختبارات وإدارة القلق", "preventive"],
  ["الوقاية من التنمر", "preventive"], ["التوعية بأضرار التدخين والمخدرات", "awareness"],
  ["مهارات المذاكرة وتنظيم الوقت", "developmental"], ["التوجيه المهني واختيار التخصص", "developmental"],
  ["تعزيز الانضباط والمواظبة", "preventive"], ["تكريم الطلاب المتميزين سلوكيًا", "developmental"],
  ["برنامج علاجي للطلاب المتعثرين دراسيًا", "remedial"],
];
const REQ_STATUS = {
  new: { t: "جديد", c: "bg-warning-light text-warning" },
  scheduled: { t: "تحدد موعده", c: "bg-excused/10 text-excused" },
  done: { t: "تمت المقابلة", c: "bg-present/10 text-present" },
  declined: { t: "اعتذر الموجه", c: "bg-canvas text-muted" },
};
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
const logos = () => ({ logoUrl: new URL(logoIcon, window.location.origin).href, moeLogoUrl: new URL(moeLogo, window.location.origin).href });
const setupErr = (e, file) => (/guidance_|schema cache|relation/i.test(e?.message ?? "")
  ? `لم يُفعَّل هذا القسم بعد: يلزم تشغيل ملف supabase/${file}.` : e?.message);

// مراحل الحدث (pages/Events.jsx) بأسمائها المختصرة
const EV_STAGE = { draft: "بيانات الحدث", participants: "المشاركون", consent: "موافقة أولياء الأمور", permission: "الاستئذان",
  attendance: "كشف الحضور", certificates: "الشهادات", report: "التقرير", approved: "معتمد" };
const EV_SELECT = "*, school_events(id, serial, title, stage, event_date, cancelled_at, event_participants(count))";

/** البرامج مع أحداثها، وقبل تشغيل guidance_5.sql بلا أحداث */
async function loadPrograms(grade) {
  let r = await supabase.from("guidance_programs").select(EV_SELECT).eq("grade", grade)
    .order("planned_date", { ascending: true, nullsFirst: false });
  if (r.error && /event|relationship|school_events/i.test(r.error.message)) {
    r = await supabase.from("guidance_programs").select("*").eq("grade", grade)
      .order("planned_date", { ascending: true, nullsFirst: false });
  }
  return r;
}
/** حال البرنامج: منفَّذ يدويًا أو باعتماد حدثه، ومستفيدوه */
export function programState(p) {
  const ev = p.school_events;
  const evDone = ev?.stage === "approved";
  return {
    ev, done: p.status === "done" || evDone,
    date: p.status === "done" ? p.done_date : evDone ? ev.event_date : null,
    beneficiaries: p.beneficiaries ?? (evDone ? ev.event_participants?.[0]?.count ?? null : null),
  };
}

async function activeTerm() {
  const { data } = await supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return { academic_year: m.active_year ?? null, term: Number(m.active_term ?? 1) };
}

/* ------------------------------ الخطة والبرامج ------------------------------ */
export function Programs({ grade, me }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [nf, setNf] = useState(null);       // برنامج جديد
  const [doneFor, setDoneFor] = useState(null);   // توثيق تنفيذ
  const [busy, setBusy] = useState(false);

  const [linkFor, setLinkFor] = useState(null);   // { p, events }
  const navigate = useNavigate();
  const { session, profile, adminRoles } = useSession();

  const load = () => loadPrograms(grade)
    .then(({ data, error }) => { if (error) setErr(setupErr(error, "guidance_3.sql")); setRows(data ?? []); });
  useEffect(() => { load(); }, [grade]);   // eslint-disable-line react-hooks/exhaustive-deps

  // تنفيذ البرنامج حدثًا: يُنشأ الحدث ببيانات البرنامج ويُربط به، ثم يُفتح في «الأحداث»
  const runAsEvent = async (p) => {
    setBusy(true); setErr("");
    const { data: serial } = await supabase.rpc("next_event_serial");
    const { data: ev, error } = await supabase.from("school_events").insert({
      serial, title: p.title, category: "التوجيه الطلابي",
      event_date: p.planned_date || todayISO(),
      description: `برنامج ${PROGRAM_KIND[p.kind]} من الخطة الإرشادية — ${GRADE_NAMES[grade] ?? ""}`,
      goals: p.target ? `الفئة المستهدفة: ${p.target}` : null,
      organizer_id: session?.user?.id, organizer_name: profile?.full_name ?? me ?? "",
      organizer_role: adminRoles.some((r) => r.startsWith("counselor")) ? "الموجه الطلابي" : "",
      cert_template: "classic", stage: "participants",
    }).select("id").single();
    if (error) { setBusy(false); setErr(error.message); return; }
    const { error: e2 } = await supabase.from("guidance_programs").update({ event_id: ev.id }).eq("id", p.id);
    setBusy(false);
    if (e2) { setErr(setupErr(e2, "guidance_5.sql")); return; }
    navigate(`/events?open=${ev.id}`);
  };

  // ربط البرنامج بحدث نُفّذ: الأحداث التي يراها المستخدم، غير الملغاة
  const openLink = async (p) => {
    const { data } = await supabase.from("school_events").select("id, serial, title, event_date, stage")
      .is("cancelled_at", null).order("event_date", { ascending: false }).limit(60);
    setLinkFor({ p, events: data ?? [] });
  };
  const link = async (eventId) => {
    const { error } = await supabase.from("guidance_programs").update({ event_id: eventId }).eq("id", linkFor.p.id);
    if (error) { setErr(setupErr(error, "guidance_5.sql")); return; }
    setLinkFor(null); load();
  };

  const add = async () => {
    if (!nf.title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("guidance_programs").insert({
      grade, title: nf.title.trim(), kind: nf.kind, target: nf.target.trim() || null,
      planned_date: nf.planned_date || null, created_by_name: me ?? null, ...(await activeTerm()),
    });
    setBusy(false);
    if (error) { setErr(setupErr(error, "guidance_3.sql")); return; }
    setNf(null); load();
  };

  const saveDone = async () => {
    setBusy(true); setErr("");
    try {
      const p = doneFor.p;
      const paths = [...(p.photos ?? [])];
      for (const f of doneFor.files.slice(0, MAX_PHOTOS - paths.length)) {
        const img = await shrinkImage(f, 1600, 0.8, { jpeg: true });
        const path = `${grade}/${p.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, img, { contentType: "image/jpeg" });
        if (error) throw error;
        paths.push(path);
      }
      const { error } = await supabase.from("guidance_programs").update({
        status: "done", done_date: doneFor.done_date || todayISO(),
        beneficiaries: Number(doneFor.beneficiaries) || null, outcome: doneFor.outcome.trim() || null, photos: paths,
      }).eq("id", p.id);
      if (error) throw error;
      setDoneFor(null); load();
    } catch (e) { setErr(setupErr(e, "guidance_3.sql")); }
    setBusy(false);
  };

  const openPhoto = async (path) => {
    const win = window.open("", "_blank");
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (data?.signedUrl && win) win.location.href = data.signedUrl; else win?.close();
  };

  const remove = async (p) => {
    if (!window.confirm(`حذف برنامج «${p.title}»؟`)) return;
    if (p.photos?.length) await supabase.storage.from(BUCKET).remove(p.photos);
    await supabase.from("guidance_programs").delete().eq("id", p.id);
    load();
  };

  const printPlan = () => printReport({
    title: "الخطة الإرشادية",
    subtitle: `${GRADE_NAMES[grade] ?? ""} · ${rows.length} برنامجًا · نُفّذ ${rows.filter((r) => programState(r).done).length}`,
    headers: ["م", "البرنامج", "نوعه", "الفئة المستهدفة", "الموعد", "التنفيذ", "المستفيدون"],
    rows: rows.map((r, i) => { const st = programState(r); return [i + 1, r.title, PROGRAM_KIND[r.kind], r.target ?? "—",
      r.planned_date ? fmtDate(r.planned_date + "T00:00:00") : "—",
      st.done ? `نُفّذ ${st.date ? fmtDate(st.date + "T00:00:00") : ""}${st.ev ? ` · حدث ${st.ev.serial}` : ""}`
        : st.ev ? `حدث ${st.ev.serial} · ${EV_STAGE[st.ev.stage] ?? ""}` : "لم يُنفَّذ", st.beneficiaries ?? "—"]; }),
    signatures: [{ title: "الموجه الطلابي", name: me ?? "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    ...logos(),
  });

  if (!rows) return <Loader />;
  return (
    <div className="space-y-3">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setNf({ title: "", kind: "awareness", target: "", planned_date: "" })}>+ برنامج</button>
        {rows.length > 0 && <button className="btn-ghost px-4 py-1.5 text-xs" onClick={printPlan}>طباعة الخطة</button>}
      </div>

      {nf && (
        <section className="card space-y-2 p-4">
          <p className="font-semibold text-ink">برنامج جديد</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(([t, k]) => <button key={t} type="button" className={pill(nf.title === t)} onClick={() => setNf((x) => ({ ...x, title: t, kind: k }))}>{t}</button>)}
          </div>
          <input className="field w-full" value={nf.title} placeholder="عنوان البرنامج" onChange={(e) => setNf((x) => ({ ...x, title: e.target.value }))} />
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PROGRAM_KIND).map(([k, t]) => <button key={k} type="button" className={pill(nf.kind === k)} onClick={() => setNf((x) => ({ ...x, kind: k }))}>{t}</button>)}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" value={nf.target} placeholder="الفئة المستهدفة (مثل: طلاب الصف كاملًا)" onChange={(e) => setNf((x) => ({ ...x, target: e.target.value }))} />
            <input type="date" className="field num" value={nf.planned_date} onChange={(e) => setNf((x) => ({ ...x, planned_date: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !nf.title.trim()} onClick={add}>حفظ</button>
            <button className="btn-ghost" onClick={() => setNf(null)}>إلغاء</button>
          </div>
        </section>
      )}

      {rows.length === 0 && !nf ? <p className="card px-4 py-6 text-center text-sm text-muted">لا برامج في خطة الصف بعد.</p> : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((p) => { const st = programState(p); return (
            <div key={p.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{p.title}</p>
                  <p className="text-xs text-muted">{PROGRAM_KIND[p.kind]}{p.target ? ` · ${p.target}` : ""}
                    {p.planned_date ? <> · <span className="num">{fmtDate(p.planned_date + "T00:00:00")}</span></> : ""}</p>
                </div>
                {st.done && <span className="chip gap-1 whitespace-nowrap bg-present/10 text-present">نُفّذ{st.beneficiaries ? <><span>·</span><span className="num">{st.beneficiaries}</span><span>مستفيدًا</span></> : ""}</span>}
                {st.ev ? (
                  <>
                    {!st.done && <span className="chip bg-excused/10 text-excused">الحدث: {EV_STAGE[st.ev.stage] ?? st.ev.stage}</span>}
                    <button className="text-xs font-semibold text-mint-deep underline" onClick={() => navigate(`/events?open=${st.ev.id}`)}>
                      فتح الحدث <span className="num">{st.ev.serial}</span></button>
                    {!st.done && <button className="text-xs text-muted underline"
                            onClick={async () => { await supabase.from("guidance_programs").update({ event_id: null }).eq("id", p.id); load(); }}>إلغاء الربط</button>}
                  </>
                ) : !st.done && (
                  <>
                    <button className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white" disabled={busy}
                            onClick={() => runAsEvent(p)}>تنفيذه حدثًا</button>
                    <button className="rounded-pill border border-mint-deep px-3 py-1 text-xs font-semibold text-mint-deep"
                            onClick={() => openLink(p)}>ربط بحدث نُفّذ</button>
                    <button className="text-xs text-muted underline"
                            onClick={() => setDoneFor({ p, done_date: todayISO(), beneficiaries: "", outcome: "", files: [] })}>توثيق يدوي</button>
                  </>
                )}
                <button className="text-xs text-absent underline" onClick={() => remove(p)}>حذف</button>
              </div>
              {linkFor?.p.id === p.id && (
                <div className="mt-2 space-y-1.5 rounded-sm2 bg-canvas p-3">
                  <p className="text-xs font-semibold text-ink">اختر الحدث الذي نُفّذ فيه البرنامج</p>
                  {linkFor.events.length === 0 && <p className="text-xs text-muted">لا أحداث تراها.</p>}
                  <div className="max-h-56 divide-y divide-line overflow-y-auto rounded-sm2 border border-line bg-white">
                    {linkFor.events.map((e) => (
                      <button key={e.id} onClick={() => link(e.id)} className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm hover:bg-canvas">
                        <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
                        <span className="num shrink-0 text-[11px] text-muted">{e.serial} · {fmtDate(e.event_date + "T00:00:00")}</span>
                        <span className="chip shrink-0 bg-canvas text-muted">{EV_STAGE[e.stage] ?? e.stage}</span>
                      </button>
                    ))}
                  </div>
                  <button className="btn-ghost px-4 py-1.5 text-xs" onClick={() => setLinkFor(null)}>إلغاء</button>
                </div>
              )}
              {p.status === "done" && (p.outcome || p.photos?.length > 0) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {p.outcome && <span className="flex-1">{p.outcome}</span>}
                  {(p.photos ?? []).map((ph, i) => <button key={ph} className="text-mint-deep underline" onClick={() => openPhoto(ph)}>صورة {i + 1}</button>)}
                </div>
              )}
              {doneFor?.p.id === p.id && (
                <div className="mt-2 space-y-2 rounded-sm2 bg-canvas p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input type="date" className="field num" value={doneFor.done_date} onChange={(e) => setDoneFor((x) => ({ ...x, done_date: e.target.value }))} />
                    <input className="field num" inputMode="numeric" value={doneFor.beneficiaries} placeholder="عدد المستفيدين"
                           onChange={(e) => setDoneFor((x) => ({ ...x, beneficiaries: e.target.value.replace(/\D/g, "") }))} />
                  </div>
                  <textarea className="field w-full" rows={2} value={doneFor.outcome} placeholder="الأثر والملاحظات"
                            onChange={(e) => setDoneFor((x) => ({ ...x, outcome: e.target.value }))} />
                  <label className="block text-xs text-muted">صور التنفيذ (حتى {MAX_PHOTOS})
                    <input type="file" accept="image/*" multiple className="mt-1 block text-xs"
                           onChange={(e) => setDoneFor((x) => ({ ...x, files: [...e.target.files].slice(0, MAX_PHOTOS) }))} />
                  </label>
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={busy} onClick={saveDone}>{busy ? "جارٍ الحفظ…" : "حفظ التنفيذ"}</button>
                    <button className="btn-ghost" onClick={() => setDoneFor(null)}>إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ طلبات المقابلة ------------------------------ */
export function Requests({ grade }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);   // { id, at, reply }
  const [busy, setBusy] = useState(false);

  const load = () => supabase.from("guidance_requests").select("*, students(full_name)").eq("grade", grade)
    .order("created_at", { ascending: false })
    .then(({ data, error }) => { if (error) setErr(setupErr(error, "guidance_4.sql")); setRows(data ?? []); });
  useEffect(() => { load(); }, [grade]);   // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (r, status) => {
    setBusy(true);
    const patch = { status, reply: edit?.reply?.trim() || null };
    if (status === "scheduled") patch.appointment_at = new Date(edit.at).toISOString();
    const { error } = await supabase.from("guidance_requests").update(patch).eq("id", r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEdit(null); load();
  };

  if (!rows) return <Loader />;
  return (
    <div className="space-y-3">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <p className="text-xs text-muted">يطلب الطالب أو ولي أمره المقابلة من حسابه، فيصلك إشعار، ويصلهم إشعار بالموعد أو الرد.</p>
      {rows.length === 0 ? <p className="card px-4 py-6 text-center text-sm text-muted">لا طلبات.</p> : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{r.students?.full_name}
                    <span className="mr-1 text-xs font-normal text-muted">· {r.requester === "guardian" ? "ولي الأمر" : "الطالب"} · <span className="num">{fmtDate(r.created_at)}</span></span></p>
                  <p className="mt-0.5 text-sm text-ink">{r.reason}</p>
                  {r.preferred && <p className="text-xs text-muted">الوقت المفضل: {r.preferred}</p>}
                  {r.appointment_at && <p className="text-xs text-excused">الموعد: <span className="num">{fmtDateTime(r.appointment_at)}</span></p>}
                  {r.reply && <p className="text-xs text-muted">الرد: {r.reply}</p>}
                </div>
                <span className={`chip ${REQ_STATUS[r.status].c}`}>{REQ_STATUS[r.status].t}</span>
                {r.status !== "done" && r.status !== "declined" && (
                  <button className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white"
                          onClick={() => setEdit({ id: r.id, at: "", reply: r.reply ?? "" })}>
                    {r.status === "new" ? "تحديد الموعد" : "تعديل"}
                  </button>
                )}
                {r.status === "scheduled" && (
                  <button className="rounded-pill border border-present px-3 py-1 text-xs font-semibold text-present" disabled={busy}
                          onClick={() => save(r, "done")}>تمت المقابلة</button>
                )}
              </div>
              {edit?.id === r.id && (
                <div className="mt-2 space-y-2 rounded-sm2 bg-canvas p-3">
                  <input type="datetime-local" className="field num" value={edit.at} onChange={(e) => setEdit((x) => ({ ...x, at: e.target.value }))} />
                  <input className="field w-full" value={edit.reply} placeholder="ملاحظة لصاحب الطلب (مثل: مكتب الموجه الطلابي)"
                         onChange={(e) => setEdit((x) => ({ ...x, reply: e.target.value }))} />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" disabled={busy || !edit.at} onClick={() => save(r, "scheduled")}>إرسال الموعد</button>
                    <button className="btn-ghost" disabled={busy || !edit.reply.trim()} onClick={() => save(r, "declined")}>اعتذار برد</button>
                    <button className="btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ التقرير الشهري ------------------------------ */
export function MonthlyReport({ grade, me }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const from = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);   // أول الشهر التالي
    setD(null); setErr("");
    Promise.all([
      supabase.from("guidance_cases").select("id, status, outcome, opened_at, closed_at, source").eq("grade", grade),
      supabase.from("guidance_sessions").select("id, kind, session_date, guidance_cases!inner(grade)").eq("guidance_cases.grade", grade)
        .gte("session_date", from).lt("session_date", to),
      loadPrograms(grade),
      supabase.from("guidance_requests").select("id, status, created_at").eq("grade", grade).gte("created_at", from).lt("created_at", to),
    ]).then(([c, s, p, r]) => {
      const e = c.error || s.error || p.error || r.error;
      if (e) setErr(setupErr(e, "guidance_3.sql وguidance_4.sql"));
      const inM = (t) => t && t.slice(0, 10) >= from && t.slice(0, 10) < to;
      const cases = c.data ?? [];
      const prog = (p.data ?? []).map((x) => ({ ...x, st: programState(x) })).filter((x) => x.st.done && inM(x.st.date));
      setD({
        opened: cases.filter((x) => inM(x.opened_at)).length,
        closed: cases.filter((x) => inM(x.closed_at)).length,
        improved: cases.filter((x) => inM(x.closed_at) && x.outcome === "improved").length,
        openNow: cases.filter((x) => x.status === "open").length,
        sessions: s.data ?? [],
        programs: prog,
        beneficiaries: prog.reduce((a, x) => a + (x.st.beneficiaries ?? 0), 0),
        requests: r.data ?? [],
      });
    });
  }, [grade, month]);

  const kinds = useMemo(() => {
    const k = { individual: 0, group: 0, guardian: 0, teacher: 0 };
    (d?.sessions ?? []).forEach((s) => { k[s.kind] = (k[s.kind] ?? 0) + 1; });
    return k;
  }, [d]);

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>;
  const stats = d ? [
    ["حالات فُتحت", d.opened], ["حالات أُغلقت", d.closed], ["منها تحسّنت", d.improved], ["حالات مفتوحة الآن", d.openNow],
    ["جلسات إرشادية", d.sessions.length], ["مقابلات أولياء الأمور", kinds.guardian],
    ["برامج نُفّذت", d.programs.length], ["المستفيدون من البرامج", d.beneficiaries],
    ["طلبات مقابلة", d.requests.length], ["طلبات تمت", d.requests.filter((x) => x.status === "done").length],
  ] : [];
  const monthLabel = new Date(`${month}-15T12:00:00`).toLocaleDateString("ar-SA-u-ca-gregory", { month: "long", year: "numeric" });

  const print = () => printReport({
    title: "التقرير الشهري للموجه الطلابي",
    subtitle: `${GRADE_NAMES[grade] ?? ""} · ${monthLabel}`,
    sections: [
      { title: "أرقام الشهر", headers: ["البيان", "العدد"], rows: stats },
      { title: "الجلسات بحسب النوع", headers: ["فردية", "جماعية", "مع ولي الأمر", "مع المعلم"],
        rows: [[kinds.individual, kinds.group, kinds.guardian, kinds.teacher]] },
      ...(d.programs.length ? [{ title: "البرامج المنفذة", headers: ["م", "البرنامج", "نوعه", "التاريخ", "المستفيدون"],
        rows: d.programs.map((x, i) => [i + 1, x.title, PROGRAM_KIND[x.kind], fmtDate(x.st.date + "T00:00:00"), x.st.beneficiaries ?? "—"]) }] : []),
    ],
    signatures: [{ title: "الموجه الطلابي", name: me ?? "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    signOnLastPageOnly: true,
    ...logos(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" className="field num w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        {d && <button className="btn-primary px-4 py-1.5 text-xs" onClick={print}>طباعة التقرير</button>}
      </div>
      {!d ? <Loader /> : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map(([t, v]) => (
            <div key={t} className="rounded-card border border-line bg-white px-2 py-3 text-center">
              <p className="num text-xl font-bold text-ink">{v}</p>
              <p className="mt-1 text-[11.5px] text-muted">{t}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------- طلب مقابلة من حساب الطالب أو ولي أمره --------------------- */
export function GuidanceRequestCard({ studentId, requester = "student" }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [preferred, setPreferred] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => supabase.from("guidance_requests").select("id, reason, status, appointment_at, reply, created_at")
    .eq("student_id", studentId).order("created_at", { ascending: false }).limit(3)
    .then(({ data, error }) => setRows(error ? null : data ?? []));
  useEffect(() => { if (studentId) load(); }, [studentId]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (rows === null) return null;   // قبل تشغيل ملف SQL لا تظهر البطاقة
  const send = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("guidance_requests").insert({
      student_id: studentId, requester, reason: reason.trim(), preferred: preferred || null,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setOpen(false); setReason(""); setPreferred(""); setMsg("أُرسل طلبك إلى الموجه الطلابي، وسيصلك إشعار بالموعد.");
    load();
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">الموجه الطلابي</p>
          <p className="text-xs text-muted">{requester === "guardian" ? "اطلب موعدًا لمقابلة موجه صف ابنك." : "تحتاج من يسمعك؟ اطلب مقابلة موجه صفك، وطلبك لا يراه غيره."}</p>
        </div>
        {!open && <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setOpen(true)}>طلب مقابلة</button>}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <textarea className="field w-full" rows={3} value={reason} placeholder="موضوع المقابلة باختصار"
                    onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {["أي وقت", "الفسحة", "بعد الحصة الأخيرة", "بداية اليوم الدراسي"].map((t) => (
              <button key={t} type="button" className={pill(preferred === t)} onClick={() => setPreferred(t)}>{t}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !reason.trim()} onClick={send}>إرسال</button>
            <button className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-mint-deep">{msg}</p>}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-sm2 border border-line px-3 py-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-ink">{r.reason}</span>
              {r.appointment_at && r.status === "scheduled" && <span className="num text-excused">{fmtDateTime(r.appointment_at)}</span>}
              <span className={`chip ${REQ_STATUS[r.status].c}`}>{REQ_STATUS[r.status].t}</span>
              {r.reply && <span className="w-full text-muted">{r.reply}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
