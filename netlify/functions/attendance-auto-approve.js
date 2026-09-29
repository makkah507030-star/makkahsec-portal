// netlify/functions/attendance-auto-approve.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  الاعتماد الآلي للغياب الرسمي والنسبة المكتملة.
//
//  الجدولة في netlify.toml: كل عشر دقائق خلال الدوام، الأحد–الخميس.
//    1) بعد نهاية الحصة الثانية + مهلة: اعتماد الغياب الرسمي ونسبة الحضور
//       الرسمية، وإشعار الإدارة.
//    2) بعد نهاية آخر حصة + مهلة: حفظ النسبة المكتملة. وإن بقي طلاب
//       «لم يُحضَّروا» في الاعتماد الرسمي يُعاد اعتماده أولًا ليشمل ما رصده
//       المعلمون متأخرين — وتبقى تصحيحات الوكيل اليدوية كما هي.
//
//  قواعد الحساب نسخة مطابقة لـ src/lib/officialAttendance.js (المصدر المعتمد):
//  أي تعديل على القواعد هناك يُنقل هنا أيضًا.
//
//  يُعطَّل بإعداد: settings.attendance_auto_approve = "false"
//  البصمات تُتجاهل ما لم يكن settings.fingerprint_enabled = "true" (قفل البصمة)
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const KSA = 3 * 60 * 60 * 1000;
const BUFFER_MIN = 10;               // مهلة بعد نهاية الحصة قبل الاعتماد
const LATE_GRACE_MINUTES = 5;        // التأخر بعد بداية الاصطفاف + 5 دقائق
const OFFICIAL_PERIODS = [1, 2];
const NOTIFY_ROLES = ["principal", "deputy_students", "tech_support"];

const ksaNow = () => new Date(Date.now() + KSA);
const ksaDate = () => ksaNow().toISOString().slice(0, 10);
const ksaMinutes = () => { const d = ksaNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const ksaDow = () => { const n = ksaNow().getUTCDay() + 1; return n >= 1 && n <= 5 ? n : 0; };
const toMinutes = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};
const punchMinutes = (ts) => {
  const d = new Date(new Date(ts).getTime() + KSA);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/* ------------------------- قواعد الحساب ------------------------- */

const isIn = (s) => s === "present" || s === "late";

function officialStatus(periods, required, excusedAbsence) {
  const vals = required.map((n) => periods[n]);
  if (vals.some(isIn)) return "present";
  if (excusedAbsence) return "excused";
  if (!vals.every((v) => v != null)) return "pending";
  if (vals.every((v) => v === "excused")) return "excused";
  return "absent";
}

function finalStatus(periods, official) {
  const vals = Object.values(periods);
  if (vals.some(isIn)) return "present";
  if (official === "excused") return "excused";
  if (vals.length) return "absent";
  return official === "absent" ? "absent" : "pending";
}

function dayStartMinutes(pt) {
  const rows = (pt || []).filter((r) => r.start_time);
  const first = rows.find((r) => r.kind === "period" && r.period_no === 1);
  const p1 = first ? toMinutes(first.start_time) : null;
  const named = rows.find((r) => r.kind !== "period" && /اصطفاف|طابور/.test(r.label || ""));
  if (named) return toMinutes(named.start_time);
  const before = rows
    .filter((r) => r.kind !== "period" && (p1 == null || toMinutes(r.start_time) < p1))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))[0];
  return before ? toMinutes(before.start_time) : p1;
}

function summarize(rows, field) {
  const blank = () => ({ total: 0, present: 0, absent: 0, excused: 0, pending: 0 });
  const all = blank();
  const byGrade = {};
  rows.forEach((r) => {
    const st = r[field];
    const g = (byGrade[r.grade] = byGrade[r.grade] || blank());
    all.total++; g.total++;
    all[st]++; g[st]++;
  });
  const pct = (c) => (c.total - c.pending > 0
    ? Math.round((c.present * 10000) / (c.total - c.pending)) / 100 : null);
  all.pct = pct(all);
  Object.values(byGrade).forEach((g) => { g.pct = pct(g); });
  return { ...all, by_grade: byGrade };
}

/* ------------------------- تحميل البيانات ------------------------- */

async function fetchAll(makeQuery) {
  let all = [];
  for (let from = 0; from < 60000; from += 1000) {
    const { data, error } = await makeQuery().range(from, from + 999);
    if (error) throw new Error(error.message);
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
  }
  return all;
}

async function computeToday(db, date, sched, pt, fingerprint) {
  const [students, attendance, allPunches, exc] = await Promise.all([
    fetchAll(() => db.from("v_active_students")
      .select("student_id, full_name, class_no, grade").order("student_id", { ascending: true })),
    fetchAll(() => db.from("class_attendance")
      .select("id, student_id, status, schedule(period_no)")
      .eq("attend_date", date).order("id", { ascending: true })),
    fetchAll(() => db.from("daily_attendance")
      .select("student_id, punch_time").eq("attend_date", date).order("student_id", { ascending: true })),
    db.from("excused_absences").select("student_id").lte("date_from", date).gte("date_to", date),
  ]);

  // البصمة المقفلة (مرحلة تجربة) لا تدخل في أي حساب
  const punches = fingerprint ? allPunches : [];

  const scheduleByClass = new Map();
  sched.forEach((r) => {
    if (!r.classes) return;
    const k = `${r.classes.grade}-${r.classes.class_no}`;
    const list = scheduleByClass.get(k) || [];
    if (!list.includes(r.period_no)) list.push(r.period_no);
    scheduleByClass.set(k, list);
  });
  const periodsBy = new Map();
  attendance.forEach((r) => {
    const no = r.schedule && r.schedule.period_no;
    if (no == null) return;
    const m = periodsBy.get(r.student_id) || {};
    m[no] = r.status;
    periodsBy.set(r.student_id, m);
  });
  const punchBy = new Map(punches.map((p) => [p.student_id, p.punch_time]));
  const excused = new Set((exc.data || []).map((r) => r.student_id));
  const dayStart = dayStartMinutes(pt);

  const rows = students.map((s) => {
    const periods = periodsBy.get(s.student_id) || {};
    const scheduled = scheduleByClass.get(`${s.grade}-${s.class_no}`);
    let required = OFFICIAL_PERIODS;
    if (scheduled && scheduled.length) {
      const inWindow = OFFICIAL_PERIODS.filter((n) => scheduled.includes(n));
      required = inWindow.length ? inWindow : [Math.min(...scheduled)];
    }
    const official = officialStatus(periods, required, excused.has(s.student_id));
    const punch = punchBy.get(s.student_id) || null;
    let lateMinutes = 0;
    if (punch && dayStart != null) {
      lateMinutes = Math.max(0, punchMinutes(punch) - (dayStart + LATE_GRACE_MINUTES));
    }
    return {
      ...s, official, final: finalStatus(periods, official),
      punched: !!punch, punch, isLate: lateMinutes > 0, lateMinutes,
    };
  });
  return { rows, hasData: attendance.length > 0 || punches.length > 0 };
}

async function approve(db, date, rows, s) {
  const sum = summarize(rows, "official");
  const marks = rows
    .filter((r) => r.official !== "present" || r.isLate)
    .map((r) => ({
      student_id: r.student_id, status: r.official, punched: r.punched,
      full_name: r.full_name, class_no: r.class_no, grade: r.grade,
      punch_time: r.punch, late_minutes: r.isLate ? r.lateMinutes : 0,
    }));
  const { error } = await db.rpc("sa_save_official_day", {
    p_date: date,
    p_day: {
      academic_year: s.active_year ?? "", term: Number(s.active_term ?? 1),
      total: sum.total, by_grade: sum.by_grade,
      late_count: rows.filter((r) => r.isLate).length, retroactive: false,
    },
    p_marks: marks,
    p_mode: "approve",
  });
  if (error) throw new Error(error.message);
  return sum;
}

async function saveFinal(db, date, rows) {
  const sum = summarize(rows, "final");
  const { error } = await db.rpc("sa_save_official_day", {
    p_date: date, p_day: { ...sum, pct: sum.pct ?? "" }, p_marks: null, p_mode: "final",
  });
  if (error) throw new Error(error.message);
  return sum;
}

async function notify(db, title, body) {
  const { data: roles } = await db.from("admin_roles")
    .select("user_id").in("role_type", NOTIFY_ROLES);
  const userIds = [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))];
  if (!userIds.length) return;
  const { data: nid, error } = await db.rpc("send_notification", {
    p_title: title, p_body: body, p_kind: "general",
    p_link: "/student-affairs?tab=official",
    p_roles: null, p_user_ids: userIds, p_grade: null, p_class_no: null, p_is_auto: true,
  });
  if (error) { console.error("[auto-approve] notify:", error.message); return; }
  if (nid) {
    try {
      await fetch(`${process.env.URL || ""}/.netlify/functions/push-send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: nid }),
      });
    } catch (e) { console.error("[auto-approve] push:", e && e.message); }
  }
}

/* ------------------------- التشغيل ------------------------- */

export const handler = async () => {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const date = ksaDate();
  const now = ksaMinutes();

  try {
    const { data: st } = await db.from("settings").select("key, value")
      .in("key", ["attendance_auto_approve", "fingerprint_enabled", "active_year", "active_term", "active_season"]);
    const s = Object.fromEntries((st || []).map((r) => [r.key, r.value]));
    if (s.attendance_auto_approve === "false") return { statusCode: 200, body: "disabled" };

    const dow = ksaDow();
    if (!dow) return { statusCode: 200, body: "weekend" };
    const { data: hol } = await db.from("academic_calendar")
      .select("title").eq("kind", "holiday").eq("is_active", true)
      .lte("start_date", date).gte("end_date", date).limit(1);
    if (hol && hol.length) return { statusCode: 200, body: "holiday" };

    const [{ data: pt }, { data: sched }, { data: day, error: dayErr }] = await Promise.all([
      db.from("period_times").select("kind, period_no, label, start_time, end_time")
        .eq("season", s.active_season ?? "summer"),
      db.from("schedule").select("id, period_no, classes(class_no, grade)")
        .eq("academic_year", s.active_year ?? "").eq("term", Number(s.active_term ?? 1))
        .eq("day_of_week", dow),
      db.from("official_attendance_days").select("attend_date, pending, final_at")
        .eq("attend_date", date).maybeSingle(),
    ]);
    if (dayErr) throw new Error(dayErr.message);
    if (!sched || !sched.length) return { statusCode: 200, body: "no classes" };

    const endOf = (no) => {
      const r = (pt || []).find((x) => x.kind === "period" && x.period_no === no);
      return r ? toMinutes(r.end_time) : null;
    };
    const p2End = endOf(2);
    const lastEnd = endOf(Math.max(...sched.map((r) => r.period_no)));
    if (p2End == null) return { statusCode: 200, body: "no period times" };

    const officialDue = !day && now >= p2End + BUFFER_MIN;
    const finalDue = lastEnd != null && now >= lastEnd + BUFFER_MIN && !(day && day.final_at);
    if (!officialDue && !finalDue) return { statusCode: 200, body: "nothing due" };

    const { rows, hasData } = await computeToday(db, date, sched, pt || [], s.fingerprint_enabled === "true");
    if (!hasData) return { statusCode: 200, body: "no attendance data yet" };

    // 1) الاعتماد الرسمي بعد الحصة الثانية
    if (officialDue) {
      const sum = await approve(db, date, rows, s);
      const pct = sum.pct != null ? `${sum.pct}%` : "—";
      await notify(db, "اعتماد الغياب الرسمي",
        `اعتُمد الغياب الرسمي لليوم آليًا.\n` +
        `نسبة الحضور الرسمية: ${pct}\nغائب: ${sum.absent} · بعذر: ${sum.excused}` +
        (sum.pending ? `\nلم يُحضَّر: ${sum.pending} طالبًا (حصص لم يرصدها معلموها)` : ""));
      console.log(`[auto-approve] official ${date}: ${pct}, absent ${sum.absent}, pending ${sum.pending}`);
    }

    // 2) النسبة المكتملة بعد آخر حصة
    if (finalDue && (day || officialDue)) {
      if (day && day.pending > 0) await approve(db, date, rows, s); // يشمل الرصد المتأخر
      const f = await saveFinal(db, date, rows);
      console.log(`[auto-approve] final ${date}: ${f.pct}%`);
    }

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.error("[auto-approve] خطأ:", e && e.message ? e.message : e);
    return { statusCode: 500, body: String(e && e.message ? e.message : e) };
  }
};
