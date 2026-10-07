// src/lib/navBadges.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/* =====================================================================
   عدادات «بانتظار إجرائك» — مصدر واحد للقائمة الجانبية وبطاقة التنبيهات:
     /forms                 نماذج أعادها المدير إليك للتعديل
     /forms-review          نماذج تنتظر اعتمادك (المدير)، وإفادات وصلت على نماذج أصدرتها،
                            وتقارير أحداث تنتظر الاعتماد (المدير والدعم الفني)
     /my-documents          نماذج وصلتك تنتظر إفادتك
     /referrals             إحالات تنتظر إجراءك (الوكيل: الواردة إليه، والموجه: المحالة إليه)
     /notifications-review  إشعارات تنتظر الاعتماد (الدعم الفني)
   يُحدَّث كل دقيقتين، وعند الانتقال بين الصفحات (refreshNavBadges).
   استعلامات عدّ فقط (head)، وكلها عبر صلاحيات المستخدم نفسه.
   ===================================================================== */

let state = {};                 // to -> count
let ctx = null;                 // { uid, roles }
let timer = null;
let inflight = null;
let lastAt = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f(state));

const count = async (q) => {
  const { count: n, error } = await q;
  return error ? 0 : n ?? 0;
};

async function load() {
  if (!ctx?.uid) return;
  const { uid, roles } = ctx;
  const has = (...r) => r.some((x) => roles.includes(x));
  const fd = () => supabase.from("form_documents").select("id", { count: "exact", head: true });
  const ref = () => supabase.from("student_referrals").select("id", { count: "exact", head: true });

  const isDeputy = has("deputy_students", "principal", "tech_support");
  const isCounselor = roles.some((r) => r.startsWith("counselor"));
  const isManager = has("principal", "tech_support");

  const [returned, toApprove, replies, events, toReply, refDeputy, refCounselor, notif] = await Promise.all([
    count(fd().eq("created_by", uid).eq("status", "rejected")),
    has("principal") ? count(fd().eq("status", "pending")) : 0,
    count(fd().eq("created_by", uid).eq("status", "replied")),
    isManager
      ? count(supabase.from("school_events").select("id", { count: "exact", head: true })
          .not("report_submitted_at", "is", null).neq("stage", "approved").is("cancelled_at", null))
      : 0,
    count(fd().eq("recipient_user_id", uid).eq("status", "awaiting_reply")),
    isDeputy ? count(ref().in("status", ["with_deputy", "guardian_replied"])) : 0,
    isCounselor ? count(ref().eq("counselor_id", uid).in("status", ["with_counselor", "returned_to_counselor"])) : 0,
    has("tech_support")
      ? count(supabase.from("notification_drafts").select("id", { count: "exact", head: true }).eq("status", "pending"))
      : 0,
  ]);

  state = {
    "/forms": returned,
    "/forms-review": toApprove + replies + events,
    "/my-documents": toReply,
    "/referrals": refDeputy + refCounselor,
    "/notifications-review": notif,
    // تفصيل لبطاقة التنبيهات
    _returned: returned, _toApprove: toApprove, _replies: replies, _events: events,
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

export function useNavBadges(uid, roles) {
  const [s, setS] = useState(state);
  const rolesKey = (roles ?? []).join(",");

  useEffect(() => {
    if (!uid) return;
    const changed = ctx?.uid !== uid || ctx?.rolesKey !== rolesKey;
    ctx = { uid, roles: roles ?? [], rolesKey };
    subs.add(setS);
    if (changed) { state = {}; emit(); run(); } else setS(state);
    if (!timer) timer = setInterval(run, 120000);
    return () => {
      subs.delete(setS);
      if (!subs.size) { clearInterval(timer); timer = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, rolesKey]);

  return s;
}
