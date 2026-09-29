// src/lib/referrals.js
import { supabase } from "./supabase";
import { sendPush } from "./pushSend.js";

/* =====================================================================
   متابعة الإحالات — ما تشترك فيه صفحة الإحالات وصندوق لوحة التحكم:
   حالة كل إحالة، ومن هي عنده الآن، ومنذ متى، ومسارها الزمني.
   ===================================================================== */

export const STATUS = {
  with_deputy:           { t: "لدى وكيل شؤون الطلاب", c: "bg-warning/10 text-warning" },
  with_counselor:        { t: "لدى الموجه الطلابي",   c: "bg-mint-tint text-mint-deep" },
  returned_to_counselor: { t: "مُعادة للموجه",         c: "bg-absent/10 text-absent" },
  closed:                { t: "مُقفلة",                c: "bg-present/10 text-present" },
  with_guardian:         { t: "لدى ولي الأمر",         c: "bg-warning/10 text-warning" },
  guardian_replied:      { t: "وصل رد ولي الأمر",      c: "bg-present/10 text-present" },
  archived:              { t: "مؤرشفة",                c: "bg-canvas text-muted" },
};

// ما زالت قيد المتابعة (لم تنتهِ)
export const OPEN_STATUSES = [
  "with_deputy", "with_counselor", "returned_to_counselor", "with_guardian", "guardian_replied",
];

// الأعمدة اللازمة لحساب المرحلة
export const STAGE_COLS =
  "id, serial, student_name, class_label, reason, status, teacher_name, created_at, teacher_at, " +
  "deputy_at, counselor_id, counselor_name, counselor_at, closed_at, guardian_ack_at";

// تُعدّ الإحالة متأخرة إن بقيت في مرحلتها أكثر من هذا
export const LATE_DAYS = 3;

const DAY = 24 * 60 * 60 * 1000;

/* عند من الإحالة الآن، ومنذ متى.
   group: deputy | counselor | guardian | done */
export function stageOf(r) {
  switch (r.status) {
    case "with_deputy":
      return r.counselor_at
        ? { group: "deputy", who: "وكيل شؤون الطلاب", since: r.counselor_at,
            what: "لاعتماد إجراء الموجه" }
        : { group: "deputy", who: "وكيل شؤون الطلاب", since: r.teacher_at ?? r.created_at,
            what: "للتحويل للموجه" };
    case "with_counselor":
      return { group: "counselor", who: r.counselor_name || "الموجه الطلابي",
               since: r.deputy_at ?? r.created_at, what: "لاتخاذ الإجراء" };
    case "returned_to_counselor":
      return { group: "counselor", who: r.counselor_name || "الموجه الطلابي",
               since: r.counselor_at ?? r.deputy_at ?? r.created_at, what: "أُعيدت بملاحظة الوكيل" };
    case "with_guardian":
      return { group: "guardian", who: "ولي الأمر", since: r.closed_at ?? r.created_at,
               what: "لتأكيد الاستلام" };
    case "guardian_replied":
      return { group: "deputy", who: "وكيل شؤون الطلاب", since: r.guardian_ack_at ?? r.created_at,
               what: "للاطّلاع على رد ولي الأمر وإنهاء المتابعة" };
    default:
      return { group: "done", who: "", since: null, what: "" };
  }
}

export function daysSince(v) {
  if (!v) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / DAY));
}

export const isLate = (r) => {
  const s = stageOf(r);
  return s.group !== "done" && daysSince(s.since) > LATE_DAYS;
};

export const daysLabel = (n) =>
  n === 0 ? "اليوم" : n === 1 ? "منذ يوم" : n === 2 ? "منذ يومين" :
  n <= 10 ? `منذ ${n} أيام` : `منذ ${n} يومًا`;

/* مسار الإحالة خطوة خطوة: ما تمّ بتاريخه، وما بقي */
export function timelineOf(r) {
  return [
    { t: "رفعها المعلم",   who: r.teacher_name,   at: r.teacher_at ?? r.created_at },
    { t: "حوّلها الوكيل",  who: r.deputy_name,    at: r.deputy_at },
    { t: "إجراء الموجه",   who: r.counselor_name, at: r.counselor_at },
    { t: "أُقفلت وأُشعر ولي الأمر", who: "",      at: r.closed_at },
    { t: "رد ولي الأمر",   who: "",               at: r.guardian_ack_at },
  ];
}

/* إشعار داخل البوابة ثم دفع للجوال — لا يعطّل الإجراء إن فشل */
export async function notifyUsers(userIds, title, body, link) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  try {
    const { data: nid } = await supabase.rpc("send_notification", {
      p_title: title, p_body: body, p_kind: "general", p_link: link,
      p_roles: null, p_user_ids: ids, p_grade: null, p_class_no: null, p_is_auto: false,
    });
    if (nid) {
      await sendPush(nid);
    }
  } catch { /* الإجراء نفسه حُفظ */ }
}
