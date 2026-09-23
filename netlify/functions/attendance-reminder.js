// netlify/functions/attendance-reminder.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  تذكير تلقائي للمعلم الذي لم يرصد تحضير حصته الجارية.
//
//  الجدولة في netlify.toml: كل خمس دقائق خلال الدوام فقط
//    schedule = "*/5 4-11 * * 0-4"   (بتوقيت UTC = 7ص–2م بتوقيت السعودية، الأحد–الخميس)
//
//  المنطق: يقرأ أوقات الحصص للتوقيت الفعّال، فيحدّد الحصة الجارية،
//  وبعد مرور مهلة (افتراضيًا ١٠ دقائق) من بدايتها يرسل تذكيرًا لمن لم يحضّر،
//  مرة واحدة فقط لكل حصة في اليوم.
// =====================================================================

const { createClient } = require("@supabase/supabase-js");

const KSA = 3 * 60 * 60 * 1000;

const admin = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const ksaNow = () => new Date(Date.now() + KSA);
const ksaDate = (d = ksaNow()) => d.toISOString().slice(0, 10);
const ksaMinutes = (d = ksaNow()) => d.getUTCHours() * 60 + d.getUTCMinutes();
const toMinutes = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

// الأحد = 1 … الخميس = 5، و0 يعني عطلة
const ksaDow = (d = ksaNow()) => {
  const js = d.getUTCDay(); // الأحد = 0
  const n = js + 1;
  return n >= 1 && n <= 5 ? n : 0;
};

exports.handler = async () => {
  const db = admin();
  const today = ksaDate();

  try {
    // ① الإعدادات
    const { data: st } = await db.from("settings").select("key, value")
      .in("key", ["attendance_reminder_enabled", "attendance_reminder_minutes",
                  "active_year", "active_term", "active_season"]);
    const s = Object.fromEntries((st || []).map((r) => [r.key, r.value]));

    if (s.attendance_reminder_enabled === "false") {
      return { statusCode: 200, body: "reminder disabled" };
    }

    const delay = Number(s.attendance_reminder_minutes ?? 10);
    const dow = ksaDow();
    if (!dow) return { statusCode: 200, body: "weekend" };

    // ② إجازة رسمية؟
    const { data: hol } = await db.from("academic_calendar")
      .select("title").eq("kind", "holiday").eq("is_active", true)
      .lte("start_date", today).gte("end_date", today).limit(1);
    if (hol && hol.length) return { statusCode: 200, body: "holiday" };

    // ③ الحصة الجارية بعد انقضاء المهلة
    const { data: pt } = await db.from("period_times")
      .select("kind, period_no, start_time, end_time")
      .eq("season", s.active_season ?? "summer");

    const now = ksaMinutes();
    const slot = (pt || []).find((r) => {
      if (r.kind !== "period" || r.period_no == null) return null;
      const a = toMinutes(r.start_time), b = toMinutes(r.end_time);
      return a != null && b != null && now >= a + delay && now <= b;
    });
    if (!slot) return { statusCode: 200, body: "no active period" };

    // ④ حصص هذه الحصة اليوم
    const { data: sched } = await db.from("schedule")
      .select("id, period_no, teacher_id, classes(class_no), subjects(name), teachers(user_id, full_name)")
      .eq("academic_year", s.active_year ?? "")
      .eq("term", Number(s.active_term ?? 1))
      .eq("day_of_week", dow)
      .eq("period_no", slot.period_no);

    if (!sched || !sched.length) return { statusCode: 200, body: "no classes" };

    const ids = sched.map((r) => r.id);

    // ⑤ ما رُصد تحضيره + ما سبق تذكيره
    const [{ data: done }, { data: sent }] = await Promise.all([
      db.from("class_attendance").select("schedule_id")
        .eq("attend_date", today).in("schedule_id", ids),
      db.from("attendance_reminders").select("schedule_id")
        .eq("remind_date", today).in("schedule_id", ids),
    ]);

    const doneSet = new Set((done || []).map((r) => r.schedule_id));
    const sentSet = new Set((sent || []).map((r) => r.schedule_id));

    const pending = sched.filter(
      (r) => !doneSet.has(r.id) && !sentSet.has(r.id) && r.teachers?.user_id,
    );
    if (!pending.length) return { statusCode: 200, body: "all marked" };

    // ⑥ إرسال تذكير لكل معلم
    let sentCount = 0;
    for (const row of pending) {
      const cls = row.classes?.class_no ?? "";
      const subj = row.subjects?.name ?? "";
      const body =
        `الحصة ${row.period_no}${cls ? ` — فصل ${cls}` : ""}${subj ? ` — ${subj}` : ""}` +
        ` لم يُرصد تحضيرها بعد. افتح البوابة لرصد الحضور.`;

      const { data: nid, error } = await db.rpc("send_notification", {
        p_title: "تذكير برصد التحضير",
        p_body: body,
        p_kind: "general",
        p_link: "/",
        p_roles: null,
        p_user_ids: [row.teachers.user_id],
        p_grade: null,
        p_class_no: null,
        p_is_auto: true,
      });

      if (error) { console.error("notify:", error.message); continue; }

      await db.from("attendance_reminders").insert({
        schedule_id: row.id, remind_date: today, teacher_id: row.teacher_id,
      });

      if (nid) {
        try {
          await fetch(`${process.env.URL || ""}/.netlify/functions/push-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_id: nid }),
          });
        } catch (e) { console.error("push:", e?.message); }
      }
      sentCount++;
    }

    console.log(`[reminder] الحصة ${slot.period_no}: ذُكّر ${sentCount} معلمًا`);
    return { statusCode: 200, body: `sent ${sentCount}` };
  } catch (e) {
    console.error("[reminder] خطأ:", e?.message || e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
