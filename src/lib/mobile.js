// src/lib/mobile.js
// توحيد الجوال السعودي من أي صيغة يكتبها المستخدم: 05… أو 5… أو 966… أو 00966… أو +966، بمسافات أو شرطات
// أو بالأرقام العربية (٠٥٥…)، إلى 05xxxxxxxx. وما لا يطابق جوالًا سعوديًا يعود أرقامًا كما هو ليُرفض.
export function normMobile(v) {
  const d = String(v ?? "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c)).replace(/\D/g, "");
  if (/^009665\d{8}$/.test(d)) return `0${d.slice(5)}`;
  if (/^9665\d{8}$/.test(d)) return `0${d.slice(3)}`;
  if (/^5\d{8}$/.test(d)) return `0${d}`;
  return d;
}
export const isMobile = (v) => /^05\d{8}$/.test(normMobile(v));
