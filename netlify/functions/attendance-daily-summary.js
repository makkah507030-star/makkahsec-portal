// netlify/functions/attendance-daily-summary.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  ملخّص يومي للإدارة: الحصص التي لم تُحضَّر اليوم ومعلموها.
//
//  الجدولة في netlify.toml (بعد انتهاء الدوام):
//    schedule = "20 11 * * 0-4"   (= 2:20 مساءً بتوقيت السعودية، الأحد–الخميس)
//
//  يُرسل إشعارًا واحدًا لمدير المدرسة والوكلاء والدعم الفني، بدل
//  إغراقهم بإشعار مع كل حصة.
// =====================================================================

const { createClient } = require("@supabase/supabase-js");

const KSA = 3 * 60 * 60 * 1000;
const ksaNow = () => new Date(Date.now() + KSA);
const ksaDate = () => ksaNow().toISOString().slice(0, 10);
const ksaDow = () => {
  const n = ksaNow().getUTCDay() + 1;
  return n >= 1 && n <= 5 ? n : 0;
};

// من يصله الملخّص
const ADMIN_ROLES = ["principal", "deputy_academic", "deputy_students", "tech_support"];

exports.handler = async () => {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const today = ksaDate();

  try {
    const { data: st } = await db.from("settings").select("key, value")
      .in("key", ["attendance_summary_enabled", "active_year", "active_term"]);
    const s = Object.fromEntries((st || []).map((r) => [r.key, r.value]));
    if (s.attendance_summary_enabled === "false") {
      return { statusCode: 200, body: "summary disabled" };
    }

    const dow = ksaDow();
    if (!dow) return { statusCode: 200, body: "weekend" };

    const { data: hol } = await db.from("academic_calendar")
      .select("title").eq("kind", "holiday").eq("is_active", true)
      .lte("start_date", today).gte("end_date", today).limit(1);
    if (hol && hol.length) return { statusCode: 200, body: "holiday" };

    // حصص اليوم
    const { data: sched } = await db.from("schedule")
      .select("id, period_no, classes(class_no), teachers(full_name)")
      .eq("academic_year", s.active_year ?? "")
      .eq("term", Number(s.active_term ?? 1))
      .eq("day_of_week", dow);
    if (!sched || !sched.length) return { statusCode: 200, body: "no classes" };

    const ids = sched.map((r) => r.id);
    const { data: done } = await db.from("class_attendance")
      .select("schedule_id").eq("attend_date", today).in("schedule_id", ids);
    const doneSet = new Set((done || []).map((r) => r.schedule_id));

    const missing = sched.filter((r) => !doneSet.has(r.id));
    const total = sched.length;
    const marked = total - missing.length;
    const pct = total ? Math.round((marked / total) * 100) : 0;

    // تجميع الحصص غير المحضَّرة بحسب المعلم
    const byTeacher = {};
    missing.forEach((r) => {
      const name = r.teachers?.full_name ?? "غير محدّد";
      (byTeacher[name] ??= []).push(`ح${r.period_no}${r.classes?.class_no ? `/${r.classes.class_no}` : ""}`);
    });

    const lines = Object.entries(byTeacher)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, list]) => `• ${name}: ${list.join("، ")}`);

    const body = missing.length === 0
      ? `اكتمل تحضير جميع حصص اليوم (${total} حصة). أحسنتم.`
      : `حُضّرت ${marked} من ${total} حصة (${pct}%).\nلم تُحضَّر ${missing.length} حصة:\n${lines.join("\n")}`;

    // مستلمو الملخّص
    const { data: roles } = await db.from("admin_roles")
      .select("user_id, role_type").in("role_type", ADMIN_ROLES);
    const userIds = [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))];
    if (!userIds.length) return { statusCode: 200, body: "no admins" };

    const { data: nid, error } = await db.rpc("send_notification", {
      p_title: "ملخّص تحضير اليوم",
      p_body: body,
      p_kind: "general",
      p_link: "/period-attendance",
      p_roles: null,
      p_user_ids: userIds,
      p_grade: null,
      p_class_no: null,
      p_is_auto: true,
    });
    if (error) throw new Error(error.message);

    if (nid) {
      try {
        await fetch(`${process.env.URL || ""}/.netlify/functions/push-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_id: nid }),
        });
      } catch (e) { console.error("push:", e?.message); }
    }

    console.log(`[summary] ${marked}/${total} — غير محضَّر: ${missing.length}`);
    return { statusCode: 200, body: `ok ${marked}/${total}` };
  } catch (e) {
    console.error("[summary] خطأ:", e?.message || e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
