// src/pages/student-affairs/monthlyData.js
import { supabase } from "../../lib/supabase";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { loadFingerprintPublic } from "../../lib/officialAttendance";
import { stageOf } from "../../lib/referrals";

/* =====================================================================
   بيانات التقرير الشهري لشؤون الطلاب: الحضور والغياب من الأيام المعتمدة
   (official_attendance_days) وعلامات الطلاب (official_day_marks)، والتأخر
   الصباحي، وإنذارات الغياب، والإحالات، والمنقطعين.
   كل مصدر مستقل: ما تعذّر جلبه يظهر صفرًا ولا يوقف التقرير.
   ===================================================================== */

const iso = (y, m, d = 1) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const quiet = (p) => Promise.resolve(p).then((r) => (r?.error ? { data: null } : r)).catch(() => ({ data: null }));
const pctOf = (present, total, pending = 0) => (total - pending > 0 ? Math.round((present * 1000) / (total - pending)) / 10 : null);

export function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  return { y, m, from: iso(y, m), to: iso(y, m + 1), trendFrom: iso(y, m - 5), days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

/** الطلاب مرتبين بعدد أيامهم في العلامات */
function topStudents(marks, extra) {
  const by = new Map();
  marks.forEach((r) => {
    const s = by.get(r.student_id) ?? { name: r.full_name, grade: r.grade, cls: r.class_no, days: 0, minutes: 0 };
    s.days += 1; s.minutes += extra ? Number(r.late_minutes) || 0 : 0;
    by.set(r.student_id, s);
  });
  return [...by.values()].sort((a, b) => b.days - a.days || b.minutes - a.minutes);
}

export async function loadAffairsMonthly(month) {
  const b = monthBounds(month);
  const lt = (q) => q.lt("attend_date", b.to);
  const [days, absent, late, warns, refs, drops, fp] = await Promise.all([
    quiet(supabase.from("official_attendance_days").select("attend_date, total, present, absent, excused, pending, by_grade, late_count")
      .gte("attend_date", b.trendFrom).lt("attend_date", b.to).order("attend_date")),
    fetchAllPaged(() => lt(supabase.from("official_day_marks").select("student_id, attend_date, full_name, grade, class_no")
      .eq("status", "absent").gte("attend_date", b.from)).order("attend_date").order("student_id")).catch(() => []),
    fetchAllPaged(() => lt(supabase.from("official_day_marks").select("student_id, attend_date, full_name, grade, class_no, late_minutes")
      .gt("late_minutes", 0).gte("attend_date", b.from)).order("attend_date").order("student_id")).catch(() => []),
    quiet(supabase.from("absence_warnings").select("stage, issued_on").gte("issued_on", b.from).lt("issued_on", b.to)),
    quiet(supabase.from("student_referrals").select("kind, status, grade, created_at, closed_at, counselor_id, counselor_at, deputy_at, teacher_at, guardian_ack_at")
      .gte("created_at", b.from).lt("created_at", b.to)),
    quiet(supabase.from("student_dropouts").select("status, reason, reported_at, decided_at").gte("reported_at", b.from).lt("reported_at", b.to)),
    loadFingerprintPublic().catch(() => ({ on: false })),
  ]);

  const D = days.data ?? [];
  const mDays = D.filter((d) => d.attend_date >= b.from);
  const sum = (list) => list.reduce((t, d) => ({ total: t.total + d.total, present: t.present + d.present, absent: t.absent + d.absent,
    excused: t.excused + d.excused, pending: t.pending + d.pending }), { total: 0, present: 0, absent: 0, excused: 0, pending: 0 });
  const tot = sum(mDays);

  // الصفوف: من by_grade في الأيام المعتمدة
  const grades = {};
  mDays.forEach((d) => Object.entries(d.by_grade ?? {}).forEach(([g, v]) => {
    const e = (grades[g] ??= { total: 0, present: 0, absent: 0, excused: 0, pending: 0 });
    for (const k of Object.keys(e)) e[k] += v[k] ?? 0;
  }));

  // أيام الأسبوع: نسبة الغياب بدون عذر
  const wd = {};
  mDays.forEach((d) => {
    const w = new Date(`${d.attend_date}T12:00:00`).getDay();
    const e = (wd[w] ??= { n: 0, total: 0, absent: 0, pending: 0 });
    e.n++; e.total += d.total; e.absent += d.absent; e.pending += d.pending;
  });

  // الأشهر الستة: نسبة الحضور الرسمية لكل شهر
  const trend = Array.from({ length: 6 }, (_, i) => {
    const k = iso(b.y, b.m - 5 + i).slice(0, 7);
    const t = sum(D.filter((d) => d.attend_date.startsWith(k)));
    return { key: k, label: new Date(`${k}-15T12:00:00`).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "short" }),
             pct: pctOf(t.present, t.total, t.pending), days: D.filter((d) => d.attend_date.startsWith(k)).length };
  });

  const absentTop = topStudents(absent, false);
  const lateTop = topStudents(late, true);
  const lateByGrade = {};
  late.forEach((r) => { lateByGrade[r.grade] = (lateByGrade[r.grade] ?? 0) + 1; });
  const W = warns.data ?? [];
  const R = refs.data ?? [];
  const X = drops.data ?? [];
  const count = (rows, k) => rows.reduce((o, r) => { o[r[k]] = (o[r[k]] ?? 0) + 1; return o; }, {});

  return {
    month, ...b, fpOn: !!fp?.on,
    attendance: {
      days: mDays.length, ...tot, pct: pctOf(tot.present, tot.total, tot.pending),
      grades: Object.entries(grades).sort().map(([g, v]) => ({ g: Number(g), ...v, pct: pctOf(v.present, v.total, v.pending) })),
      weekdays: [0, 1, 2, 3, 4].filter((w) => wd[w]).map((w) => ({ w, ...wd[w], rate: pctOf(wd[w].absent, wd[w].total, wd[w].pending) })),
      students: absentTop.length, repeat3: absentTop.filter((s) => s.days >= 3).length, top: absentTop.slice(0, 10),
    },
    late: {
      incidents: late.length, students: lateTop.length, minutes: late.reduce((a, r) => a + (Number(r.late_minutes) || 0), 0),
      repeat3: lateTop.filter((s) => s.days >= 3).length, byGrade: lateByGrade, top: lateTop.slice(0, 10),
    },
    warnings: { total: W.length, byStage: count(W, "stage") },
    referrals: {
      total: R.length, byKind: count(R, "kind"), byGrade: count(R, "grade"),
      // أُنهي إجراؤها: أُقفلت وأُشعر ولي الأمر (closed_at) — ومنها ما ينتظر تأكيد ولي الأمر
      closed: R.filter((r) => r.closed_at).length,
      // عند من هي الآن (stageOf كما في صفحة الإحالات)
      byStage: count(R.map((r) => ({ g: stageOf(r).group })), "g"),
    },
    dropouts: { total: X.length, byStatus: count(X, "status") },
    trend,
  };
}

/** تسميات الشهر للتقارير الشهرية: الميلادي والهجري والفترة */
export function monthLabels(month) {
  const b = monthBounds(month);
  const last = new Date(Date.UTC(b.y, b.m, 0, 12)), first = new Date(Date.UTC(b.y, b.m - 1, 1, 12));
  const hm = (dt) => new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { month: "long" }).format(dt);
  const hy = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { year: "numeric" }).format(last).replace(/\D/g, "");
  const dmy = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  return {
    month: new Date(`${month}-15T12:00:00`).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric" }),
    hijri: `${hm(first) === hm(last) ? hm(first) : `${hm(first)} – ${hm(last)}`} ${hy}هـ`,
    range: `${dmy(b.from)} – ${dmy(`${b.from.slice(0, 8)}${String(b.days).padStart(2, "0")}`)}`,
  };
}
