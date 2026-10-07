// src/lib/examScope.js
import { supabase } from "./supabase";
import { GRADE_NAMES, todayISO } from "./schoolTime";

/* =====================================================================
   نطاق جداول الاختبارات لكل مستخدم — مشترك بين صفحة «جداول الاختبارات»
   وبطاقة «اختبارات اليوم» في الصفحة الرئيسية:
     الطالب      فصله فقط
     ولي الأمر   فصول أبنائه فقط
     المعلم      الفصول المسندة إليه، وموادّه فيها فقط
     الإدارة     كل الفصول
   كل نطاق: { key, classId, grade, label, subjects? }؛ subjects (للمعلم) قائمة
   { id, name } بموادّه في ذلك الفصل.
   ===================================================================== */

const classLabel = (grade, no) => `${GRADE_NAMES[grade] ?? ""} — فصل ${no}`;
const normName = (s) => String(s ?? "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

export async function loadExamContext(uid, role) {
  const { data: st } = await supabase.from("settings")
    .select("key, value").in("key", ["active_year", "active_term"]);
  const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
  const year = m.active_year ?? "";
  const activeTerm = Number(m.active_term ?? 1);

  const { data: terms } = await supabase.from("exam_terms")
    .select("*").eq("is_published", true).eq("academic_year", year);

  let scopes = [];
  if (role === "student") {
    const { data: s } = await supabase.from("students")
      .select("id, class_id, classes(class_no, grade)").eq("user_id", uid).maybeSingle();
    if (s) scopes = [{ key: s.class_id, classId: s.class_id, grade: s.classes?.grade,
                       label: classLabel(s.classes?.grade, s.classes?.class_no) }];
  } else if (role === "guardian") {
    const { data: g } = await supabase.from("guardians").select("id").eq("user_id", uid).maybeSingle();
    if (g) {
      const { data: kids } = await supabase.from("guardian_student")
        .select("students(id, full_name, class_id, classes(class_no, grade))").eq("guardian_id", g.id);
      scopes = (kids ?? []).map((k) => k.students).filter(Boolean).map((s) => ({
        key: s.id, classId: s.class_id, grade: s.classes?.grade,
        label: `${s.full_name} — فصل ${s.classes?.class_no}`,
      }));
    }
  } else if (role === "teacher") {
    const { data: t } = await supabase.from("teachers").select("id").eq("user_id", uid).maybeSingle();
    if (t) {
      const { data: sch } = await supabase.from("schedule")
        .select("class_id, subject_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t.id).eq("academic_year", year).eq("term", activeTerm);
      const map = new Map();
      (sch ?? []).forEach((r) => {
        if (!map.has(r.class_id)) {
          map.set(r.class_id, { key: r.class_id, classId: r.class_id, grade: r.classes?.grade,
                                classNo: r.classes?.class_no ?? 0,
                                label: classLabel(r.classes?.grade, r.classes?.class_no), subjects: [] });
        }
        const sc = map.get(r.class_id);
        if (!sc.subjects.some((x) => x.id === r.subject_id)) sc.subjects.push({ id: r.subject_id, name: r.subjects?.name ?? "" });
      });
      scopes = [...map.values()].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo);
    }
  } else {
    const { data: cs } = await supabase.from("classes")
      .select("id, class_no, grade").eq("academic_year", year).order("grade").order("class_no");
    scopes = (cs ?? []).map((c) => ({ key: c.id, classId: c.id, grade: c.grade, label: classLabel(c.grade, c.class_no) }));
  }

  return { year, terms: terms ?? [], scopes };
}

// هل الاختبار من مواد المعلم في هذا الفصل؟ (بالمعرّف، أو بالاسم إن غاب المعرّف)
export function isMySubject(slot, scope) {
  if (!scope?.subjects) return true;
  return scope.subjects.some((s) =>
    (s.id && slot.subject_id && s.id === slot.subject_id) || normName(s.name) === normName(slot.subject_name));
}

// اختبارات نطاق واحد في فترة اختبار واحدة
export async function loadScopeSlots(term, scope) {
  let q = supabase.from("exam_slots").select("*").eq("exam_term_id", term.id);
  q = term.kind === "final"
    ? q.eq("grade", scope.grade).is("class_id", null)
    : q.eq("class_id", scope.classId);
  const { data } = await q.order("exam_date").order("period_no");
  return (data ?? []).filter((s) => isMySubject(s, scope));
}

/* اختبارات أقرب يوم اختبار (اليوم أو ما بعده) لكل النطاقات معًا — للبطاقة الرئيسية.
   ترجع { date, items: [{ scope, slot, final }] } أو null */
export async function loadNextExamDay(ctx) {
  const today = todayISO();
  const live = ctx.terms.filter((t) => !t.end_date || t.end_date >= today);
  if (!live.length || !ctx.scopes.length) return null;

  const classTerms = live.filter((t) => t.kind !== "final").map((t) => t.id);
  const finalTerms = live.filter((t) => t.kind === "final").map((t) => t.id);
  const classIds = [...new Set(ctx.scopes.map((s) => s.classId).filter(Boolean))];
  const grades = [...new Set(ctx.scopes.map((s) => s.grade).filter((g) => g != null))];

  const [a, b] = await Promise.all([
    classTerms.length && classIds.length
      ? supabase.from("exam_slots").select("*").in("exam_term_id", classTerms)
          .in("class_id", classIds).gte("exam_date", today)
      : { data: [] },
    finalTerms.length && grades.length
      ? supabase.from("exam_slots").select("*").in("exam_term_id", finalTerms)
          .is("class_id", null).in("grade", grades).gte("exam_date", today)
      : { data: [] },
  ]);

  const items = [];
  (a.data ?? []).forEach((slot) => ctx.scopes
    .filter((sc) => sc.classId === slot.class_id && isMySubject(slot, sc))
    .forEach((scope) => items.push({ scope, slot, final: false })));
  // النهائي على مستوى الصف: مرة واحدة لكل ابن، ولكل صف عند المعلم
  (b.data ?? []).forEach((slot) => {
    const seen = new Set();
    ctx.scopes.filter((sc) => sc.grade === slot.grade && isMySubject(slot, sc)).forEach((scope) => {
      const k = ctx.scopes.some((x) => x.subjects) ? `g${scope.grade}` : scope.key;
      if (seen.has(k)) return;
      seen.add(k);
      items.push({ scope: ctx.scopes.some((x) => x.subjects)
                     ? { ...scope, label: GRADE_NAMES[scope.grade] ?? scope.label } : scope,
                   slot, final: true });
    });
  });

  if (!items.length) return null;
  const date = items.map((i) => i.slot.exam_date).filter(Boolean).sort()[0];
  return {
    date,
    items: items.filter((i) => i.slot.exam_date === date)
      .sort((x, y) => (x.slot.period_no ?? 0) - (y.slot.period_no ?? 0) || x.scope.label.localeCompare(y.scope.label, "ar")),
  };
}

// «بعد 4 أيام» بالعدد الصحيح للتمييز
export const daysPhrase = (n) =>
  n === 0 ? "اليوم" : n === 1 ? "غدًا" : n === 2 ? "بعد يومين"
    : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`;
