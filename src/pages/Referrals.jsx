// src/pages/Referrals.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useBackStep } from "../lib/backStep";
import { useSession, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { todayISO, todayDow, GRADE_NAMES } from "../lib/schoolTime";
import { currentPeriodNo, loadPeriodTimes } from "../lib/periodTimes";
import ReferralSheet, { ReferralPrintArea, behaviorLetter, sheetPages } from "../components/ReferralSheet.jsx";
import ViolationPicker from "../components/ViolationPicker.jsx";
import StudentPicker from "../components/StudentPicker.jsx";
import { degreeName, typeLabel } from "../lib/behavior";
import Loader from "../components/Loader.jsx";
import StudentFileLink from "../components/StudentFileLink.jsx";
import { useNotice } from "../lib/useNotice.js";
import { fmtDate } from "../lib/dates";
import { printReport, exportStyledExcel, STUDENT_DEPUTY_NAME, PRINCIPAL_NAME } from "../lib/exportUtils";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import { useUsageCounts } from "../lib/usage.js";
import UsageBadge from "../components/UsageBadge.jsx";
import {
  STATUS, OPEN_STATUSES, LATE_DAYS, stageOf, daysSince, daysLabel, isLate, chainOf, returnedByCounselor, REMIND_DAYS, NO_REPLY_DAYS, notifyUsers,
  PRESETS_TEACHER_DONE, PRESETS_BEHAVIOR_NOTE, PRESETS_DEPUTY_TRANSFER, PRESETS_COUNSELOR, PRESETS_DEPUTY_REVIEW,
  REF_TYPES, ACADEMIC_ITEMS, academicItemDone, docsSummary, refTypeLabel, notifyDeputies,
} from "../lib/referrals";
import { ReferralGuide, BehaviorSteps, AcademicDocs, DocsView } from "../components/ReferralProcedures.jsx";
import PresetChips from "../components/PresetChips.jsx";
import Sticker, { FlagPicker } from "../components/Sticker.jsx";
import { urgentPrefix } from "../lib/flags.js";
import { loadTermStart } from "../lib/officialAttendance";

/* =====================================================================
   إحالة الطالب — شاشة واحدة تخدم المسار كاملًا بحسب دور المستخدم:
   • المعلم: يرفع الإحالة من فصوله، وتُملأ المادة والحصة تلقائيًا.
   • وكيل شؤون الطلاب: يكتب ما عمله ويحوّلها للموجه، ثم يقفلها أو يعيدها.
   • الموجه الطلابي: يكتب إجراءه.
   • ولي الأمر: يؤكّد استلامه ويكتب ردّه.
   وتبويب «قيد المتابعة» يُري الوكيل والمدير أين وصلت كل إحالة ومنذ متى.
   وكل مرحلة تُوثَّق بتوقيع صاحبها إلكترونيًا.
   ===================================================================== */

const signedUrl = async (path) => {
  if (!path) return null;
  const { data } = await supabase.storage.from("form-assets").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
};

export default function Referrals() {
  const { session, profile, adminRoles, effectiveRole } = useSession();
  const usage = useUsageCounts();
  const uid = session?.user?.id;
  const roles = adminRoles ?? [];

  const isDeputy = roles.includes("deputy_students") ||
                   roles.includes("principal") || roles.includes("tech_support");
  const isCounselor = roles.some((r) => r.startsWith("counselor"));
  const isTeacher = effectiveRole === "teacher";

  const [rows, setRows] = useState(null);
  const [params, setParams] = useSearchParams();
  // ?open=<id> من «بانتظار إجرائك»: تُعرض تلك الإحالة وحدها مفتوحة، مع زر لعرض الكل
  const openId = params.get("open");
  const [tab, setTab] = useState(
    params.get("tab") === "follow" && isDeputy ? "follow"
      : params.get("tab") === "behavior" && isDeputy ? "behavior"
      : ["inbox", "all"].includes(params.get("tab")) ? params.get("tab") : isTeacher ? "new" : "inbox");
  const [msg, setMsg] = useNotice(null);
  const [viewing, setViewing] = useState(null);
  // ملف الإحالة يُفتح داخل الصفحة: زر الرجوع يغلقه بدل مغادرة الصفحة
  useBackStep(!!viewing, () => setViewing(null), "رجوع إلى الإحالات");

  const load = async () => {
    const { data } = await supabase.from("student_referrals")
      .select("*").order("created_at", { ascending: false }).limit(200);
    // رقم هوية الطالب للبطاقة (لا يُحفظ في الإحالة): من سجل الطلاب لمن يحق له قراءته
    const ids = [...new Set((data ?? []).map((r) => r.student_id).filter(Boolean))];
    const nid = {};
    for (let i = 0; i < ids.length; i += 150) {
      const { data: st } = await supabase.from("students").select("id, national_id").in("id", ids.slice(i, i + 150));
      (st ?? []).forEach((x) => { nid[x.id] = x.national_id; });
    }
    setRows((data ?? []).map((r) => ({ ...r, student_nid: nid[r.student_id] ?? null })));
  };

  useEffect(() => { load(); }, [uid]);

  const mine = useMemo(() => {
    const all = rows ?? [];
    // من جمع الدورين يرى وارد الاثنين
    if (isDeputy || isCounselor) return all.filter((r) =>
      (isDeputy && ["with_deputy", "guardian_replied"].includes(r.status)) ||
      (isCounselor && ["with_counselor", "returned_to_counselor"].includes(r.status) &&
       r.counselor_id === uid));
    return all.filter((r) => r.teacher_id === uid);
  }, [rows, isDeputy, isCounselor, uid]);

  // كل ما لم يُنهَ، الأقدم في مرحلته أولًا
  const following = useMemo(() =>
    (rows ?? []).filter((r) => OPEN_STATUSES.includes(r.status))
      .sort((a, b) => new Date(stageOf(a).since) - new Date(stageOf(b).since)),
  [rows]);

  const listed = tab === "inbox" ? mine : rows ?? [];
  const focused = openId ? (rows ?? []).find((r) => r.id === openId) ?? null : null;
  const shown = focused && (tab === "inbox" || tab === "all") ? [focused] : listed;
  const showAll = () => { params.delete("open"); setParams(params, { replace: true }); };

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-5">
      <div className="no-print">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink">إحالة الطالب</h1>
          <UsageBadge map={usage} category="referral" itemKey="referral" />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          سلسلة من ست حلقات، لكل حلقة صاحب واحد: معالجة المعلم ← رفع الإحالة ← قرار الوكيل
          ← إجراء الموجه (إن حوّلها الوكيل) ← ولي الأمر ← الإغلاق. لا تُفتح حلقة قبل اكتمال التي قبلها.
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-1.5">
        {isTeacher && (
          <button className={pill(tab === "new")} onClick={() => setTab("new")}>طلابي</button>
        )}
        <button className={pill(tab === "inbox")} onClick={() => setTab("inbox")}>
          {isDeputy || isCounselor ? "بانتظار إجرائي" : "ملفاتي"}
          {mine.length > 0 && <span className="num"> ({mine.length})</span>}
        </button>
        {isDeputy && (
          <button className={pill(tab === "follow")} onClick={() => setTab("follow")}>
            المتابعة
            {following.length > 0 && <span className="num"> ({following.length})</span>}
          </button>
        )}
        {isDeputy && (
          <button className={pill(tab === "behavior")} onClick={() => setTab("behavior")}>+ إحالة مخالفة يرصدها الوكيل</button>
        )}
        <button className={pill(tab === "all")} onClick={() => setTab("all")}>السجل</button>
      </div>

      {msg && (
        <p className={`no-print rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {tab === "new" && isTeacher && (
        <NewReferral key="new" uid={uid} profile={profile} onDone={(t) => { setMsg(t); setTab("inbox"); load(); }} />
      )}

      {tab === "behavior" && isDeputy && (
        <NewBehaviorReferral uid={uid} profile={profile}
          onDone={(t) => { setMsg(t); if (t.ok) { setTab("follow"); load(); } }} />
      )}

      {tab === "follow" && isDeputy && (
        <FollowUp list={following} rows={rows} uid={uid} profile={profile} roles={roles}
                  isDeputy={isDeputy} isCounselor={isCounselor}
                  onOpen={setViewing} onChange={(t) => { setMsg(t); load(); }} />
      )}

      {(tab === "inbox" || tab === "all") && (
        <div className="no-print space-y-2">
          {tab === "all" && rows?.length > 0 && (
            <ReportBar list={rows} title="سجل الإحالات" />
          )}
          {!rows && <Loader compact />}
          {focused && (
            <div className="flex flex-wrap items-center gap-2 rounded-sm2 bg-mint-tint/60 px-3 py-2 text-xs text-mint-deep">
              <span>تعرض الإحالة التي اخترتها وحدها.</span>
              <button className="mr-auto font-semibold underline" onClick={showAll}>
                عرض كل الإحالات{tab === "inbox" && mine.length > 1 ? ` (${mine.length})` : ""}</button>
            </div>
          )}
          {shown.length === 0 && rows && (
            <p className="card px-4 py-6 text-sm text-muted">لا إحالات هنا.</p>
          )}
          {shown.map((r) => (
            <ReferralRow key={r.id} r={r} uid={uid} profile={profile} roles={roles} focus={r.id === openId}
                         isDeputy={isDeputy} isCounselor={isCounselor}
                         onOpen={setViewing} onChange={(t) => { setMsg(t); load(); }} />
          ))}
        </div>
      )}

      {viewing && (
        <SheetModal r={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

/* ------------------ إحالة مخالفة سلوكية (وكيل شؤون الطلاب) ------------------
   الوكيل يختار الطالب والمخالفة من دليل السلوك والمواظبة، فيصدر خطاب إحالة
   للموجه الطلابي مباشرة. ثم يسير في المسار نفسه: إجراء الموجه ← اعتماد الوكيل
   ← إشعار ولي الأمر بالنموذج. */
function NewBehaviorReferral({ uid, profile, onDone }) {
  const [flag, setFlag] = useState(null);
  const [student, setStudent] = useState(null);
  const [violation, setViolation] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [counselors, setCounselors] = useState([]);
  const [counselor, setCounselor] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("admin_roles").select("user_id, role_type, users(full_name)")
      .in("role_type", ["counselor_1", "counselor_2", "counselor_3"])
      .then(({ data }) => setCounselors((data ?? []).map((x) => ({
        id: x.user_id, name: x.users?.full_name ?? "",
        role: ADMIN_ROLE_LABEL[x.role_type] ?? x.role_type,
        grade: Number(String(x.role_type).replace(/\D/g, "")) || null,
      }))));
  }, []);

  const pick = (s) => {
    setStudent(s);
    // الإسناد الآلي: موجه صف الطالب
    const auto = counselors.find((c) => c.grade === s.grade);
    if (auto) setCounselor(auto.id);
  };

  const c = counselors.find((x) => x.id === counselor);
  const classLabel = student ? `${GRADE_NAMES[student.grade] ?? ""} — فصل ${student.class_no}` : "";
  const draft = student && violation ? {
    kind: "behavior", student_name: student.full_name, class_label: classLabel,
    counselor_name: c?.name ?? "", violation_degree: violation.degree, violation_text: violation.text,
    violation_date: date,
  } : null;

  const submit = async () => {
    if (!draft || !c) return;
    setBusy(true);
    const { data: serial } = await supabase.rpc("next_referral_serial");
    const { data: sig } = await supabase.from("user_signatures").select("path").eq("user_id", uid).maybeSingle();
    const now = new Date().toISOString();
    const { error } = await supabase.from("student_referrals").insert({
      serial, kind: "behavior",
      student_id: student.student_id, student_name: student.full_name,
      class_label: classLabel, grade: student.grade ?? null,
      referral_date: todayISO(),
      violation_degree: violation.degree, violation_type: violation.type,
      violation_text: violation.text, violation_date: date,
      reason: `مخالفة سلوكية من الدرجة ${degreeName(violation.degree)}: ${violation.text}`,
      teacher_at: null,
      deputy_id: uid, deputy_name: profile?.full_name ?? "", deputy_note: note.trim() || null,
      deputy_sig: sig?.path ?? null, deputy_at: now,
      counselor_id: c.id, counselor_name: c.name,
      status: "with_counselor",
      ...(flag ? { flag } : {}),
    });
    if (!error) {
      await notifyUsers([c.id], urgentPrefix(flag) + "إحالة مخالفة سلوكية",
        `أحال إليك وكيل شؤون الطلاب الطالب ${student.full_name} لارتكابه مخالفة سلوكية من الدرجة ${degreeName(violation.degree)} (${serial}).`,
        "/referrals");
    }
    setBusy(false);
    onDone(error
      ? { ok: false, text: /column|kind|violation/i.test(error.message)
          ? "نفّذ ملف supabase/behavior_referrals.sql أولًا من Supabase ← SQL Editor." : error.message }
      : { ok: true, text: `أُحيل الطالب للموجه ${c.name} برقم ${serial}، وأُشعر بها.` });
  };

  return (
    <section className="card space-y-4 p-4">
      <div>
        <p className="text-sm font-bold text-ink">إحالة طالب للموجه الطلابي — مخالفة سلوكية</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          المخالفات من دليل السلوك والمواظبة للمرحلة الثانوية. بعد إجراء الموجه تعود إليك للاعتماد،
          ثم يُشعر ولي الأمر ويظهر له النموذج.
        </p>
      </div>

      <div>
        <label className="text-xs text-muted">الطالب</label>
        <div className="mt-1"><StudentPicker value={student} onChange={(x) => (x ? pick(x) : setStudent(null))} /></div>
      </div>

      <div>
        <label className="text-xs text-muted">المخالفة السلوكية</label>
        <div className="mt-1.5"><ViolationPicker value={violation} onChange={setViolation} /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted">تاريخ المخالفة</label>
          <input type="date" className="field mt-1 w-full" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted">الموجه الطلابي</label>
          <select className="field mt-1 w-full" value={counselor} onChange={(e) => setCounselor(e.target.value)}>
            <option value="">اختر الموجه الطلابي…</option>
            {counselors.map((x) => (
              <option key={x.id} value={x.id}>{x.name} — {x.role}{student && x.grade === student.grade ? " (موجه الصف)" : ""}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">ملاحظات الوكيل (اختياري)</label>
        <PresetChips items={PRESETS_BEHAVIOR_NOTE} value={note} onChange={setNote} />
        <textarea rows={2} className="field mt-1 w-full" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="ما اتُّخذ من إجراء أو تفاصيل الواقعة" />
      </div>

      {draft && (
        <div className="rounded-sm2 border border-line bg-canvas/50 px-4 py-3">
          <p className="mb-1.5 text-[11px] font-semibold text-muted">نص الخطاب</p>
          {behaviorLetter(draft).map((line, i) => (
            <p key={i} className={`text-[13px] leading-[1.9] text-ink ${i === 0 ? "font-bold" : ""}`}>{line}</p>
          ))}
          <p className="mt-1 text-[11px] text-faint">{typeLabel(violation.type)}</p>
        </div>
      )}

      <FlagPicker value={flag} onChange={setFlag} hint="يظهر للموجه على المهمة، والعاجل في أول قائمته" />

      <button className="btn-primary w-full" disabled={!draft || !c || busy} onClick={submit}>
        {busy ? "جارٍ الإرسال…" : "إصدار الإحالة وإرسالها للموجه"}
      </button>
    </section>
  );
}

/* ------------------------- إحالة جديدة (المعلم) ------------------------- */
function NewReferral({ uid, profile, onDone }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [ctx, setCtx] = useState({ subject: "", period: null, className: "", grade: null });
  const [reasons, setReasons] = useState([]);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState("");
  const [sig, setSig] = useState(null);
  const [busy, setBusy] = useState(false);
  // إحالة من خارج فصوله: حصة انتظار أو إشراف أو مناوبة — تفتح له كل فصول المدرسة وطلابها
  const [outside, setOutside] = useState(false);
  const [cap, setCap] = useState("");
  const [allClasses, setAllClasses] = useState(null);
  const [gradeSel, setGradeSel] = useState(null);
  const [outErr, setOutErr] = useState("");
  const [nowPeriod, setNowPeriod] = useState(null);
  const ownAuto = useRef(null);
  // نوع الإحالة وإجراءات المعلم قبلها (supabase/referral_procedures_*.sql)
  const [refType, setRefType] = useState("behavior");
  const [violation, setViolation] = useState(null);
  const [steps, setSteps] = useState({ ready: false, steps: [] });
  const [docs, setDocs] = useState({ items: {}, files: [] });
  const [urgent, setUrgent] = useState(null);   // null = غير عاجلة، نص = سبب الإحالة العاجلة
  const [flag, setFlag] = useState(null);       // الملصق؛ والإحالة العاجلة «عاجل» ما لم يُختر غيره

  // فصول المعلم اليوم مع مادته وحصته
  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term", "referral_reasons"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      setReasons((m.referral_reasons ?? "").split("|").filter(Boolean));

      const { data: t } = await supabase.from("teachers")
        .select("id").eq("user_id", uid).maybeSingle();
      if (!t) return;

      const { data: sch } = await supabase.from("schedule")
        .select("id, period_no, day_of_week, class_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t.id)
        .eq("academic_year", m.active_year ?? "")
        .eq("term", Number(m.active_term ?? 1))
        .order("period_no");

      // فصول اليوم أولًا، ثم بقية فصوله
      const dow = todayDow();
      const today = (sch ?? []).filter((x) => x.day_of_week === dow);
      const seen = new Set();
      const list = [...today, ...(sch ?? [])].filter((x) => {
        if (seen.has(x.class_id)) return false;
        seen.add(x.class_id); return true;
      });
      setClasses(list);

      // الحصة الجارية تُحدّد الفصل تلقائيًا
      const { rows: pt } = await loadPeriodTimes();
      const now = currentPeriodNo(pt);
      const auto = today.find((x) => x.period_no === now) ?? today[0] ?? list[0];
      setNowPeriod(now ?? null);
      ownAuto.current = auto ?? null;
      if (auto) pickClass(auto, list);

      const { data: s } = await supabase.from("user_signatures")
        .select("path").eq("user_id", uid).maybeSingle();
      setSig(s?.path ?? null);
    })();
  }, [uid]);

  // رصد مخالفة: أين وصل كل طالب من الخطوات الثلاث في دورته الحالية
  const [progress, setProgress] = useState({});
  const loadProgress = async (ids) => {
    if (!ids.length) return;
    const term = await loadTermStart(todayISO());
    const [{ data: refs }, { data: acts }] = await Promise.all([
      supabase.from("student_referrals").select("student_id, created_at").eq("teacher_id", uid).in("student_id", ids),
      supabase.from("student_actions").select("student_id, action, created_at, action_date")
        .eq("teacher_id", uid).eq("category", "behavior").in("student_id", ids)
        .gte("action_date", term ?? "1900-01-01"),
    ]);
    const lastRef = {};
    (refs ?? []).forEach((r) => { if (!lastRef[r.student_id] || r.created_at > lastRef[r.student_id]) lastRef[r.student_id] = r.created_at; });
    const m = {};
    (acts ?? []).forEach((a) => {
      if (lastRef[a.student_id] && a.created_at <= lastRef[a.student_id]) return;
      (m[a.student_id] ??= new Set()).add(a.action);
    });
    setProgress(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.size])));
  };

  const pickClass = async (row, list) => {
    setClassId(row.class_id);
    setCtx({
      subject: row.subjects?.name ?? "",
      period: row.period_no ?? null,
      className: row.classes?.class_no ?? "",
      grade: row.classes?.grade ?? null,
    });
    const { data } = await supabase.from("student_enrollment")
      .select("students(id, full_name)").eq("class_id", row.class_id).eq("status", "active");
    const list2 = (data ?? []).map((e) => e.students).filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    setStudents(list2);
    setStudentId("");
    setProgress({});
    loadProgress(list2.map((x) => x.id));
  };

  const CAPACITIES = ["حصة انتظار", "إشراف", "مناوبة"];

  const openOutside = async () => {
    setOutside(true); setOutErr("");
    setClassId(null); setStudents([]); setStudentId("");
    setCtx({ subject: cap, period: nowPeriod, className: "", grade: null });
    if (allClasses) return;
    const { data, error } = await supabase.rpc("referral_all_classes");
    if (error) {
      setOutErr("تعذّر فتح طلاب المدرسة — لم يُفعَّل هذا الإجراء بعد في قاعدة البيانات.");
      setAllClasses([]);
      return;
    }
    setAllClasses(data ?? []);
  };

  const closeOutside = () => {
    setOutside(false); setOutErr(""); setCap(""); setGradeSel(null);
    setClassId(null); setStudents([]); setStudentId("");
    if (ownAuto.current) pickClass(ownAuto.current, classes);
  };

  const pickCap = (c) => {
    setCap(c);
    setCtx((x) => ({ ...x, subject: c }));
  };

  const pickOutsideClass = async (c) => {
    setClassId(c.class_id);
    setCtx({ subject: cap, period: nowPeriod, className: c.class_no, grade: c.grade });
    setStudentId("");
    const { data, error } = await supabase.rpc("referral_class_students", { p_class: c.class_id });
    if (error) { setOutErr("تعذّر تحميل طلاب الفصل."); setStudents([]); return; }
    setOutErr("");
    setStudents(data ?? []);
  };

  const student = students.find((s) => s.id === studentId) ?? null;
  const direct = (violation?.degree ?? 0) >= 3;
  const urgentOk = !!urgent?.trim();
  const fullReason = refType === "behavior"
    ? (violation ? `مخالفة سلوكية من الدرجة ${degreeName(violation.degree)}: ${violation.text}` +
                   (reason.trim() ? ` — ${reason.trim()}` : "") : "")
    : `${refTypeLabel(refType)}${ctx.subject && !outside ? ` في مادة ${ctx.subject}` : ""}` +
      (reason.trim() ? `: ${reason.trim()}` : "");
  const academicMissing = ACADEMIC_ITEMS.filter((i) => !academicItemDone(docs, i.key)).length;

  // الحلقة الأولى: اكتملت المعالجة أو تُجاوزت بسبب موثّق (درجة ثالثة، عاجلة، من خارج الفصل)
  const stepsDone = steps.steps.length;
  const l1 = refType !== "behavior"
    ? (academicMissing === 0 ? { state: "done", note: "التوثيق الدراسي" }
                             : { state: "now", note: `${ACADEMIC_ITEMS.length - academicMissing}/${ACADEMIC_ITEMS.length}` })
    : outside ? { state: "skip", note: "من خارج فصولك" }
    : direct ? { state: "skip", note: "درجة ثالثة فما فوق" }
    : urgentOk ? { state: "skip", note: "حالة عاجلة" }
    : steps.ready ? { state: "done", note: "3/3" }
    : { state: "now", note: `${stepsDone}/3` };
  const locked = !student || ["now"].includes(l1.state) || (refType === "behavior" && !violation);
  const draftChain = [
    { key: "teacher", t: "معالجة المعلم", ...l1 },
    { key: "submit", t: "رفع الإحالة", state: locked ? "todo" : "now" },
    { key: "deputy", t: "قرار الوكيل", state: "todo" },
    { key: "counselor", t: "إجراء الموجه", optional: true, state: "todo" },
    { key: "guardian", t: "ولي الأمر", state: "todo" },
    { key: "close", t: "الإغلاق", state: "todo" },
  ];

  // ما يمنع الرفع، بالترتيب
  const blocker = !studentId ? "اختر الطالب."
    : outside && !cap ? "اختر الصفة التي تحيل بها."
    : refType === "behavior" && !violation ? "اختر المخالفة من دليل السلوك والمواظبة."
    : refType === "behavior" && !outside && !direct && !urgentOk && urgent !== null ? "اكتب سبب الإحالة العاجلة."
    : refType === "behavior" && !outside && !direct && !urgentOk && !steps.ready
      ? "تُرفع الإحالة بعد استكمال الإجراءات الثلاثة، كل منها في موقف مستقل. المخالفات من الدرجة الثالثة فما فوق تُحال مباشرة."
    : refType !== "behavior" && academicMissing > 0 ? `أكمل التوثيق: بقي ${academicMissing} من ${ACADEMIC_ITEMS.length}.`
    : refType !== "behavior" && !reason.trim() ? "اكتب سبب التحويل."
    : "";

  const submit = async () => {
    if (blocker) return;
    setBusy(true);
    const { data: serial } = await supabase.rpc("next_referral_serial");
    const refDocs = refType === "behavior"
      ? { steps: urgentOk || direct || outside ? [] : steps.steps, direct, urgent: urgentOk ? urgent.trim() : null }
      : docs;
    const summary = docsSummary(refType, refDocs);

    const { error } = await supabase.from("student_referrals").insert({
      serial,
      student_id: studentId,
      student_name: student?.full_name ?? "",
      class_label: `${GRADE_NAMES[ctx.grade] ?? ""} — فصل ${ctx.className}`.trim(),
      grade: ctx.grade ?? null,
      teacher_id: uid,
      teacher_name: profile?.full_name ?? "",
      subject: ctx.subject,
      period_no: ctx.period,
      referral_date: todayISO(),
      reason: fullReason,
      done_in_class: [summary, done.trim()].filter(Boolean).join("\n") || null,
      teacher_sig: sig,
      status: "with_deputy",
      ref_type: refType,
      docs: refDocs,
      urgent_reason: urgentOk ? urgent.trim() : null,
      ...(flag || urgentOk ? { flag: flag ?? "urgent" } : {}),
      ...(refType === "behavior" ? { violation_degree: violation.degree, violation_type: violation.type ?? null,
                                     violation_text: violation.text } : {}),
      ...(outside ? { outside_class: true } : {}),
    });
    setBusy(false);
    if (!error) notifyDeputies(urgentPrefix(flag ?? (urgentOk ? "urgent" : null)) + "إحالة طالب جديدة من معلم",
      `رفع ${profile?.full_name ?? "معلم"} إحالة ${student?.full_name ?? ""} برقم ${serial}.`);
    onDone(error ? { ok: false, text: /ref_type|docs|urgent_reason|schema cache/i.test(error.message)
                       ? "لم تُفعَّل إجراءات الإحالة الجديدة بعد في قاعدة البيانات." : error.message }
                 : { ok: true, text: `أُرسلت الإحالة ${serial} لوكيل شؤون الطلاب.` });
  };

  return (
    <section className="card space-y-4 p-4">
      {!outside ? (
        <div>
          <label className="text-xs text-muted">الفصل</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <button key={c.class_id} type="button" onClick={() => pickClass(c, classes)}
                className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  classId === c.class_id ? "bg-mint-deep text-white"
                                         : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                فصل {c.classes?.class_no}
                <span className="text-[11px] opacity-75"> · {c.subjects?.name}</span>
              </button>
            ))}
            {classes.length === 0 && <p className="text-sm text-muted">لا فصول مسندة إليك.</p>}
          </div>
          <button type="button" onClick={openOutside}
            className="mt-3 rounded-sm2 border border-dashed border-mint-deep/50 bg-mint-tint px-3.5 py-2 text-xs font-semibold text-mint-deep hover:bg-mint-light">
            طالب من خارج فصولي — حصة انتظار أو إشراف أو مناوبة
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-sm2 border border-mint-deep/30 bg-mint-tint/50 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-mint-deep">
              إحالة من خارج فصولك: فُتح لك طلاب المدرسة كلهم، وتُوثَّق الإحالة بصفتك.
            </p>
            <button type="button" onClick={closeOutside}
                    className="shrink-0 text-xs font-medium text-muted underline hover:text-ink">
              العودة لفصولي
            </button>
          </div>

          <div>
            <label className="text-xs text-muted">بأي صفة تحيل؟</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CAPACITIES.map((c) => (
                <button key={c} type="button" onClick={() => pickCap(c)}
                  className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    cap === c ? "bg-mint-deep text-white"
                              : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {outErr && <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">{outErr}</p>}

          {allClasses === null ? (
            <p className="text-xs text-muted">جارٍ تحميل الفصول…</p>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted">الصف</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[...new Set(allClasses.map((c) => c.grade))].map((g) => (
                    <button key={g} type="button" onClick={() => { setGradeSel(g); setClassId(null); setStudents([]); setStudentId(""); }}
                      className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        gradeSel === g ? "bg-mint-deep text-white"
                                       : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                      {GRADE_NAMES[g] ?? `صف ${g}`}
                    </button>
                  ))}
                </div>
              </div>
              {gradeSel != null && (
                <div>
                  <label className="text-xs text-muted">الفصل</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {allClasses.filter((c) => c.grade === gradeSel).map((c) => (
                      <button key={c.class_id} type="button" onClick={() => pickOutsideClass(c)}
                        className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                          classId === c.class_id ? "bg-mint-deep text-white"
                                                 : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                        فصل {c.class_no}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {classId && (
        <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs text-mint-deep">
          {ctx.subject || (outside ? "اختر الصفة" : "")} · الحصة <span className="num">{ctx.period ?? "—"}</span> ·{" "}
          {GRADE_NAMES[ctx.grade] ?? ""} فصل <span className="num">{ctx.className}</span>
        </p>
      )}

      <div>
        <label className="text-xs text-muted">الطالب</label>
        <select className="field mt-1 w-full" value={studentId}
                onChange={(e) => setStudentId(e.target.value)}>
          <option value="">اختر الطالب…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}{progress[s.id] ? ` — المعالجة ${progress[s.id]} من 3` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* سلسلة الطالب المختار: أين هو من الحلقتين الأوليين */}
      {student && <ReferralChain links={draftChain} />}

      {/* نوع الإحالة: السلوكية بالتدرج، والدراسية بشروط الموجه الطلابي */}
      <div>
        <label className="text-xs text-muted">نوع الإحالة</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {REF_TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setRefType(t.key)}
              className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                refType === t.key ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ReferralGuide type={refType} />

      {refType === "behavior" && (
        <div>
          <label className="text-xs text-muted">المخالفة من دليل السلوك والمواظبة</label>
          <div className="mt-1.5"><ViolationPicker value={violation} onChange={setViolation} /></div>
        </div>
      )}

      {student && !outside && refType === "behavior" && violation && urgent === null && (
        <BehaviorSteps key={student.id} uid={uid} student={student} violation={violation}
                       subject={ctx.subject}
                       onState={(st) => { setSteps(st); setProgress((p) => ({ ...p, [student.id]: st.steps.length })); }} />
      )}
      {student && outside && refType === "behavior" && violation && (
        <p className="rounded-sm2 bg-canvas px-3 py-2 text-xs text-muted">
          الطالب من خارج فصولك: تُرفع الإحالة مباشرة، وتدرّج الإجراءات على معلمه.
        </p>
      )}

      {student && refType !== "behavior" && (
        <AcademicDocs key={student.id} uid={uid} student={student} docs={docs} onChange={setDocs} />
      )}

      {refType === "behavior" && violation && !outside && !direct && (
        urgent === null ? (
          <button type="button" onClick={() => setUrgent("")}
                  className="text-xs text-muted underline hover:text-ink">
            حالة عاجلة تمس السلامة؟ أحِل مباشرة مع ذكر السبب
          </button>
        ) : (
          <div className="space-y-1.5 rounded-sm2 border border-absent/30 bg-absent/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-absent">سبب الإحالة العاجلة</label>
              <button type="button" onClick={() => setUrgent(null)} className="text-xs text-muted underline">إلغاء</button>
            </div>
            <textarea rows={2} className="field w-full" value={urgent} onChange={(e) => setUrgent(e.target.value)}
                      placeholder="مثل: خطر على سلامة الطالب أو زملائه" />
          </div>
        )
      )}

      {/* ② رفع الإحالة: تُفتح بعد اكتمال الحلقة الأولى أو تجاوزها بسبب */}
      {locked ? (
        <div className="rounded-card border border-dashed border-line bg-canvas/60 px-3 py-3">
          <p className="text-sm font-semibold text-muted">رفع الإحالة — مقفلة</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{blocker || "اختر الطالب ونوع الإحالة."}</p>
        </div>
      ) : <>
      <p className="border-t border-line pt-3 text-sm font-semibold text-ink">رفع الإحالة لوكيل شؤون الطلاب</p>
      <div>
        <label className="text-xs text-muted">{refType === "behavior" ? "تفاصيل الموقف (اختياري)" : "سبب التحويل"}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {reasons.map((t) => (
            <button key={t} type="button" onClick={() => setReason(t)}
                    className="rounded-pill border border-mint-light bg-mint-tint px-3 py-1 text-[11.5px] font-medium text-mint-deep hover:bg-mint-light">
              {t}
            </button>
          ))}
        </div>
        <textarea rows={2} className="field mt-1.5 w-full" value={reason}
                  placeholder="اختر صيغة أو اكتب السبب"
                  onChange={(e) => setReason(e.target.value)} />
      </div>

      {refType === "behavior" && (
        <div>
          <label className="text-xs text-muted">ما تم عمله أيضًا (اختياري)</label>
          <PresetChips items={PRESETS_TEACHER_DONE} value={done} onChange={setDone} />
          <textarea rows={2} className="field mt-1 w-full" value={done}
                    onChange={(e) => setDone(e.target.value)} />
        </div>
      )}

      <FlagPicker value={flag ?? (urgentOk ? "urgent" : null)} onChange={setFlag}
                  hint="يظهر للوكيل على المهمة، والعاجل في أول قائمته" />

      {blocker && <p className="rounded-sm2 bg-warning-light px-3 py-2 text-xs text-warning">{blocker}</p>}

      {!sig && (
        <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
          لم ترفع توقيعك بعد. يمكنك الإرسال، ويفضّل رفعه من صفحة «توقيعي».
        </p>
      )}

      <button className="btn-primary w-full" disabled={!!blocker || busy}
              onClick={submit}>
        {busy ? "جارٍ الإرسال…" : "رفع الإحالة لوكيل شؤون الطلاب"}
      </button>
      </>}
    </section>
  );
}

/* ------------------ قيد المتابعة (الوكيل والمدير) ------------------ */
const GROUPS = [
  { k: "all",       t: "الكل" },
  { k: "late",      t: "المتأخرة" },
  { k: "deputy",    t: "عند الوكيل" },
  { k: "counselor", t: "عند الموجهين" },
  { k: "teacher",   t: "عند المعلم" },
  { k: "guardian",  t: "عند ولي الأمر" },
];

function FollowUp({ list, rows, onOpen, onChange, ...rowProps }) {
  const [g, setG] = useState("all");

  const count = (k) => k === "all" ? list.length
    : k === "late" ? list.filter(isLate).length
    : list.filter((r) => stageOf(r).group === k).length;

  const shown = g === "all" ? list
    : g === "late" ? list.filter(isLate)
    : list.filter((r) => stageOf(r).group === g);

  // حِمل كل موجه: ما عنده الآن وكم تأخر منه
  const byCounselor = useMemo(() => {
    const m = new Map();
    list.filter((r) => stageOf(r).group === "counselor").forEach((r) => {
      const k = r.counselor_name || "—";
      const v = m.get(k) ?? { n: 0, late: 0 };
      v.n += 1; if (isLate(r)) v.late += 1;
      m.set(k, v);
    });
    return [...m.entries()];
  }, [list]);

  if (!rows) return <Loader compact />;

  return (
    <div className="no-print space-y-3">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GROUPS.slice(1).map((x) => (
          <button key={x.k} onClick={() => setG(x.k)}
                  className={`card p-3 text-right transition-colors ${
                    g === x.k ? "ring-2 ring-mint-deep" : "hover:bg-canvas"}`}>
            <p className="text-xs text-muted">{x.t}</p>
            <p className={`num mt-1 text-2xl font-bold ${
              x.k === "late" && count("late") ? "text-absent" : "text-ink"}`}>{count(x.k)}</p>
          </button>
        ))}
      </section>

      {byCounselor.length > 0 && (
        <p className="text-xs leading-relaxed text-muted">
          <span className="text-faint">عند الموجهين: </span>
          {byCounselor.map(([name, v], i) => (
            <span key={name}>
              {i > 0 && " · "}
              {name} <span className="num">{v.n}</span>
              {v.late > 0 && <span className="text-absent"> (<span className="num">{v.late}</span> متأخرة)</span>}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((x) => (
          <button key={x.k} onClick={() => setG(x.k)}
                  className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                    g === x.k ? "bg-ink text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {x.t} <span className="num">({count(x.k)})</span>
          </button>
        ))}
      </div>

      {shown.length > 0 && (
        <ReportBar list={shown}
                   title={g === "all" ? "تقرير متابعة الإحالات"
                                      : `تقرير متابعة الإحالات — ${GROUPS.find((x) => x.k === g).t}`} />
      )}

      <p className="text-[11px] text-faint">
        الأقدم في مرحلته أولًا. تُعدّ متأخرة إن بقيت في مرحلتها أكثر من <span className="num">{LATE_DAYS}</span> أيام.
      </p>

      {shown.length === 0 && <p className="card px-4 py-6 text-sm text-muted">لا إحالات هنا.</p>}
      {shown.map((r) => (
        <ReferralRow key={r.id} r={r} {...rowProps} onOpen={onOpen} onChange={onChange} />
      ))}
    </div>
  );
}

/* ------------------ تقرير المتابعة (طباعة / Excel) ------------------ */
const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const REPORT_HEADERS = [
  "م", "رقم الإحالة", "الطالب", "الفصل", "سبب الإحالة", "المعلم",
  "تاريخ الرفع", "الحالة", "عند من الآن", "المدة",
];

/* صف لكل إحالة: حالتها، وعند من هي الآن ولماذا، ومنذ متى */
function reportRows(list) {
  return list.map((r, i) => {
    const s = stageOf(r);
    const open = s.group !== "done";
    const late = isLate(r);
    return {
      late,
      cells: [
        i + 1, r.serial ?? "", r.student_name ?? "", r.class_label ?? "", r.reason ?? "",
        r.teacher_name ?? "", fmtDate(r.teacher_at ?? r.created_at),
        STATUS[r.status]?.t ?? r.status,
        open ? `${s.who} — ${s.what}` : "—",
        open ? daysLabel(daysSince(s.since)) + (late ? " (متأخرة)" : "")
             : r.closed_at ? `أُقفلت ${fmtDate(r.closed_at)}` : "—",
      ],
    };
  });
}

function ReportBar({ list, title }) {
  const summary = () => {
    const open = list.filter((r) => OPEN_STATUSES.includes(r.status)).length;
    const late = list.filter(isLate).length;
    return `عدد الإحالات ${list.length} · قيد المتابعة ${open} · متأخرة ${late}` +
           ` · منتهية ${list.length - open} — حتى ${fmtDate(new Date())}`;
  };
  const note = `تُعدّ الإحالة متأخرة إن بقيت في مرحلتها أكثر من ${LATE_DAYS} أيام.`;
  const signatures = [
    { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
    { title: "مدير المدرسة", name: PRINCIPAL_NAME },
  ];

  const print = () => printReport({
    title, subtitle: summary(), headers: REPORT_HEADERS, note, signatures, landscape: true,
    rows: reportRows(list).map(({ late, cells }) => cells.map((c, k) =>
      k === 9 && late ? { text: escHtml(c), cls: "st-absent" } : escHtml(c))),
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  });

  const excel = () => exportStyledExcel({
    title, subtitle: summary(), headers: REPORT_HEADERS, note, signatures,
    rows: reportRows(list).map((x) => x.cells),
    fileName: "متابعة-الإحالات", sheetName: "الإحالات",
  });

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={print}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
        طباعة التقرير / PDF
      </button>
      <button onClick={excel}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
        تصدير Excel
      </button>
    </div>
  );
}

/* --------------------------- صف الإحالة --------------------------- */
function ReferralRow({ r, uid, profile, roles, isDeputy, isCounselor, onOpen, onChange, focus = false }) {
  const [flag, setFlag] = useState(r.flag ?? null);
  // المفتوحة من «بانتظار إجرائك» تبدأ بلوحة الإجراء مفتوحة
  const [open, setOpen] = useState(focus);
  const [note, setNote] = useState("");
  const [counselor, setCounselor] = useState("");
  const [counselors, setCounselors] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !isDeputy || counselors.length) return;
    (async () => {
      const { data } = await supabase.from("admin_roles")
        .select("user_id, role_type, users(full_name)")
        .in("role_type", ["counselor_1", "counselor_2", "counselor_3"]);

      const list = (data ?? []).map((x) => ({
        id: x.user_id,
        name: x.users?.full_name ?? "",
        role: ADMIN_ROLE_LABEL[x.role_type] ?? x.role_type,
        grade: Number(String(x.role_type).replace(/\D/g, "")) || null,
      }));
      setCounselors(list);

      // الإسناد الآلي بحسب صف الطالب: الأول ← موجه 1، والثاني ← 2، والثالث ← 3
      const auto = list.find((c) => c.grade === r.grade);
      if (auto) setCounselor(auto.id);
    })();
  }, [open, isDeputy, counselors.length, r.grade]);

  const mySig = async () => {
    const { data } = await supabase.from("user_signatures")
      .select("path").eq("user_id", uid).maybeSingle();
    return data?.path ?? null;
  };

  const act = async (patch, okText, after) => {
    setBusy(true);
    const { error } = await supabase.from("student_referrals").update(patch).eq("id", r.id);
    if (!error && after) await after();
    setBusy(false);
    setOpen(false);
    onChange(error ? { ok: false, text: error.message } : { ok: true, text: okText });
  };

  // ② الوكيل يحوّلها للموجه
  const toCounselor = async () => {
    if (!counselor || !note.trim()) return;
    const c = counselors.find((x) => x.id === counselor);
    act({
      deputy_id: uid, deputy_name: profile?.full_name ?? "",
      deputy_note: note.trim(), deputy_sig: await mySig(), deputy_at: new Date().toISOString(),
      counselor_id: c.id, counselor_name: c.name,
      status: "with_counselor", return_note: null,
      ...(flag || r.flag ? { flag } : {}),
    }, `أُحيلت إلى ${c.name} وأُشعر بها.`,
    () => {
      notifyUsers([c.id], urgentPrefix(flag) + "إحالة طالب جديدة",
        `أحال إليك وكيل شؤون الطلاب إحالة ${r.student_name} برقم ${r.serial}.`, "/referrals");
      // المعلم المحيل يعرف أن إحالته تحرّكت
      notifyUsers([r.teacher_id], "تحرّكت إحالتك",
        `حوّل وكيل شؤون الطلاب إحالة ${r.student_name} (${r.serial}) إلى ${c.name}.`, "/referrals?tab=inbox");
    });
  };

  // ④ الموجه يعتمد إجراءه ويرسله لولي الأمر مباشرة، ويُشعَر الوكيل
  // (counselor_at = closed_at تمييزًا لإرسال الموجه: closedByCounselor)
  const counselorSend = async () => {
    if (!note.trim()) return;
    const now = new Date().toISOString();
    const body = `اعتمد ${profile?.full_name ?? "الموجه الطلابي"} إجراءه في إحالة ${r.student_name} (${r.serial}) وأرسلها لولي الأمر.`;
    await sendToGuardian({
      counselor_note: note.trim(), counselor_sig: await mySig(), counselor_at: now,
      close_note: "اعتمد الموجه الطلابي إجراءه وأُرسل الإشعار لولي الأمر.",
      closed_at: now, status: "with_guardian", return_note: null,
    }, "اعتُمد إجراؤك وأُرسل لولي الأمر، وأُشعر وكيل شؤون الطلاب.");
    if (r.deputy_id) notifyUsers([r.deputy_id], "أرسل الموجه إحالة لولي الأمر", body, "/referrals?tab=follow");
    else notifyDeputies("أرسل الموجه إحالة لولي الأمر", body, "/referrals?tab=follow");
  };

  // ④ب الموجه يعيدها للوكيل بملاحظة (ليست من اختصاص التوجيه أو تحتاج قرارًا آخر)
  const counselorReturn = async () => {
    if (!note.trim()) return;
    const body = `أعاد ${profile?.full_name ?? "الموجه الطلابي"} إحالة ${r.student_name} (${r.serial}): ${note.trim()}`;
    act({ return_note: note.trim(), status: "with_deputy" }, "أُعيدت لوكيل شؤون الطلاب بملاحظتك.",
      () => (r.deputy_id ? notifyUsers([r.deputy_id], "إحالة أعادها الموجه", body, "/referrals")
                         : notifyDeputies("إحالة أعادها الموجه", body)));
  };

  // ④ الوكيل يقفلها ويُشعر ولي الأمر
  const close = async () => {
    const patch = {
      close_note: note.trim() || (r.kind === "behavior"
        ? "اعتُمد إجراء الموجه الطلابي، وأُرسل الإشعار لولي الأمر." : "اعتُمد الإجراء وأُقفلت الإحالة."),
      closed_at: new Date().toISOString(),
      status: "with_guardian",
    };
    await sendToGuardian(patch, "أُقفلت الإحالة وأُشعر الطالب وولي أمره.");
  };

  // ②ج الوكيل يتجاوز الموجه ويوجّهها لولي الأمر مباشرة (حسب ما يراه)
  const toGuardianDirect = async () => {
    if (!note.trim()) return;
    const now = new Date().toISOString();
    await sendToGuardian({
      deputy_id: uid, deputy_name: profile?.full_name ?? "",
      deputy_note: note.trim(), deputy_sig: await mySig(), deputy_at: now,
      close_note: "وُجّهت لولي الأمر مباشرة دون التحويل للموجه الطلابي.",
      closed_at: now, status: "with_guardian", return_note: null,
    }, "أُرسلت الإحالة لولي الأمر مباشرة وأُشعر هو والطالب.");
  };

  // حفظ الإقفال ثم إشعار الطالب وولي أمره
  const sendToGuardian = async (patch, okText) => {
    setBusy(true);
    const { error } = await supabase.from("student_referrals").update(patch).eq("id", r.id);
    if (error) { setBusy(false); onChange({ ok: false, text: error.message }); return; }

    // إشعار الطالب وولي أمره
    const ids = new Set();
    const { data: s } = await supabase.from("students")
      .select("user_id").eq("id", r.student_id).maybeSingle();
    if (s?.user_id) ids.add(s.user_id);
    const { data: gs } = await supabase.from("guardian_student")
      .select("guardians(user_id)").eq("student_id", r.student_id);
    (gs ?? []).forEach((g) => { if (g.guardians?.user_id) ids.add(g.guardians.user_id); });

    if (r.teacher_id) notifyUsers([r.teacher_id], "أُقفلت إحالتك",
      `أُقفلت إحالة ${r.student_name} (${r.serial}) وأُشعر ولي الأمر بالإجراء المتخذ.`, "/referrals?tab=inbox");
    await notifyUsers([...ids], r.kind === "behavior" ? "إشعار بمشكلة سلوكية" : "إحالة طالب",
      (r.kind === "behavior"
        ? `صدر إشعار بمشكلة سلوكية بشأن ${r.student_name} (${r.serial}) والإجراءات المتخذة حياله.`
        : `صدرت إحالة بشأن ${r.student_name} برقم ${r.serial}.`) +
      " افتحه من البوابة للاطّلاع وتأكيد الاستلام.", `/referral/${r.id}`);
    setBusy(false);
    setOpen(false);
    onChange({ ok: true, text: okText });
  };

  // ④ب الوكيل يعيدها للموجه
  const returnToCounselor = async () => {
    if (!note.trim()) return;
    act({ return_note: note.trim(), status: "returned_to_counselor" }, "أُعيدت للموجه بملاحظتك.",
      () => notifyUsers([r.counselor_id], "إحالة مُعادة إليك",
        `أعاد وكيل شؤون الطلاب إحالة ${r.student_name} (${r.serial}) بملاحظة.`, "/referrals"));
  };

  // ②ب الوكيل يعيدها للمعلم لاستكمال التوثيق قبل التحويل
  const returnToTeacher = async () => {
    if (!note.trim()) return;
    act({ teacher_return_note: note.trim(), status: "returned_to_teacher" },
      "أُعيدت للمعلم لاستكمال التوثيق.",
      () => notifyUsers([r.teacher_id], "إحالة مُعادة لاستكمال التوثيق",
        `أعاد وكيل شؤون الطلاب إحالة ${r.student_name} (${r.serial}): ${note.trim()}`, "/referrals?tab=inbox"));
  };

  // ①ب المعلم يستكمل التوثيق ويعيد رفعها
  const [docs, setDocs] = useState(r.docs ?? { items: {}, files: [] });
  const resubmit = async () => {
    const extra = note.trim() ? `استكمال: ${note.trim()}` : "";
    if (r.ref_type === "behavior" ? !extra
        : ACADEMIC_ITEMS.some((i) => !academicItemDone(docs, i.key))) return;
    const newDocs = r.ref_type === "behavior" ? { ...(r.docs ?? {}), completion: note.trim() } : docs;
    act({
      docs: newDocs,
      done_in_class: [docsSummary(r.ref_type, newDocs), extra].filter(Boolean).join("\n") || null,
      status: "with_deputy", teacher_at: new Date().toISOString(),
    }, "أُعيد رفع الإحالة لوكيل شؤون الطلاب.",
    () => (r.deputy_id
      ? notifyUsers([r.deputy_id], "أُعيد رفع إحالة بعد استكمالها",
          `استكمل ${r.teacher_name} توثيق إحالة ${r.student_name} (${r.serial}).`, "/referrals")
      : notifyDeputies("أُعيد رفع إحالة بعد استكمالها",
          `استكمل ${r.teacher_name} توثيق إحالة ${r.student_name} (${r.serial}).`)));
  };

  // المعلم يحذف إحالته قبل اتخاذ أي إجراء فيها
  const remove = async () => {
    if (!window.confirm(`حذف إحالة ${r.student_name} (${r.serial})؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    const { data, error } = await supabase.from("student_referrals").delete().eq("id", r.id).select("id");
    setBusy(false);
    onChange(error || !data?.length
      ? { ok: false, text: error?.message || "تعذّر الحذف: اتُّخذ فيها إجراء أو لا تملك صلاحية حذفها." }
      : { ok: true, text: `حُذفت الإحالة ${r.serial}.` });
  };

  // ⑤ بعد رد ولي الأمر: تنتهي المتابعة وتُحفظ في السجل
  const archive = async () => {
    act({ status: "archived",
          ...(r.status === "with_guardian" ? { close_note: [r.close_note, "انتهت المتابعة دون رد ولي الأمر."].filter(Boolean).join("\n") } : {}) },
      "انتهت متابعة الإحالة وحُفظت في السجل.");
  };

  // ⑤ب لم يرد ولي الأمر: تذكيره مرة أخرى
  const remindGuardian = async () => {
    setBusy(true);
    const ids = [];
    const { data: gs } = await supabase.from("guardian_student")
      .select("guardians(user_id)").eq("student_id", r.student_id);
    (gs ?? []).forEach((g) => { if (g.guardians?.user_id) ids.push(g.guardians.user_id); });
    await notifyUsers(ids, "تذكير: إحالة بانتظار اطلاعك",
      `نأمل الاطلاع على ${r.kind === "behavior" ? "الإشعار" : "الإحالة"} بشأن ${r.student_name} (${r.serial}) وتأكيد الاستلام.`,
      `/referral/${r.id}`);
    setBusy(false);
    onChange(ids.length ? { ok: true, text: "أُرسل التذكير لولي الأمر." }
                        : { ok: false, text: "لا حساب لولي أمر هذا الطالب في البوابة — تواصل معه هاتفيًا ثم أنهِ المتابعة." });
  };

  const st = STATUS[r.status] ?? { t: r.status, c: "" };
  const counselorTurn = isCounselor && r.counselor_id === uid &&
    ["with_counselor", "returned_to_counselor"].includes(r.status);
  const deputyTurn = isDeputy && ["with_deputy", "with_guardian"].includes(r.status);
  // ③ قرار الوكيل: أول وصولها، أو بعد إعادة الموجه
  const deciding = isDeputy && r.status === "with_deputy" && !r.counselor_at;
  const teacherTurn = r.teacher_id === uid && r.status === "returned_to_teacher";
  // لوحة الإجراء لصاحب الدور وحده (المفتوحة من «بانتظار إجرائك» لا تفتح لغيره)
  const isOpen = open && (deputyTurn || counselorTurn || teacherTurn);
  // يحذف المعلم إحالته ما لم يُتخذ فيها إجراء: لم يحوّلها الوكيل ولم يصلها الموجه أو ولي الأمر
  const teacherCanDelete = r.teacher_id === uid && !r.deputy_at && !r.counselor_id && !r.counselor_at &&
    !r.closed_at && ["with_deputy", "returned_to_teacher"].includes(r.status);
  const stage = stageOf(r);
  const days = daysSince(stage.since);
  const late = isLate(r);

  return (
    <div className={`card p-3 ${focus ? "ring-2 ring-mint-light" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            <StudentFileLink id={r.student_id}>{r.student_name}</StudentFileLink>
            {r.student_nid && <span className="num mr-2 text-xs font-normal text-muted">{r.student_nid}</span>}
          </p>
          {/* السطر عربي الاتجاه، والأرقام وحدها لاتينية (num) — فلا يتبدّل ترتيب أجزائه */}
          <p className="mt-0.5 text-xs text-faint">
            <span className="num">{r.serial}</span> · {r.class_label}{r.subject ? ` · ${r.subject}` : ""}
            {r.period_no ? <> · الحصة <span className="num">{r.period_no}</span></> : ""}
            {r.kind === "behavior" && ` · مخالفة سلوكية — الدرجة ${degreeName(r.violation_degree)}`}
            {r.kind === "missing" && " · طالب مفقود"}
          </p>
          {/* صاحب الإحالة: المعلم في إحالة الحصة، ومن أنشأها في المخالفة والمفقود */}
          {r.teacher_name && (
            <p className="mt-0.5 text-xs text-muted">
              {r.kind === "behavior" || r.kind === "missing" ? "أنشأها" : "المعلم"}: <span className="font-semibold text-ink">{r.teacher_name}</span>
            </p>
          )}
        </div>
        <Sticker flag={r.flag} />
        {stage.group === "done" && <span className={`chip shrink-0 ${st.c}`}>{st.t}</span>}
        <button onClick={() => onOpen(r)}
                className="shrink-0 rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
          الملف
        </button>
        {teacherCanDelete && (
          <button onClick={remove} disabled={busy}
                  className="shrink-0 rounded-pill border border-absent/40 px-3 py-1 text-xs text-absent hover:bg-absent/5">
            حذف
          </button>
        )}
        {(deputyTurn || counselorTurn || teacherTurn) && (
          <button onClick={() => { setOpen(!isOpen); setNote(""); }}
                  className="shrink-0 rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">
            {isOpen ? "إغلاق" : teacherTurn ? "استكمال التوثيق" : counselorTurn ? "إجراء الموجه"
              : r.status === "with_guardian" ? "متابعة ولي الأمر" : deciding ? "قرار الوكيل" : "اعتماد"}
          </button>
        )}
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        <span className="text-faint">السبب: </span>{r.reason}
        {r.ref_type && <span className="chip mr-1.5 bg-canvas text-muted">{refTypeLabel(r.ref_type)}</span>}
      </p>

      {r.status === "returned_to_teacher" && r.teacher_return_note && (
        <p className="mt-1.5 rounded-sm2 bg-absent/5 px-3 py-2 text-xs text-absent">
          <span className="font-semibold">ملاحظة الوكيل: </span>{r.teacher_return_note}
        </p>
      )}

      {r.status === "with_deputy" && returnedByCounselor(r) && (
        <p className="mt-1.5 rounded-sm2 bg-absent/5 px-3 py-2 text-xs text-absent">
          <span className="font-semibold">أعادها {r.counselor_name || "الموجه"}: </span>{r.return_note}
        </p>
      )}

      <DocsView r={r} />

      <ReferralChain links={chainOf(r)} />

      {stage.group !== "done" && (
        <p className={`mt-2 rounded-sm2 px-3 py-1.5 text-xs ${late ? "bg-absent/5 font-semibold text-absent" : "bg-warning-light text-warning"}`}>
          <span className="font-semibold text-ink">عند {stage.who}</span> {daysLabel(days)} — {stage.what}
          {late && " · متأخرة"}
        </p>
      )}

      {isOpen && teacherTurn && (
        <div className="mt-3 space-y-2 rounded-sm2 bg-mint-tint/50 p-3">
          {r.ref_type && r.ref_type !== "behavior" && (
            <AcademicDocs uid={uid} student={{ id: r.student_id, full_name: r.student_name }}
                          docs={docs} onChange={setDocs} />
          )}
          <textarea rows={2} className="field w-full" value={note}
                    placeholder={r.ref_type === "behavior" ? "ما استكملته من إجراءات وتوثيق" : "ملاحظة للوكيل (اختياري)"}
                    onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary w-full" onClick={resubmit}
                  disabled={busy || (r.ref_type === "behavior" ? !note.trim()
                    : ACADEMIC_ITEMS.some((i) => !academicItemDone(docs, i.key)))}>
            إعادة الرفع لوكيل شؤون الطلاب
          </button>
        </div>
      )}

      {isOpen && !teacherTurn && (
        <div className="mt-3 space-y-2 rounded-sm2 bg-mint-tint/50 p-3">
          {/* بطاقات بحسب المرحلة: الموجه، أو الوكيل محوِّلًا، أو مراجعًا لإجراء الموجه */}
          <PresetChips value={note} onChange={setNote}
                       items={counselorTurn ? PRESETS_COUNSELOR
                              : deciding ? PRESETS_DEPUTY_TRANSFER
                              : isDeputy && r.status === "with_deputy" ? PRESETS_DEPUTY_REVIEW
                              : []} />
          <textarea rows={3} className="field w-full" value={note}
                    placeholder={counselorTurn
                      ? (r.kind === "behavior" ? "دراسة الحالة والإجراءات التربوية والعلاجية — كل إجراء في سطر (تظهر في إشعار ولي الأمر)"
                                               : "الإجراء المتخذ والملاحظات")
                      : "ما تم عمله والملاحظات"}
                    onChange={(e) => setNote(e.target.value)} />

          {deciding && (
            <>
              <div>
                <p className="mb-1 text-[11px] text-muted">
                  الموجه المسند لصف الطالب — يمكن تغييره عند الحاجة
                </p>
                <select className="field w-full" value={counselor}
                        onChange={(e) => setCounselor(e.target.value)}>
                  <option value="">اختر الموجه الطلابي…</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.role}
                      {c.grade === r.grade ? " (موجه الصف)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <FlagPicker value={flag} onChange={setFlag} hint="يظهر للموجه على المهمة" />
              <p className="text-[11px] text-muted">اكتب إجراءك ثم اختر مخرجًا واحدًا:</p>
              <button className="btn-primary w-full" disabled={busy || !counselor || !note.trim()}
                      onClick={toCounselor}>
                تحويل للموجه الطلابي
              </button>
              <button disabled={busy || !note.trim()} onClick={toGuardianDirect}
                      className="w-full rounded-pill border border-warning/40 py-2 text-sm font-semibold text-warning hover:bg-warning/5">
                إرسال لولي الأمر مباشرة (دون الموجه)
              </button>
              {r.kind === "teacher" && r.teacher_id && (
                <button disabled={busy || !note.trim()} onClick={returnToTeacher}
                        className="w-full rounded-pill border border-absent/40 py-2 text-sm font-semibold text-absent hover:bg-absent/5">
                  إعادة للمعلم لاستكمال التوثيق
                </button>
              )}
            </>
          )}

          {counselorTurn && (
            <>
              <button className="btn-primary w-full" disabled={busy || !note.trim()} onClick={counselorSend}>
                اعتماد الإجراء وإرساله لولي الأمر
              </button>
              <button disabled={busy || !note.trim()} onClick={counselorReturn}
                      className="w-full rounded-pill border border-absent/40 py-2 text-sm font-semibold text-absent hover:bg-absent/5">
                إعادة لوكيل شؤون الطلاب بملاحظة
              </button>
              <p className="text-[11px] leading-relaxed text-muted">
                عند الإعادة اكتب في الخانة سبب إعادتها، فيقرر الوكيل تحويلها لغيرك أو إرسالها لولي الأمر أو إعادتها للمعلم.
              </p>
            </>
          )}

          {/* إحالات السلسلة السابقة: كتب الموجه إجراءه وأعادها للوكيل للاعتماد */}
          {isDeputy && r.counselor_at && r.status === "with_deputy" && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary flex-1" disabled={busy} onClick={close}>
                {r.kind === "behavior" ? "اعتماد وإرسال الإشعار لولي الأمر" : "اعتماد وإقفال وإشعار ولي الأمر"}
              </button>
              <button disabled={busy || !note.trim()} onClick={returnToCounselor}
                      className="flex-1 rounded-pill border border-warning/40 px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/5">
                إعادة للموجه
              </button>
            </div>
          )}

          {/* لم يرد ولي الأمر: تذكيره، أو إنهاء المتابعة بعد التواصل معه هاتفيًا */}
          {isDeputy && r.status === "with_guardian" && (
            <div className="space-y-2 rounded-card border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs leading-relaxed text-muted">
                لم يؤكد ولي الأمر استلامها بعد ({daysLabel(daysSince(r.closed_at))}).
                {daysSince(r.closed_at) < REMIND_DAYS ? ` يُذكَّر بعد ${REMIND_DAYS === 2 ? "يومين" : `${REMIND_DAYS} أيام`} من الإرسال.` : ""}
                {daysSince(r.closed_at) < NO_REPLY_DAYS ? ` ويُغلق الملف دون رده بعد ${NO_REPLY_DAYS} أيام.` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={remindGuardian}
                        className="rounded-pill border border-warning/40 px-4 py-1.5 text-sm font-semibold text-warning hover:bg-warning/5">
                  تذكير ولي الأمر
                </button>
                {daysSince(r.closed_at) >= NO_REPLY_DAYS && (
                  <button disabled={busy} onClick={archive}
                          className="rounded-pill border border-line px-4 py-1.5 text-sm font-semibold text-muted hover:bg-canvas">
                    إغلاق الملف دون رده
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {r.guardian_note && (
        <p className="mt-2 rounded-sm2 bg-present/5 px-3 py-2 text-xs leading-relaxed text-ink">
          <span className="font-semibold text-present">رد ولي الأمر: </span>{r.guardian_note}
        </p>
      )}
    </div>
  );
}

/* --------------------------- مسار الإحالة --------------------------- */
/** شريط السلسلة: حلقات الإحالة الست بحالتها (chainOf في lib/referrals) */
function ReferralChain({ links }) {
  return (
    <ol className="-mx-1 mt-2 flex flex-wrap gap-1 px-1">
      {links.map((x, i) => {
        const cls = x.state === "done" ? "border border-mint-light bg-mint-tint text-mint-deep"
          : x.state === "now" ? "bg-mint-deep text-white"
          : x.state === "back" ? "bg-absent/10 text-absent"
          : x.state === "skip" ? "border border-dashed border-line bg-canvas text-muted"
          : `border ${x.optional ? "border-dashed" : ""} border-line bg-white text-faint`;
        const mark = x.state === "done" ? "✓" : x.state === "skip" ? "—" : x.state === "back" ? "↩" : i + 1;
        return (
          <li key={x.key} title={[x.who, x.at && fmtDate(x.at)].filter(Boolean).join(" · ") || undefined}
              className={`flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11.5px] font-medium ${cls}`}>
            <span className={`num grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9.5px] ${
              x.state === "now" ? "bg-white/25" : "bg-white"}`}>{mark}</span>
            {x.t}
            {x.note && <><span className="opacity-50">·</span><span className="num font-normal opacity-80">{x.note}</span></>}
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------- عرض الملف --------------------------- */
function SheetModal({ r, onClose }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [stamp, setStamp] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("school_assets")
        .select("path").eq("key", "stamp").maybeSingle();
      setStamp(await signedUrl(data?.path));
    })();
  }, []);

  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      if (w) setScale(Math.min(1, Math.max(0.3, (w - 8) / 794)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-3 flex justify-between gap-2">
          <button onClick={onClose}
                  className="rounded-pill bg-white px-4 py-1.5 text-sm font-medium text-muted">
            إغلاق
          </button>
          <button className="btn-primary" onClick={() => window.print()}>طباعة / حفظ PDF</button>
        </div>

        <div ref={box} className="no-print overflow-hidden rounded-card bg-white">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top right",
                        width: 794, height: 1123 * sheetPages(r) * scale }}>
            <ReferralSheet r={r} stampUrl={stamp} />
          </div>
        </div>

        <div className="hidden print:block">
          <ReferralPrintArea>
            <ReferralSheet r={r} stampUrl={stamp} />
          </ReferralPrintArea>
        </div>
      </div>
    </div>
  );
}
