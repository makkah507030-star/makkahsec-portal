// src/lib/periodNotice.js
/* =====================================================================
   قراءة «إشعار فترة» المصدَّر من نظام نور بصيغة Excel: ورقة لكل طالب. يُقرأ كل شيء بالبحث عن
   العناوين نصًا لا بمواضع ثابتة، فلا يتأثر بإزاحة الأعمدة بين نسخ التصدير.
   يُؤخذ من كل ورقة: الهوية والاسم، والفصل الدراسي وعنوان الإشعار والصف والفصل، والمواد المرصودة
   وحدها (ما له «مجموع») بأجزائها، ودرجات المواظبة والسلوك. لا يُؤخذ «المجموع» العام.
   ===================================================================== */
import { cleanIdentity } from "./importer";

const norm = (v) => String(v ?? "").replace(/[ \s]+/g, " ").trim();
const num = (v) => {
  const s = norm(v).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* يبحث عن خلية نصها label ويعيد [صف، عمود] */
function find(rows, test) {
  for (let i = 0; i < rows.length; i++)
    for (let j = 0; j < rows[i].length; j++) if (test(norm(rows[i][j]))) return [i, j];
  return null;
}
/* أول قيمة غير فارغة في صف العنوان (نور يضع القيمة يسار العنوان) */
function valueBeside(rows, label) {
  const at = find(rows, (t) => t.replace(/:$/, "").trim() === label);
  if (!at) return "";
  const r = rows[at[0]];
  for (let j = 0; j < r.length; j++) {
    const t = norm(r[j]);
    if (j !== at[1] && t && t !== ":" && t.replace(/:$/, "").trim() !== label) return t;
  }
  return "";
}

/* ورقة طالب واحد ← كائن، أو null إن لم تكن إشعار فترة */
export function parseNoticeSheet(rows) {
  const head = find(rows, (t) => t === "المادة");
  if (!head) return null;
  const [hr, subjCol] = head;
  const H = rows[hr] ?? [];
  const S = rows[hr + 1] ?? [];
  const colOf = (label) => H.findIndex((v) => norm(v) === label);
  const maxCol = colOf("النهاية العظمى");
  const totalCol = colOf("مجموع");
  const noteCol = colOf("الملاحظات");
  // أجزاء الدرجة: عناوين الصف الفرعي (تقويمات تحريرية، المهام الأدائية…)
  const parts = [];
  S.forEach((v, j) => { const t = norm(v); if (t && j !== subjCol) parts.push({ col: j, label: t }); });

  const subjects = [];
  for (let i = hr + 2; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = norm(r[subjCol]).replace(/^\*+\s*/, "");
    if (!name) continue;
    if (name === "المجموع") break;
    const total = num(r[totalCol]);
    if (total == null) continue;                       // غير مرصودة: لا تظهر
    subjects.push({
      name,
      max: num(r[maxCol]),
      total,
      parts: parts.map((p) => ({ label: p.label, value: num(r[p.col]) })).filter((p) => p.value != null),
      note: noteCol >= 0 ? norm(r[noteCol]) || null : null,
    });
  }

  const titleAt = find(rows, (t) => /^إشعار فترة/.test(t));
  return {
    nationalId: cleanIdentity(valueBeside(rows, "رقم الهوية")),
    name: valueBeside(rows, "اسم الطالب"),
    year: valueBeside(rows, "العام الدراسي"),
    term: valueBeside(rows, "الفصل الدراسي"),
    gradeName: valueBeside(rows, "الصف"),
    section: valueBeside(rows, "القسم"),
    classNo: valueBeside(rows, "الفصل"),
    title: titleAt ? norm(rows[titleAt[0]][titleAt[1]]) : "إشعار فترة",
    subjects,
    attendance: num(valueBeside(rows, "درجة المواظبة")),
    behaviorExcellent: num(valueBeside(rows, "درجة السلوك المتميز")),
    behaviorPositive: num(valueBeside(rows, "درجة السلوك الإيجابي")),
  };
}

/* ملف نور كاملًا ← { notices, skipped } */
export async function parseNoticeFile(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const notices = [];
  let skipped = 0;
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", raw: false });
    const p = parseNoticeSheet(rows);
    if (p?.nationalId) notices.push(p); else skipped++;
  }
  return { notices, skipped };
}

/* مفتاح الإشعار داخل العام: الفصل الدراسي + عنوانه (يُستبدل عند كل رفع جديد له) */
export const noticeKey = (n) => `${n.term || "—"}|${n.title}`;

/* المجموع والنسبة من المواد المرصودة وحدها (لتقرير المتفوقين؛ لا يظهران للطالب) */
export function noticeTotals(subjects) {
  const total = subjects.reduce((a, x) => a + (x.total ?? 0), 0);
  const max = subjects.reduce((a, x) => a + (x.max ?? 0), 0);
  return { total, max_total: max, pct: max ? Math.round((total / max) * 1000) / 10 : null };
}

/* صف النشر المرسَل إلى period_notice_publish */
export const noticeRow = (n, studentId) => ({
  student_id: studentId,
  term: n.term || null,
  grade_name: n.gradeName || null,
  section: n.section || null,
  class_label: n.classNo ? `${n.gradeName} — فصل ${n.classNo}` : n.gradeName || null,
  subjects: n.subjects,
  ...noticeTotals(n.subjects),
  attendance: n.attendance,
  behavior_excellent: n.behaviorExcellent,
  behavior_positive: n.behaviorPositive,
});

/* هل تغيّر الإشعار عن المنشور؟ (المقارنة نفسها في الدالة على القاعدة) */
export function noticeChanged(row, old) {
  if (!old) return true;
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
  const num = (v) => (v == null ? null : Number(v));
  return JSON.stringify(canon(row.subjects)) !== JSON.stringify(canon(old.subjects))
    || num(row.attendance) !== num(old.attendance)
    || num(row.behavior_excellent) !== num(old.behavior_excellent)
    || num(row.behavior_positive) !== num(old.behavior_positive);
}

/* ملاحظة نور أسفل الإشعار */
export const NOOR_NOTE = (title) => `هذه ليست نتيجة الطالب النهائية، وإنما ${title || "إشعار فترة"} بالمواد التي اكتمل رصدها حتى آخر تحديث.`;
