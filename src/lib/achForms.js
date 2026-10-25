// src/lib/achForms.js
/* =====================================================================
   نموذج ملاحظة التحصيل والخطة العلاجية (supabase/ach_forms_1..3.sql).
   نموذج لكل معلم ومادة وصف في كل إشعار فترة، فيه فصوله الضعيفة كلها:
   مسودة آلية ← يرسلها موجه الصف ← يرد المعلم بالأسباب والخطة ← يراجعها الموجه ويرفعها
   للوكيل وتصل الخطة أولياء أمور المتعثرين ← يعتمدها وكيل الشؤون التعليمية.
   ===================================================================== */
import { supabase } from "./supabase";
import { stats, groupBy, weakTeachers, WEAK } from "./achievement";

export const FORM_STATUS = {
  draft: { t: "بانتظار الإرسال", who: "الموجه", c: "#5E6B66", bg: "#EEF1EF" },
  sent: { t: "بانتظار رد المعلم", who: "المعلم", c: "#2C5079", bg: "#E9F1FB" },
  returned: { t: "أُعيد للمعلم", who: "المعلم", c: "#8A5A12", bg: "#FBF3DE" },
  replied: { t: "بانتظار مراجعة الموجه", who: "الموجه", c: "#6B4FA0", bg: "#F1ECFA" },
  forwarded: { t: "بانتظار اعتماد الوكيل", who: "الوكيل", c: "#13606B", bg: "#E6F2F3" },
  approved: { t: "معتمد", who: null, c: "#2F6B4F", bg: "#EAF5EE" },
  excluded: { t: "مستبعد", who: null, c: "#7A2B2B", bg: "#FBEBEB" },
};
export const FLOW = ["draft", "sent", "replied", "forwarded", "approved"];

export const isOverdue = (f) => ["sent", "returned"].includes(f.status) && f.due_on && f.due_on < new Date().toISOString().slice(0, 10);

export const REASONS = [
  "ضعف التأسيس في المهارات السابقة",
  "كثافة المنهج وضيق الوقت",
  "غياب الطلاب وتأخرهم",
  "ضعف الدافعية والمشاركة الصفية",
  "صعوبة أسئلة الاختبار أو عدم مواءمتها لما دُرِّس",
  "قلة التدريب والواجبات",
  "كثرة أعداد الطلاب في الفصل",
  "انشغال الطلاب بالتزامات أخرى في فترة الاختبار",
];

export const ACTIONS = [
  "حصص تقوية للطلاب المتعثرين",
  "إعادة شرح المهارات غير المتقنة",
  "مجموعات تعلم تعاوني بقيادة المتميزين",
  "أوراق عمل علاجية متدرجة",
  "اختبار قصير بعد المعالجة لقياس الأثر",
  "التواصل مع أولياء الأمور ومتابعة الواجبات",
  "تنويع أساليب التقويم وأسئلة الاختبار",
];

/* صفوف المسودات من التحليل: معلم + مادة + صف ← فصوله الضعيفة بلقطة أرقامها */
export function buildFormRows(recs, checks) {
  const subjGrade = new Map([...groupBy(recs, (r) => `${r.grade}|${r.subject}`)].map(([k, rs]) => [k, stats(rs).avg]));
  const byCls = groupBy(recs, (r) => `${r.class_id}|${r.subject}`);
  const forms = new Map();
  weakTeachers(checks).forEach((w) => {
    if (!w.teacher?.teacher_id) return;
    const k = `${w.teacher.teacher_id}|${w.subject}|${w.grade}`;
    const f = forms.get(k) ?? { grade: w.grade, subject: w.subject, teacher_id: w.teacher.teacher_id,
      teacher_user: w.teacher.user_id, teacher_name: w.teacher.name, classes: [] };
    const rs = byCls.get(`${w.class_id}|${w.subject}`) ?? [];
    const s = stats(rs);
    f.classes.push({
      class_id: w.class_id, class_no: w.class_no,
      stats: { n: s.n, avg: s.avg, median: s.median, weakPct: s.weakPct, exPct: s.exPct, max: s.max, min: s.min,
               perfAvg: s.perfAvg, gradeAvg: subjGrade.get(`${w.grade}|${w.subject}`) ?? null, dist: s.dist },
      checks: w.checks.map((c) => ({ sev: c.sev, kind: c.kind, title: c.title, detail: c.detail, rec: c.rec })),
      students: rs.filter((r) => r.testPct != null && r.testPct < WEAK).sort((a, b) => a.testPct - b.testPct)
        .map((r) => ({ sid: r.sid, name: r.name, pct: Math.round(r.testPct * 10) / 10 })),
    });
    forms.set(k, f);
  });
  return [...forms.values()].map((f) => ({ ...f, classes: f.classes.sort((a, b) => a.class_no - b.class_no) }));
}

export async function syncForms(year, key, rows) {
  const { data, error } = await supabase.rpc("ach_sync", { p_year: year, p_key: key, p_rows: rows });
  if (error) throw error;
  return data;
}

export const setupMsg = "نماذج ملاحظة التحصيل تحتاج تشغيل supabase/ach_forms_1.sql ثم 2 ثم 3 في Supabase ← SQL Editor.";
export const isSetupErr = (e) => /ach_forms|ach_sync|function .* does not exist|schema cache/i.test(e?.message ?? "");
