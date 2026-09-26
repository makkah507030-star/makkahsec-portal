// src/lib/gradeBook.js
/* =====================================================================
   كشف رصد الدرجات القابل للتعديل — منطق مشترك بين محرّر الكشف وطباعته.

   قيمة كل خانة:
   ١) ما كتبه المعلم (جدول grade_entries) — يتقدّم دائمًا.
   ٢) وإلا القيمة التلقائية: عمود «التقويمات التحريرية» يُملأ من الاختبارات
      القصيرة المصحّحة في البوابة (متوسط نسب الطالب × سقف العمود، والغائب «غ»).
   ٣) مجموع الفترة يُحسب حين تكتمل كل خانات الفترة أرقامًا، والمجموع الكلي
      حين يكتمل مجموعا الفترتين.
   ===================================================================== */
import { configFor, quizColumnIndex } from "./gradeSheets";

export const PERIODS = ["period1", "period2"];
const P_SHORT = { period1: "p1", period2: "p2" };

const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
export const subjectKey = (g) => g.subject_id || clean(g.subject);
export const fmtNum = (v) => String(Math.round(Number(v) * 10) / 10);
export const cellId = (period, col) => `${P_SHORT[period]}:${col}`;

export function sheetShape(g) {
  const cfg = configFor(g.subject, g.grade);
  const cols = cfg.periodGroups.flatMap((x) => x.cols);
  const qIdx = quizColumnIndex(cfg);
  return { cfg, cols, nCols: cols.length, qIdx, qMax: qIdx >= 0 ? cols[qIdx].max : 0 };
}

/* ——— القيم التلقائية من الاختبارات المصحّحة ———
   ترجع { [g.key]: { period1: {studentId: نسبة ٠–١ | "غ"}, period2: {…}, count: {…} } } */
export async function loadQuizMarks(supabase, { uid, year, term, groups }) {
  if (!uid || !groups.length) return {};
  const { data: qz } = await supabase.from("quizzes")
    .select("id, subject_id, subject_name, period, total_marks")
    .eq("teacher_id", uid).eq("academic_year", year).eq("term", term)
    .in("period", PERIODS);
  if (!qz?.length) return {};
  const ids = qz.map((q) => q.id);
  const [{ data: qc }, { data: subs }] = await Promise.all([
    supabase.from("quiz_classes").select("quiz_id, class_id").in("quiz_id", ids),
    supabase.from("quiz_submissions").select("quiz_id, class_id, student_id, score, absent").in("quiz_id", ids),
  ]);
  const linked = new Set((qc ?? []).map((x) => `${x.quiz_id}|${x.class_id}`));
  const out = {};
  groups.forEach((g) => {
    const mine = qz.filter((q) =>
      (q.subject_id && g.subject_id ? q.subject_id === g.subject_id : clean(q.subject_name) === clean(g.subject)) &&
      linked.has(`${q.id}|${g.class_id}`));
    if (!mine.length) return;
    const res = { period1: {}, period2: {}, count: { period1: 0, period2: 0 } };
    PERIODS.forEach((p) => {
      const graded = mine.filter((q) => q.period === p &&
        (subs ?? []).some((x) => x.quiz_id === q.id && x.class_id === g.class_id));
      res.count[p] = graded.length;
      g.students.forEach((st) => {
        const rows = (subs ?? []).filter((x) =>
          x.class_id === g.class_id && x.student_id === st.id && graded.some((q) => q.id === x.quiz_id));
        const pcts = rows.filter((x) => !x.absent && x.score != null).map((x) => {
          const q = graded.find((qq) => qq.id === x.quiz_id);
          return Number(x.score) / (Number(q.total_marks) || 1);
        });
        if (pcts.length) res[p][st.id] = pcts.reduce((a, b) => a + b, 0) / pcts.length;
        else if (rows.some((x) => x.absent)) res[p][st.id] = "غ";
      });
    });
    out[g.key] = res;
  });
  return out;
}

/* ——— ما كتبه المعلم ———  ترجع { "g.key|studentId|cell": value } */
export async function loadEntries(supabase, { uid, year, term, groups }) {
  if (!uid || !groups.length) return {};
  const classIds = [...new Set(groups.map((g) => String(g.class_id)))];
  const { data } = await supabase.from("grade_entries")
    .select("class_id, subject_key, student_id, cell, value")
    .eq("teacher_user_id", uid).eq("academic_year", String(year)).eq("term", term)
    .in("class_id", classIds);
  const out = {};
  (data ?? []).forEach((e) => {
    const g = groups.find((x) => String(x.class_id) === e.class_id && subjectKey(x) === e.subject_key);
    if (g) out[`${g.key}|${e.student_id}|${e.cell}`] = e.value ?? "";
  });
  return out;
}

/* ——— حفظ خانة أو إرجاعها للقيمة التلقائية (value === null) ——— */
export async function saveEntry(supabase, { uid, year, term, g, studentId, cell, value }) {
  const key = {
    teacher_user_id: uid, class_id: String(g.class_id), subject_key: subjectKey(g),
    academic_year: String(year), term, student_id: String(studentId), cell,
  };
  if (value === null) {
    let q = supabase.from("grade_entries").delete();
    Object.entries(key).forEach(([k, v]) => { q = q.eq(k, v); });
    return q;
  }
  return supabase.from("grade_entries")
    .upsert({ ...key, value, updated_at: new Date().toISOString() },
            { onConflict: "teacher_user_id,class_id,subject_key,academic_year,term,student_id,cell" });
}

/* ——— صف طالب كاملًا ———
   خانات بترتيب الكشف: أعمدة الفترة الأولى، مجموعها، أعمدة الثانية، مجموعها، المجموع.
   كل خانة: { text, src: "manual" | "auto" | "calc" | "", period, col, max, auto } */
export function buildRow(g, shape, student, marks, entries) {
  const { cols, qIdx, qMax } = shape;
  const cells = [];
  const totals = {};
  PERIODS.forEach((p) => {
    const periodCells = cols.map((c, ci) => {
      const id = cellId(p, ci);
      const k = `${g.key}|${student.id}|${id}`;
      const autoRaw = ci === qIdx ? marks?.[p]?.[student.id] : undefined;
      const auto = autoRaw == null ? "" : autoRaw === "غ" ? "غ" : fmtNum(autoRaw * qMax);
      const has = Object.prototype.hasOwnProperty.call(entries, k);
      return { text: has ? entries[k] : auto, src: has ? "manual" : auto ? "auto" : "",
               period: p, col: ci, cell: id, max: c.max, auto };
    });
    const nums = periodCells.map((c) => (c.text !== "" && c.text !== "غ" && isFinite(Number(c.text))) ? Number(c.text) : null);
    const total = nums.every((n) => n != null) ? nums.reduce((a, b) => a + b, 0) : null;
    totals[p] = total;
    cells.push(...periodCells,
      { text: total == null ? "" : fmtNum(total), src: total == null ? "" : "calc", period: p, total: true });
  });
  const grand = totals.period1 != null && totals.period2 != null ? totals.period1 + totals.period2 : null;
  cells.push({ text: grand == null ? "" : fmtNum(grand), src: grand == null ? "" : "calc", grand: true });
  return cells;
}

/* التحقق من قيمة يكتبها المعلم: فارغ، أو «غ»، أو رقم بين ٠ وسقف العمود */
export function validCell(text, max) {
  const t = clean(text).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace("٫", ".");
  if (t === "" || t === "غ") return { ok: true, value: t };
  const n = Number(t);
  if (!isFinite(n) || n < 0 || n > max) return { ok: false };
  return { ok: true, value: fmtNum(n) };
}
