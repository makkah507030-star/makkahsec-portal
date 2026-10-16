import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * قراءة ملفات النتائج PDF المُصدَّرة من نظام نور.
 *
 * ملاحظة مهمة: نصوص الحقول العربية داخل هذه الملفات مُرمَّزة بخط خاص من
 * نور ولا يمكن قراءتها كنص عادي — لهذا نعتمد فقط على الأرقام ومواضعها في
 * الصفحة (تُستخرج بشكل سليم دائمًا لأنها ليست جزءًا من ترميز الخط الخاص).
 *
 * يقبل الملف لطالب واحد، أو لفصل أو صف أو المدرسة كاملة: تُقسَّم الصفحات
 * حسب رقم الهوية، فكل صفحة فيها رقم هوية تبدأ طالبًا جديدًا، والصفحة التي
 * بلا رقم (أو بالرقم نفسه) تتبع الطالب الذي قبلها.
 */

const NUM = /^\d+(?:\.\d+)?$/;

/** رقم الهوية/الإقامة: 10 خانات يبدأ بـ 1 أو 2 */
const findNationalId = (text) => text.match(/\b[12]\d{9}\b/)?.[0] ?? null;

/**
 * مجموع الطالب في إشعار الفترة. جدول المواد يضم مواد الفصلين معًا، ولكل مادة
 * «النهاية العظمى» (100، أو 60 لأن الـ40 الباقية للاختبار النهائي)، وفي آخره
 * سطر المجموع (1220 مثلًا = مجموع العمود). نجد هذا العمود برقم يساوي مجموع
 * ما فوقه، ثم نقرأ درجة الطالب لكل مادة من عمود «مجموع» المجاور له.
 * تُحتسب المواد المرصودة فقط؛ مواد الفصل الآخر (الفارغة) لا تدخل في الحساب.
 * يعيد { total, max, subjects } أو null إن لم تُرصد أي مادة بعد.
 */
function findPeriodTotal(items) {
  const nums = items
    .filter((it) => NUM.test(it.str.trim()))
    .map((it) => ({
      v: Number(it.str.trim()),
      cx: it.transform[4] + it.width / 2,
      y: it.transform[5],
    }));

  for (const sumRow of nums) {
    if (sumRow.v < 100) continue;
    // صفوف المواد المتصلة فوق سطر المجموع فقط — لا رقم الفصل في رأس الصفحة وإن وقع في العمود نفسه
    const column = nums
      .filter((n) => n !== sumRow && Math.abs(n.cx - sumRow.cx) < 4 && n.y > sumRow.y)
      .sort((a, b) => a.y - b.y);
    const rows = [];
    for (const n of column) {
      if (n.y - (rows.at(-1)?.y ?? sumRow.y) > 40) break;
      rows.push(n);
    }
    if (rows.length < 3) continue;
    if (Math.abs(rows.reduce((s, n) => s + n.v, 0) - sumRow.v) > 0.01) continue;

    // عمود «مجموع» يقع يمين عمود النهاية العظمى مباشرة
    let total = 0, max = 0, subjects = 0;
    for (const row of rows) {
      const grade = nums.find((n) => Math.abs(n.y - row.y) < 3 && n.cx > row.cx + 15 && n.cx < row.cx + 45);
      if (!grade || grade.v > row.v) continue;
      total += grade.v; max += row.v; subjects++;
    }
    return subjects ? { total, max, subjects } : null;
  }
  return null;
}

/** الأرقام العشرية (0-100) في الصفحة — مرشّحة لمعدل الاختبارات النهائية */
const decimalCandidates = (text) =>
  [...text.matchAll(/\b\d{1,3}\.\d{1,2}\b/g)]
    .map((m) => Number(m[0]))
    .filter((n) => n >= 0 && n <= 100);

/**
 * يقسّم ملف النتائج إلى طلاب. يعيد مصفوفة، لكل طالب:
 *  - nationalId: رقم الهوية (أو null إن لم يوجد)
 *  - pages: أرقام صفحاته في الملف الأصلي (تبدأ من 0)
 *  - periodTotal: { total, max } مجموعه في إشعار الفترة، أو null
 *  - averageCandidates: الأرقام العشرية المرشّحة للمعدل (للنهائي)
 */
export async function analyzeResultsPdf(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const groups = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { items } = await page.getTextContent();
    const text = items.map((it) => it.str).join(" ");
    const nid = findNationalId(text);
    const last = groups[groups.length - 1];
    let g = last;
    if (!last || (nid && nid !== last.nationalId)) {
      g = { nationalId: nid, pages: [], periodTotal: null, averageCandidates: [] };
      groups.push(g);
    }
    g.pages.push(i - 1);
    g.periodTotal = g.periodTotal ?? findPeriodTotal(items);
    g.averageCandidates = [...new Set([...g.averageCandidates, ...decimalCandidates(text)])];
  }
  return groups;
}

/** يستخرج صفحات طالب واحد في ملف PDF مستقل */
export async function extractPages(srcDoc, pages) {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const copied = await out.copyPages(srcDoc, pages);
  copied.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return new Blob([bytes], { type: "application/pdf" });
}

export async function loadPdfDoc(buf) {
  const { PDFDocument } = await import("pdf-lib");
  return PDFDocument.load(buf, { ignoreEncryption: true });
}

/** النسبة المئوية من المجموع، بمنزلتين عشريتين */
export const percentOf = ({ total, max }) => Math.round((total / max) * 10000) / 100;
