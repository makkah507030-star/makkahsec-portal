// src/pages/Events.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { GRADE_NAMES, todayISO } from "../lib/schoolTime";

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
  { key: "approved",     n: 8, label: "معتمد ومنتهٍ" },
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
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(null);

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
                   onBack={() => { setOpenId(null); load(); }}
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

      {!list && <p className="text-sm text-muted">جارٍ التحميل…</p>}
      {list?.length === 0 && (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          لا أحداث بعد. ابدأ بـ«حدث جديد».
        </p>
      )}

      <div className="space-y-2">
        {(list ?? []).map((e) => {
          const i = stageIndex(e.stage);
          const done = e.stage === "approved";
          return (
            <button key={e.id} onClick={() => setOpenId(e.id)}
                    className="card block w-full p-4 text-right transition-colors hover:border-[#CCF2DB]">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{e.title}</p>
                <span className={`chip shrink-0 ${
                  done ? "bg-present/10 text-present" : "bg-mint-tint text-mint-deep"}`}>
                  {done ? "معتمد" : `المرحلة ${i + 1} من 8`}
                </span>
              </div>
              <p className="num mt-1 text-xs text-faint">
                {e.serial} · {fmtG(e.event_date)}
                {e.category ? ` · ${e.category}` : ""}
                {e.organizer_name ? ` · ${e.organizer_name}` : ""}
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-canvas">
                <div className="h-full rounded-pill bg-mint-deep transition-all"
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
function EventWizard({ ev, uid, profile, isSupport, onBack, onMsg, msg }) {
  const [e, setE] = useState(ev);
  const [parts, setParts] = useState(null);
  const [step, setStep] = useState(stageIndex(ev.stage));

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack}
                className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
          ← كل الأحداث
        </button>
        <span className="num text-xs text-faint">{e.serial}</span>
      </div>

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
          const reached = i <= done;
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

      {step === 0 && <StageInfo e={e} patch={patch} isSupport={isSupport}
                                onNext={() => advance("participants")} />}
      {step === 1 && <StageParticipants e={e} parts={parts} reload={loadParts}
                                        onNext={() => advance("consent", "انتقلنا لإرسال الموافقات.")} />}
      {step === 2 && <StageConsent e={e} parts={parts} reload={loadParts}
                                   uid={uid} organizerName={profile?.full_name ?? ""}
                                   onNext={() => advance("permission", "انتقلنا للاستئذان.")} />}
      {step === 3 && <StagePermission e={e} parts={parts} uid={uid}
                                      onNext={() => advance("attendance", "انتقلنا لكشف الحضور.")} />}
      {step === 4 && <StageAttendance e={e} parts={parts} reload={loadParts}
                                      onNext={() => advance("certificates", "انتقلنا للشهادات.")} />}
      {step >= 5 && (
        <section className="card px-6 py-10 text-center">
          <p className="font-semibold text-ink">{STAGES[step].label}</p>
          <p className="mt-1.5 text-sm text-muted">قيد الإعداد — ستتوفّر في التحديث القادم.</p>
        </section>
      )}
    </div>
  );
}

/* ① بيانات الحدث */
function StageInfo({ e, patch, isSupport, onNext }) {
  const [f, setF] = useState({
    description: e.description ?? "", goals: e.goals ?? "",
    venue: e.venue ?? "", cert_title: e.cert_title ?? "",
    cert_template: e.cert_template ?? "classic",
  });

  const TEMPLATES = [
    { k: "classic", t: "كلاسيكي" }, { k: "gold", t: "ذهبي" },
    { k: "medal", t: "وسام" }, { k: "modern", t: "حديث" }, { k: "ornate", t: "مزخرف" },
  ];

  return (
    <section className="card space-y-4 p-4">
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

      <div className="rounded-sm2 border border-line p-3">
        <p className="text-xs font-semibold text-ink">شهادة الحدث</p>
        <div className="mt-2">
          <label className="text-xs text-muted">عنوان الشهادة</label>
          <input className="field mt-1 w-full" value={f.cert_title}
                 placeholder="مثال: شهادة مشاركة في الاحتفاء باليوم الوطني"
                 onChange={(x) => setF((v) => ({ ...v, cert_title: x.target.value }))} />
        </div>
        <div className="mt-2.5">
          <label className="text-xs text-muted">القالب</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
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
        {isSupport && (
          <p className="mt-2.5 rounded-sm2 bg-mint-tint px-3 py-2 text-[11px] leading-relaxed text-mint-deep">
            خلفية خاصة بالحدث تُرفع من الدعم الفني: A4 أفقي ٢٩٧×٢١٠ مم،
            أي ٣٥٠٨×٢٤٨٠ بكسل بدقة ٣٠٠، بصيغة PNG أو JPG ولا تتجاوز ٥ ميجابايت،
            مع ترك ٢٥ مم آمنة من كل جانب و٤٠ مم أسفل للتوقيع والختم.
          </p>
        )}
      </div>

      <button className="btn-primary w-full"
              onClick={async () => { await patch(f, "حُفظت البيانات."); onNext(); }}>
        حفظ والمتابعة
      </button>
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

/* ③ موافقة أولياء الأمور — عبر نظام النماذج */
function StageConsent({ e, parts, reload, onNext, uid, organizerName }) {
  const [busy, setBusy] = useState(false);
  const [tpl, setTpl] = useState(null);
  const [note, setNote] = useState(null);

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
    let sent = 0, skipped = 0;

    for (const p of (parts ?? []).filter((x) => !x.consent_doc_id)) {
      // ولي الأمر المستلم
      const { data: gs } = await supabase.from("guardian_student")
        .select("guardians(user_id, full_name)").eq("student_id", p.student_id);
      const g = (gs ?? []).map((x) => x.guardians).find((x) => x?.user_id);
      if (!g) { skipped++; continue; }

      const { data: serial } = await supabase.rpc("next_form_serial", { p_category: "administrative" });

      const { data: doc, error } = await supabase.from("form_documents").insert({
        template_id: tpl.id,
        serial,
        title: tpl.title,
        recipient: p.student_name,
        recipient_user_id: g.user_id,
        status: "awaiting_reply",
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

      if (error || !doc) { skipped++; continue; }

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
          await fetch("/.netlify/functions/push-send", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_id: nid }),
          });
        } catch { /* الإشعار في البوابة وصل */ }
      }
      sent++;
    }

    await reload();
    setBusy(false);
    setNote({
      ok: sent > 0,
      text: sent > 0
        ? `صدرت ${sent} موافقة وأُرسلت لأولياء الأمور.` +
          (skipped ? ` وتعذّر إرسال ${skipped} لعدم وجود حساب ولي أمر.` : "")
        : "تعذّر الإصدار: لا أولياء أمور بحسابات لهؤلاء الطلاب.",
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
          await fetch("/.netlify/functions/push-send", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_id: nid }),
          });
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
function StagePermission({ e, parts, uid, onNext }) {
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState(null);
  const approved = (parts ?? []).filter((p) => p.consent_at);

  const raise = async () => {
    setBusy(true);
    const { data: req, error } = await supabase.from("permission_requests").insert({
      request_date: e.event_date,
      scope: "day",
      period_numbers: null,
      note: `مشاركة في «${e.title}»`,
      created_by: uid,
    }).select("id").single();

    if (error) { setDoneMsg({ ok: false, text: error.message }); setBusy(false); return; }

    const rows = approved.map((p) => ({ request_id: req.id, student_id: p.student_id }));
    const { error: e2 } = await supabase.from("permission_request_students").insert(rows);
    setBusy(false);
    if (e2) { setDoneMsg({ ok: false, text: e2.message }); return; }

    await supabase.from("event_participants")
      .update({ permission_id: req.id }).in("id", approved.map((p) => p.id));
    setDoneMsg({ ok: true, text: `رُفع الاستئذان لـ ${rows.length} طالبًا، ويظهر عند معلميهم.` });
  };

  return (
    <section className="card space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">استئذان الطلاب المشاركين</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          يُرفع استئذان ليوم الحدث لمن وافق أولياء أمورهم، فيظهرون عند معلميهم
          «مستأذنين» بدل الغياب.
        </p>
      </div>

      <div className="rounded-sm2 bg-mint-tint px-3 py-2.5 text-sm text-mint-deep">
        <span className="num font-bold">{approved.length}</span> طالبًا وافق أولياؤهم
        · التاريخ <span className="num">{fmtG(e.event_date)}</span>
      </div>

      {doneMsg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          doneMsg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {doneMsg.text}
        </p>
      )}

      <button className="btn-primary w-full" onClick={raise}
              disabled={busy || approved.length === 0 || approved.every((p) => p.permission_id)}>
        {busy ? "جارٍ الرفع…"
          : approved.every((p) => p.permission_id) && approved.length ? "رُفع الاستئذان"
          : "رفع الاستئذان"}
      </button>

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
