// src/pages/Events.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { GRADE_NAMES, todayISO, PERIODS_PER_DAY } from "../lib/schoolTime";
import PrintPortal from "../components/PrintPortal.jsx";
import { printThen } from "../lib/print.js";
import EventReportSheet from "../components/EventReportSheet.jsx";
import { normalizeImage } from "../lib/imageResize.js";
import EventCertificate, {
  CERT_TEMPLATES, DEFAULT_CERT_TITLE, certPresets, isNationalDay, officialCert, readCert,
} from "../components/EventCertificate.jsx";
import GuestCertificate, { forTask } from "../components/GuestCertificate.jsx";
import { fmtDate, stripBidi } from "../lib/dates";
import Loader from "../components/Loader.jsx";
import { useNotice } from "../lib/useNotice.js";
import { loadPeriodTimes, toMinutes, fmtTime } from "../lib/periodTimes.js";
import { sendPush } from "../lib/pushSend.js";
import { countAr } from "../lib/arabicCount.js";

/* =====================================================================
   الأحداث والمناسبات — مسار متتابع، كل مرحلة تفتح التي بعدها.
   ① بيانات الحدث ② الطلاب المشاركون ③ موافقة ولي الأمر
   ④ الاستئذان ⑤ كشف الحضور ⑥ الشهادات ⑦ التقرير ⑧ الاعتماد
   ===================================================================== */

export const STAGES = [
  { key: "draft",        n: 1, label: "بيانات الحدث" },
  { key: "participants", n: 2, label: "الطلاب المشاركون" },
  { key: "consent",      n: 3, label: "موافقة أولياء الأمور" },
  { key: "permission",   n: 4, label: "الاستئذان" },
  { key: "attendance",   n: 5, label: "كشف الحضور" },
  { key: "certificates", n: 6, label: "الشهادات" },
  { key: "report",       n: 7, label: "التقرير" },
  { key: "approved",     n: 8, label: "الاعتماد" },
];

const stageIndex = (k) => Math.max(0, STAGES.findIndex((s) => s.key === k));

const fmtG = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export default function Events() {
  const { session, profile, adminRoles } = useSession();
  const uid = session?.user?.id;
  const roles = adminRoles ?? [];
  const isSupport = roles.includes("tech_support") || roles.includes("principal");

  const [list, setList] = useState(null);
  // ?open=<معرّف>&step=approval — من «الاعتماد والمتابعة»: يفتح الحدث على مرحلة الاعتماد
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState(params.get("open"));
  const openStep = params.get("step");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const load = async () => {
    const { data } = await supabase.from("school_events")
      .select("*").order("event_date", { ascending: false }).limit(100);
    setList(data ?? []);
  };

  useEffect(() => { load(); }, [uid]);

  const open = (list ?? []).find((e) => e.id === openId);

  if (open) {
    return (
      <EventWizard ev={open} uid={uid} profile={profile} isSupport={isSupport}
                   isPrincipal={roles.includes("principal")}
                   startAtApproval={openStep === "approval" && !!open.report_submitted_at}
                   onBack={() => { setOpenId(null); setParams({}, { replace: true }); load(); }}
                   onMsg={setMsg} msg={msg} />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">الأحداث والمناسبات</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            من إنشاء الحدث إلى اعتماده: الطلاب، وموافقة أوليائهم، والاستئذان،
            والحضور، والشهادات، والتقرير الموثّق.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setCreating((v) => !v)}>
          {creating ? "إغلاق" : "حدث جديد"}
        </button>
      </div>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {creating && (
        <NewEvent uid={uid} profile={profile} roles={roles}
                  onDone={(id, t) => { setCreating(false); setMsg(t); load(); setOpenId(id); }} />
      )}

      {!list && <Loader compact />}
      {list?.length === 0 && (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          لا أحداث بعد. ابدأ بـ«حدث جديد».
        </p>
      )}

      <div className="space-y-2">
        {(list ?? []).map((e) => {
          const i = stageIndex(e.stage);
          const done = e.stage === "approved";
          const cancelled = !!e.cancelled_at;
          return (
            <button key={e.id} onClick={() => setOpenId(e.id)}
                    className={`card block w-full p-4 text-right transition-colors hover:border-[#CCF2DB] ${
                      cancelled ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className={`min-w-0 flex-1 truncate text-sm font-bold text-ink ${cancelled ? "line-through" : ""}`}>
                  {e.title}
                </p>
                <span className={`chip shrink-0 ${
                  cancelled ? "bg-absent/10 text-absent"
                  : done ? "bg-present/10 text-present"
                  : e.report_submitted_at ? "bg-warning-light text-warning" : "bg-mint-tint text-mint-deep"}`}>
                  {cancelled ? "ملغى" : done ? "معتمد"
                    : e.report_submitted_at ? "بانتظار الاعتماد" : `المرحلة ${i + 1} من 8`}
                </span>
              </div>
              <p className="num mt-1 text-xs text-faint">
                {e.serial} · {fmtG(e.event_date)}
                {e.category ? ` · ${e.category}` : ""}
                {e.organizer_name ? ` · ${e.organizer_name}` : ""}
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-canvas">
                <div className={`h-full rounded-pill transition-all ${cancelled ? "bg-line" : "bg-mint-deep"}`}
                     style={{ width: `${((i + 1) / 8) * 100}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- حدث جديد --------------------------- */
function NewEvent({ uid, profile, roles, onDone }) {
  const [cats, setCats] = useState([]);
  const [f, setF] = useState({
    title: "", category: "", event_date: todayISO(),
    start_time: "", end_time: "", venue: "", description: "", goals: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings")
        .select("value").eq("key", "event_categories").maybeSingle();
      setCats((data?.value ?? "").split("|").filter(Boolean));
    })();
  }, []);

  const save = async () => {
    if (f.title.trim().length < 3 || !f.event_date) return;
    setBusy(true);
    const { data: serial } = await supabase.rpc("next_event_serial");
    const roleLabel = roles.length ? (ADMIN_ROLE_LABEL[roles[0]] ?? "") : "معلم";

    const { data, error } = await supabase.from("school_events").insert({
      serial,
      title: f.title.trim(),
      category: f.category || null,
      event_date: f.event_date,
      start_time: f.start_time || null,
      end_time: f.end_time || null,
      venue: f.venue.trim() || null,
      description: f.description.trim() || null,
      goals: f.goals.trim() || null,
      organizer_id: uid,
      organizer_name: profile?.full_name ?? "",
      organizer_role: roleLabel,
      cert_template: isNationalDay({ title: f.title, category: f.category }) ? "national" : "classic",
      stage: "participants",
    }).select("id").single();

    setBusy(false);
    if (error) { onDone(null, { ok: false, text: error.message }); return; }
    onDone(data.id, { ok: true, text: `أُنشئ الحدث ${serial}. انتقل لاختيار الطلاب.` });
  };

  return (
    <section className="card space-y-4 p-4">
      <h2 className="text-sm font-semibold text-ink">بيانات الحدث</h2>

      <div>
        <label className="text-xs text-muted">عنوان الحدث</label>
        <input className="field mt-1 w-full" value={f.title}
               placeholder="مثال: الاحتفاء باليوم الوطني ٩٦"
               onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} />
      </div>

      <div>
        <label className="text-xs text-muted">التصنيف</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setF((x) => ({ ...x, category: c }))}
              className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                f.category === c ? "bg-mint-deep text-white"
                                 : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted">تاريخ التنفيذ</label>
          <input type="date" className="field num mt-1 w-full" value={f.event_date}
                 onChange={(e) => setF((x) => ({ ...x, event_date: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted">من الساعة</label>
          <input type="time" className="field num mt-1 w-full" value={f.start_time}
                 onChange={(e) => setF((x) => ({ ...x, start_time: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted">إلى الساعة</label>
          <input type="time" className="field num mt-1 w-full" value={f.end_time}
                 onChange={(e) => setF((x) => ({ ...x, end_time: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">مكان التنفيذ</label>
        <input className="field mt-1 w-full" value={f.venue}
               placeholder="مثال: مسرح المدرسة"
               onChange={(e) => setF((x) => ({ ...x, venue: e.target.value }))} />
      </div>

      <div>
        <label className="text-xs text-muted">نبذة عن الحدث</label>
        <textarea rows={3} className="field mt-1 w-full" value={f.description}
                  onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} />
      </div>

      <div>
        <label className="text-xs text-muted">أهدافه</label>
        <textarea rows={2} className="field mt-1 w-full" value={f.goals}
                  onChange={(e) => setF((x) => ({ ...x, goals: e.target.value }))} />
      </div>

      <button className="btn-primary w-full" onClick={save}
              disabled={busy || f.title.trim().length < 3 || !f.event_date}>
        {busy ? "جارٍ الحفظ…" : "حفظ والانتقال لاختيار الطلاب"}
      </button>
    </section>
  );
}

/* --------------------------- مسار الحدث --------------------------- */
function EventWizard({ ev, uid, profile, isSupport, isPrincipal, startAtApproval, onBack, onMsg, msg }) {
  const [e, setE] = useState(ev);
  const [parts, setParts] = useState(null);
  const [step, setStep] = useState(startAtApproval ? 7 : stageIndex(ev.stage));

  const loadParts = async () => {
    const { data } = await supabase.from("event_participants")
      .select("*").eq("event_id", e.id).order("class_label").order("student_name");
    setParts(data ?? []);
  };

  useEffect(() => { loadParts(); }, [e.id]);

  const patch = async (fields, okText) => {
    const { error } = await supabase.from("school_events").update(fields).eq("id", e.id);
    if (error) { onMsg({ ok: false, text: error.message }); return false; }
    setE((x) => ({ ...x, ...fields }));
    if (okText) onMsg({ ok: true, text: okText });
    return true;
  };

  const advance = async (toKey, okText) => {
    if (stageIndex(toKey) > stageIndex(e.stage)) await patch({ stage: toKey }, okText);
    else if (okText) onMsg({ ok: true, text: okText });
    setStep(stageIndex(toKey));
  };

  const done = stageIndex(e.stage);
  const cancelled = !!e.cancelled_at;
  const [cancelling, setCancelling] = useState(false);

  // استعادة حدث أُلغي بالخطأ — يعود لمرحلته، والاستئذان المسحوب يُرفع من جديد يدويًا
  const restore = async () => {
    if (!window.confirm("استعادة الحدث وإعادته لمرحلته؟ الاستئذان المسحوب لا يعود تلقائيًا، فارفعه من جديد من مرحلة الاستئذان.")) return;
    await patch({ cancelled_at: null, cancel_reason: null, cancelled_by_name: null }, "استُعيد الحدث.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack}
                className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
          ← كل الأحداث
        </button>
        <div className="flex items-center gap-2">
          <span className="num text-xs text-faint">{e.serial}</span>
          {!cancelled && e.stage !== "approved" && (
            <button onClick={() => setCancelling((v) => !v)}
                    className="rounded-pill border border-absent/40 px-3.5 py-1.5 text-xs font-semibold text-absent transition-colors hover:bg-absent hover:text-white">
              {cancelling ? "تراجع" : "إلغاء الحدث"}
            </button>
          )}
        </div>
      </div>

      {cancelling && !cancelled && (
        <CancelEvent e={e} parts={parts} patch={patch} reload={loadParts} onMsg={onMsg}
                     byName={profile?.full_name ?? ""} onDone={() => setCancelling(false)} />
      )}

      {cancelled && (
        <section className="card space-y-2 border-absent/30 bg-absent/5 p-4">
          <p className="text-sm font-bold text-absent">أُلغي هذا الحدث</p>
          <p className="text-sm leading-relaxed text-ink">السبب: {e.cancel_reason || "—"}</p>
          <p className="num text-xs text-muted">
            {e.cancelled_by_name ? `${e.cancelled_by_name} · ` : ""}{fmtG(String(e.cancelled_at).slice(0, 10))}
          </p>
          <button onClick={restore}
                  className="rounded-pill border border-line bg-white px-3.5 py-1.5 text-xs text-muted hover:bg-canvas">
            استعادة الحدث
          </button>
        </section>
      )}

      <div>
        <h1 className="text-lg font-bold text-ink">{e.title}</h1>
        <p className="num mt-1 text-xs text-muted">
          {fmtG(e.event_date)}
          {e.venue ? ` · ${e.venue}` : ""}
          {e.category ? ` · ${e.category}` : ""}
        </p>
      </div>

      {/* شريط المراحل */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {STAGES.map((s, i) => {
          // مرحلة الاعتماد تُفتح حين يُرفع التقرير لمدير المدرسة
          const reached = i <= done || (i === 7 && !!e.report_submitted_at);
          const active = i === step;
          return (
            <button key={s.key} onClick={() => reached && setStep(i)} disabled={!reached}
              className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                active ? "bg-mint-deep text-white"
                : reached ? "border border-[#CCF2DB] bg-mint-tint text-mint-deep"
                : "border border-line bg-white text-faint"}`}>
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                active ? "bg-white/25" : reached ? "bg-white" : "bg-canvas"}`}>
                {i < done ? "✓" : s.n}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {/* الحدث الملغى يُعرض ببياناته فقط، بلا إجراءات */}
      {!cancelled && step === 0 && <StageInfo key={e.id} e={e} parts={parts} patch={patch}
                                onNext={() => advance("participants")} />}
      {!cancelled && step === 1 && <StageParticipants e={e} parts={parts} reload={loadParts}
                                        onNext={() => advance("consent", "انتقلنا لإرسال الموافقات.")} />}
      {!cancelled && step === 2 && <StageConsent e={e} parts={parts} reload={loadParts}
                                   uid={uid} organizerName={profile?.full_name ?? ""}
                                   onNext={() => advance("permission", "انتقلنا للاستئذان.")} />}
      {!cancelled && step === 3 && <StagePermission e={e} parts={parts} uid={uid} reload={loadParts}
                                      onNext={() => advance("attendance", "انتقلنا لكشف الحضور.")} />}
      {!cancelled && step === 4 && <StageAttendance e={e} parts={parts} reload={loadParts}
                                      onNext={() => advance("certificates", "انتقلنا للشهادات.")} />}
      {!cancelled && step === 5 && <StageCertificates e={e} parts={parts} patch={patch} isSupport={isSupport}
                                        onNext={() => advance("report", "انتقلنا للتقرير.")} />}
      {!cancelled && step === 6 && <StageReport e={e} parts={parts} patch={patch} onMsg={onMsg}
                                                onSubmitted={() => setStep(7)} />}
      {!cancelled && step === 7 && <StageApproval e={e} patch={patch} onMsg={onMsg} isPrincipal={isPrincipal}
                                                  byName={profile?.full_name ?? ""} goReport={() => setStep(6)} />}
    </div>
  );
}

/* إلغاء الحدث — حين يتعذّر إكماله لأي ظرف. لا يُحذف: يبقى موثّقًا بسببه ومن ألغاه،
   ويُسحب استئذان المشاركين إن لم يمضِ يومه، ويُشعَر أولياء الأمور إن رغب المنظّم. */
function CancelEvent({ e, parts, patch, reload, onMsg, byName, onDone }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const permIds = [...new Set((parts ?? []).map((p) => p.permission_id).filter(Boolean))];
  const upcoming = e.event_date >= todayISO();               // الاستئذان لم يمضِ يومه
  const guardians = (parts ?? []).filter((p) => p.consent_doc_id);

  const run = async () => {
    if (reason.trim().length < 3) return;
    if (!window.confirm(`إلغاء «${e.title}»؟`)) return;
    setBusy(true);
    const ok = await patch({
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason.trim(),
      cancelled_by_name: byName || null,
    });
    if (!ok) {
      onMsg({ ok: false, text: "تعذّر الإلغاء — نفّذ ملف supabase/events_cancel.sql في قاعدة البيانات مرة واحدة." });
      setBusy(false);
      return;
    }

    const notes = ["أُلغي الحدث."];

    if (upcoming && permIds.length) {
      const { error } = await supabase.from("permission_requests").delete().in("id", permIds);
      if (error) notes.push(`تعذّر سحب الاستئذان: ${error.message}`);
      else {
        await supabase.from("event_participants").update({ permission_id: null }).eq("event_id", e.id);
        notes.push("سُحب استئذان المشاركين.");
      }
    }

    if (notify && guardians.length) {
      let n = 0;
      for (const p of guardians) {
        const { data: doc } = await supabase.from("form_documents")
          .select("recipient_user_id").eq("id", p.consent_doc_id).maybeSingle();
        if (!doc?.recipient_user_id) continue;
        const { data: nid } = await supabase.rpc("send_notification", {
          p_title: "إلغاء فعالية",
          p_body: `نعتذر عن إلغاء «${e.title}» المقرر ${fmtG(e.event_date)}، ` +
                  `فلا حاجة لمشاركة ${p.student_name} فيها. السبب: ${reason.trim()}`,
          p_kind: "general", p_link: null,
          p_roles: null, p_user_ids: [doc.recipient_user_id],
          p_grade: null, p_class_no: null, p_is_auto: false,
        });
        if (nid) {
          n++;
          try {
            await sendPush(nid);
          } catch { /* الإشعار في الجرس وصل */ }
        }
      }
      notes.push(`أُشعر ${n} من أولياء الأمور.`);
    }

    await reload();
    setBusy(false);
    onMsg({ ok: true, text: notes.join(" ") });
    onDone();
  };

  return (
    <section className="card space-y-3 border-absent/30 p-4">
      <div>
        <p className="text-sm font-semibold text-absent">إلغاء الحدث</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          يبقى الحدث موثّقًا في القائمة والتقارير بحالة «ملغى» وسببه، ولا يدخل في الإجماليات.
        </p>
      </div>
      <div>
        <label className="text-xs text-muted">سبب الإلغاء</label>
        <textarea rows={2} className="field mt-1 w-full" value={reason}
                  placeholder="مثال: تعليق الدراسة بسبب الأحوال الجوية"
                  onChange={(x) => setReason(x.target.value)} />
      </div>
      {permIds.length > 0 && (
        <p className="rounded-sm2 bg-gray-tint px-3 py-2 text-xs text-muted">
          {upcoming
            ? "سيُسحب استئذان الطلاب المشاركين، فيعودون للتحضير المعتاد يوم الحدث."
            : "يوم الحدث مضى، فيبقى الاستئذان المرفوع كما هو في سجلات الحضور."}
        </p>
      )}
      {guardians.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={notify} onChange={(x) => setNotify(x.target.checked)} />
          إشعار أولياء الأمور الذين وصلتهم الموافقة (<span className="num">{guardians.length}</span>)
        </label>
      )}
      <button onClick={run} disabled={busy || reason.trim().length < 3}
              className="w-full rounded-pill bg-absent py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "جارٍ الإلغاء…" : "تأكيد إلغاء الحدث"}
      </button>
    </section>
  );
}

/* ① بيانات الحدث — تُعدَّل كلها في أي مرحلة: العنوان والتصنيف والتاريخ والوقت والمكان
   والنبذة والأهداف. وإن تغيّر الموعد بعد إرسال الموافقات أو رفع الاستئذان نُنبّه
   المنظّم، فهي صدرت بالموعد القديم. */
function StageInfo({ e, parts, patch, onNext }) {
  const [cats, setCats] = useState([]);
  const init = () => ({
    title: e.title ?? "", category: e.category ?? "", event_date: e.event_date ?? "",
    description: e.description ?? "", goals: e.goals ?? "", venue: e.venue ?? "",
    start_time: String(e.start_time ?? "").slice(0, 5), end_time: String(e.end_time ?? "").slice(0, 5),
  });
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings")
        .select("value").eq("key", "event_categories").maybeSingle();
      setCats((data?.value ?? "").split("|").filter(Boolean));
    })();
  }, []);

  // الحدث المرفوع للاعتماد أو المعتمد يبقى قابلًا للتعديل، مع تنبيه
  const submitted = e.stage === "approved" || !!e.report_submitted_at;
  const sentConsents = (parts ?? []).filter((p) => p.consent_sent_at).length;
  const raised = (parts ?? []).some((p) => p.permission_id);
  const was = init();
  const timingChanged = f.event_date !== was.event_date || f.start_time !== was.start_time || f.end_time !== was.end_time;
  const changed = JSON.stringify(f) !== JSON.stringify(was);
  const badTime = !!(f.start_time && f.end_time && f.start_time >= f.end_time);
  const valid = f.title.trim().length >= 3 && !!f.event_date && !badTime;

  const save = async (next) => {
    if (!valid) return;
    if (!changed) { if (next) onNext(); return; }
    if (timingChanged && (sentConsents || raised)) {
      const lines = [
        "غيّرت موعد الحدث بعد أن:",
        sentConsents ? `• أُرسلت موافقات ${sentConsents} من أولياء الأمور بالموعد السابق.` : null,
        raised ? "• رُفع الاستئذان بالموعد السابق." : null,
        "",
        raised ? "بعد الحفظ أعد رفع الاستئذان من مرحلة «الاستئذان» بالموعد الجديد." : null,
        sentConsents ? "ويُستحسن إبلاغ أولياء الأمور بالموعد الجديد." : null,
        "",
        "هل تحفظ الموعد الجديد؟",
      ].filter((x) => x !== null);
      if (!window.confirm(lines.join("\n"))) return;
    }
    setBusy(true);
    const ok = await patch({
      title: f.title.trim(),
      category: f.category || null,
      event_date: f.event_date,
      start_time: f.start_time || null,
      end_time: f.end_time || null,
      venue: f.venue.trim() || null,
      description: f.description.trim() || null,
      goals: f.goals.trim() || null,
    }, "حُفظت بيانات الحدث.");
    setBusy(false);
    if (ok && next) onNext();
  };

  return (
    <section className="card space-y-4 p-4">
      {submitted && (
        <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
          {e.stage === "approved"
            ? "الحدث معتمد. أي تعديل هنا يظهر في تقريره وشهاداته المطبوعة لاحقًا."
            : "التقرير مرفوع لمدير المدرسة. أي تعديل هنا يظهر له عند مراجعته."}
        </p>
      )}
      <div>
        <label className="text-xs text-muted">عنوان الحدث</label>
        <input className="field mt-1 w-full" value={f.title}
               onChange={(x) => setF((v) => ({ ...v, title: x.target.value }))} />
      </div>

      {cats.length > 0 && (
        <div>
          <label className="text-xs text-muted">التصنيف</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} type="button" onClick={() => setF((v) => ({ ...v, category: c }))}
                className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  f.category === c ? "bg-mint-deep text-white"
                                   : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted">تاريخ التنفيذ</label>
          <input type="date" className="field num mt-1 w-full" value={f.event_date}
                 onChange={(x) => setF((v) => ({ ...v, event_date: x.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted">من الساعة</label>
          <input type="time" className="field num mt-1 w-full" value={f.start_time}
                 onChange={(x) => setF((v) => ({ ...v, start_time: x.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted">إلى الساعة</label>
          <input type="time" className="field num mt-1 w-full" value={f.end_time}
                 onChange={(x) => setF((v) => ({ ...v, end_time: x.target.value }))} />
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-faint">من وقت الحدث تُحسب حصص الاستئذان، ويعود الطلاب لفصولهم تلقائيًا بعده.</p>
      {badTime && <p className="-mt-2 text-xs text-absent">وقت النهاية يجب أن يكون بعد وقت البداية.</p>}

      {timingChanged && (sentConsents > 0 || raised) && (
        <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
          تنبيه: {sentConsents > 0 && <>أُرسلت موافقات <span className="num">{sentConsents}</span> من أولياء الأمور</>}
          {sentConsents > 0 && raised && " و"}
          {raised && "رُفع الاستئذان"} بالموعد السابق.
          {raised && " أعد رفع الاستئذان بعد الحفظ."}
        </p>
      )}

      <div>
        <label className="text-xs text-muted">مكان التنفيذ</label>
        <input className="field mt-1 w-full" value={f.venue}
               onChange={(x) => setF((v) => ({ ...v, venue: x.target.value }))} />
      </div>
      <div>
        <label className="text-xs text-muted">نبذة عن الحدث</label>
        <textarea rows={3} className="field mt-1 w-full" value={f.description}
                  onChange={(x) => setF((v) => ({ ...v, description: x.target.value }))} />
      </div>
      <div>
        <label className="text-xs text-muted">أهدافه</label>
        <textarea rows={2} className="field mt-1 w-full" value={f.goals}
                  onChange={(x) => setF((v) => ({ ...v, goals: x.target.value }))} />
      </div>
      <p className="text-[11px] text-faint">عنوان الشهادة وقالبها ونصّها تُضبط في مرحلة «الشهادات».</p>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary flex-1" disabled={busy || !valid} onClick={() => save(true)}>
          {busy ? "جارٍ الحفظ…" : changed ? "حفظ التعديلات والمتابعة" : "المتابعة"}
        </button>
        {changed && (
          <button className="rounded-pill border border-line px-4 py-2 text-sm text-mint-deep hover:bg-canvas disabled:opacity-50"
                  disabled={busy || !valid} onClick={() => save(false)}>
            حفظ فقط
          </button>
        )}
      </div>
    </section>
  );
}

/* ② اختيار الطلاب */
function StageParticipants({ e, parts, reload, onNext }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("value").eq("key", "active_year").maybeSingle();
      const { data } = await supabase.from("classes")
        .select("id, class_no, grade").eq("academic_year", st?.value ?? "")
        .order("grade").order("class_no");
      setClasses(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    (async () => {
      const { data } = await supabase.from("student_enrollment")
        .select("students(id, full_name)").eq("class_id", classId).eq("status", "active");
      setStudents((data ?? []).map((x) => x.students).filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
    })();
  }, [classId]);

  const chosen = useMemo(() => new Set((parts ?? []).map((p) => p.student_id)), [parts]);

  const toggle = async (s) => {
    setBusy(true);
    if (chosen.has(s.id)) {
      await supabase.from("event_participants").delete()
        .eq("event_id", e.id).eq("student_id", s.id);
    } else {
      const c = classes.find((x) => x.id === classId);
      await supabase.from("event_participants").insert({
        event_id: e.id, student_id: s.id, student_name: s.full_name,
        class_label: `${GRADE_NAMES[c?.grade] ?? ""} — فصل ${c?.class_no ?? ""}`.trim(),
      });
    }
    await reload();
    setBusy(false);
  };

  const shown = q.trim()
    ? students.filter((s) => s.full_name.includes(q.trim()))
    : students;

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <p className="text-sm font-semibold text-ink">اختيار الطلاب المشاركين</p>
        <p className="mt-0.5 text-xs text-muted">الاختيار مفتوح لكل طلاب المدرسة.</p>

        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((g) => (
            <div key={g}>
              <p className="text-[11px] font-medium text-faint">{GRADE_NAMES[g]}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {classes.filter((c) => c.grade === g).map((c) => (
                  <button key={c.id} onClick={() => setClassId(c.id)}
                    className={`rounded-pill px-3 py-1 text-[12.5px] font-medium transition-colors ${
                      classId === c.id ? "bg-mint-deep text-white"
                                       : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                    فصل {c.class_no}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {classId && (
        <section className="card p-4">
          <input className="field w-full" type="search" value={q} placeholder="ابحث باسم الطالب"
                 onChange={(x) => setQ(x.target.value)} />
          <div className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-sm2 border border-line">
            {shown.map((s) => (
              <label key={s.id}
                     className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-mint-tint">
                <input type="checkbox" checked={chosen.has(s.id)} disabled={busy}
                       onChange={() => toggle(s)} />
                <span className="flex-1">{s.full_name}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="px-3 py-4 text-sm text-muted">لا طلاب.</p>}
          </div>
        </section>
      )}

      <section className="card p-4">
        <p className="text-sm font-semibold text-ink">
          المختارون: <span className="num text-mint-deep">{parts?.length ?? 0}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(parts ?? []).map((p) => (
            <span key={p.id} className="chip bg-mint-tint text-mint-deep">
              {p.student_name}
            </span>
          ))}
        </div>
        <button className="btn-primary mt-4 w-full" disabled={(parts?.length ?? 0) === 0}
                onClick={onNext}>
          المتابعة لإرسال موافقات أولياء الأمور
        </button>
      </section>
    </div>
  );
}

// السنة الهجرية الحالية — كما في مكتبة النماذج
const hijriYear = () => {
  try {
    const s = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).format(new Date());
    return parseInt(String(s).replace(/\D/g, ""), 10);
  } catch { return new Date().getFullYear() - 579; }
};

/* ③ موافقة أولياء الأمور — عبر نظام النماذج */
function StageConsent({ e, parts, reload, onNext, uid, organizerName }) {
  const [busy, setBusy] = useState(false);
  const [tpl, setTpl] = useState(null);
  const [note, setNote] = useNotice(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("form_templates")
        .select("id, title, fields").eq("key", "frm_activity_consent").maybeSingle();
      setTpl(data ?? null);
    })();
  }, []);

  // يصدر مستند موافقة لكل طالب لم يصله، ويُرسله لولي أمره
  const issueAll = async () => {
    if (!tpl) { setNote({ ok: false, text: "نموذج الموافقة غير مفعّل. راجع مكتبة النماذج." }); return; }
    setBusy(true);
    let sent = 0, noGuardian = 0, failed = 0, lastError = "";

    // أولياء الأمور بحسابات — عبر دالة الخادم لأن المنظّم لا يقرأ جداولهم مباشرة
    const { data: gs, error: gErr } = await supabase.rpc("ev_participant_guardians", { p_event: e.id });
    if (gErr) {
      setBusy(false);
      setNote({ ok: false, text: `تعذّرت قراءة أولياء الأمور: ${gErr.message}` });
      return;
    }
    const guardianOf = new Map();
    (gs ?? []).forEach((x) => { if (!guardianOf.has(x.student_id)) guardianOf.set(x.student_id, x); });

    for (const p of (parts ?? []).filter((x) => !x.consent_doc_id)) {
      // ولي الأمر المستلم
      const g = guardianOf.get(p.student_id);
      if (!g) { noGuardian++; continue; }

      const year = hijriYear();
      const { data: serial, error: se } = await supabase
        .rpc("next_form_serial", { p_category: "administrative", p_hijri_year: year });
      if (se) { failed++; lastError = se.message; continue; }

      // الحقول نفسها التي تُرسلها مكتبة النماذج — created_by شرط في قاعدة الإدراج
      const { data: doc, error } = await supabase.from("form_documents").insert({
        template_id: tpl.id,
        serial,
        title: tpl.title,
        recipient: p.student_name,
        student_id: p.student_id,
        recipient_user_id: g.user_id,
        status: "awaiting_reply",
        hijri_year: year,
        created_by: uid,
        data: {
          recipient: p.student_name,
          class_label: p.class_label,
          guardian_name: g.full_name ?? "",
          event_title: e.title,
          event_date: e.event_date,
          event_venue: e.venue ?? "",
          event_time: [e.start_time, e.end_time].filter(Boolean).join(" — "),
        },
      }).select("id").single();

      if (error || !doc) { failed++; lastError = error?.message ?? ""; continue; }

      await supabase.from("event_participants")
        .update({ consent_doc_id: doc.id, consent_sent_at: new Date().toISOString() })
        .eq("id", p.id);

      const { data: nid } = await supabase.rpc("send_notification", {
        p_title: "موافقة على مشاركة في فعالية",
        p_body: `صدر لك نموذج موافقة على مشاركة ${p.student_name} في «${e.title}»` +
                ` يوم ${fmtG(e.event_date)}. افتحه للموافقة والتوقيع.`,
        p_kind: "general", p_link: `/doc/${doc.id}`,
        p_roles: null, p_user_ids: [g.user_id], p_grade: null, p_class_no: null, p_is_auto: false,
      });
      if (nid) {
        try {
          await sendPush(nid);
        } catch { /* الإشعار في البوابة وصل */ }
      }
      sent++;
    }

    await reload();
    setBusy(false);
    const why = [
      noGuardian ? `${noGuardian} لعدم وجود حساب ولي أمر` : "",
      failed ? `${failed} لخطأ في إنشاء المستند${lastError ? ` (${lastError})` : ""}` : "",
    ].filter(Boolean).join("، و");
    setNote({
      ok: sent > 0,
      text: sent > 0
        ? `صدرت ${sent} موافقة وأُرسلت لأولياء الأمور.` + (why ? ` وتعذّر إرسال ${why}.` : "")
        : `تعذّر الإصدار: ${why || "لا طلاب بانتظار الموافقة"}.`,
    });
  };

  // تذكير من تأخّر عن الرد
  const remind = async () => {
    setBusy(true);
    const late = (parts ?? []).filter((p) => p.consent_doc_id && !p.consent_at);
    let n = 0;
    for (const p of late) {
      const { data: doc } = await supabase.from("form_documents")
        .select("recipient_user_id").eq("id", p.consent_doc_id).maybeSingle();
      if (!doc?.recipient_user_id) continue;
      const { data: nid } = await supabase.rpc("send_notification", {
        p_title: "تذكير: موافقة على مشاركة في فعالية",
        p_body: `ما زال نموذج موافقة ${p.student_name} على المشاركة في «${e.title}»` +
                ` بانتظار ردّك. افتحه من البوابة.`,
        p_kind: "general", p_link: `/doc/${p.consent_doc_id}`,
        p_roles: null, p_user_ids: [doc.recipient_user_id],
        p_grade: null, p_class_no: null, p_is_auto: false,
      });
      if (nid) {
        try {
          await sendPush(nid);
        } catch { /* الإشعار في البوابة وصل */ }
      }
      await supabase.from("event_participants")
        .update({ reminded_at: new Date().toISOString() }).eq("id", p.id);
      n++;
    }
    await reload();
    setBusy(false);
    setNote({ ok: n > 0, text: n > 0 ? `ذُكّر ${n} من أولياء الأمور.` : "لا أحد بانتظار الرد." });
  };

  // تسجيل الموافقة يدويًا — باسم المنظّم لا باسم ولي الأمر
  const [manual, setManual] = useState(null);   // المشارك قيد التسجيل
  const saveManual = async (photoOk) => {
    if (!manual) return;
    setBusy(true);
    const stamp = new Date().toISOString();
    await supabase.from("event_participants").update({
      consent_at: stamp,
      consent_photo: photoOk,
      consent_manual: true,
      consent_by: uid,
      consent_by_name: organizerName,
      consent_note: `سُجّلت الموافقة من ${organizerName} بناءً على موافقة شفهية من ولي الأمر.`,
    }).eq("id", manual.id);

    // يُوثَّق ذلك في المستند نفسه إن وُجد
    if (manual.consent_doc_id) {
      const { data: doc } = await supabase.from("form_documents")
        .select("data").eq("id", manual.consent_doc_id).maybeSingle();
      await supabase.from("form_documents").update({
        status: "replied",
        reply_at: stamp,
        reply_signature_path: null,
        reply_signature_name: `${organizerName} — تسجيل يدوي`,
        data: {
          ...(doc?.data ?? {}),
          consent: `سُجّلت الموافقة من ${organizerName} بناءً على موافقة شفهية من ولي الأمر.`,
          photo_consent: photoOk
            ? "أوافق على تصوير ابني ونشر الصور في القنوات الرسمية للمدرسة."
            : "لا أوافق على التصوير أو النشر.",
        },
      }).eq("id", manual.consent_doc_id);
    }

    setManual(null);
    await reload();
    setBusy(false);
    setNote({ ok: true, text: "سُجّلت الموافقة يدويًا وموثّقة باسمك." });
  };

  const sent = (parts ?? []).filter((p) => p.consent_doc_id).length;
  const ok = (parts ?? []).filter((p) => p.consent_at).length;
  const photo = (parts ?? []).filter((p) => p.consent_photo).length;
  const late = (parts ?? []).filter((p) => p.consent_doc_id && !p.consent_at).length;

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <p className="text-sm font-semibold text-ink">موافقة أولياء الأمور</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          يصدر لكل طالب مستند موافقة رسمي مرقّم من مكتبة النماذج، يصل ولي أمره
          فيقرّ بالموافقة وبالتصوير ويوقّع إلكترونيًا، ثم يُحفظ في الأرشيف.
        </p>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[["المرشّحون", parts?.length ?? 0, "text-ink"],
            ["صدرت لهم", sent, "text-mint-deep"],
            ["وافقوا", ok, "text-present"],
            ["وافق على التصوير", photo, "text-present"]].map(([t, v, c]) => (
            <div key={t} className="rounded-sm2 border border-line py-3">
              <p className={`num text-lg font-bold ${c}`}>{v}</p>
              <p className="mt-0.5 text-[10.5px] leading-tight text-muted">{t}</p>
            </div>
          ))}
        </div>

        {note && (
          <p className={`mt-3 rounded-sm2 px-3 py-2 text-sm ${
            note.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {note.text}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary flex-1" onClick={issueAll}
                  disabled={busy || sent === (parts?.length ?? 0)}>
            {busy ? "جارٍ الإصدار…"
              : sent === (parts?.length ?? 0) && sent > 0 ? "صدرت لجميع المشاركين"
              : `إصدار الموافقات وإرسالها (${(parts?.length ?? 0) - sent})`}
          </button>
          {late > 0 && (
            <button onClick={remind} disabled={busy}
                    className="flex-1 rounded-pill border border-mint-deep px-4 py-2 text-sm font-semibold text-mint-deep hover:bg-mint-tint">
              تذكير من تأخّر ({late})
            </button>
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="divide-y divide-line">
          {(parts ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{p.student_name}</p>
                <p className="truncate text-xs text-faint">{p.class_label}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.consent_at && p.consent_photo === false && (
                  <span className="chip bg-warning/10 text-warning">لا تصوير</span>
                )}
                {p.consent_manual && (
                  <span className="chip bg-[#F0E3C4] text-[#7E6318]">تسجيل يدوي</span>
                )}
                <span className={`chip ${
                  p.consent_at ? "bg-present/10 text-present"
                  : p.consent_doc_id ? "bg-warning/10 text-warning"
                  : "bg-canvas text-muted"}`}>
                  {p.consent_at ? "موافق" : p.consent_doc_id ? "بانتظار الرد" : "لم تصدر"}
                </span>
                {p.consent_doc_id && !p.consent_at && (
                  <button onClick={() => setManual(p)}
                          className="text-xs font-medium text-warning hover:underline">
                    تسجيل يدوي
                  </button>
                )}
                {p.consent_doc_id && (
                  <a href={`/doc/${p.consent_doc_id}`} target="_blank" rel="noreferrer"
                     className="text-xs font-medium text-mint-deep hover:underline">
                    المستند
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {manual && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-card bg-white p-5">
            <p className="text-sm font-bold text-ink">تسجيل موافقة {manual.student_name}</p>
            <p className="mt-2 rounded-sm2 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">
              ستُسجَّل الموافقة <b>باسمك أنت</b> لا باسم ولي الأمر، ويُكتب في المستند
              أنها سُجّلت بناءً على موافقة شفهية. لا تسجّلها ما لم تتأكّد منها.
            </p>
            <p className="mt-3 text-xs text-muted">هل وافق ولي الأمر على التصوير والنشر؟</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary flex-1" disabled={busy}
                      onClick={() => saveManual(true)}>
                وافق على المشاركة والتصوير
              </button>
              <button disabled={busy} onClick={() => saveManual(false)}
                      className="flex-1 rounded-pill border border-warning/40 px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/5">
                المشاركة فقط بلا تصوير
              </button>
            </div>
            <button onClick={() => setManual(null)}
                    className="mt-3 w-full rounded-pill border border-line py-2 text-sm text-muted">
              إلغاء
            </button>
          </div>
        </div>
      )}

      <button className="btn-primary w-full" onClick={onNext} disabled={ok === 0}>
        المتابعة للاستئذان
      </button>
    </div>
  );
}

/* ④ الاستئذان */
// حصص يوم الحدث: الأحد والاثنين ٧، وبقية الأيام ٦
const periodsOn = (d) => {
  const n = PERIODS_PER_DAY[new Date(d + "T00:00:00").getDay() + 1] ?? 7;
  return Array.from({ length: n }, (_, i) => i + 1);
};

function StagePermission({ e, parts, uid, reload, onNext }) {
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useNotice(null);
  const hasTime = !!(e.start_time && e.end_time);
  const [scope, setScope] = useState(hasTime ? "auto" : "day"); // auto | day | periods
  const [ptimes, setPtimes] = useState([]);
  const [picked, setPicked] = useState(new Set());      // الحصص المختارة
  const [req, setReq] = useState(null);                 // الاستئذان المرفوع { scope, period_numbers }
  const [returns, setReturns] = useState([]);           // عودات الطلاب يوم الحدث
  const [backFrom, setBackFrom] = useState(null);       // حصة العودة المختارة

  const approved = (parts ?? []).filter((p) => p.consent_at);
  const raised = approved.filter((p) => p.permission_id);
  const allRaised = approved.length > 0 && raised.length === approved.length;
  const periods = periodsOn(e.event_date);
  const reqId = raised[0]?.permission_id ?? null;

  useEffect(() => { loadPeriodTimes().then(({ rows }) => setPtimes(rows)); }, []);

  // الحصص التي يتقاطع وقتها مع وقت الحدث — بعدها يعود الطلاب لفصولهم تلقائيًا
  const autoPeriods = useMemo(() => {
    if (!hasTime) return [];
    const s = toMinutes(e.start_time), en = toMinutes(e.end_time);
    return ptimes
      .filter((r) => r.kind === "period" && periods.includes(r.period_no)
        && toMinutes(r.start_time) < en && toMinutes(r.end_time) > s)
      .map((r) => r.period_no)
      .sort((a, b) => a - b);
  }, [ptimes, hasTime, e.start_time, e.end_time, periods.length]);
  const autoBack = autoPeriods.length
    ? periods.find((n) => n > autoPeriods[autoPeriods.length - 1]) ?? null
    : null;
  const chosen = scope === "auto" ? autoPeriods : [...picked].sort((a, b) => a - b);

  // الاستئذان المرفوع وعودات طلابه
  const loadState = async () => {
    if (!reqId) { setReq(null); setReturns([]); return; }
    const ids = raised.map((p) => p.student_id);
    const [{ data: r }, { data: rets }] = await Promise.all([
      supabase.from("permission_requests").select("scope, period_numbers").eq("id", reqId).maybeSingle(),
      supabase.from("permission_returns").select("student_id, from_period")
        .eq("return_date", e.event_date).in("student_id", ids),
    ]);
    setReq(r ?? null);
    setReturns(rets ?? []);
  };
  useEffect(() => { loadState(); }, [reqId, parts]);

  const togglePeriod = (n) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const raise = async () => {
    if (scope !== "day" && !chosen.length) return;
    setBusy(true);
    const { data: newReq, error } = await supabase.from("permission_requests").insert({
      request_date: e.event_date,
      scope: scope === "day" ? "day" : "periods",
      period_numbers: scope === "day" ? null : chosen,
      note: `مشاركة في «${e.title}»`,
      created_by: uid,
    }).select("id").single();

    if (error) { setDoneMsg({ ok: false, text: error.message }); setBusy(false); return; }

    const rows = approved.map((p) => ({ request_id: newReq.id, student_id: p.student_id }));
    const { error: e2 } = await supabase.from("permission_request_students").insert(rows);
    if (e2) { setBusy(false); setDoneMsg({ ok: false, text: e2.message }); return; }

    await supabase.from("event_participants")
      .update({ permission_id: newReq.id }).in("id", approved.map((p) => p.id));
    setBusy(false);
    setDoneMsg({ ok: true, text: `رُفع الاستئذان لـ ${countAr(rows.length, "student", { acc: true })}، ويظهر عند معلميهم.` });
    await reload?.();
  };

  // عودة الطلاب للفصل: ينتهي استئذانهم من الحصة المختارة فما بعدها
  const markReturn = async () => {
    if (!backFrom) return;
    setBusy(true);
    const { error } = await supabase.from("permission_returns").upsert(
      raised.map((p) => ({
        student_id: p.student_id, return_date: e.event_date,
        from_period: backFrom, returned_by: uid,
      })),
      { onConflict: "student_id,return_date" },
    );
    setBusy(false);
    if (error) { setDoneMsg({ ok: false, text: "تعذّر تسجيل العودة: " + error.message }); return; }
    setDoneMsg({ ok: true, text: `سُجّلت عودة الطلاب للفصل من الحصة ${backFrom}، فيُحضَّرون عادةً من هذه الحصة.` });
    setBackFrom(null);
    await loadState();
  };

  const undoReturn = async () => {
    setBusy(true);
    const { error } = await supabase.from("permission_returns").delete()
      .eq("return_date", e.event_date).in("student_id", raised.map((p) => p.student_id));
    setBusy(false);
    if (error) { setDoneMsg({ ok: false, text: "تعذّر التراجع: " + error.message }); return; }
    setDoneMsg({ ok: true, text: "أُلغيت العودة، وعاد الطلاب مستأذنين." });
    await loadState();
  };

  const scopeText = !req ? ""
    : req.scope === "day" ? "اليوم كاملًا"
    : `الحصص ${(req.period_numbers ?? []).join("، ")}`;
  const backPeriods = [...new Set(returns.map((r) => r.from_period))].sort((a, b) => a - b);

  return (
    <section className="card space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">استئذان الطلاب المشاركين</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          يُرفع استئذان يوم الحدث لمن وافق أولياء أمورهم، فيظهرون عند معلميهم
          «مستأذنين» بدل الغياب: لليوم كاملًا، أو لحصص محددة.
        </p>
      </div>

      <div className="rounded-sm2 bg-mint-tint px-3 py-2.5 text-sm text-mint-deep">
        <span className="num font-bold">{approved.length}</span> طالبًا وافق أولياؤهم
        · التاريخ <span className="num">{fmtG(e.event_date)}</span>
        {req && <> · الاستئذان: {scopeText}</>}
      </div>

      {doneMsg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          doneMsg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {doneMsg.text}
        </p>
      )}

      {!allRaised && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              ...(hasTime ? [["auto", "حسب وقت الحدث"]] : []),
              ["day", "اليوم كاملًا"],
              ["periods", "حصص محددة"],
            ].map(([k, t]) => (
              <button key={k} onClick={() => setScope(k)}
                      className={`flex-1 whitespace-nowrap rounded-pill px-3 py-2 text-sm font-medium ${
                        scope === k ? "bg-mint-deep text-white" : "border border-line text-muted hover:bg-canvas"}`}>
                {t}
              </button>
            ))}
          </div>
          {scope === "auto" && (
            <p className={`rounded-sm2 px-3 py-2.5 text-xs leading-relaxed ${
              autoPeriods.length ? "bg-canvas text-ink" : "bg-warning/10 text-warning"}`}>
              وقت الحدث <span className="num">{fmtTime(e.start_time)} — {fmtTime(e.end_time)}</span>
              {autoPeriods.length ? (
                <>
                  {" "}· الاستئذان للحصص <span className="num font-semibold">{autoPeriods.join("، ")}</span>
                  {autoBack
                    ? <>، ويعود الطلاب لفصولهم تلقائيًا من الحصة <span className="num font-semibold">{autoBack}</span>.</>
                    : "، وهي حتى آخر اليوم الدراسي."}
                </>
              ) : " · لا يتقاطع مع أي حصة، فلا حاجة لاستئذان."}
            </p>
          )}
          {!hasTime && (
            <p className="text-[11px] text-faint">
              أضف وقت بداية الحدث ونهايته في مرحلة «البيانات» لتُحسب الحصص ويعود الطلاب تلقائيًا بعده.
            </p>
          )}
          {scope === "periods" && (
            <div>
              <p className="mb-1.5 text-xs text-muted">اختر حصص المشاركة:</p>
              <div className="flex flex-wrap gap-1.5">
                {periods.map((n) => (
                  <button key={n} onClick={() => togglePeriod(n)}
                          className={`num h-9 w-9 rounded-full text-sm font-semibold ${
                            picked.has(n) ? "bg-mint-deep text-white" : "border border-line text-muted hover:bg-canvas"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button className="btn-primary w-full" onClick={raise}
              disabled={busy || approved.length === 0 || allRaised || (scope !== "day" && !chosen.length)}>
        {busy && !allRaised ? "جارٍ الرفع…" : allRaised ? "رُفع الاستئذان" : "رفع الاستئذان"}
      </button>

      {allRaised && (
        <div className="space-y-2.5 rounded-sm2 border border-line p-3">
          <p className="text-sm font-semibold text-ink">عودة الطلاب للفصل</p>
          {backPeriods.length ? (
            <>
              <p className="text-sm text-present">
                عاد الطلاب للفصل من الحصة <span className="num">{backPeriods.join("، ")}</span>
                {" "}— يُحضَّرون عادةً من هذه الحصة.
              </p>
              <button onClick={undoReturn} disabled={busy}
                      className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted hover:bg-canvas">
                تراجع عن العودة
              </button>
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted">
                إن انتهت المشاركة مبكرًا فاختر الحصة التي يعود فيها الطلاب لفصولهم،
                فينتهي استئذانهم منها ويحضّرهم معلموهم عاديًا.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {periods.map((n) => (
                  <button key={n} onClick={() => setBackFrom(n)}
                          className={`num h-9 w-9 rounded-full text-sm font-semibold ${
                            backFrom === n ? "bg-mint-deep text-white" : "border border-line text-muted hover:bg-canvas"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={markReturn} disabled={busy || !backFrom}
                      className="w-full rounded-pill border border-mint-deep py-2 text-sm font-semibold text-mint-deep hover:bg-mint-tint disabled:opacity-40">
                {backFrom ? `عاد الطلاب من الحصة ${backFrom}` : "اختر حصة العودة"}
              </button>
            </>
          )}
        </div>
      )}

      <button className="w-full rounded-pill border border-line py-2 text-sm text-muted hover:bg-canvas"
              onClick={onNext}>
        المتابعة لكشف الحضور
      </button>
    </section>
  );
}

/* ⑤ كشف الحضور */
function StageAttendance({ e, parts, reload, onNext }) {
  const [busy, setBusy] = useState(false);
  const approved = (parts ?? []).filter((p) => p.consent_at);

  const mark = async (p, value) => {
    setBusy(true);
    await supabase.from("event_participants").update({ attended: value }).eq("id", p.id);
    await reload();
    setBusy(false);
  };

  const all = async (value) => {
    setBusy(true);
    await supabase.from("event_participants")
      .update({ attended: value }).in("id", approved.map((x) => x.id));
    await reload();
    setBusy(false);
  };

  const present = approved.filter((p) => p.attended).length;

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">كشف حضور الحدث</p>
            <p className="mt-0.5 text-xs text-muted">
              الحاضر <span className="num font-semibold text-present">{present}</span> من{" "}
              <span className="num">{approved.length}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => all(true)} disabled={busy}
                    className="rounded-pill bg-present/10 px-3.5 py-1.5 text-xs font-semibold text-present">
              الكل حضر
            </button>
            <button onClick={() => all(false)} disabled={busy}
                    className="rounded-pill border border-line px-3.5 py-1.5 text-xs text-muted">
              مسح
            </button>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="divide-y divide-line">
          {approved.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{p.student_name}</p>
                <p className="truncate text-xs text-faint">{p.class_label}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => mark(p, true)} disabled={busy}
                  className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${
                    p.attended === true ? "bg-present text-white"
                                        : "border border-line text-muted hover:bg-canvas"}`}>
                  حضر
                </button>
                <button onClick={() => mark(p, false)} disabled={busy}
                  className={`rounded-pill px-3 py-1 text-xs font-semibold transition-colors ${
                    p.attended === false ? "bg-absent text-white"
                                         : "border border-line text-muted hover:bg-canvas"}`}>
                  لم يحضر
                </button>
              </div>
            </div>
          ))}
          {approved.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">لا طلاب موافق عليهم بعد.</p>
          )}
        </div>
      </section>

      <button className="btn-primary w-full" onClick={onNext} disabled={present === 0}>
        المتابعة لإصدار الشهادات
      </button>
    </div>
  );
}

const signedUrl = async (p) =>
  (p ? (await supabase.storage.from("form-assets").createSignedUrl(p, 3600)).data?.signedUrl ?? null : null);

/** توقيع منظّم الحدث، وختم المدرسة وتوقيع المدير — للشهادات والتقرير */
function useEventSignatures(organizerId) {
  const [sigUrl, setSigUrl] = useState(null);
  const [school, setSchool] = useState({});

  // توقيع المنظّم يظهر لمن أنشأ الحدث (سياسات التوقيع تمنع قراءة توقيع غيره)
  useEffect(() => {
    (async () => {
      if (!organizerId) return;
      const { data: sig } = await supabase.from("user_signatures")
        .select("path").eq("user_id", organizerId).maybeSingle();
      setSigUrl(await signedUrl(sig?.path));
    })();
  }, [organizerId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("school_assets").select("key, path, label");
      const get = (k) => (data ?? []).find((r) => r.key === k);
      setSchool({
        stampUrl: await signedUrl(get("stamp")?.path),
        principalUrl: await signedUrl(get("principal_signature")?.path),
        principalName: get("principal_signature")?.label ?? "",
      });
    })();
  }, []);

  return { sigUrl, school };
}

/** الطباعة بعد اكتمال تحميل صور منطقة الطباعة (الشعارات والتواقيع والصور) */
function usePrintWhenReady(id, trigger, onDone) {
  useEffect(() => {
    if (!trigger) return;
    const t = setTimeout(async () => {
      const imgs = [...document.querySelectorAll(`#${id} img`)];
      await Promise.all(imgs.map((i) => (i.complete ? null
        : new Promise((r) => { i.onload = r; i.onerror = r; }))));
      // على الجوال تعود الطباعة فورًا: تبقى منطقة الطباعة حتى يعود المستخدم للصفحة
      printThen(onDone);
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}

/* ⑥ الشهادات */
function StageCertificates({ e, parts, patch, isSupport, onNext }) {
  const [f, setF] = useState({
    cert_title: e.cert_title ?? "",
    cert_template: e.cert_template ?? (isNationalDay(e) ? "national" : "classic"),
  });
  const [text, setText] = useState(() => readCert(e));   // التمهيد والنص والختام
  const official = officialCert(e);
  const presets = certPresets(e);
  const isOfficial = ["intro", "body", "closing"].every((k) => text[k].trim() === official[k]);
  // الصيغة الرسمية لا تُحفظ نصًا، فتبقى متابعة لعنوان الحدث وتاريخه إن تغيّرا
  const certText = isOfficial ? null : JSON.stringify(text);
  const [saveErr, setSaveErr] = useState(false);
  const { sigUrl, school } = useEventSignatures(e.organizer_id);
  const [printing, setPrinting] = useState(null);   // الشهادات المُعدّة للطباعة

  const attended = useMemo(() => (parts ?? []).filter((p) => p.attended === true), [parts]);
  const serialOf = (p) => `${e.serial}-${String(attended.indexOf(p) + 1).padStart(3, "0")}`;
  const draft = { ...e, ...f, cert_text: certText };

  usePrintWhenReady("ev-cert", printing, () => setPrinting(null));

  const save = async () => {
    const ok = await patch({ ...f, cert_text: certText }, "حُفظت إعدادات الشهادة.");
    setSaveErr(!ok);
    return ok;
  };

  const printList = async (list) => {
    if (!list.length) return;
    await save();
    setPrinting(list);
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">شهادة الحدث</h2>
          <p className="mt-0.5 text-xs text-muted">
            تصدر شهادة لكل طالب سُجّل «حضر» في كشف الحضور، على قالب الشهادات المعتمد: توقيع منظّم الحدث وختم المدرسة وتوقيع المدير.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted">عنوان الشهادة</label>
          <input className="field mt-1 w-full" value={f.cert_title} placeholder={DEFAULT_CERT_TITLE}
                 onChange={(x) => setF((v) => ({ ...v, cert_title: x.target.value }))} />
        </div>

        <div>
          <label className="text-xs text-muted">القالب</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CERT_TEMPLATES.map((t) => (
              <button key={t.k} type="button"
                      onClick={() => setF((v) => ({ ...v, cert_template: t.k }))}
                className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  f.cert_template === t.k ? "bg-mint-deep text-white"
                                          : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                {t.t}
              </button>
            ))}
          </div>
        </div>

        {/* نص الشهادة — يبدأ بالصيغة الرسمية ويُعدَّل بحرية، كشهادة الشكر في النماذج */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              نص الشهادة {isOfficial && <span className="text-mint-deep">— الصيغة الرسمية</span>}
            </p>
            {!isOfficial && (
              <button type="button" className="text-[11px] text-mint-deep hover:underline"
                      onClick={() => setText(official)}>
                استعادة الصيغة الرسمية
              </button>
            )}
          </div>

          {[
            { k: "intro",   label: "السطر التمهيدي (قبل اسم الطالب)", rows: 1 },
            { k: "body",    label: "نص الشهادة (بعد اسم الطالب)",     rows: 3 },
            { k: "closing", label: "السطر الختامي",                   rows: 1 },
          ].map(({ k, label, rows }) => (
            <div key={k}>
              <label className="text-[11px] text-faint">{label}</label>
              <textarea rows={rows} className="field mt-1 w-full leading-relaxed" value={text[k]}
                        onChange={(x) => setText((v) => ({ ...v, [k]: x.target.value }))} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {presets[k].map((t, i) => (
                  <button key={i} type="button" title={t} onClick={() => setText((v) => ({ ...v, [k]: t }))}
                    className={`max-w-full truncate rounded-pill border px-3 py-1 text-[11.5px] font-medium ${
                      text[k] === t ? "border-mint-deep bg-mint-tint text-mint-deep"
                                    : "border-[#CCF2DB] bg-white text-mint-deep hover:bg-mint-tint"}`}>
                    {i === 0 ? "الرسمية: " : ""}{t.length > 42 ? t.slice(0, 42) + "…" : t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-faint">
            اسم الطالب يُكتب تلقائيًا بارزًا بين السطر التمهيدي ونص الشهادة، لكل طالب في شهادته.
          </p>
        </div>

        {!sigUrl && (
          <p className="rounded-sm2 bg-warning-light px-3 py-2 text-[11px] text-warning">
            لا يظهر توقيع منظّم الحدث. يرفعه المنظّم من صفحة «توقيعي»، ويظهر في الشهادات التي يطبعها بنفسه.
          </p>
        )}
        {isSupport && (
          <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-[11px] leading-relaxed text-mint-deep">
            خلفية خاصة بالحدث تُرفع من الدعم الفني: A4 أفقي ٢٩٧×٢١٠ مم،
            أي ٣٥٠٨×٢٤٨٠ بكسل بدقة ٣٠٠، بصيغة PNG أو JPG ولا تتجاوز ٥ ميجابايت،
            مع ترك ٢٥ مم آمنة من كل جانب و٤٠ مم أسفل للتوقيع والختم.
          </p>
        )}
        {saveErr && (
          <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-[11px] text-absent">
            تعذّر حفظ نص الشهادة — نفّذ ملف supabase/events_certificates.sql في قاعدة البيانات مرة واحدة.
          </p>
        )}

        <button className="rounded-sm2 border border-mint-deep px-4 py-2 text-sm font-semibold text-mint-deep hover:bg-mint-tint"
                onClick={save}>
          حفظ إعدادات الشهادة
        </button>
      </section>

      {/* المعاينة */}
      <section className="card space-y-2 p-4">
        <p className="text-xs font-semibold text-ink">معاينة</p>
        <CertPreview>
          <EventCertificate event={draft} sigUrl={sigUrl} {...school}
                            participant={attended[0] ?? { student_name: "اسم الطالب", class_label: "الصف الأول — فصل 1" }}
                            serial={attended[0] ? serialOf(attended[0]) : `${e.serial}-001`} />
        </CertPreview>
      </section>

      {/* الطلاب */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-sm text-ink">
            الحاضرون <span className="num font-semibold text-present">{attended.length}</span>
          </p>
          <button className="btn-primary" disabled={!attended.length} onClick={() => printList(attended)}>
            طباعة كل الشهادات ({attended.length})
          </button>
        </div>
        <div className="divide-y divide-line">
          {attended.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{p.student_name}</p>
                <p className="num truncate text-xs text-faint">{p.class_label} · {serialOf(p)}</p>
              </div>
              <button onClick={() => printList([p])}
                      className="shrink-0 rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
                طباعة
              </button>
            </div>
          ))}
          {attended.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">لا طلاب حاضرون. سجّل الحضور في المرحلة السابقة أولًا.</p>
          )}
        </div>
      </section>

      <GuestCertificates e={e} patch={patch} sigUrl={sigUrl} school={school} />

      <button className="btn-primary w-full" onClick={async () => { await save(); onNext(); }}>
        المتابعة للتقرير
      </button>

      {printing && (
        <PrintPortal id="ev-cert" landscape margin="0"
                     extraCss="#ev-cert .sheet { page-break-after: always; } #ev-cert .sheet:last-child { page-break-after: auto; }">
          {printing.map((p) => (
            <EventCertificate key={p.id} event={draft} participant={p} sigUrl={sigUrl} {...school} serial={serialOf(p)} />
          ))}
        </PrintPortal>
      )}
    </div>
  );
}

/* شهادات الضيوف والمتعاونين — اختيارية: للمحاضرين والمدربين ومنفّذي الفعاليات
   من خارج المدرسة، بتصميم مستقل عن شهادات الطلاب. تُحفظ قائمتهم مع الحدث. */
const newGuest = () => ({ id: Math.random().toString(36).slice(2, 10), name: "", entity: "", task: "" });

function guestCertProps(e, g, i, sigUrl, school) {
  return {
    name: g.name, entity: g.entity,
    text: `وذلك تقديرًا ${forTask(g.task)}، وما بذله من جهد وعطاء أسهم في نجاح البرنامج.`,
    activity: e.title,
    dateText: e.event_date ? stripBidi(fmtDate(`${e.event_date}T12:00:00`)) : "",
    closing: "سائلين الله له دوام التوفيق والسداد",
    serial: `${e.serial}-G${String(i + 1).padStart(2, "0")}`,
    issuer: { url: sigUrl, name: e.organizer_name, role: e.organizer_role || "منفّذ البرنامج" },
    principal: { url: school.principalUrl, name: school.principalName },
    stampUrl: school.stampUrl,
  };
}

function GuestCertificates({ e, patch, sigUrl, school }) {
  const [list, setList] = useState(() => (Array.isArray(e.guests) ? e.guests : []));
  const [open, setOpen] = useState(list.length > 0);
  const [saveErr, setSaveErr] = useState(false);
  const [printing, setPrinting] = useState(null);
  usePrintWhenReady("ev-guest", printing, () => setPrinting(null));

  const ready = list.filter((g) => g.name.trim());
  const set = (id, k, val) => setList((l) => l.map((g) => (g.id === id ? { ...g, [k]: val } : g)));

  const save = async () => {
    const ok = await patch({ guests: ready }, "حُفظت قائمة الضيوف.");
    setSaveErr(!ok);
    return ok;
  };
  const printList = async (gs) => {
    if (!gs.length) return;
    if (await save()) setPrinting(gs);
  };

  if (!open) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">شهادات الضيوف والمتعاونين <span className="font-normal text-faint">— اختياري</span></h2>
          <p className="mt-0.5 text-xs text-muted">لمن شارك من خارج المدرسة: محاضر أو مدرب أو منفّذ فعالية.</p>
        </div>
        <button className="rounded-sm2 border border-mint-deep px-4 py-2 text-sm font-semibold text-mint-deep hover:bg-mint-tint"
                onClick={() => { setOpen(true); if (!list.length) setList([newGuest()]); }}>
          إضافة ضيف
        </button>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">شهادات الضيوف والمتعاونين <span className="font-normal text-faint">— اختياري</span></h2>
        <p className="mt-0.5 text-xs text-muted">
          شهادة شكر بتصميم خاص لكل ضيف، تحمل عنوان الحدث وتاريخه، بتوقيع منظّم الحدث وختم المدرسة وتوقيع المدير.
        </p>
      </div>

      <div className="space-y-3">
        {list.map((g, i) => (
          <div key={g.id} className="space-y-2 rounded-sm2 border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-mint-deep">الضيف <span className="num">{i + 1}</span></span>
              <button type="button" className="text-[11px] text-absent hover:underline"
                      onClick={() => setList((l) => l.filter((x) => x.id !== g.id))}>
                حذف
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[11px] text-faint">الاسم مع اللقب</label>
                <input className="field mt-1 w-full" value={g.name} placeholder="مثال: الدكتور/ خالد بن سعيد الغامدي"
                       onChange={(x) => set(g.id, "name", x.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-faint">الجهة (اختياري)</label>
                <input className="field mt-1 w-full" value={g.entity} placeholder="مثال: جامعة أم القرى"
                       onChange={(x) => set(g.id, "entity", x.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-faint">المهمة التي نفّذها (اختياري)</label>
              <input className="field mt-1 w-full" value={g.task} placeholder="مثال: تقديم محاضرة توعوية عن السلامة المرورية"
                     onChange={(x) => set(g.id, "task", x.target.value)} />
              <p className="mt-1 text-[11px] leading-relaxed text-faint">
                يُكتب في الشهادة: «وذلك تقديرًا {forTask(g.task)}، وما بذله من جهد وعطاء أسهم في نجاح البرنامج.»
              </p>
            </div>
            {g.name.trim() && (
              <button type="button" onClick={() => printList([g])}
                      className="rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
                طباعة شهادته
              </button>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="text-sm font-medium text-mint-deep hover:underline"
              onClick={() => setList((l) => [...l, newGuest()])}>
        + إضافة ضيف آخر
      </button>

      {ready.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">معاينة</p>
          <CertPreview portrait>
            <GuestCertificate {...guestCertProps(e, ready[0], 0, sigUrl, school)} />
          </CertPreview>
        </div>
      )}

      {saveErr && (
        <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-[11px] text-absent">
          تعذّر حفظ قائمة الضيوف — نفّذ ملف supabase/guest_certificates.sql في قاعدة البيانات مرة واحدة.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="rounded-sm2 border border-mint-deep px-4 py-2 text-sm font-semibold text-mint-deep hover:bg-mint-tint"
                onClick={save}>
          حفظ قائمة الضيوف
        </button>
        <button className="btn-primary" disabled={!ready.length} onClick={() => printList(ready)}>
          طباعة شهادات الضيوف ({ready.length})
        </button>
      </div>

      {printing && (
        <PrintPortal id="ev-guest" margin="0"
                     extraCss="#ev-guest .sheet { page-break-after: always; } #ev-guest .sheet:last-child { page-break-after: auto; }">
          {printing.map((g) => (
            <GuestCertificate key={g.id} {...guestCertProps(e, g, ready.indexOf(g), sigUrl, school)} />
          ))}
        </PrintPortal>
      )}
    </section>
  );
}

/** إشعار في الجرس وعلى الجوال لمستخدمين محدّدين */
async function notifyUsers(userIds, title, body, link = "/events") {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  const { data: nid } = await supabase.rpc("send_notification", {
    p_title: title, p_body: body, p_kind: "general", p_link: link,
    p_roles: null, p_user_ids: ids, p_grade: null, p_class_no: null, p_is_auto: false,
  });
  if (!nid) return;
  try {
    await sendPush(nid);
  } catch { /* الإشعار في الجرس وصل */ }
}

/* ⑦ التقرير — يكتبه المنظّم، وبيانات الحدث وأعداده وقائمة الحاضرين تُملأ آليًا */
const MAX_REPORT_PHOTOS = 4;

function StageReport({ e, parts, patch, onMsg, onSubmitted }) {
  const [f, setF] = useState({
    report_summary: e.report_summary ?? "",
    report_outcomes: e.report_outcomes ?? "",
    report_recommendations: e.report_recommendations ?? "",
    report_photos: e.report_photos ?? [],
  });
  const [photoUrls, setPhotoUrls] = useState({});   // المسار ← رابط موقّع
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useNotice(null, "error");
  const [printing, setPrinting] = useState(false);
  const { sigUrl, school } = useEventSignatures(e.organizer_id);

  const approved = e.stage === "approved";
  const submitted = !!e.report_submitted_at;
  const locked = approved || submitted;              // لا يُعدَّل بعد رفعه، إلا إن أُعيد

  const all = parts ?? [];
  const consented = all.filter((p) => p.consent_at);
  const attended = all.filter((p) => p.attended === true);
  const noPhoto = consented.filter((p) => p.consent_photo === false).length;
  const stats = [
    ["المرشّحون", all.length],
    ["وافق أولياؤهم", consented.length],
    ["وافق على التصوير", consented.filter((p) => p.consent_photo).length],
    ["الحاضرون", attended.length],
    ["نسبة الحضور", consented.length ? `${Math.round((attended.length / consented.length) * 100)}%` : "—"],
  ];

  // الصور في مخزن خاص، فتُقرأ بروابط موقّعة مؤقتة
  useEffect(() => {
    (async () => {
      const missing = f.report_photos.filter((p) => !photoUrls[p]);
      if (!missing.length) return;
      const { data } = await supabase.storage.from("event-reports").createSignedUrls(missing, 3600);
      setPhotoUrls((m) => ({ ...m, ...Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl])) }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.report_photos]);

  usePrintWhenReady("ev-report-sheet", printing, () => setPrinting(false));

  const save = async (next = f, okText = "حُفظ التقرير.") => {
    const ok = await patch(next, okText);
    setErr(ok ? null : "تعذّر الحفظ — نفّذ ملف supabase/events_report.sql في قاعدة البيانات مرة واحدة.");
    return ok;
  };

  const upload = async (file) => {
    if (!file || f.report_photos.length >= MAX_REPORT_PHOTOS) return;
    setBusy(true); setErr(null);
    try {
      const blob = await normalizeImage(file);
      const path = `${e.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from("event-reports")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const next = { ...f, report_photos: [...f.report_photos, path] };
      setF(next);
      await save(next, "أُضيفت الصورة.");
    } catch (x) {
      setErr(`تعذّر رفع الصورة: ${x.message ?? x}`);
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (path) => {
    if (!window.confirm("حذف الصورة من التقرير؟")) return;
    setBusy(true);
    await supabase.storage.from("event-reports").remove([path]);
    const next = { ...f, report_photos: f.report_photos.filter((p) => p !== path) };
    setF(next);
    await save(next, "حُذفت الصورة.");
    setBusy(false);
  };

  // رفع التقرير لمدير المدرسة للاعتماد
  const submit = async () => {
    if (!window.confirm("رفع التقرير لمدير المدرسة للاعتماد؟ لا يمكن تعديله بعد الرفع إلا إن أُعيد إليك.")) return;
    setBusy(true);
    const ok = await save({ ...f, report_submitted_at: new Date().toISOString(), approval_note: null },
                          "رُفع التقرير لمدير المدرسة للاعتماد.");
    if (ok) {
      // إشعار مدير المدرسة — إن تعذّرت قراءة الأدوار يبقى الحدث ظاهرًا له «بانتظار الاعتماد»
      const { data: ps } = await supabase.from("admin_roles").select("user_id").eq("role_type", "principal");
      await notifyUsers((ps ?? []).map((r) => r.user_id), "حدث بانتظار اعتمادك",
                        `رفع ${e.organizer_name ?? "المنظّم"} تقرير «${e.title}» للاعتماد.`);
      onSubmitted();
    }
    setBusy(false);
  };

  const area = (k, label, placeholder, rows = 3) => (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <textarea rows={rows} className="field mt-1 w-full leading-relaxed disabled:bg-canvas" value={f[k]}
                placeholder={placeholder} disabled={locked}
                onChange={(x) => setF((v) => ({ ...v, [k]: x.target.value }))} />
    </div>
  );

  const photos = f.report_photos.map((p) => photoUrls[p]).filter(Boolean);

  return (
    <div className="space-y-4">
      {e.approval_note && !submitted && !approved && (
        <section className="card border-warning/40 bg-warning-light p-4">
          <p className="text-sm font-semibold text-warning">أُعيد التقرير إليك من مدير المدرسة</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{e.approval_note}</p>
        </section>
      )}

      <section className="card space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">تقرير تنفيذ الحدث</h2>
          <p className="mt-0.5 text-xs text-muted">
            بيانات الحدث ونبذته وأهدافه وأعداد المشاركين وقائمة الحاضرين تُدرج في التقرير آليًا. اكتب ما يخص التنفيذ.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-sm2 border border-line px-2 py-2 text-center">
              <p className="num text-base font-bold text-mint-deep">{v}</p>
              <p className="text-[11px] text-muted">{k}</p>
            </div>
          ))}
        </div>

        {area("report_summary", "وصف التنفيذ", "ما الذي نُفّذ؟ الفقرات والبرامج، وسير الحدث…", 4)}
        {area("report_outcomes", "النتائج والأثر", "ما تحقق من الأهداف، وتفاعل الطلاب…")}
        {area("report_recommendations", "التوصيات", "مقترحات لتحسين الحدث في المرات القادمة…", 2)}

        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-muted">
              صور من التنفيذ (<span className="num">{f.report_photos.length}</span> من{" "}
              <span className="num">{MAX_REPORT_PHOTOS}</span>)
            </label>
            {!locked && f.report_photos.length < MAX_REPORT_PHOTOS && (
              <label className={`cursor-pointer rounded-pill border border-mint-deep px-3 py-1 text-xs font-semibold text-mint-deep hover:bg-mint-tint ${
                busy ? "pointer-events-none opacity-50" : ""}`}>
                {busy ? "جارٍ الرفع…" : "+ إضافة صورة"}
                <input type="file" accept="image/*" className="hidden"
                       onChange={(x) => { upload(x.target.files?.[0]); x.target.value = ""; }} />
              </label>
            )}
          </div>
          {noPhoto > 0 && !locked && (
            <p className="mt-1.5 rounded-sm2 bg-warning-light px-3 py-2 text-[11px] text-warning">
              <span className="num">{noPhoto}</span> من أولياء الأمور لم يوافقوا على تصوير أبنائهم — لا ترفع صورًا تُظهرهم.
            </p>
          )}
          {f.report_photos.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {f.report_photos.map((p) => (
                <div key={p} className="relative overflow-hidden rounded-sm2 border border-line bg-canvas"
                     style={{ aspectRatio: "16 / 9" }}>
                  {photoUrls[p] && <img src={photoUrls[p]} alt="" className="h-full w-full object-cover" />}
                  {!locked && (
                    <button onClick={() => removePhoto(p)} disabled={busy}
                            className="absolute left-1.5 top-1.5 rounded-pill bg-white/90 px-2 py-0.5 text-[11px] text-absent">
                      حذف
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">{err}</p>}

        <div className="flex flex-wrap gap-2">
          {!locked && (
            <button className="flex-1 rounded-pill border border-mint-deep py-2 text-sm font-semibold text-mint-deep hover:bg-mint-tint"
                    onClick={() => save()} disabled={busy}>
              حفظ التقرير
            </button>
          )}
          <button className="flex-1 rounded-pill border border-line py-2 text-sm text-ink hover:bg-canvas"
                  onClick={async () => { if (!locked) await save(f, null); setPrinting(true); }}>
            طباعة / حفظ PDF
          </button>
        </div>
        {!locked && (
          <button className="btn-primary w-full" onClick={submit}
                  disabled={busy || f.report_summary.trim().length < 10}>
            رفع التقرير للاعتماد
          </button>
        )}
        {!locked && f.report_summary.trim().length < 10 && (
          <p className="text-[11px] text-faint">اكتب وصف التنفيذ لتتمكّن من رفع التقرير للاعتماد.</p>
        )}
        {submitted && !approved && (
          <p className="rounded-sm2 bg-warning-light px-3 py-2 text-xs text-warning">
            التقرير مرفوع لمدير المدرسة وبانتظار الاعتماد.
          </p>
        )}
      </section>

      {printing && (
        <PrintPortal id="ev-report-sheet" margin="10mm 14mm">
          <EventReportSheet event={{ ...e, ...f }} stats={stats} attended={attended} photos={photos}
                            sigUrl={sigUrl} stampUrl={school.stampUrl} principalName={school.principalName}
                            principalUrl={approved ? school.principalUrl : null} />
        </PrintPortal>
      )}
    </div>
  );
}

/* ⑧ الاعتماد — يعتمده مدير المدرسة فيُقفل الحدث، أو يعيده للمنظّم بملاحظة */
function StageApproval({ e, patch, onMsg, isPrincipal, byName, goReport }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const approved = e.stage === "approved";

  const approve = async () => {
    if (!window.confirm(`اعتماد «${e.title}» وإقفاله؟`)) return;
    setBusy(true);
    const ok = await patch({ stage: "approved", approved_at: new Date().toISOString(),
                             approved_by_name: byName || null, approval_note: null },
                           "اعتُمد الحدث وأُقفل.");
    if (ok) await notifyUsers([e.organizer_id], "اعتُمد الحدث",
                              `اعتمد مدير المدرسة تقرير «${e.title}». يمكنك طباعة التقرير المعتمد.`);
    else onMsg({ ok: false, text: "تعذّر الاعتماد — نفّذ ملف supabase/events_report.sql في قاعدة البيانات مرة واحدة." });
    setBusy(false);
  };

  const sendBack = async () => {
    if (note.trim().length < 3) return;
    setBusy(true);
    const ok = await patch({ report_submitted_at: null, approval_note: note.trim() },
                           "أُعيد التقرير للمنظّم بملاحظتك.");
    if (ok) {
      await notifyUsers([e.organizer_id], "أُعيد تقرير الحدث إليك",
                        `أعاد مدير المدرسة تقرير «${e.title}»: ${note.trim()}`);
      goReport();
    }
    setBusy(false);
  };

  if (approved) {
    return (
      <section className="card space-y-3 border-present/30 bg-present/5 p-4">
        <p className="text-sm font-bold text-present">اعتُمد الحدث وأُقفل</p>
        <p className="num text-xs text-muted">
          {e.approved_by_name ? `${e.approved_by_name} · ` : ""}
          {e.approved_at ? fmtG(String(e.approved_at).slice(0, 10)) : ""}
        </p>
        <button onClick={goReport}
                className="rounded-pill border border-line bg-white px-4 py-1.5 text-sm text-ink hover:bg-canvas">
          طباعة التقرير المعتمد
        </button>
      </section>
    );
  }

  if (!isPrincipal) {
    return (
      <section className="card px-6 py-10 text-center">
        <p className="font-semibold text-ink">بانتظار اعتماد مدير المدرسة</p>
        <p className="mt-1.5 text-sm text-muted">يصلك إشعار حين يُعتمد التقرير أو يُعاد إليك بملاحظة.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">اعتماد الحدث</h2>
        <p className="mt-0.5 text-xs text-muted">
          راجع التقرير من مرحلة «التقرير»، ثم اعتمده فيُقفل الحدث ويُطبع التقرير بتوقيعك، أو أعِده للمنظّم بملاحظة.
        </p>
      </div>
      <button onClick={goReport}
              className="w-full rounded-pill border border-line py-2 text-sm text-ink hover:bg-canvas">
        مراجعة التقرير
      </button>
      <button className="btn-primary w-full" onClick={approve} disabled={busy}>
        اعتماد الحدث وإقفاله
      </button>
      <div className="space-y-2 border-t border-line pt-3">
        <label className="text-xs text-muted">أو إعادة للمنظّم بملاحظة</label>
        <textarea rows={2} className="field w-full" value={note} placeholder="مثال: أضف صورًا من التنفيذ"
                  onChange={(x) => setNote(x.target.value)} />
        <button onClick={sendBack} disabled={busy || note.trim().length < 3}
                className="w-full rounded-pill border border-warning/50 py-2 text-sm font-semibold text-warning hover:bg-warning-light disabled:opacity-50">
          إعادة للمنظّم
        </button>
      </div>
    </section>
  );
}

/* معاينة مصغّرة للشهادة بعرض البطاقة */
function CertPreview({ portrait = false, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.5);
  // 297mm ≈ 1122.5px و210mm ≈ 793.7px — العمودية تُعرض بنصف عرض البطاقة تقريبًا
  const [w, h] = portrait ? [793.7, 1122.5] : [1122.5, 793.7];
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / w);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={ref} className={`overflow-hidden rounded-sm2 border border-line ${portrait ? "mx-auto max-w-[360px]" : ""}`}
         style={{ height: h * scale }}>
      <div style={{ width: portrait ? "210mm" : "297mm", transform: `scale(${scale})`, transformOrigin: "top right" }}>
        {children}
      </div>
    </div>
  );
}
