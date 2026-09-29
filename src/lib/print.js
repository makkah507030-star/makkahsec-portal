/* =====================================================================
   أدوات الطباعة المشتركة — مراعاة سلوك الجوال.

   على الحاسب تتوقف window.print() حتى تُغلق نافذة الطباعة، أما على الجوال
   (Safari وChrome) فتعود فورًا وتُلتقط الصفحة لاحقًا. لذا:
   • لا تُزال منطقة الطباعة بعد window.print() مباشرة — وإلا طُبعت الصفحة
     كاملة بدل التقرير أو الشهادة. تُزال عند أول لمسة بعد العودة للصفحة.
   • الإطار المخفي (iframe) لا يُطبع وحده على الجوال؛ يُطبع ما حوله كاملًا.
   ===================================================================== */

/** هل الجهاز جوال/لوحي؟ (يشمل iPad الذي يعرّف نفسه كجهاز Mac) */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** يطبع الصفحة، ثم ينفّذ التنظيف عند أول تفاعل للمستخدم بعد الطباعة */
export function printThen(cleanup) {
  window.print();
  if (!cleanup) return;
  const done = () => {
    window.removeEventListener("pointerdown", done, true);
    window.removeEventListener("keydown", done, true);
    cleanup();
  };
  setTimeout(() => {
    window.addEventListener("pointerdown", done, true);
    window.addEventListener("keydown", done, true);
  }, 0);
}
