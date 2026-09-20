// يعرض تاريخًا (رقم + حرف لاحق مثل "هـ" أو "م") بجانب نص عربي في نفس
// السطر دون خلل ترتيب الأحرف الشهير في المتصفحات (Bidi).
//
// لماذا الترتيب "suffix ثم value" هنا رغم أن المعروض هو "value ثم suffix"؟
// لأن الصندوق LTR يضع أول عنصر في DOM على اليسار وآخر عنصر على اليمين،
// وجهة اليمين هي التي تلامس النص العربي السابق. تم اختبار هذا فعليًا
// بمتصفح Chromium (وليس نظريًا) وهو الترتيب الوحيد الذي أعطى نتيجة صحيحة
// من بين أكثر من 15 طريقة مختلفة تم تجربتها.
//
// الاستخدام:
//   <BidiDate value={fmtHijri(date, false)} suffix="هـ" />
//   <BidiDate value={fmtGreg(date)} suffix="م" />
export default function BidiDate({ value, suffix }) {
  return (
    <span className="inline-flex" style={{ direction: "ltr" }}>
      <span>{suffix}</span>
      <span className="num">{value}</span>
    </span>
  );
}
