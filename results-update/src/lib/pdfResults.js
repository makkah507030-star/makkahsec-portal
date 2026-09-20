import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * يستخرج من ملف نتيجة PDF (مُصدَّر من نظام نور):
 *  - رقم الهوية: أول رقم مكوّن من 10 خانات في الملف (فريد دائمًا لكل طالب)
 *  - المعدل المرشّح: كل الأرقام العشرية (0-100) الظاهرة في الملف، لاختيار
 *    الإدارة منها يدويًا عند المراجعة (لا نخمّن أيها الصحيح تلقائيًا، لأن
 *    ترتيب ظهورها في الملف قد يختلف بين تقرير وآخر)
 *
 * ملاحظة مهمة: نصوص الحقول العربية داخل هذه الملفات مُرمَّزة بخط خاص من
 * نور ولا يمكن قراءتها كنص عادي — لهذا نعتمد فقط على الأرقام (تُستخرج
 * بشكل سليم دائمًا لأنها ليست جزءًا من ترميز الخط الخاص).
 */
export async function extractResultCandidates(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += " " + content.items.map((it) => it.str).join(" ");
  }

  const nationalId = fullText.match(/\b\d{10}\b/)?.[0] ?? null;

  const decimals = [...fullText.matchAll(/\b\d{1,3}\.\d{1,2}\b/g)]
    .map((m) => Number(m[0]))
    .filter((n) => n >= 0 && n <= 100);

  return { nationalId, averageCandidates: [...new Set(decimals)], pageCount: pdf.numPages };
}
