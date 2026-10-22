import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { supabase } from "../lib/supabase";
import { GRADE_NAMES, todayISO } from "../lib/schoolTime";
import { fmtDate, fmtDateTime } from "../lib/dates";
import { shrinkImage } from "../lib/imageResize.js";
import Loader from "../components/Loader.jsx";
import GuidanceThread, { GUIDANCE_VOICE } from "../components/GuidanceThread.jsx";
import { VoiceRecorder, uploadVoice } from "../components/Voice.jsx";
import PlanReport from "./guidance/PlanReport.jsx";

/* =====================================================================
   التوجيه الطلابي — بقية الصفحة (supabase/guidance_3.sql و guidance_4.sql):
   • الخطة والبرامج: برامج الصف بموعدها. يُنفَّذ البرنامج حدثًا في «الأحداث
     والمناسبات» أو يُربط بحدث نُفّذ (guidance_5.sql)، فيُعدّ منفَّذًا حين يُعتمد
     حدثه ومستفيدوه طلابه؛ أو يوثَّق تنفيذه يدويًا بالمستفيدين والأثر والصور.
   • طلبات المقابلة: من الطالب أو ولي أمره، يحدد الموجه موعدها أو يرد.
   • التقرير الشهري بغلافه ورسومه: guidance/MonthlyReport.jsx.
   ===================================================================== */

export const BUCKET = "guidance-files";
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
  replied: { t: "تم الرد", c: "bg-mint-tint text-mint-deep" },
  done: { t: "تمت المقابلة", c: "bg-present/10 text-present" },
  declined: { t: "اعتذر الموجه", c: "bg-canvas text-muted" },
};
// لون كل نوع برنامج: الشريط الجانبي وشارة النوع
const KIND_STYLE = {
  awareness: { border: "border-r-excused", chip: "bg-excused/10 text-excused" },
  preventive: { border: "border-r-present", chip: "bg-present/10 text-present" },
  developmental: { border: "border-r-late", chip: "bg-late/10 text-late" },
  remedial: { border: "border-r-absent", chip: "bg-absent/10 text-absent" },
};
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
const setupErr = (e, file) => (/guidance_|schema cache|relation/i.test(e?.message ?? "")
  ? `لم يُفعَّل هذا القسم بعد: يلزم تشغيل ملف supabase/${file}.` : e?.message);

// مراحل الحدث (pages/Events.jsx) بأسمائها المختصرة
const EV_STAGE = { draft: "بيانات الحدث", participants: "المشاركون", consent: "موافقة أولياء الأمور", permission: "الاستئذان",
  attendance: "كشف الحضور", certificates: "الشهادات", report: "التقرير", approved: "معتمد" };
const EV_SELECT = "*, school_events(id, serial, title, stage, event_date, cancelled_at, event_participants(count))";

/** البرامج مع أحداثها، وقبل تشغيل guidance_5.sql بلا أحداث */
export async function loadPrograms(grade) {
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
  const [view, setView] = useState("list");       // list | report (تقرير الخطة)
  const [kindF, setKindF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [thumbs, setThumbs] = useState({});        // مسار الصورة ← رابط موقّت للمصغّرة
  const navigate = useNavigate();
  const { session, profile, adminRoles } = useSession();

  const load = () => loadPrograms(grade)
    .then(({ data, error }) => { if (error) setErr(setupErr(error, "guidance_3.sql")); setRows(data ?? []); });
  useEffect(() => { load(); }, [grade]);   // eslint-disable-line react-hooks/exhaustive-deps

  // مصغّرات صور التنفيذ بطلب واحد
  useEffect(() => {
    const paths = (rows ?? []).flatMap((p) => (p.status === "done" ? p.photos ?? [] : []));
    if (!paths.length) return;
    supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
      .then(({ data }) => setThumbs(Object.fromEntries(paths.map((x, i) => [x, data?.[i]?.signedUrl ?? null]))));
  }, [rows]);

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

  // البرامج بحالها، والإحصاء، والتصفية
  const list = (rows ?? []).map((p) => ({ ...p, st: programState(p) }));
  const doneN = list.filter((p) => p.st.done).length;
  const benN = list.reduce((a, p) => a + (p.st.done ? Number(p.st.beneficiaries ?? 0) : 0), 0);
  const ratio = list.length ? Math.round((doneN / list.length) * 100) : 0;
  const shown = list.filter((p) => (kindF === "all" || p.kind === kindF)
    && (statusF === "all" || (statusF === "done" ? p.st.done : !p.st.done)));

  if (!rows) return <Loader />;
  if (view === "report") {
    return <PlanReport grade={grade} me={me} rows={list} bucket={BUCKET} PROGRAM_KIND={PROGRAM_KIND} EV_STAGE={EV_STAGE}
                       onBack={() => setView("list")} />;
  }
  return (
    <div className="space-y-4">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      {/* لوحة الخطة: الأرقام ونسبة التنفيذ */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-l from-mint-tint to-paper px-4 py-3">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="text-base font-bold text-ink">الخطة الإرشادية · {GRADE_NAMES[grade] ?? ""}</p>
            <p className="text-xs text-muted">برامج الصف بموعدها، وتوثيق تنفيذها بالمستفيدين والأثر والصور.</p>
          </div>
          <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setNf({ title: "", kind: "awareness", target: "", planned_date: "" })}>+ برنامج</button>
          {list.length > 0 && <button className="btn-ghost px-4 py-1.5 text-xs" onClick={() => setView("report")}>تقرير الخطة وطباعتها</button>}
        </div>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[["برامج الخطة", list.length, "text-ink"], ["نُفّذ", doneN, "text-present"],
            ["لم يُنفَّذ", list.length - doneN, "text-late"], ["المستفيدون", benN, "text-excused"]].map(([t, v, c]) => (
            <div key={t} className="bg-paper px-4 py-3 text-center">
              <p className={`num text-2xl font-bold ${c}`}>{v}</p>
              <p className="text-[11.5px] text-muted">{t}</p>
            </div>
          ))}
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>نسبة تنفيذ الخطة</span><span className="num font-bold text-mint-deep">{ratio}%</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-mint-deep transition-all" style={{ width: `${ratio}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button className={pill(kindF === "all")} onClick={() => setKindF("all")}>كل الأنواع</button>
            {Object.entries(PROGRAM_KIND).map(([k, t]) => {
              const c = list.filter((p) => p.kind === k).length;
              return c ? <button key={k} className={pill(kindF === k)} onClick={() => setKindF(k)}>{t} <span className="num">({c})</span></button> : null;
            })}
            <span className="mx-1 w-px self-stretch bg-line" />
            {[["all", "الكل"], ["done", "المنفّذة"], ["pending", "غير المنفّذة"]].map(([k, t]) => (
              <button key={k} className={pill(statusF === k)} onClick={() => setStatusF(k)}>{t}</button>
            ))}
          </div>
        </div>
      </section>

      {nf && (
        <section className="card space-y-3 p-4">
          <p className="font-semibold text-ink">برنامج جديد</p>
          <div>
            <p className="mb-1.5 text-xs text-muted">برامج جاهزة</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(([t, k]) => <button key={t} type="button" className={pill(nf.title === t)} onClick={() => setNf((x) => ({ ...x, title: t, kind: k }))}>{t}</button>)}
            </div>
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

      {list.length === 0 && !nf ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-3xl">🗂️</p>
          <p className="mt-2 text-sm font-semibold text-ink">لا برامج في خطة الصف بعد</p>
          <p className="mt-1 text-xs text-muted">أضف برامج الخطة من «+ برنامج»، ومنها برامج جاهزة بضغطة.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا برامج بهذه التصفية.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => { const st = p.st; const kc = KIND_STYLE[p.kind] ?? KIND_STYLE.awareness; return (
            <article key={p.id} className={`card overflow-hidden border-r-4 ${kc.border}`}>
              <div className="px-4 pb-3 pt-3.5">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`chip ${kc.chip}`}>{PROGRAM_KIND[p.kind]}</span>
                      {st.done ? <span className="chip bg-present/10 text-present">✓ نُفّذ</span>
                        : st.ev ? <span className="chip bg-excused/10 text-excused">الحدث: {EV_STAGE[st.ev.stage] ?? st.ev.stage}</span>
                        : <span className="chip bg-canvas text-muted">لم يُنفَّذ</span>}
                    </div>
                    <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-ink">{p.title}</h3>
                  </div>
                  <button className="text-xs text-faint hover:text-absent" title="حذف البرنامج" onClick={() => remove(p)}>حذف</button>
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {[["الفئة المستهدفة", p.target || "—"],
                    ["الموعد في الخطة", p.planned_date ? fmtDate(p.planned_date + "T00:00:00") : "—"],
                    ["تاريخ التنفيذ", st.date ? fmtDate(st.date + "T00:00:00") : "—"],
                    ["المستفيدون", st.beneficiaries ?? "—"]].map(([k, v]) => (
                    <div key={k} className="rounded-sm2 bg-canvas px-2.5 py-1.5">
                      <dt className="text-[10.5px] text-faint">{k}</dt>
                      <dd className="num break-words text-[12px] font-semibold leading-snug text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>

                {p.status === "done" && p.outcome && (
                  <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                    <span className="font-semibold text-mint-deep">الأثر والملاحظات: </span>{p.outcome}
                  </p>
                )}
                {p.status === "done" && p.photos?.length > 0 && (
                  <div className="mt-2.5 flex gap-2">
                    {p.photos.map((ph, i) => (
                      <button key={ph} onClick={() => openPhoto(ph)} title={`صورة ${i + 1}`}
                              className="h-20 w-28 overflow-hidden rounded-sm2 border border-line bg-canvas">
                        {thumbs[ph] ? <img src={thumbs[ph]} alt="" className="h-full w-full object-cover" />
                                    : <span className="text-xs text-muted">صورة {i + 1}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* الإجراءات */}
              {(st.ev || !st.done) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/50 px-4 py-2">
                  {st.ev ? (
                    <>
                      <button className="text-xs font-semibold text-mint-deep underline" onClick={() => navigate(`/events?open=${st.ev.id}`)}>
                        فتح الحدث <span className="num">{st.ev.serial}</span></button>
                      {!st.done && <button className="text-xs text-muted underline"
                              onClick={async () => { await supabase.from("guidance_programs").update({ event_id: null }).eq("id", p.id); load(); }}>إلغاء الربط</button>}
                    </>
                  ) : (
                    <>
                      <button className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white" disabled={busy}
                              onClick={() => runAsEvent(p)}>تنفيذه حدثًا</button>
                      <button className="rounded-pill border border-mint-deep bg-paper px-3 py-1 text-xs font-semibold text-mint-deep"
                              onClick={() => openLink(p)}>ربط بحدث نُفّذ</button>
                      <button className="rounded-pill border border-line bg-paper px-3 py-1 text-xs font-semibold text-muted"
                              onClick={() => setDoneFor({ p, done_date: todayISO(), beneficiaries: "", outcome: "", files: [] })}>توثيق يدوي</button>
                    </>
                  )}
                </div>
              )}

              {linkFor?.p.id === p.id && (
                <div className="space-y-1.5 border-t border-line bg-canvas p-3">
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
              {doneFor?.p.id === p.id && (
                <div className="space-y-2 border-t border-line bg-canvas p-3">
                  <p className="text-xs font-semibold text-ink">توثيق تنفيذ البرنامج</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-[11px] text-muted">تاريخ التنفيذ
                      <input type="date" className="field num mt-0.5" value={doneFor.done_date} onChange={(e) => setDoneFor((x) => ({ ...x, done_date: e.target.value }))} />
                    </label>
                    <label className="text-[11px] text-muted">عدد المستفيدين
                      <input className="field num mt-0.5" inputMode="numeric" value={doneFor.beneficiaries} placeholder="مثل: 30"
                             onChange={(e) => setDoneFor((x) => ({ ...x, beneficiaries: e.target.value.replace(/\D/g, "") }))} />
                    </label>
                  </div>
                  <textarea className="field w-full" rows={3} value={doneFor.outcome} placeholder="الأثر والملاحظات: نتائج القياس، وما تحقق من أهداف البرنامج…"
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
            </article>
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
  const [chat, setChat] = useState(null);   // الطلب المفتوحة محادثته

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
      <p className="text-xs text-muted">يطلب الطالب أو ولي أمره المقابلة من حسابه: حضورية بموعد، أو عن بعد بسؤال أو استفسار بلا موعد. فيصلك إشعار، وترد بموعد أو برسالة نصية أو صوتية.</p>
      {rows.length === 0 ? <p className="card px-4 py-6 text-center text-sm text-muted">لا طلبات.</p> : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{r.students?.full_name}
                    <span className="mr-1 text-xs font-normal text-muted">· {r.requester === "guardian" ? "ولي الأمر" : "الطالب"} · <span className="num">{fmtDate(r.created_at)}</span></span>
                    <span className={`chip mr-1 ${r.mode === "remote" ? "bg-excused/10 text-excused" : "bg-canvas text-muted"}`}>{r.mode === "remote" ? "عن بعد" : "حضورية"}</span></p>
                  <p className="mt-0.5 text-sm text-ink">{r.reason}</p>
                  {r.preferred && <p className="text-xs text-muted">الوقت المفضل: {r.preferred}</p>}
                  {r.appointment_at && <p className="text-xs text-excused">الموعد: <span className="num">{fmtDateTime(r.appointment_at)}</span></p>}
                  {r.reply && <p className="text-xs text-muted">الرد: {r.reply}</p>}
                </div>
                <span className={`chip ${(REQ_STATUS[r.status] ?? REQ_STATUS.new).c}`}>{(REQ_STATUS[r.status] ?? REQ_STATUS.new).t}</span>
                <button className="rounded-pill border border-mint-deep px-3 py-1 text-xs font-semibold text-mint-deep"
                        onClick={() => setChat(chat === r.id ? null : r.id)}>{chat === r.id ? "إخفاء المحادثة" : r.mode === "remote" ? "الرد والمحادثة" : "المحادثة"}</button>
                {r.status !== "done" && r.status !== "declined" && r.mode !== "remote" && (
                  <button className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white"
                          onClick={() => setEdit({ id: r.id, at: "", reply: r.reply ?? "" })}>
                    {r.status === "new" ? "تحديد الموعد" : "تعديل"}
                  </button>
                )}
                {(r.status === "scheduled" || (r.mode === "remote" && r.status !== "done" && r.status !== "declined")) && (
                  <button className="rounded-pill border border-present px-3 py-1 text-xs font-semibold text-present" disabled={busy}
                          onClick={() => save(r, "done")}>{r.mode === "remote" ? "إغلاق الطلب" : "تمت المقابلة"}</button>
                )}
              </div>
              {chat === r.id && <div className="mt-2"><GuidanceThread requestId={r.id} side="counselor" voice closed={r.status === "done" || r.status === "declined"} onSent={load} /></div>}
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

/* --------------------- طلب مقابلة من حساب الطالب أو ولي أمره --------------------- */
export function GuidanceRequestCard({ studentId, requester = "student" }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [preferred, setPreferred] = useState("");
  const [mode, setMode] = useState("inperson");
  const [rec, setRec] = useState(null);
  const [chat, setChat] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const voice = requester === "guardian";   // الرسائل الصوتية للموجه وولي الأمر

  const load = () => supabase.from("guidance_requests").select("id, reason, status, mode, appointment_at, reply, created_at")
    .eq("student_id", studentId).order("created_at", { ascending: false }).limit(3)
    .then(({ data, error }) => setRows(error ? null : data ?? []));
  useEffect(() => { if (studentId) load(); }, [studentId]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (rows === null) return null;   // قبل تشغيل ملف SQL لا تظهر البطاقة
  const send = async () => {
    setBusy(true); setMsg("");
    const row = { student_id: studentId, requester, reason: reason.trim() || "رسالة صوتية", preferred: mode === "remote" ? null : preferred || null };
    if (mode === "remote") row.mode = "remote";   // بلا العمود قبل تشغيل guidance_6.sql
    const { data, error } = await supabase.from("guidance_requests").insert(row).select("id").single();
    if (!error && rec) {
      try {
        const path = await uploadVoice(data.id, rec, GUIDANCE_VOICE);
        await supabase.from("guidance_messages").insert({ request_id: data.id, audio_path: path, audio_secs: rec.secs });
      } catch (e) { setMsg(`أُرسل الطلب، وتعذّر رفع الرسالة الصوتية: ${e.message}`); }
    }
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setOpen(false); setReason(""); setPreferred(""); setRec(null);
    setMsg(mode === "remote" ? "أُرسل سؤالك إلى الموجه الطلابي، وسيصلك إشعار برده." : "أُرسل طلبك إلى الموجه الطلابي، وسيصلك إشعار بالموعد.");
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
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={pill(mode === "inperson")} onClick={() => setMode("inperson")}>مقابلة حضورية بموعد</button>
            <button type="button" className={pill(mode === "remote")} onClick={() => setMode("remote")}>عن بعد: سؤال أو استفسار</button>
          </div>
          <textarea className="field w-full" rows={3} value={reason}
                    placeholder={mode === "remote" ? "اكتب سؤالك أو استفسارك للموجه" : "موضوع المقابلة باختصار"}
                    onChange={(e) => setReason(e.target.value)} />
          {mode === "inperson" ? (
            <div className="flex flex-wrap gap-1.5">
              {["أي وقت", "الفسحة", "بعد الحصة الأخيرة", "بداية اليوم الدراسي"].map((t) => (
                <button key={t} type="button" className={pill(preferred === t)} onClick={() => setPreferred(t)}>{t}</button>
              ))}
            </div>
          ) : <p className="text-[11px] text-faint">يرد الموجه برسالة نصية{voice ? " أو صوتية" : ""} دون موعد، وتتابع المحادثة من هنا.</p>}
          {voice && mode === "remote" && <VoiceRecorder onChange={setRec} disabled={busy} label="أو سجّل رسالة صوتية" />}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || (!reason.trim() && !rec)} onClick={send}>إرسال</button>
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
              {r.mode === "remote" && <span className="chip bg-excused/10 text-excused">عن بعد</span>}
              {r.appointment_at && r.status === "scheduled" && <span className="num text-excused">{fmtDateTime(r.appointment_at)}</span>}
              <span className={`chip ${(REQ_STATUS[r.status] ?? REQ_STATUS.new).c}`}>{(REQ_STATUS[r.status] ?? REQ_STATUS.new).t}</span>
              <button type="button" className="text-mint-deep underline" onClick={() => setChat(chat === r.id ? null : r.id)}>{chat === r.id ? "إخفاء" : "المحادثة"}</button>
              {r.reply && <span className="w-full text-muted">{r.reply}</span>}
              {chat === r.id && <div className="w-full pt-1"><GuidanceThread requestId={r.id} side="requester" voice={voice}
                closed={r.status === "done" || r.status === "declined"} onSent={load} /></div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
