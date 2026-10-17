/* تحميل pdfjs (عند الحاجة فقط) من نسخته «legacy»: النسخة الحديثة من pdfjs-dist 6 تستخدم
   Map.getOrInsertComputed الجديدة جدًا، فتفشل في متصفحات كثيرة (منها كروم غير المحدّث وسفاري
   الأقدم) بخطأ «getOrInsertComputed is not a function». legacy تحمل ما ينقص المتصفح. */
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: worker } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}
