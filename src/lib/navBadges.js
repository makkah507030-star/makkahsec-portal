// src/lib/navBadges.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { stageOf, isLate, STAGE_COLS } from "./referrals.js";
import { fmtHijri, fmtDateTime } from "./dates.js";
import { todayISO } from "./schoolTime.js";
import { countAr } from "./arabicCount.js";
import { FLAG_ORDER, flagRank } from "./flags.js";
import { loadDueNotes, noteTitle, dueState } from "./notes.js";
import { EL_TITLE, LATE_AFTER, addDays, dueState as goalDue } from "./improve.js";

/* =====================================================================
   «بانتظار إجرائك» — مصدر واحد لكل ما ينتظر إجراء المستخدم: عدادات القائمة الجانبية
   وبطاقات صندوق المهام في الرئيسية (components/TasksBox.jsx).

   كل مهمة: { key, n, to, label, tone, icon, sub?, follow?, items? }
     sub    سطر تفصيل تحت العنوان
     follow متابعة لما عند غيرك — لا تُحسب في عدد «بانتظار إجرائك»
     to     الصفحة التي يُنجز فيها الإجراء (مع التبويب المناسب)
     items  [{ id, to, title, flag? }] حين تكون عناصرها معروفة — فتُفتح مباشرة
            إن كانت واحدة، وتُعرض قائمتها إن تعددت
            وبلا to يبقى العنصر للاطلاع فقط في القائمة (لا رابط له)
     flag   ملصق يحدده مرسل النموذج (عاجل/سري/للاطلاع والتوجيه) — الأشد بين عناصرها
   تُحتسب بحسب الدور: الإدارة بأدوارها، والمعلم والطالب وولي الأمر بحسابه.
   يُحدَّث كل دقيقتين ما دامت الصفحة ظاهرة، وعند الانتقال بين الصفحات
   (refreshNavBadges). كلها عبر صلاحيات المستخدم نفسه (RLS).
   ===================================================================== */

let state = {};                 // to -> count، و_tasks: قائمة المهام
let ctx = null;                 // { uid, roles, role }
let timer = null;
let inflight = null;
let lastAt = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f(state));

const count = async (q) => {
  const { count: n, error } = await q;
  return error ? 0 : n ?? 0;
};
// صفوف قليلة بمعرّفاتها (تُعدّ وتُفتح مباشرة) — الخطأ (جدول غير مفعّل مثلًا) يعني لا شيء
const rowsOf = async (q) => {
  const { data, error } = await q;
  return error ? [] : data ?? [];
};
// استعلام بعمود الملصق، وإن لم يُضف العمود بعد (supabase/flags.sql) يُعاد بدونه فلا تختفي المهام
const rowsFlag = async (make) => {
  const { data, error } = await make(", flag");
  if (!error) return data ?? [];
  return /flag/.test(error.message ?? "") ? rowsOf(make("")) : [];
};
const head = (t) => supabase.from(t).select("id", { count: "exact", head: true });
const mine = (uid) => JSON.stringify([{ user_id: uid }]);   // attendees @> [{user_id}]

const QP_QUIZ = "quizzes!quiz_plans_quiz_id_fkey(title, cycle_closed_at)";
const VERIFY_LATE_DAYS = 14;   // خطة علاجية نُفّذت ولم يُقس أثرها بعد أسبوعين: تظهر للمدير
const GOAL_TEACHER = "teacher:users!improvement_goals_teacher_user_id_fkey(full_name)";

const BEHAVIOR_KIND = { pledge: "تعهد سلوكي", invite: "دعوة ولي أمر", notice: "إشعار سلوكي" };

/* تذكير رصد درجات الفترات في نور: لون المهلة منذ أقدم اختبار لم يُرصد
   (حتى يومين أخضر، ومن 3 إلى 5 برتقالي، وبعدها أحمر)، والعدّاد إلى آخر يوم */
const dayNo = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const weekday = (iso) => new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
function noorTask(rows) {
  const today = todayISO();
  const ago = (r) => dayNo(today) - dayNo(r.exam_date);
  const max = Math.max(0, ...rows.map(ago));
  const end = rows.find((r) => r.deadline)?.deadline;
  const left = end ? dayNo(end) - dayNo(today) : null;
  return {
    key: "noorGrades", n: rows.length, to: "/", icon: "clipboard",
    tone: max > 5 ? "absent" : max > 2 ? "warning" : "mint",
    label: "درجات فترات لم تُرصد في نور",
    sub: end ? `آخر يوم ${weekday(end)} ${fmtHijri(end)} · ${left < 0 ? "انتهت المهلة" : left === 0 ? "اليوم آخر يوم"
      : `باقي ${countAr(left, "day")}`}` : "",
    items: rows.map((r) => {
      const d = ago(r);
      return { id: r.slot_id,
        title: `${r.subject_name} · فصل ${Number(r.class_no) >= 100 ? r.class_no : (Number(r.grade) || 0) * 100 + Number(r.class_no)} · ${d === 0 ? "اليوم" : `منذ ${countAr(d, "day", { acc: true })}`}`
          + (r.cont ? " · تقويم مستمر" : "") + (r.status === "partial" ? " · رصد جزئي" : "") + (d > 5 ? " · متأخر" : "") };
    }),
  };
}

async function load() {
  if (!ctx?.uid) return;
  const { uid, roles, role } = ctx;
  const has = (...r) => r.some((x) => roles.includes(x));
  const staff = role === "admin" || role === "teacher";
  const isGuardian = role === "guardian";
  const isStudent = role === "student";

  const isDeputy = has("deputy_students", "principal", "tech_support");
  const isCounselor = roles.some((r) => r.startsWith("counselor"));
  const isManager = has("principal", "tech_support");
  const isAcademic = has("deputy_academic", "tech_support");      // معتمد التطوير المهني
  const myGrades = [1, 2, 3].filter((g) => roles.includes(`counselor_${g}`));
  const none = Promise.resolve(0);
  const noRows = Promise.resolve([]);

  const fd = () => head("form_documents");

  const [
    returned, toApprove, replies, events, toReply, refDeputy, refCounselor, notif,
    plcSign, pdSign, xvHost, plcPending, pdPending, xvPending,
    plcBack, pdBack, xvBack, perfAck, guidance, deputyReq, excuses,
    behaviorGuardian, refGuardian, pledges, refAway, noorDue,
    giTeacher, giDeputy, giCounselor, giGuardian, dropouts, ethicsAck, onlineQuizzes, myNotes,
    goals, goalsLate, qPlans, qPlansLate, circs,
  ] = await Promise.all([
    staff ? count(fd().eq("created_by", uid).eq("status", "rejected")) : none,
    has("principal") ? rowsFlag((f) => supabase.from("form_documents").select(`id, title, recipient${f}`)
      .eq("status", "pending").order("created_at").limit(100)) : noRows,
    staff ? count(fd().eq("created_by", uid).eq("status", "replied")) : none,
    isManager
      ? count(head("school_events").not("report_submitted_at", "is", null).neq("stage", "approved").is("cancelled_at", null))
      : none,
    rowsFlag((f) => supabase.from("form_documents").select(`id, title, serial${f}`)
      .eq("recipient_user_id", uid).eq("status", "awaiting_reply").order("created_at").limit(50)),
    isDeputy ? rowsFlag((f) => supabase.from("student_referrals").select(`id, student_name${f}`)
      .eq("status", "with_deputy").order("created_at").limit(100)) : noRows,
    isCounselor ? rowsFlag((f) => supabase.from("student_referrals").select(`id, student_name${f}`).eq("counselor_id", uid)
      .in("status", ["with_counselor", "returned_to_counselor"]).order("created_at").limit(100)) : noRows,
    has("tech_support") ? count(head("notification_drafts").eq("status", "pending")) : none,

    // التطوير المهني: التوقيع للحاضرين، والاعتماد للوكيل، والمعاد لصاحبه
    staff ? rowsOf(supabase.from("plc_sessions").select("id, head_name, plc_signatures(user_id)")
      .eq("status", "signing").contains("attendees", mine(uid)).limit(50)) : noRows,
    staff ? rowsOf(supabase.from("pd_reports").select("id, owner_name, pd_signatures(user_id)")
      .eq("status", "signing").contains("attendees", mine(uid)).limit(50)) : noRows,
    staff ? rowsOf(supabase.from("exchange_visits").select("id, visitor_name")
      .eq("status", "hosting").eq("host_user_id", uid).limit(50)) : noRows,
    isAcademic ? rowsOf(supabase.from("plc_sessions").select("id, head_name").eq("status", "pending").limit(50)) : noRows,
    isAcademic ? rowsOf(supabase.from("pd_reports").select("id, owner_name").eq("status", "pending").limit(50)) : noRows,
    isAcademic ? rowsOf(supabase.from("exchange_visits").select("id, visitor_name").eq("status", "pending").limit(50)) : noRows,
    staff ? rowsOf(supabase.from("plc_sessions").select("id").eq("status", "returned").eq("head_user_id", uid).limit(50)) : noRows,
    staff ? rowsOf(supabase.from("pd_reports").select("id").eq("status", "returned").eq("owner_user_id", uid).limit(50)) : noRows,
    staff ? rowsOf(supabase.from("exchange_visits").select("id").eq("status", "returned").eq("visitor_user_id", uid).limit(50)) : noRows,
    staff ? count(head("perf_reviews").eq("teacher_user_id", uid).not("sent_at", "is", null).is("ack_at", null)) : none,
    myGrades.length ? count(head("guidance_requests").eq("status", "new").in("grade", myGrades)) : none,
    has("deputy_students") ? count(head("guidance_requests").eq("status", "new").eq("target", "deputy")) : none,
    has("deputy_students", "clerk", "clerk_2") ? count(head("absence_excuses").eq("status", "pending")) : none,

    // ولي الأمر: نماذج السلوك والإحالات التي تنتظر إقراره، والطالب: تعهداته
    isGuardian ? rowsFlag((f) => supabase.from("behavior_forms").select(`id, kind, student_name${f}`)
      .in("kind", ["pledge", "invite", "notice"]).is("guardian_ack_at", null).neq("status", "closed")
      .order("created_at").limit(50)) : noRows,
    isGuardian ? rowsFlag((f) => supabase.from("student_referrals").select(`id${f}, students(full_name)`)
      .eq("status", "with_guardian").is("guardian_ack_at", null).order("created_at").limit(50)) : noRows,
    isStudent ? rowsFlag((f) => supabase.from("behavior_forms").select(`id, kind${f}`)
      .eq("kind", "pledge").is("student_ack_at", null).neq("status", "closed").order("created_at").limit(50)) : noRows,

    // متابعة الوكيل: إحالات عند الموجهين أو ولي الأمر لم تنتهِ بعد
    isDeputy ? rowsOf(supabase.from("student_referrals").select(STAGE_COLS)
      .in("status", ["with_counselor", "returned_to_counselor", "with_guardian"]).limit(300)) : noRows,

    // المعلم: اختبارات فترات حلّ موعدها ولم يسجّل الوكيل رصدها في نور (للاطلاع)
    role === "teacher" ? rowsOf(supabase.rpc("my_noor_grade_due")) : noRows,

    // استمارة توضيح مستوى الطالب: سطر المعلم، ورأي الوكيل، وما ينتظر الموجه، ونسخة ولي الأمر
    staff ? rowsOf(supabase.from("guidance_inquiry_items")
      .select("id, inquiry_id, subject, guidance_inquiries!inner(student_name, flag, status)")
      .eq("teacher_user_id", uid).is("filled_at", null).eq("guidance_inquiries.status", "teachers").limit(50)) : noRows,
    isDeputy ? rowsOf(supabase.from("guidance_inquiries").select("id, student_name, flag")
      .eq("status", "deputy").order("created_at").limit(50)) : noRows,
    myGrades.length ? rowsOf(supabase.from("guidance_inquiries")
      .select("id, student_name, flag, status, guidance_inquiry_items(filled_at, teacher_user_id)")
      .in("status", ["teachers", "counselor"]).in("grade", myGrades).order("created_at").limit(100)) : noRows,
    isGuardian ? rowsOf(supabase.from("guidance_inquiries").select("id, student_name, flag")
      .eq("status", "sent").is("guardian_seen_at", null).order("created_at").limit(50)) : noRows,

    // بلاغات المعلمين عن طلاب منقطعين تنتظر طي القيد أو ردها (supabase/student_dropouts_1.sql)
    isDeputy ? rowsOf(supabase.from("student_dropouts").select("id, student_name")
      .eq("status", "reported").order("reported_at").limit(100)) : noRows,

    // ميثاق أخلاقيات المهنة: هل أقرّ المعلم بالاطّلاع؟ (null: الجدول غير مفعّل فلا مهمة)
    role === "teacher" ? supabase.from("doc_acks").select("user_id").eq("doc_key", "ethics_code").eq("user_id", uid)
      .then(({ data, error }) => (error ? null : data ?? [])) : Promise.resolve(null),

    // الطالب: اختبارات إلكترونية مفتوحة الآن لم يسلّمها، والقادم يبقى في بطاقة «الاختبارات الإلكترونية»
    isStudent ? rowsOf(supabase.rpc("my_online_quizzes")) : noRows,

    // مفكرتي: مهام حلّ موعدها (supabase/staff_notes.sql)
    staff ? loadDueNotes() : noRows,

    // خطط التطوير: توصيات المعلم وما يتابعه الزائر، والمتأخر للمدير (supabase/improvement_loop_*.sql)
    staff ? rowsOf(supabase.from("improvement_goals")
      .select(`id, teacher_user_id, owner_user_id, status, element_key, follow_up_date, progress_at, plan_return_note, cycle, ${GOAL_TEACHER}`)
      .in("status", ["plan", "review", "active"]).or(`teacher_user_id.eq.${uid},owner_user_id.eq.${uid}`).limit(200)) : noRows,
    has("principal") ? rowsOf(supabase.from("improvement_goals")
      .select(`id, element_key, follow_up_date, ${GOAL_TEACHER}`)
      .eq("status", "active").lt("follow_up_date", addDays(todayISO(), -LATE_AFTER))
      .or(`owner_user_id.is.null,owner_user_id.neq.${uid}`).order("follow_up_date").limit(100)) : noRows,

    // الخطط العلاجية في دورة الاختبار: انتهاء مدتها، واختبار التحقق، والخطة الثانية (supabase/quiz_verify_*.sql)
    role === "teacher" ? rowsOf(supabase.from("quiz_plans")
      .select("id, quiz_id, kind, round, status, end_date, measured_at, impact, quizzes!quiz_plans_quiz_id_fkey!inner(title, cycle_closed_at)")
      .eq("teacher_id", uid).is("quizzes.cycle_closed_at", null).limit(200)) : noRows,
    has("principal") ? rowsOf(supabase.from("quiz_plans").select(`id, quiz_id, done_at, ${QP_QUIZ}`)
      .eq("kind", "remedial").eq("status", "done").is("measured_at", null)
      .lt("done_at", new Date(Date.now() - VERIFY_LATE_DAYS * 864e5).toISOString()).limit(100)) : noRows,

    // التعاميم: ما وصلك ولم تطّلع عليه (أو لم تقرّ به إن تطلّب الإقرار) ومتابعته مفتوحة (supabase/circulars_*.sql)
    staff || isGuardian ? rowsOf(supabase.from("circular_recipients")
      .select("circular_id, read_at, ack_at, circulars!inner(subject, needs_ack, priority, closed_at)")
      .eq("user_id", uid).is("circulars.closed_at", null).is("ack_at", null).limit(100)) : noRows,
  ]);
  const circPending = circs.filter((r) => (r.circulars?.needs_ack ? !r.ack_at : !r.read_at));

  const unsigned = (rows, sigKey) => rows.filter((r) => !(r[sigKey] ?? []).some((g) => g.user_id === uid));
  const plcToSign = unsigned(plcSign, "plc_signatures");
  const pdToSign = unsigned(pdSign, "pd_signatures");
  const awayC = refAway.filter((r) => stageOf(r).group === "counselor").length;
  const awayG = refAway.filter((r) => stageOf(r).group === "guardian").length;
  const awayLate = refAway.filter(isLate).length;
  const noor = noorTask(noorDue);
  const items = (rows, path, title) => rows.map((r) => ({ id: r.id, to: `${path}/${r.id}`, title: title?.(r) ?? "", flag: r.flag ?? null }));
  // الموجه: ما عاد إليه من الوكيل، وما اكتملت تعبئة معلميه ولم يُرسَل للوكيل
  const giReady = giCounselor.filter((r) => {
    if (r.status === "counselor") return true;
    const acc = (r.guidance_inquiry_items ?? []).filter((x) => x.teacher_user_id);
    return acc.length > 0 && acc.every((x) => x.filled_at);
  });
  const giTasks = [
    { key: "giTeacher", label: "استمارات مستوى طالب تنتظر تعبئتك", icon: "clipboard",
      items: giTeacher.map((x) => ({ id: x.id, to: `/inquiry/${x.inquiry_id}`, flag: x.guidance_inquiries?.flag ?? null,
                                     title: `${x.guidance_inquiries?.student_name ?? ""} · ${x.subject}` })) },
    { key: "giDeputy", label: "استمارات مستوى طالب تنتظر رأيك", icon: "clipboard",
      items: items(giDeputy, "/inquiry", (r) => r.student_name) },
    { key: "giCounselor", label: "استمارات مستوى جاهزة لإجرائك", icon: "heart",
      items: items(giReady, "/inquiry", (r) => `${r.student_name} · ${r.status === "counselor" ? "عادت من الوكيل" : "اكتملت التعبئة"}`) },
    { key: "giGuardian", label: "استمارة مستوى ابنك من التوجيه الطلابي", icon: "heart",
      items: items(giGuardian, "/inquiry", (r) => r.student_name) },
  ].map((t) => ({ ...t, n: t.items.length, to: "/", tone: "warning" }));

  // كل اختبار لم يُسلَّم ولم يُغلق: الجاري والمتاح الآن، والقادم بموعد فتحه — يظهر فور نشره
  const quizzesDue = onlineQuizzes.filter((r) => !r.submitted_at && new Date(r.closes_at) > Date.now());
  const quizSoon = (r) => !r.started_at && new Date(r.opens_at) > Date.now();
  const quizWhen = (r) => (quizSoon(r) ? `يُفتح ${fmtDateTime(r.opens_at)}` : `يُغلق ${fmtDateTime(r.closes_at)}`);

  const ethicsDue = Array.isArray(ethicsAck) && ethicsAck.length === 0 ? 1 : 0;

  // خطط التطوير: خطة يكتبها المعلم، واعتماد للزائر، ومتابعة حلّ موعدها للطرفين
  const goalItem = (g, extra = "") => ({ id: g.id, to: `/improve?g=${g.id}`,
    title: `${g.teacher_user_id === uid ? "" : `${g.teacher?.full_name ?? "معلم"} · `}${EL_TITLE[g.element_key] ?? ""}${extra}` });
  const goalPlan = goals.filter((g) => g.status === "plan" && g.teacher_user_id === uid);
  const goalReview = goals.filter((g) => g.status === "review" && g.owner_user_id === uid);
  // الخطط العلاجية: ما حلّ موعد نهايته ولم يُسجَّل تنفيذه، وما نُفّذ وينتظر اختبار التحقق
  const qOpen = qPlans;
  const qItem = (x, extra) => ({ id: x.id, to: `/quizzes?q=${x.quiz_id}`, title: `${x.quizzes?.title ?? "اختبار"}${extra}` });
  const qEnded = qOpen.filter((x) => x.status === "planned" && x.end_date && x.end_date <= todayISO());
  const qVerify = qOpen.filter((x) => x.kind === "remedial" && x.status === "done" && !x.measured_at);
  const qRound2 = qOpen.filter((x) => x.kind === "remedial" && (x.round ?? 1) === 1 && Number(x.impact?.below) > 0
    && !qOpen.some((y) => y.quiz_id === x.quiz_id && y.kind === "remedial" && y.round === 2));
  const goalDueRows = goals.filter((g) => goalDue(g) && (g.owner_user_id === uid || (g.teacher_user_id === uid && !g.progress_at)));

  const tasks = [
    // العاجل أولًا: الإقرار بميثاق أخلاقيات المهنة
    { key: "ethics", n: ethicsDue, to: "/ethics", label: "ميثاق أخلاقيات المهنة ينتظر اطّلاعك وإقرارك", tone: "absent", icon: "shield",
      items: [{ id: "ethics", to: "/ethics", title: "مدونة قواعد السلوك الوظيفي وأخلاقيات الوظيفة العامة", flag: "urgent" }] },

    // ما أُعيد إليك أولًا: عمل بدأته ينتظر تعديلك
    { key: "returned", n: returned, to: "/forms", label: "نماذج أُعيدت إليك للتعديل", tone: "absent", icon: "edit" },
    { key: "plcBack", n: plcBack.length, to: "/plc?tab=mine", items: items(plcBack, "/plc"),
      label: "جلسات تعلم مهني أُعيدت إليك", tone: "absent", icon: "edit" },
    { key: "pdBack", n: pdBack.length, to: "/pd?tab=mine", items: items(pdBack, "/pd"),
      label: "نماذج تطوير مهني أُعيدت إليك", tone: "absent", icon: "edit" },
    { key: "xvBack", n: xvBack.length, to: "/xvisits?tab=mine", items: items(xvBack, "/xvisits"),
      label: "زيارات تبادلية أُعيدت إليك", tone: "absent", icon: "edit" },

    // ولي الأمر والطالب
    { key: "behaviorGuardian", n: behaviorGuardian.length, to: "/",
      items: items(behaviorGuardian, "/behavior", (r) => `${BEHAVIOR_KIND[r.kind] ?? "نموذج"} — ${r.student_name ?? ""}`),
      label: "نماذج سلوك تنتظر اطلاعك وإقرارك", tone: "absent", icon: "shield" },
    { key: "refGuardian", n: refGuardian.length, to: "/",
      items: items(refGuardian, "/referral", (r) => `إحالة — ${r.students?.full_name ?? ""}`),
      label: "إحالات تنتظر اطلاعك وردك", tone: "absent", icon: "send" },
    { key: "onlineQuizzes", n: quizzesDue.length, to: "/", label: "اختبارات إلكترونية بانتظارك",
      tone: quizzesDue.some((r) => r.started_at) ? "absent" : quizzesDue.every(quizSoon) ? "mint" : "warning", icon: "quiz",
      sub: quizzesDue.length === 1 ? quizWhen(quizzesDue[0]) : "",
      items: quizzesDue.map((r) => ({ id: r.quiz_id, to: `/quiz/${r.quiz_id}`,
        title: `${r.title}${r.subject_name ? ` · ${r.subject_name}` : ""} · ${r.started_at ? "جارٍ — أكمل" : quizWhen(r)}` })) },
    { key: "pledges", n: pledges.length, to: "/", items: items(pledges, "/behavior", () => "تعهد سلوكي"),
      label: "تعهدات تنتظر توقيعك", tone: "absent", icon: "shield" },

    // ما ينتظر ردك أو توقيعك أو اطلاعك
    { key: "toReply", n: toReply.length, to: "/my-documents",
      items: toReply.map((d) => ({ id: d.id, to: `/doc/${d.id}`, title: `${d.title} · ${d.serial}`, flag: d.flag ?? null })),
      label: staff ? "نماذج وصلتك تنتظر إفادتك" : "نماذج وصلتك تنتظر ردك", tone: "warning", icon: "folder" },
    { key: "plcSign", n: plcToSign.length, to: "/plc?tab=sign",
      items: items(plcToSign, "/plc", (r) => `جلسة ${r.head_name ?? ""}`),
      label: "جلسات تعلم مهني تنتظر توقيعك", tone: "warning", icon: "signature" },
    { key: "pdSign", n: pdToSign.length, to: "/pd?tab=sign",
      items: items(pdToSign, "/pd", (r) => r.owner_name ?? ""),
      label: "نماذج تطوير مهني تنتظر توقيعك", tone: "warning", icon: "signature" },
    { key: "xvHost", n: xvHost.length, to: "/xvisits?tab=host",
      items: items(xvHost, "/xvisits", (r) => `زيارة ${r.visitor_name ?? ""}`),
      label: "زيارات تبادلية تنتظر توقيعك", tone: "warning", icon: "signature" },
    ...giTasks,
    { key: "goalPlan", n: goalPlan.length, to: "/improve?tab=mine", label: "توصيات تطوير تنتظر خطتك", icon: "target",
      tone: goalPlan.some((g) => g.plan_return_note || g.cycle > 1) ? "absent" : "warning",
      items: goalPlan.map((g) => goalItem(g, g.plan_return_note ? " · أُعيدت بملاحظة" : g.cycle > 1 ? " · دورة ثانية" : "")) },
    { key: "goalReview", n: goalReview.length, to: "/improve?tab=follow", label: "خطط تطوير تنتظر اعتمادك", tone: "warning", icon: "target",
      items: goalReview.map((g) => goalItem(g)) },
    { key: "goalDue", n: goalDueRows.length, to: "/improve", label: "متابعة خطط تطوير حلّ موعدها", icon: "target",
      tone: goalDueRows.some((g) => goalDue(g) === "late") ? "absent" : "warning",
      items: goalDueRows.map((g) => goalItem(g, goalDue(g) === "late" ? " · متأخرة" : g.teacher_user_id === uid ? " · سجّل ما نفّذته" : " · زيارة المتابعة")) },
    { key: "quizPlanEnd", n: qEnded.length, to: "/quizzes", label: "خطط علاجية أو إثرائية انتهت مدتها", tone: "warning", icon: "quiz",
      sub: "سجّل تنفيذها ليُتحقق من أثرها", items: qEnded.map((x) => qItem(x, x.kind === "remedial" ? " · علاجية" : " · إثرائية")) },
    { key: "quizVerify", n: qVerify.length, to: "/quizzes", label: "خطط علاجية تنتظر اختبار التحقق", tone: "warning", icon: "quiz",
      items: qVerify.map((x) => qItem(x, x.round > 1 ? " · الخطة الثانية" : "")) },
    { key: "quizRound2", n: qRound2.length, to: "/quizzes", label: "طلاب بقوا دون 60% بعد التحقق: خطة ثانية بدعم أعلى", tone: "absent", icon: "quiz",
      items: qRound2.map((x) => qItem(x, ` · ${countAr(Number(x.impact.below), "student")}`)) },
    { key: "perfAck", n: perfAck, to: "/my-performance", label: "تقييم أداء ينتظر اطلاعك", tone: "warning", icon: "award" },
    { key: "referrals", n: refDeputy.length + refCounselor.length, to: "/referrals", label: "إحالات تنتظر إجراءك", tone: "warning", icon: "send",
      items: [...refDeputy, ...refCounselor].map((r) => ({ id: r.id, to: `/referrals?tab=inbox&open=${r.id}`, title: r.student_name ?? "", flag: r.flag ?? null })) },
    { key: "dropouts", n: dropouts.length, to: "/dropouts?tab=new", label: "بلاغات طلاب منقطعين تنتظر إجراءك",
      tone: "warning", icon: "userX",
      items: dropouts.map((r) => ({ id: r.id, to: `/dropouts?tab=new&open=${r.id}`, title: r.student_name ?? "" })) },
    { key: "guidance", n: guidance, to: `/guidance?tab=requests${myGrades.length === 1 ? `&grade=${myGrades[0]}` : ""}`,
      label: "طلبات مقابلة جديدة", tone: "warning", icon: "heart" },
    { key: "excuses", n: excuses, to: "/absence-excuses", label: "أعذار غياب بانتظار قرارك", tone: "warning", icon: "idcard" },
    { key: "deputyReq", n: deputyReq, to: "/student-requests", label: "طلبات تواصل جديدة من الطلاب وأولياء الأمور", tone: "warning", icon: "send" },

    // الاعتماد
    { key: "toApprove", n: toApprove.length, to: "/forms-review", label: "نماذج تنتظر اعتمادك", tone: "warning", icon: "inbox",
      items: toApprove.map((d) => ({ id: d.id, to: `/forms-review?open=${d.id}`, title: [d.title, d.recipient].filter(Boolean).join(" · "), flag: d.flag ?? null })) },
    { key: "events", n: events, to: "/forms-review", label: "تقارير أحداث تنتظر الاعتماد", tone: "warning", icon: "sparkles" },
    { key: "plcPending", n: plcPending.length, to: "/plc?tab=pending",
      items: items(plcPending, "/plc", (r) => `جلسة ${r.head_name ?? ""}`),
      label: "جلسات تعلم مهني تنتظر اعتمادك", tone: "warning", icon: "users" },
    { key: "pdPending", n: pdPending.length, to: "/pd?tab=pending",
      items: items(pdPending, "/pd", (r) => r.owner_name ?? ""),
      label: "نماذج تطوير مهني تنتظر اعتمادك", tone: "warning", icon: "certificate" },
    { key: "xvPending", n: xvPending.length, to: "/xvisits?tab=pending",
      items: items(xvPending, "/xvisits", (r) => `زيارة ${r.visitor_name ?? ""}`),
      label: "زيارات تبادلية تنتظر اعتمادك", tone: "warning", icon: "eye" },
    { key: "notif", n: notif, to: "/notifications-review", label: "إشعارات تنتظر الاعتماد", tone: "warning", icon: "bell" },

    // المتابعة: ما عند غيرك ولم ينتهِ
    { key: "refFollow", n: refAway.length, to: "/referrals?tab=follow",
      label: "إحالات قيد المتابعة", tone: awayLate ? "absent" : "mint", icon: "clipboard", follow: true,
      sub: [awayC && `عند الموجهين ${awayC}`, awayG && `عند ولي الأمر ${awayG}`, awayLate && `متأخرة ${awayLate}`]
        .filter(Boolean).join(" · ") },

    noor,

    { key: "goalLate", n: goalsLate.length, to: "/improve?tab=board", label: "خطط تطوير متأخرة المتابعة", tone: "absent",
      icon: "target", follow: true, sub: `تجاوزت موعدها بأكثر من ${countAr(LATE_AFTER, "day", { acc: true })} دون قياس`,
      items: goalsLate.map((g) => goalItem(g, ` · الموعد ${fmtHijri(g.follow_up_date)}`)) },

    { key: "quizVerifyLate", n: qPlansLate.length, to: "/improve?tab=board", label: "خطط علاجية لم يُتحقق من أثرها",
      tone: "warning", icon: "quiz", follow: true, sub: `نُفّذت منذ أكثر من ${countAr(VERIFY_LATE_DAYS, "day", { acc: true })}`,
      items: qPlansLate.map((x) => ({ id: x.id, title: x.quizzes?.title ?? "خطة علاجية" })) },

    // مفكرتي: مهامك التي حلّ موعدها، والمتأخرة أولًا
    { key: "notes", n: myNotes.length, to: "/notebook", icon: "edit",
      label: "مهام في مفكرتي حلّ موعدها",
      tone: "note",   // لون مستقل (TasksBox)؛ والمتأخر يُذكر في السطر تحت العنوان
      sub: myNotes.some((x) => dueState(x) === "overdue") ? `متأخرة ${myNotes.filter((x) => dueState(x) === "overdue").length}` : "",
      items: myNotes.map((x) => ({ id: x.id, to: `/notebook?n=${x.id}`,
        title: `${noteTitle(x)}${dueState(x) === "overdue" ? " · متأخرة" : x.due_time ? ` · ${x.due_time.slice(0, 5)}` : ""}` })) },

    { key: "circulars", n: circPending.length, to: "/my-circulars", label: "تعاميم تنتظر اطلاعك", tone: "warning", icon: "circular",
      items: circPending.map((r) => ({ id: r.circular_id, to: `/circulars/${r.circular_id}`, title: r.circulars?.subject ?? "تعميم",
        flag: r.circulars?.priority === "urgent" ? "urgent" : null })) },

    // للعلم
    { key: "replies", n: replies, to: "/forms-review", label: "إفادات وصلت على نماذجك", tone: "mint", icon: "inbox" },
  ].filter((t) => t.n > 0).map((t) => {
    // الملصق: الأشد بين عناصر المهمة يظهر على بطاقتها، والعاجل أول قائمتها وبطاقته حمراء،
    // وتُعرض قائمتها في الصندوق (to: "/") ليظهر ملصق كل عنصر
    if (!t.items?.some((x) => x.flag)) return t;
    const flag = FLAG_ORDER.find((f) => t.items.some((x) => x.flag === f));
    return { ...t, flag, to: "/", items: [...t.items].sort((a, b) => flagRank(a.flag) - flagRank(b.flag)),
             tone: flag === "urgent" ? "absent" : t.tone };
  });

  state = {
    "/forms": returned,
    "/forms-review": toApprove.length + replies + events,
    "/my-documents": toReply.length,
    "/referrals": refDeputy.length + refCounselor.length,
    "/notifications-review": notif,
    "/plc": plcToSign.length + plcPending.length + plcBack.length
      + pdToSign.length + pdPending.length + pdBack.length
      + xvHost.length + xvPending.length + xvBack.length,
    "/my-performance": perfAck,
    "/improve": goalPlan.length + goalReview.length + goalDueRows.length,
    "/quizzes": qEnded.length + qVerify.length + qRound2.length,
    "/dropouts": dropouts.length,
    "/ethics": ethicsDue,
    "/notebook": myNotes.length,
    "/my-circulars": circPending.length,
    "/guidance": guidance + giDeputy.length + giReady.length,
    "/student-requests": deputyReq,
    "/absence-excuses": excuses,
    "/": behaviorGuardian.length + refGuardian.length + pledges.length + giGuardian.length + quizzesDue.length,
    _tasks: tasks,
    _ready: true,
  };
  lastAt = Date.now();
  emit();
}

function run() {
  if (!inflight) inflight = load().catch(() => {}).finally(() => { inflight = null; });
  return inflight;
}

// تحديث فوري (بعد إجراء أو انتقال)، مع حدّ أدنى 20 ثانية بين طلبين تلقائيين
export function refreshNavBadges(force = false) {
  if (force || Date.now() - lastAt > 20000) run();
}

// التحديث الدوري يتوقف والصفحة في الخلفية، ويُستأنف فور العودة إليها
const tick = () => { if (document.visibilityState === "visible") run(); };
const onVisible = () => { if (document.visibilityState === "visible") refreshNavBadges(); };

export function useNavBadges(uid, roles, role) {
  const [s, setS] = useState(state);
  const rolesKey = `${role ?? ""}:${(roles ?? []).join(",")}`;

  useEffect(() => {
    if (!uid) return;
    const changed = ctx?.uid !== uid || ctx?.rolesKey !== rolesKey;
    ctx = { uid, roles: roles ?? [], role: role ?? null, rolesKey };
    subs.add(setS);
    if (changed) { state = {}; emit(); run(); } else setS(state);
    if (!timer) {
      timer = setInterval(tick, 120000);
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      subs.delete(setS);
      if (!subs.size) {
        clearInterval(timer); timer = null;
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, rolesKey]);

  return s;
}
