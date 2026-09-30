// src/lib/signers.js
import { supabase } from "./supabase";

/* =====================================================================
   أسماء الموقّعين في التقارير المطبوعة — تُحفظ في جدول settings
   (signer_principal …) وتُعدَّل من «الإدارة ← أسماء الموقّعين» بلا نشر
   جديد للموقع. الأسماء أدناه احتياطية فقط: تظهر إن لم يُحفظ اسم بعد.
   تُصدَّر بـ let: من يستوردها يرى القيمة المحدَّثة بعد loadSigners().
   ===================================================================== */

// اسم مدير المدرسة — يظهر في ترويسة وتذييل التقارير المطبوعة
export let PRINCIPAL_NAME = "عبدالله بن حسن سلمان الفيفي";

// وكيل شؤون الطلاب — يظهر في تقارير الطلاب وأولياء الأمور
export let STUDENT_DEPUTY_NAME = "فهد بن نايف ماطر المعبدي";

// وكيل الشؤون التعليمية
export let ACADEMIC_DEPUTY_NAME = "فهد بن سعود حضرواي";

// مسؤول الدعم الفني للبوابة — يظهر في تقارير مركز الدعم والمساندة
export let TECH_SUPPORT_NAME = "محمد بن حسن الحازمي";

export const SIGNERS = [
  { key: "signer_principal",        label: "مدير المدرسة" },
  { key: "signer_student_deputy",   label: "وكيل شؤون الطلاب" },
  { key: "signer_academic_deputy",  label: "وكيل الشؤون التعليمية" },
  { key: "signer_tech_support",     label: "مسؤول الدعم الفني" },
];

/** الأسماء الحالية { signer_principal: "…", … } */
export function currentSigners() {
  return {
    signer_principal: PRINCIPAL_NAME,
    signer_student_deputy: STUDENT_DEPUTY_NAME,
    signer_academic_deputy: ACADEMIC_DEPUTY_NAME,
    signer_tech_support: TECH_SUPPORT_NAME,
  };
}

/** يطبّق الأسماء المحفوظة؛ الفارغ يُبقي الاسم السابق */
export function applySigners(m) {
  const v = (k) => (m?.[k] ?? "").trim();
  if (v("signer_principal"))       PRINCIPAL_NAME       = v("signer_principal");
  if (v("signer_student_deputy"))  STUDENT_DEPUTY_NAME  = v("signer_student_deputy");
  if (v("signer_academic_deputy")) ACADEMIC_DEPUTY_NAME = v("signer_academic_deputy");
  if (v("signer_tech_support"))    TECH_SUPPORT_NAME    = v("signer_tech_support");
}

let loading = null;

/** يجلب الأسماء مرة في الجلسة؛ force لإعادة الجلب بعد الحفظ */
export function loadSigners(force = false) {
  if (loading && !force) return loading;
  loading = (async () => {
    try {
      const { data } = await supabase.from("settings")
        .select("key, value").in("key", SIGNERS.map((s) => s.key));
      applySigners(Object.fromEntries((data ?? []).map((r) => [r.key, r.value])));
    } catch { /* تبقى الأسماء الاحتياطية */ }
    return currentSigners();
  })();
  return loading;
}
