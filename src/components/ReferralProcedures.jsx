import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendPush } from "../lib/pushSend.js";
import { todayISO } from "../lib/schoolTime";
import { fmtDate } from "../lib/dates";
import { degreeName } from "../lib/behavior";
import {
  ACADEMIC_ITEMS, BEHAVIOR_STEPS, DIRECT_DEGREE, academicItemDone,
} from "../lib/referrals";

/* =====================================================================
   إجراءات المعلم قبل الإحالة — مكوّنات صفحة الإحالة:
   • ReferralGuide: مختصر الإجراءات من دليل السلوك والمواظبة وشروط الموجه.
   • BehaviorSteps: التدرج قبل إحالة المخالفة (تنبيه ← تدوين ← إشعار ولي الأمر).
   • AcademicDocs: توثيق التأخر الدراسي والأعمال الأدائية، مع بيانات البوابة.
   • DocsView: عرض التوثيق للوكيل والموجه.
   ===================================================================== */

export const REF_BUCKET = "referral-files";
const MAX_BYTES = 5 * 1024 * 1024;

/* --------------------- مختصر الإجراءات --------------------- */
export function ReferralGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-card border border-line bg-canvas/60 px-3.5 py-2.5 text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-right">
        <span className="font-semibold text-ink">مختصر إجراءات الإحالة — دليل السلوك والمواظبة 1447</span>
        <span className="shrink-0 text-xs text-mint-deep">{open ? "إخفاء" : "عرض"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2.5 text-[12.5px] leading-relaxed text-muted">
          <div>
            <p className="font-semibold text-ink">المخالفات السلوكية</p>
            <ul className="mt-1 list-disc space-y-1 pr-4">
              <li><b className="text-ink">الدرجة الأولى</b> (التأخر، النوم، الحديث الجانبي، إعاقة الدرس):
                يعالجها المعلم بالتدرج، كل خطوة في موقف مستقل: تنبيه شفهي ← تدوين المشكلة وتوقيع الطالب ←
                إشعار ولي الأمر. فإن تكررت بعد ذلك يُحال الطالب.</li>
              <li><b className="text-ink">الدرجة الثانية</b> (الهروب من الحصة، الخروج دون استئذان، إثارة الفوضى):
                التدرج نفسه، ثم الإحالة لدراسة الحالة وأخذ التعهد.</li>
              <li><b className="text-ink">الدرجة الثالثة فما فوق</b> (الشجار، الإيذاء، الإتلاف، المواد الممنوعة،
                التعدي على المعلم): تُحال مباشرة لوكيل شؤون الطلاب.</li>
              <li>الحالة العاجلة التي تمس السلامة تُحال فورًا مع ذكر السبب.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ink">التأخر الدراسي والأعمال الأدائية</p>
            <p className="mt-1">
              لا يُحال الطالب إلا بعد استكمال المعلم الإجراءات التربوية والعلاجية وتوثيقها: المشكلة وتاريخ رصدها،
              والتنبيه والتوجيه، والدعم والعلاج المقدّم، ونتائج المتابعة وقياس التحسن، والأدلة والسجلات،
              وبيان استمرار الحالة. ولا تُعتمد الإحالة الناقصة، ويعيدها الوكيل لاستكمالها.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const Mark = ({ ok }) => (
  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
    ok ? "bg-mint-deep text-white" : "border-[1.5px] border-warning/60 bg-white text-warning"}`}>
    {ok ? "✓" : "!"}
  </span>
);

/** إشعار لولي أمر الطالب من البوابة، يُسجَّل إجراءً على الطالب */
async function notifyGuardian(studentId, title, body, category) {
  const { data, error } = await supabase.rpc("teacher_notify_guardian", {
    p_student: studentId, p_title: title, p_body: body, p_category: category,
  });
  if (error) throw error;
  if (data) await sendPush(data).catch(() => {});
  return data;
}

/* --------------------- التدرج في المخالفة السلوكية ---------------------
   onState({ ready, steps }): ready = اكتملت الخطوات أو المخالفة تُحال مباشرة */
export function BehaviorSteps({ uid, student, violation, subject, onState }) {
  const [acts, setActs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("student_actions")
      .select("action, action_date, detail, violation_text")
      .eq("student_id", student.id).eq("teacher_id", uid).eq("category", "behavior")
      .order("created_at");
    setActs(error ? [] : data ?? []);
  };
  useEffect(() => { setActs(null); setErr(""); load(); }, [student.id]);

  const direct = (violation?.degree ?? 0) >= DIRECT_DEGREE;
  const done = BEHAVIOR_STEPS.map((s) => (acts ?? []).find((a) => a.action === s.key) ?? null);
  const next = done.findIndex((d) => !d);
  const today = todayISO();
  const actedToday = (acts ?? []).some((a) => a.action_date === today);

  useEffect(() => {
    if (acts === null) return;
    onState({
      ready: direct || next === -1,
      steps: done.filter(Boolean).map((d, i) => ({ t: BEHAVIOR_STEPS[i].t, date: fmtDate(d.action_date) })),
    });
  }, [acts, direct]);

  const record = async () => {
    const step = BEHAVIOR_STEPS[next];
    setBusy(true); setErr("");
    try {
      if (step.key === "guardian") {
        await notifyGuardian(student.id, "ملاحظة سلوكية بشأن ابنكم",
          `نفيدكم بتكرار ملاحظة سلوكية على الطالب ${student.full_name}${subject ? ` في مادة ${subject}` : ""}: ` +
          `${violation?.text ?? ""} وقد نُبّه شفهيًا ودُوّنت المشكلة، ونأمل تعاونكم في توجيهه.`, "behavior");
      } else {
        const { error } = await supabase.from("student_actions").insert({
          student_id: student.id, teacher_id: uid, category: "behavior", action: step.key,
          detail: step.t, violation_text: violation?.text ?? null, violation_degree: violation?.degree ?? null,
        });
        if (error) throw error;
      }
      await load();
    } catch (e) {
      setErr(/student_actions|teacher_notify_guardian|schema cache/i.test(e.message)
        ? "لم يُفعَّل سجل الإجراءات بعد في قاعدة البيانات." : e.message);
    }
    setBusy(false);
  };

  if (!violation) return null;
  if (direct) {
    return (
      <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs text-mint-deep">
        مخالفة من الدرجة {degreeName(violation.degree)}: تُحال مباشرة لوكيل شؤون الطلاب.
      </p>
    );
  }
  if (acts === null) return <p className="text-xs text-muted">جارٍ تحميل إجراءاتك السابقة…</p>;

  return (
    <div className="rounded-card border border-line bg-canvas/60 p-3 text-sm">
      <p className="mb-2 font-semibold text-ink">
        إجراءات المعلم قبل الإحالة <span className="text-xs font-normal text-muted">— كل خطوة في موقف مستقل</span>
      </p>
      <div className="space-y-2">
        {BEHAVIOR_STEPS.map((s, i) => (
          <div key={s.key} className="flex items-start gap-2">
            <Mark ok={!!done[i]} />
            <div className="min-w-0 flex-1">
              <p className="text-ink">{s.t}</p>
              {done[i] && <p className="text-[11.5px] text-muted">سُجّل بتاريخ <span className="num">{fmtDate(done[i].action_date)}</span></p>}
              {i === next && (actedToday ? (
                <p className="text-[11.5px] text-warning">سجّلت إجراءً اليوم. الخطوة التالية عند تكرار المخالفة في موقف لاحق.</p>
              ) : (
                <button type="button" disabled={busy} onClick={record}
                        className="mt-1 rounded-pill border border-mint-deep px-3 py-1 text-[11.5px] font-semibold text-mint-deep hover:bg-mint-tint disabled:opacity-50">
                  {busy ? "جارٍ الحفظ…" : s.key === "guardian" ? "إرسال إشعار لولي الأمر الآن" : "تسجيل هذا الإجراء اليوم"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {err && <p className="mt-2 rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">{err}</p>}
    </div>
  );
}

/* --------------------- توثيق التأخر الدراسي والأعمال الأدائية --------------------- */
const pct = (s, t) => (t ? Math.round((Number(s) / Number(t)) * 100) : null);

/** بيانات البوابة للطالب عند هذا المعلم: نتائج اختباراته، وخططه العلاجية، وإشعاراته لولي الأمر */
async function portalData(uid, studentId) {
  const [subs, plans, acts] = await Promise.all([
    supabase.from("quiz_submissions")
      .select("score, absent, marked_at, quizzes!inner(title, total_marks, teacher_id)")
      .eq("student_id", studentId).eq("quizzes.teacher_id", uid).not("score", "is", null),
    supabase.from("quiz_plans").select("kind, skills, procedures, status, done_at, created_at, students, quizzes(title)")
      .eq("teacher_id", uid).eq("kind", "remedial"),
    supabase.from("student_actions").select("detail, action_date")
      .eq("student_id", studentId).eq("teacher_id", uid).eq("category", "academic").eq("action", "guardian"),
  ]);
  const results = (subs.data ?? []).map((r) => ({
    title: r.quizzes.title, score: Number(r.score), total: r.quizzes.total_marks,
    p: pct(r.score, r.quizzes.total_marks), at: r.marked_at,
  })).sort((a, b) => new Date(a.at) - new Date(b.at));
  const myPlans = (plans.data ?? []).filter((p) => (p.students ?? []).some((s) => s.id === studentId));
  return { results, plans: myPlans, notices: acts.data ?? [] };
}

const resLine = (r) => `${r.title}: ${r.score} من ${r.total ?? "—"}${r.at ? ` (${fmtDate(r.at)})` : ""}`;

export function AcademicDocs({ uid, student, docs, onChange }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const items = docs?.items ?? {};
  const files = docs?.files ?? [];

  useEffect(() => {
    let live = true;
    setData(null);
    portalData(uid, student.id).then((d) => { if (live) setData(d); }, () => { if (live) setData({ results: [], plans: [], notices: [] }); });
    return () => { live = false; };
  }, [uid, student.id]);

  const set = (k, v) => onChange({ ...docs, items: { ...items, [k]: v } });
  const add = (k, text) => set(k, items[k]?.trim() ? `${items[k].trim()}\n${text}` : text);

  // ما يُدرج من البوابة في كل بند
  const helpers = {
    problem: data?.results.filter((r) => r.p != null && r.p < 60).map(resLine).join("\n"),
    guidance: data?.notices.map((n) => `إشعار لولي الأمر عبر البوابة (${fmtDate(n.action_date)})`).join("\n"),
    support: data?.plans.map((p) => `خطة علاجية${p.quizzes?.title ? ` بعد ${p.quizzes.title}` : ""}` +
      `${p.skills ? `: ${p.skills}` : ""}${p.status === "done" ? " — نُفّذت" : " — قيد التنفيذ"}`).join("\n"),
    followup: data?.results.length > 1 ? data.results.map(resLine).join("\n") : "",
  };

  const sendNotice = async () => {
    setBusy("notice"); setErr("");
    try {
      await notifyGuardian(student.id, "ملاحظة على المستوى الدراسي لابنكم",
        `نفيدكم بتدني مستوى الطالب ${student.full_name} الدراسي أو تأخره في تسليم الأعمال، ونأمل متابعته ` +
        "والتواصل مع المدرسة عند الحاجة.", "academic");
      const d = await portalData(uid, student.id);
      setData(d);
      add("guidance", `إشعار لولي الأمر عبر البوابة (${fmtDate(todayISO())})`);
    } catch (e) { setErr(e.message); }
    setBusy("");
  };

  const upload = async (list) => {
    setBusy("file"); setErr("");
    const next = [...files];
    for (const f of list) {
      const pdf = f.type === "application/pdf";
      if (!pdf && !(f.type || "").startsWith("image/")) { setErr(`«${f.name}» ليس PDF ولا صورة.`); continue; }
      if (f.size > MAX_BYTES) { setErr(`«${f.name}» أكبر من 5 م.ب.`); continue; }
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${pdf ? "pdf" : (f.name.split(".").pop() || "jpg")}`;
      const { error } = await supabase.storage.from(REF_BUCKET).upload(path, f, { contentType: f.type });
      if (error) { setErr(/bucket/i.test(error.message) ? "لم يُفعَّل مخزن المرفقات بعد في قاعدة البيانات." : error.message); continue; }
      next.push({ path, name: f.name });
    }
    onChange({ ...docs, files: next });
    setBusy("");
  };

  const doneCount = ACADEMIC_ITEMS.filter((i) => academicItemDone(docs, i.key)).length;

  return (
    <div className="rounded-card border border-line bg-canvas/60 p-3 text-sm">
      <p className="mb-2 font-semibold text-ink">
        التوثيق المطلوب قبل الإحالة{" "}
        <span className="text-xs font-normal text-muted">— <span className="num">{doneCount}</span> من <span className="num">{ACADEMIC_ITEMS.length}</span></span>
      </p>
      <div className="space-y-3">
        {ACADEMIC_ITEMS.map((it) => (
          <div key={it.key} className="flex items-start gap-2">
            <Mark ok={academicItemDone(docs, it.key)} />
            <div className="min-w-0 flex-1">
              <p className="text-ink">{it.t}</p>
              <textarea rows={2} className="field mt-1 w-full text-xs" value={items[it.key] ?? ""}
                        onChange={(e) => set(it.key, e.target.value)}
                        placeholder={it.key === "evidence" ? "اختياري إن أرفقت ملفًا" : "اكتب ما نُفّذ وتاريخه"} />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {helpers[it.key] && (
                  <button type="button" onClick={() => add(it.key, helpers[it.key])}
                          className="rounded-pill bg-mint-light px-2.5 py-0.5 text-[11px] font-semibold text-mint-deep">
                    إدراج من البوابة
                  </button>
                )}
                {it.key === "guidance" && (
                  <button type="button" disabled={!!busy} onClick={sendNotice}
                          className="rounded-pill border border-mint-deep px-2.5 py-0.5 text-[11px] font-semibold text-mint-deep disabled:opacity-50">
                    {busy === "notice" ? "جارٍ الإرسال…" : "إرسال إشعار لولي الأمر الآن"}
                  </button>
                )}
                {it.key === "evidence" && (
                  <label className="cursor-pointer rounded-pill border border-line bg-white px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                    {busy === "file" ? "جارٍ الرفع…" : "إرفاق ملف (PDF أو صورة)"}
                    <input type="file" multiple accept="application/pdf,image/*" className="hidden"
                           onChange={(e) => { upload([...e.target.files]); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              {it.key === "evidence" && files.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted">
                  {files.map((f) => (
                    <li key={f.path} className="flex items-center gap-2">
                      <span className="truncate">📎 {f.name}</span>
                      <button type="button" className="text-absent underline"
                              onClick={() => onChange({ ...docs, files: files.filter((x) => x.path !== f.path) })}>
                        إزالة
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-muted">
        «إدراج من البوابة» يضيف ما سجّلته في البوابة لهذا الطالب. وما نُفّذ خارجها يُكتب ويُرفق ملفه.
      </p>
      {err && <p className="mt-2 rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">{err}</p>}
    </div>
  );
}

/* --------------------- عرض التوثيق للوكيل والموجه --------------------- */
export function DocsView({ r }) {
  const d = r.docs;
  if (!d || !r.ref_type) return null;
  const open = async (path) => {
    const { data } = await supabase.storage.from(REF_BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <div className="mt-2 rounded-sm2 border border-line bg-white px-3 py-2 text-xs leading-relaxed">
      <p className="mb-1 font-semibold text-ink">توثيق المعلم قبل الإحالة</p>
      {r.ref_type === "behavior" ? (
        <ul className="space-y-0.5 text-muted">
          {(d.steps ?? []).map((x) => <li key={x.t}>✓ {x.t} <span className="num">({x.date})</span></li>)}
          {d.direct && <li>مخالفة تُحال مباشرة (الدرجة الثالثة فما فوق).</li>}
          {d.urgent && <li className="font-semibold text-absent">إحالة عاجلة: {d.urgent}</li>}
        </ul>
      ) : (
        <ul className="space-y-1">
          {ACADEMIC_ITEMS.map((it) => (
            <li key={it.key}>
              <span className="font-semibold text-ink">{it.t}: </span>
              <span className="whitespace-pre-line text-muted">{d.items?.[it.key]?.trim() || "—"}</span>
            </li>
          ))}
          {(d.files ?? []).length > 0 && (
            <li className="flex flex-wrap gap-2">
              {d.files.map((f) => (
                <button key={f.path} type="button" onClick={() => open(f.path)} className="text-mint-deep underline">
                  📎 {f.name}
                </button>
              ))}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
