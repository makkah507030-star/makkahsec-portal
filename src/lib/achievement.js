// src/lib/achievement.js
/* =====================================================================
   مركز التحصيل الدراسي — التحليل من «إشعار الفترة» المرفوع من نور (period_notices).
   • التحليل الرئيسي على درجات الاختبارات وحدها (التقويمات التحريرية والشفهية والعملية)،
     دون «المهام الأدائية والمشاركة والتفاعل» وعظماها 40 في كل المواد؛ فعظمى الاختبارات
     = عظمى المادة − 40 (60 ← 20، 100 ← 60).
   • المهام الأدائية تُحلَّل منفصلة في الفحوصات وحدها (تدنٍّ أو فجوة مع الاختبارات).
   • المادة التي لم يُرصد جزء اختباراتها بعد لا تدخل التحليل.
   ===================================================================== */
import { supabase } from "./supabase";
import { cmpAr } from "./sortAr.js";
import { GRADE_NAMES } from "./schoolTime";

/* من يرى المدرسة كلها، ومن يرى صفه وحده (counselor_N للصف N) */
export const ACH_ALL = ["principal", "deputy_academic", "deputy_students", "tech_support"];
export const ACH_ROLES = [...ACH_ALL, "counselor_1", "counselor_2", "counselor_3"];

export const PERF_MAX = 40;
export const isPerf = (label) => /أدائي/.test(label ?? "");

/* الشرائح الوزارية على النسبة (في الفترات لا «راسب»: ما دون 60 ضعيف).
   ألوانها متباعدة بقطبين (أخضر مزرقّ للمرتفع، وبرتقالي للمتدني) ووسط رمادي، فتُقرأ مع
   ضعف تمييز الألوان، ومعها دائمًا اسم الشريحة في المفتاح والتلميح والجدول. */
export const BANDS = [
  { k: "ex", min: 90, t: "ممتاز", color: "#13606B" },
  { k: "vg", min: 80, t: "جيد جدًا", color: "#4A97A0" },
  { k: "g", min: 70, t: "جيد", color: "#B3B9B5" },
  { k: "ok", min: 60, t: "مقبول", color: "#E2A35A" },
  { k: "weak", min: -Infinity, t: "ضعيف", color: "#B4502A" },
];
export const bandOf = (pct) => (pct == null ? null : BANDS.find((b) => pct >= b.min));

export const WEAK = 60;       // دون هذا ضعيف
export const LOW_AVG = 65;    // متوسط فصل متدنٍّ
export const VERY_LOW = 55;   // متوسط فصل متدنٍّ جدًا
export const MIN_N = 5;       // أقل عدد طلاب لفحص مجموعة

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const classLabel = (g, c) => `${GRADE_NAMES[g] ?? ""} · ${c}`;
export const classShort = (c) => String(c);

const TERM_NO = { "الفصل الأول": 1, "الفصل الثاني": 2, "الفصل الثالث": 3 };
export const termOf = (key) => TERM_NO[(key ?? "").split("|")[0]?.trim()] ?? 1;
export const noticeTitle = (key) => {
  const [term, title] = (key ?? "").split("|");
  return `${title ?? key} — ${term ?? ""}`.trim();
};

/* ---------------------------------------------------------------- */
/* التحميل                                                          */
/* ---------------------------------------------------------------- */

async function all(q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/* الإشعارات المتاحة في العام النشط: [{ key, count, last }] */
export async function loadNoticeKeys() {
  const { data: st } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
  const year = st?.value ?? "";
  const rows = await all(() => supabase.from("period_notices").select("report_key, updated_at").eq("academic_year", year));
  const g = new Map();
  rows.forEach((r) => {
    const x = g.get(r.report_key) ?? { key: r.report_key, count: 0, last: null };
    x.count++; if (!x.last || r.updated_at > x.last) x.last = r.updated_at;
    g.set(r.report_key, x);
  });
  return { year, keys: [...g.values()].sort((a, b) => (b.last ?? "").localeCompare(a.last ?? "")) };
}

/* تطبيع اسم المادة للمطابقة بين نور والجدول: بلا «ال» ولا أرقام ولا رموز */
const normSubj = (s) => (s ?? "").replace(/[0-9٠-٩\-–_()]/g, " ").split(/\s+/)
  .map((w) => w.replace(/^ال/, "")).filter((w) => w && w !== "و").join(" ").trim();

/* معلمو كل فصل ومادة من الجدول المدرسي للعام والفصل الدراسي */
async function loadTeachers(year, term) {
  const rows = await all(() => supabase.from("schedule")
    .select("teacher_id, class_id, subjects(name), teachers(full_name, user_id)")
    .eq("academic_year", year).eq("term", term)).catch(() => []);
  const out = [];   // [{ class_id, subj, teacher_id, name, user_id }]
  const seen = new Set();
  rows.forEach((r) => {
    const subj = normSubj(r.subjects?.name);
    const k = `${r.class_id}|${subj}|${r.teacher_id}`;
    if (!subj || seen.has(k)) return;
    seen.add(k);
    out.push({ class_id: r.class_id, subj, teacher_id: r.teacher_id, name: r.teachers?.full_name ?? "—", user_id: r.teachers?.user_id ?? null });
  });
  return out;
}

/* بيانات الإشعار كاملة ← { recs, students, teacherOf } */
export async function loadAchievement(year, key) {
  const [notices, enr, teachers] = await Promise.all([
    all(() => supabase.from("period_notices").select("student_id, subjects").eq("academic_year", year).eq("report_key", key)),
    all(() => supabase.from("v_active_students").select("student_id, full_name, national_id, grade, class_no")
      .eq("academic_year", year).eq("status", "active")),
    loadTeachers(year, termOf(key)),
  ]);
  const { data: cls } = await supabase.from("classes").select("id, grade, class_no").eq("academic_year", year);
  const classId = new Map((cls ?? []).map((c) => [`${c.grade}|${c.class_no}`, c.id]));
  const stu = new Map(enr.map((s) => [s.student_id, s]));

  const recs = [];   // سجل لكل طالب ومادة
  notices.forEach((n) => {
    const s = stu.get(n.student_id);
    if (!s) return;
    (n.subjects ?? []).forEach((x) => {
      const max = Number(x.max) || 0;
      const parts = x.parts ?? [];
      const perf = parts.find((p) => isPerf(p.label));
      const tests = parts.filter((p) => !isPerf(p.label) && p.value != null);
      const testMax = max > PERF_MAX ? max - PERF_MAX : max;
      const testScore = tests.length ? tests.reduce((a, p) => a + Number(p.value), 0) : null;
      const testPct = testScore != null && testMax ? Math.min(100, (testScore / testMax) * 100) : null;
      const perfPct = perf?.value != null ? Math.min(100, (Number(perf.value) / PERF_MAX) * 100) : null;
      if (testPct == null && perfPct == null) return;
      recs.push({
        sid: s.student_id, name: s.full_name, nid: s.national_id, grade: s.grade, class_no: s.class_no,
        class_id: classId.get(`${s.grade}|${s.class_no}`) ?? null,
        subject: x.name, testScore, testMax, testPct, perfPct,
      });
    });
  });

  // معلم المادة في الفصل: مطابقة الاسم بعد التطبيع (احتواء من أي جهة)
  const cache = new Map();
  const teacherOf = (class_id, subject) => {
    const k = `${class_id}|${subject}`;
    if (cache.has(k)) return cache.get(k);
    const ns = normSubj(subject);
    const list = teachers.filter((t) => t.class_id === class_id && (t.subj === ns || t.subj.includes(ns) || ns.includes(t.subj)));
    cache.set(k, list);
    return list;
  };
  // عدد طلاب كل فصل: لقياس اكتمال الرصد
  const classSize = new Map();
  enr.forEach((s) => { const k = classId.get(`${s.grade}|${s.class_no}`); if (k) classSize.set(k, (classSize.get(k) ?? 0) + 1); });
  return { recs, students: enr, teacherOf, classSize };
}

/* ---------------------------------------------------------------- */
/* الإحصاء                                                          */
/* ---------------------------------------------------------------- */

/* إحصاء مجموعة سجلات على نسبة الاختبارات */
export function stats(recs) {
  const xs = recs.map((r) => r.testPct).filter((v) => v != null);
  const ps = recs.map((r) => r.perfPct).filter((v) => v != null);
  const dist = Object.fromEntries(BANDS.map((b) => [b.k, 0]));
  xs.forEach((v) => { dist[bandOf(v).k]++; });
  const sorted = [...xs].sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  const m = avg(xs);
  const sd = xs.length > 1 ? Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / xs.length) : null;
  return {
    n: xs.length, avg: r1(m), median: r1(median), sd: r1(sd),
    min: r1(sorted[0] ?? null), max: r1(sorted[sorted.length - 1] ?? null),
    weakPct: xs.length ? r1((xs.filter((v) => v < WEAK).length / xs.length) * 100) : null,
    exPct: xs.length ? r1((xs.filter((v) => v >= 90).length / xs.length) * 100) : null,
    weak: xs.filter((v) => v < WEAK).length, ex: xs.filter((v) => v >= 90).length,
    perfAvg: r1(avg(ps)), perfN: ps.length, dist,
  };
}

export function groupBy(recs, keyFn) {
  const m = new Map();
  recs.forEach((r) => { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
}

/* ملخص كل طالب: متوسط اختباراته، ومواد ضعفه */
export function studentSummaries(recs) {
  return [...groupBy(recs, (r) => r.sid).values()].map((rs) => {
    const t = rs.filter((r) => r.testPct != null);
    return {
      sid: rs[0].sid, name: rs[0].name, nid: rs[0].nid, grade: rs[0].grade, class_no: rs[0].class_no, class_id: rs[0].class_id,
      avg: r1(avg(t.map((r) => r.testPct))), subjects: t.length,
      weakSubjects: t.filter((r) => r.testPct < WEAK).map((r) => ({ subject: r.subject, pct: r1(r.testPct) }))
        .sort((a, b) => a.pct - b.pct),
    };
  }).filter((s) => s.subjects > 0);
}

/* ---------------------------------------------------------------- */
/* الفحوصات الجماعية: ملاحظات آلية على مستوى الفصل والمادة         */
/* ---------------------------------------------------------------- */

export const SEV = {
  critical: { t: "حرج", rank: 0, c: "#A23B3B", bg: "#FBEBEB" },
  warning: { t: "تنبيه", rank: 1, c: "#8A5A12", bg: "#FBF3DE" },
  info: { t: "للمتابعة", rank: 2, c: "#2C5079", bg: "#E9F1FB" },
};

/* كل ملاحظة: { id, sev, kind, title, detail, grade, class_no, class_id, subject, teachers[], metric, rec } */
export const COVER_MIN = 0.7;   // دون هذه النسبة من طلاب الفصل: الرصد غير مكتمل فلا يُحكم على المتوسط

export function runChecks(recs, teacherOf, classSize = new Map()) {
  const out = [];
  const bySubjGrade = groupBy(recs, (r) => `${r.grade}|${r.subject}`);
  const gradeAvg = new Map([...bySubjGrade].map(([k, rs]) => [k, stats(rs).avg]));
  const push = (o) => out.push({ ...o, id: `${o.kind}|${o.class_id ?? o.grade}|${o.subject ?? ""}` });

  for (const rs of groupBy(recs, (r) => `${r.class_id}|${r.subject}`).values()) {
    const s = stats(rs);
    const { grade, class_no, class_id, subject } = rs[0];
    const base = { grade, class_no, class_id, subject, teachers: teacherOf(class_id, subject), n: s.n };
    const size = classSize.get(class_id) ?? 0;
    const partial = size > 0 && s.n / size < COVER_MIN;
    if (partial) push({ ...base, sev: "info", kind: "incomplete", metric: Math.round((s.n / size) * 100),
      title: "رصد درجات الاختبارات غير مكتمل",
      detail: `رُصدت درجات ${s.n} من ${size} طالبًا (${Math.round((s.n / size) * 100)}%)، فلا يُحكم على مستوى الفصل حتى يكتمل.`,
      rec: "متابعة المعلم لإكمال الرصد في نور، ثم إعادة رفع إشعار الفترة." });
    if (s.n >= MIN_N && !partial) {
      if (s.avg < VERY_LOW) push({ ...base, sev: "critical", kind: "low_avg", metric: s.avg,
        title: "متوسط الفصل في الاختبارات متدنٍّ جدًا",
        detail: `متوسط الاختبارات ${s.avg}% (${s.weak} من ${s.n} دون ${WEAK}%).`,
        rec: "تشخيص المهارات غير المتقنة، وخطة علاجية للفصل كله، وإعادة تقويم بعد التدخل." });
      else if (s.avg < LOW_AVG) push({ ...base, sev: "warning", kind: "low_avg", metric: s.avg,
        title: "متوسط الفصل في الاختبارات متدنٍّ",
        detail: `متوسط الاختبارات ${s.avg}%، والمرجع ${LOW_AVG}%.`,
        rec: "مراجعة نتائج الاختبار سؤالًا سؤالًا لتحديد المهارات الضعيفة ومعالجتها." });

      if (s.weakPct >= 40) push({ ...base, sev: s.weakPct >= 60 ? "critical" : "warning", kind: "many_weak", metric: s.weakPct,
        title: "نسبة كبيرة من الطلاب نسبهم متدنية",
        detail: `${s.weak} من ${s.n} طالبًا (${s.weakPct}%) دون ${WEAK}% في الاختبارات.`,
        rec: "تجميع الطلاب المتعثرين في مجموعة علاجية، وإشعار أولياء أمورهم." });

      if (s.n >= 10 && s.ex === 0 && s.avg != null) push({ ...base, sev: "info", kind: "no_top", metric: s.max,
        title: "لا يوجد طلاب بتقدير مرتفع",
        detail: `لم يبلغ أي طالب 90% في الاختبارات؛ أعلى نسبة ${s.max}%.`,
        rec: "مراجعة مستوى صعوبة الاختبار وتوازنه، وإثراء للطلاب المتميزين." });

      const ga = gradeAvg.get(`${grade}|${subject}`);
      if (ga != null && s.avg != null && ga - s.avg >= 12) push({ ...base, sev: "warning", kind: "gap_peers", metric: r1(ga - s.avg),
        title: "الفصل أقل من بقية فصول الصف بفارق كبير",
        detail: `متوسط الفصل ${s.avg}% مقابل ${ga}% لمتوسط ${GRADE_NAMES[grade] ?? "الصف"} في المادة.`,
        rec: "مقارنة الأساليب والتقويم مع فصول الصف الأخرى، وتبادل الزيارات." });
    }
    // المهام الأدائية: منفصلة عن التحليل الرئيسي
    if (s.perfN >= MIN_N && s.perfAvg != null) {
      if (s.perfAvg < 60) push({ ...base, sev: s.perfAvg < 45 ? "critical" : "warning", kind: "low_perf", metric: s.perfAvg,
        title: "درجات الفصل متدنية جدًا في المهام الأدائية",
        detail: `متوسط المهام الأدائية والمشاركة ${s.perfAvg}% من ${PERF_MAX}.`,
        rec: "التحقق من اكتمال رصد المهام وتفعيل المشاركة الصفية والواجبات." });
      if (s.avg != null && s.n >= MIN_N && s.perfAvg >= 90 && s.avg < 55) push({ ...base, sev: "info", kind: "perf_gap", metric: r1(s.perfAvg - s.avg),
        title: "فجوة كبيرة بين المهام الأدائية والاختبارات",
        detail: `المهام الأدائية ${s.perfAvg}% والاختبارات ${s.avg}%.`,
        rec: "مراجعة معايير تقدير المهام الأدائية ومواءمتها مع مستوى التحصيل." });
    }
  }

  // على مستوى الصف والمادة: ضعف عام في المادة
  for (const [k, rs] of bySubjGrade) {
    const s = stats(rs);
    if (s.n < 20 || s.avg == null || s.avg >= LOW_AVG) continue;
    const [grade, subject] = k.split("|");
    push({ grade: Number(grade), class_no: null, class_id: null, subject, teachers: [], n: s.n,
      sev: s.avg < VERY_LOW ? "critical" : "warning", kind: "subject_grade", metric: s.avg,
      title: "ضعف عام في المادة على مستوى الصف",
      detail: `متوسط ${GRADE_NAMES[grade] ?? ""} في الاختبارات ${s.avg}% (${s.n} طالبًا).`,
      rec: "اجتماع القسم لمراجعة توزيع المنهج والاختبارات، وخطة علاجية على مستوى الصف." });
  }

  // طلاب متعثرون في مواد كثيرة داخل الفصل
  for (const ss of groupBy(studentSummaries(recs), (s) => s.class_id).values()) {
    const many = ss.filter((s) => s.weakSubjects.length >= 3);
    if (!many.length) continue;
    const { grade, class_no, class_id } = ss[0];
    push({ grade, class_no, class_id, subject: null, teachers: [], n: ss.length,
      sev: many.length >= 5 ? "critical" : "warning", kind: "multi_weak", metric: many.length,
      title: "طلاب متعثرون في ثلاث مواد فأكثر",
      detail: `${many.length} طالبًا: ${many.slice(0, 4).map((s) => s.name.split(" ").slice(0, 2).join(" ")).join("، ")}${many.length > 4 ? "…" : ""}`,
      students: many.map((s) => s.sid),
      rec: "إحالة للموجه الطلابي لدراسة الحالة، والتواصل مع أولياء الأمور." });
  }

  return out.sort((a, b) => SEV[a.sev].rank - SEV[b.sev].rank || (a.grade - b.grade) || (a.class_no ?? 0) - (b.class_no ?? 0) || cmpAr(a.subject, b.subject));
}

/* المعلمون ذوو الضعف الواضح: من له ملاحظة حرجة، أو تنبيهان فأكثر، في فصل ومادة يدرّسهما */
export function weakTeachers(checks) {
  const m = new Map();
  checks.filter((c) => c.class_id && c.subject).forEach((c) => {
    c.teachers.forEach((t) => {
      const k = `${t.teacher_id}|${c.class_id}|${c.subject}`;
      const x = m.get(k) ?? { teacher: t, grade: c.grade, class_no: c.class_no, class_id: c.class_id, subject: c.subject, checks: [] };
      x.checks.push(c);
      m.set(k, x);
    });
  });
  return [...m.values()].filter((x) => x.checks.some((c) => c.sev === "critical") || x.checks.filter((c) => c.sev === "warning").length >= 2);
}
