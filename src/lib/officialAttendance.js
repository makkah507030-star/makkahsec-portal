// src/lib/officialAttendance.js
// =====================================================================
//  قواعد الحضور والغياب الرسمي لمركز تقارير شؤون الطلاب — مصدر واحد
//  لكل الأرقام حتى لا تختلف نسبتان لليوم نفسه في البوابة.
//
//  • التأخر الصباحي: بصمة بعد بداية الاصطفاف الصباحي + 5 دقائق.
//  • الغياب الرسمي: غائب عن الحصتين الأولى والثانية معًا (بعد الحصة الثانية).
//    من بصم وغاب عن الحصتين ليس حاضرًا — غائب، ويظهر للمتابعة (دخل ولم يحضر).
//  • النسبة الرسمية: تُعتمد بعد الحصة الثانية، ويحق للوكيل تصحيحها لاحقًا.
//  • النسبة المكتملة: حضور أي حصة خلال اليوم — للإجراءات الإحصائية.
// =====================================================================

import { supabase } from "./supabase";
import { fetchAllPaged } from "./attendanceHelpers";
import { loadPeriodTimes, toMinutes } from "./periodTimes";

export const LATE_GRACE_MINUTES = 5;
export const OFFICIAL_PERIODS = [1, 2];

/** حدود الإنذار بأيام الغياب الرسمي بدون عذر */
export const WARNING_STAGES = [
  { key: "warn1",    days: 10, label: "الإنذار الأول",  doc: "محضر إنذار أول" },
  { key: "warn2",    days: 15, label: "الإنذار الثاني", doc: "محضر إنذار ثانٍ" },
  { key: "transfer", days: 20, label: "التحويل لوكيل شؤون الطلاب", doc: "محضر تحويل لدراسة الحالة" },
];

export const OFFICIAL_LABEL = {
  present: "حاضر",
  absent: "غائب",
  excused: "غائب بعذر",
  pending: "لم يُحضَّر",
};

const isIn = (s) => s === "present" || s === "late";

/** دقائق اليوم لطابع زمني بتوقيت الرياض (مستقل عن توقيت جهاز المستخدم) */
export function riyadhMinutes(ts) {
  if (!ts) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(ts));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/**
 * بداية الاصطفاف الصباحي بالدقائق من جدول التوقيت (حسب التوقيت المفعّل:
 * صيفي/شتوي/رمضان). يُعرف بعنوانه (اصطفاف/طابور)، وإلا فأول فعالية قبل
 * الحصة الأولى، وإلا بداية الحصة الأولى نفسها.
 */
export function dayStartMinutes(periodTimes) {
  const rows = (periodTimes ?? []).filter((r) => r.start_time);
  const first = rows.find((r) => r.kind === "period" && r.period_no === 1);
  const p1 = first ? toMinutes(first.start_time) : null;
  const named = rows.find((r) => r.kind !== "period" && /اصطفاف|طابور/.test(r.label ?? ""));
  if (named) return toMinutes(named.start_time);
  const before = rows
    .filter((r) => r.kind !== "period" && (p1 == null || toMinutes(r.start_time) < p1))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))[0];
  return before ? toMinutes(before.start_time) : p1;
}

/** معلومات التأخر الصباحي لبصمة: { isLate, minutes } — الدقائق بعد انتهاء المهلة */
export function morningLate(punchTime, dayStart) {
  if (!punchTime || dayStart == null) return { isLate: false, minutes: 0 };
  const deadline = dayStart + LATE_GRACE_MINUTES;
  const m = riyadhMinutes(punchTime);
  return { isLate: m > deadline, minutes: Math.max(0, m - deadline) };
}

/** "6:50 ص" لموعد بدء احتساب التأخر */
export function lateDeadlineLabel(dayStart) {
  if (dayStart == null) return "";
  const t = dayStart + LATE_GRACE_MINUTES;
  const h = Math.floor(t / 60), m = t % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
}

/**
 * الحالة الرسمية لطالب واحد.
 * periods: { [period_no]: status } من تحضير المعلمين
 * required: الحصص المعتمدة لفصله (الأولى والثانية، أو أول حصة مجدولة له)
 */
export function officialStatus({ periods, required, excusedAbsence }) {
  const req = required?.length ? required : OFFICIAL_PERIODS;
  const vals = req.map((n) => periods?.[n]);
  if (vals.some(isIn)) return "present";
  const allMarked = vals.every((v) => v != null);
  if (excusedAbsence) return "excused";
  if (!allMarked) return "pending";
  if (vals.every((v) => v === "excused")) return "excused";
  return "absent";
}

/** الحالة المكتملة (نهاية اليوم): حضور أي حصة */
export function finalStatus({ periods, official }) {
  const vals = Object.values(periods ?? {});
  if (vals.some(isIn)) return "present";
  if (official === "excused") return "excused";
  if (vals.length) return "absent";
  return official === "absent" ? "absent" : "pending";
}

/**
 * يحسب كل حالات اليوم من السجلات الخام (بلا أي كتابة).
 * يعيد صفًا لكل طالب نشط:
 *  { student_id, full_name, class_no, grade, periods, punch, punched,
 *    official, final, conflict, noPunch, isLate, lateMinutes }
 */
export function computeDay({ students, attendance, punches, excusedIds, scheduleByClass, dayStart }) {
  const periodsBy = new Map();
  (attendance ?? []).forEach((r) => {
    const no = r.schedule?.period_no;
    if (no == null) return;
    const m = periodsBy.get(r.student_id) ?? {};
    m[no] = r.status;
    periodsBy.set(r.student_id, m);
  });
  const punchBy = new Map((punches ?? []).map((p) => [p.student_id, p.punch_time]));
  const excused = excusedIds ?? new Set();

  return (students ?? []).map((s) => {
    const periods = periodsBy.get(s.student_id) ?? {};
    const scheduled = scheduleByClass?.get(`${s.grade}-${s.class_no}`);
    let required = OFFICIAL_PERIODS;
    if (scheduled?.length) {
      const inWindow = OFFICIAL_PERIODS.filter((n) => scheduled.includes(n));
      required = inWindow.length ? inWindow : [Math.min(...scheduled)];
    }
    const official = officialStatus({ periods, required, excusedAbsence: excused.has(s.student_id) });
    const final = finalStatus({ periods, official });
    const punch = punchBy.get(s.student_id) ?? null;
    const late = morningLate(punch, dayStart);
    return {
      ...s,
      periods,
      punch,
      punched: !!punch,
      official,
      final,
      conflict: official === "absent" && !!punch,     // بصم ولم يحضر الحصتين
      noPunch: official === "present" && !punch,      // حضر الحصص بلا بصمة
      isLate: late.isLate,
      lateMinutes: late.minutes,
    };
  });
}

/** ملخّص أرقام اليوم لحقل حالة (official أو final) */
export function summarize(rows, field = "official") {
  const blank = () => ({ total: 0, present: 0, absent: 0, excused: 0, pending: 0 });
  const all = blank();
  const byGrade = {};
  (rows ?? []).forEach((r) => {
    const st = r[field];
    const g = (byGrade[r.grade] ??= blank());
    all.total++; g.total++;
    all[st] = (all[st] ?? 0) + 1;
    g[st] = (g[st] ?? 0) + 1;
  });
  const pct = (c) => (c.total - c.pending > 0
    ? Math.round((c.present * 10000) / (c.total - c.pending)) / 100 : null);
  all.pct = pct(all);
  Object.values(byGrade).forEach((g) => { g.pct = pct(g); });
  return { ...all, by_grade: byGrade };
}

/* ============================ تحميل البيانات ============================ */

let settingsCache = null;
export async function loadActiveTerm() {
  if (settingsCache) return settingsCache;
  const { data } = await supabase.from("settings").select("key, value")
    .in("key", ["active_year", "active_term"]);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  settingsCache = { year: m.active_year ?? "", term: Number(m.active_term ?? 1) };
  return settingsCache;
}

/** بداية الفصل الحالي من التقويم (آخر «بداية فصل» قبل اليوم) */
export async function loadTermStart(today) {
  const { data } = await supabase.from("academic_calendar")
    .select("start_date").eq("kind", "term_start").eq("is_active", true)
    .lte("start_date", today).order("start_date", { ascending: false }).limit(1);
  return data?.[0]?.start_date ?? null;
}

const dowOf = (date) => {
  const d = new Date(`${date}T12:00:00`).getDay() + 1; // الأحد = 1
  return d >= 1 && d <= 5 ? d : 0;
};

let studentsCache = null;
async function activeStudents() {
  if (studentsCache) return studentsCache;
  studentsCache = await fetchAllPaged(() =>
    supabase.from("v_active_students")
      .select("student_id, full_name, class_no, grade")
      .order("student_id", { ascending: true }));
  return studentsCache;
}

/** كل ما يلزم لحساب يوم واحد — قراءة فقط */
export async function loadDay(date) {
  const dow = dowOf(date);
  const { year, term } = await loadActiveTerm();

  const [students, attendance, punches, excRes, { rows: ptimes }, schedRes] = await Promise.all([
    activeStudents(),
    fetchAllPaged(() =>
      supabase.from("class_attendance")
        .select("id, student_id, status, schedule(period_no)")
        .eq("attend_date", date)
        .order("id", { ascending: true })),
    fetchAllPaged(() =>
      supabase.from("daily_attendance")
        .select("student_id, punch_time")
        .eq("attend_date", date)
        .order("student_id", { ascending: true })),
    supabase.from("excused_absences").select("student_id")
      .lte("date_from", date).gte("date_to", date),
    loadPeriodTimes(),
    dow
      ? supabase.from("schedule").select("period_no, classes(class_no, grade)")
          .eq("academic_year", year).eq("term", term).eq("day_of_week", dow)
      : Promise.resolve({ data: [] }),
  ]);

  const scheduleByClass = new Map();
  (schedRes.data ?? []).forEach((r) => {
    if (!r.classes) return;
    const k = `${r.classes.grade}-${r.classes.class_no}`;
    const list = scheduleByClass.get(k) ?? [];
    if (!list.includes(r.period_no)) list.push(r.period_no);
    scheduleByClass.set(k, list);
  });

  const dayStart = dayStartMinutes(ptimes);
  const rows = computeDay({
    students,
    attendance,
    punches,
    excusedIds: new Set((excRes.data ?? []).map((r) => r.student_id)),
    scheduleByClass,
    dayStart,
  });

  // سجلات تحضير لم يعد جدولها موجودًا (مثلًا بعد إعادة استيراد الجدول) — لا تُحتسب
  const orphans = attendance.filter((r) => r.schedule?.period_no == null).length;

  return {
    date, rows, dayStart, orphans,
    punchCount: punches.length,
    hasData: attendance.length > 0 || punches.length > 0,
  };
}

/** اليوم المعتمد وحالاته المحفوظة، أو null إن لم يُعتمد */
export async function loadApproval(date) {
  const { data: day, error } = await supabase.from("official_attendance_days")
    .select("*").eq("attend_date", date).maybeSingle();
  if (error) return { day: null, marks: [], missingTables: isMissingTable(error) };
  if (!day) return { day: null, marks: [] };
  const marks = await fetchAllPaged(() =>
    supabase.from("official_day_marks").select("*")
      .eq("attend_date", date).order("student_id", { ascending: true }));
  return { day, marks };
}

export function isMissingTable(error) {
  const msg = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return /42P01|PGRST205|PGRST202|does not exist|Could not find/i.test(msg);
}

/** اعتماد الغياب الرسمي لليوم (أو إعادة اعتماده) */
export async function approveDay(date, rows, { retroactive = false } = {}) {
  const { year, term } = await loadActiveTerm();
  const sum = summarize(rows, "official");
  const marks = rows
    .filter((r) => r.official !== "present" || r.isLate)
    .map((r) => ({
      student_id: r.student_id,
      status: r.official,
      punched: r.punched,
      full_name: r.full_name,
      class_no: r.class_no,
      grade: r.grade,
      punch_time: r.punch,
      late_minutes: r.isLate ? r.lateMinutes || 1 : 0,
    }));
  const { error } = await supabase.rpc("sa_save_official_day", {
    p_date: date,
    p_day: {
      academic_year: year,
      term,
      total: sum.total,
      by_grade: sum.by_grade,
      late_count: rows.filter((r) => r.isLate).length,
      retroactive,
    },
    p_marks: marks,
    p_mode: "approve",
  });
  if (error) throw error;
}

/** حفظ النسبة المكتملة لليوم (بعد اعتماده) */
export async function saveFinal(date, rows) {
  const sum = summarize(rows, "final");
  const { error } = await supabase.rpc("sa_save_official_day", {
    p_date: date,
    p_day: { ...sum, pct: sum.pct ?? "" },
    p_marks: null,
    p_mode: "final",
  });
  if (error) throw error;
}

/** تصحيح حالة طالب بعد الاعتماد */
export async function overrideMark(date, row, status, note) {
  const { error } = await supabase.rpc("sa_override_mark", {
    p_date: date,
    p_student: {
      student_id: row.student_id, punched: row.punched, full_name: row.full_name,
      class_no: row.class_no, grade: row.grade,
    },
    p_status: status,
    p_note: note || null,
  });
  if (error) throw error;
}

/** أيام الدراسة (الأحد–الخميس) بين تاريخين */
export function schoolDaysBetween(from, to) {
  const out = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (d <= end) {
    const js = d.getDay();
    if (js >= 0 && js <= 4) {
      const p = (n) => String(n).padStart(2, "0");
      out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}
