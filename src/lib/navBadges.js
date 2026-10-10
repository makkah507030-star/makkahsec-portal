// src/lib/navBadges.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { stageOf, isLate, STAGE_COLS } from "./referrals.js";
import { fmtHijri } from "./dates.js";
import { GRADE_NAMES, todayISO } from "./schoolTime.js";
import { countAr } from "./arabicCount.js";

/* =====================================================================
   «بانتظار إجرائك» — مصدر واحد لكل ما ينتظر إجراء المستخدم: عدادات القائمة الجانبية
   وبطاقات صندوق المهام في الرئيسية (components/TasksBox.jsx).

   كل مهمة: { key, n, to, label, tone, icon, sub?, follow?, items? }
     sub    سطر تفصيل تحت العنوان
     follow متابعة لما عند غيرك — لا تُحسب في عدد «بانتظار إجرائك»
     to     الصفحة التي يُنجز فيها الإجراء (مع التبويب المناسب)
     items  [{ id, to, title }] حين تكون عناصرها معروفة — فتُفتح مباشرة
            إن كانت واحدة، وتُعرض قائمتها إن تعددت
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
const head = (t) => supabase.from(t).select("id", { count: "exact", head: true });
const mine = (uid) => JSON.stringify([{ user_id: uid }]);   // attendees @> [{user_id}]

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
      return { id: r.slot_id, to: "/exams",
        title: `${r.subject_name} · ${GRADE_NAMES[r.grade] ?? ""} ${r.class_no} · ${d === 0 ? "اليوم" : `منذ ${countAr(d, "day", { acc: true })}`}`
          + (r.status === "partial" ? " · رصد جزئي" : "") + (d > 5 ? " · متأخر" : "") };
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
  const ref = () => head("student_referrals");

  const [
    returned, toApprove, replies, events, toReply, refDeputy, refCounselor, notif,
    plcSign, pdSign, xvHost, plcPending, pdPending, xvPending,
    plcBack, pdBack, xvBack, perfAck, guidance,
    behaviorGuardian, refGuardian, pledges, refAway, noorDue,
  ] = await Promise.all([
    staff ? count(fd().eq("created_by", uid).eq("status", "rejected")) : none,
    has("principal") ? count(fd().eq("status", "pending")) : none,
    staff ? count(fd().eq("created_by", uid).eq("status", "replied")) : none,
    isManager
      ? count(head("school_events").not("report_submitted_at", "is", null).neq("stage", "approved").is("cancelled_at", null))
      : none,
    count(fd().eq("recipient_user_id", uid).eq("status", "awaiting_reply")),
    isDeputy ? count(ref().in("status", ["with_deputy", "guardian_replied"])) : none,
    isCounselor ? count(ref().eq("counselor_id", uid).in("status", ["with_counselor", "returned_to_counselor"])) : none,
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

    // ولي الأمر: نماذج السلوك والإحالات التي تنتظر إقراره، والطالب: تعهداته
    isGuardian ? rowsOf(supabase.from("behavior_forms").select("id, kind, student_name")
      .in("kind", ["pledge", "invite", "notice"]).is("guardian_ack_at", null).neq("status", "closed")
      .order("created_at").limit(50)) : noRows,
    isGuardian ? rowsOf(supabase.from("student_referrals").select("id, students(full_name)")
      .eq("status", "with_guardian").is("guardian_ack_at", null).order("created_at").limit(50)) : noRows,
    isStudent ? rowsOf(supabase.from("behavior_forms").select("id, kind")
      .eq("kind", "pledge").is("student_ack_at", null).neq("status", "closed").order("created_at").limit(50)) : noRows,

    // متابعة الوكيل: إحالات عند الموجهين أو ولي الأمر لم تنتهِ بعد
    isDeputy ? rowsOf(supabase.from("student_referrals").select(STAGE_COLS)
      .in("status", ["with_counselor", "returned_to_counselor", "with_guardian"]).limit(300)) : noRows,

    // المعلم: اختبارات فترات حلّ موعدها ولم يسجّل الوكيل رصدها في نور (للاطلاع)
    role === "teacher" ? rowsOf(supabase.rpc("my_noor_grade_due")) : noRows,
  ]);

  const unsigned = (rows, sigKey) => rows.filter((r) => !(r[sigKey] ?? []).some((g) => g.user_id === uid));
  const plcToSign = unsigned(plcSign, "plc_signatures");
  const pdToSign = unsigned(pdSign, "pd_signatures");
  const awayC = refAway.filter((r) => stageOf(r).group === "counselor").length;
  const awayG = refAway.filter((r) => stageOf(r).group === "guardian").length;
  const awayLate = refAway.filter(isLate).length;
  const noor = noorTask(noorDue);
  const items = (rows, path, title) => rows.map((r) => ({ id: r.id, to: `${path}/${r.id}`, title: title?.(r) ?? "" }));

  const tasks = [
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
    { key: "pledges", n: pledges.length, to: "/", items: items(pledges, "/behavior", () => "تعهد سلوكي"),
      label: "تعهدات تنتظر توقيعك", tone: "absent", icon: "shield" },

    // ما ينتظر ردك أو توقيعك أو اطلاعك
    { key: "toReply", n: toReply, to: "/my-documents",
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
    { key: "perfAck", n: perfAck, to: "/my-performance", label: "تقييم أداء ينتظر اطلاعك", tone: "warning", icon: "award" },
    { key: "referrals", n: refDeputy + refCounselor, to: "/referrals", label: "إحالات تنتظر إجراءك", tone: "warning", icon: "send" },
    { key: "guidance", n: guidance, to: `/guidance?tab=requests${myGrades.length === 1 ? `&grade=${myGrades[0]}` : ""}`,
      label: "طلبات مقابلة جديدة", tone: "warning", icon: "heart" },

    // الاعتماد
    { key: "toApprove", n: toApprove, to: "/forms-review", label: "نماذج تنتظر اعتمادك", tone: "warning", icon: "inbox" },
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

    // للعلم
    { key: "replies", n: replies, to: "/forms-review", label: "إفادات وصلت على نماذجك", tone: "mint", icon: "inbox" },
  ].filter((t) => t.n > 0);

  state = {
    "/forms": returned,
    "/forms-review": toApprove + replies + events,
    "/my-documents": toReply,
    "/referrals": refDeputy + refCounselor,
    "/notifications-review": notif,
    "/plc": plcToSign.length + plcPending.length + plcBack.length
      + pdToSign.length + pdPending.length + pdBack.length
      + xvHost.length + xvPending.length + xvBack.length,
    "/my-performance": perfAck,
    "/guidance": guidance,
    "/": behaviorGuardian.length + refGuardian.length + pledges.length,
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
