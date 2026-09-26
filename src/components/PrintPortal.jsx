// src/components/PrintPortal.jsx
import { createPortal } from "react-dom";

/* =====================================================================
   منطقة طباعة موحّدة لكل تقارير البوابة.

   سبب وجودها: الطريقة القديمة (إخفاء الواجهة بـ visibility + ‏@page مسمّاة)
   كانت تُخرج التقرير أحيانًا على ورقة أفقية منزاحًا لليمين، ومنقسمًا على
   صفحتين — لأن المتصفح يتجاهل مقاس الصفحة المسمّاة ويأخذ آخر اتجاه اختاره
   المستخدم، ولأن الواجهة المخفية بـ visibility تبقى تشغل مساحة فتضيف صفحات.

   الحل:
   • تُركَّب المنطقة مباشرة في <body> (بوابة React)، وعند الطباعة يُخفى كل ما
     عداها بـ display:none — فلا صفحات زائدة ولا إزاحة من هوامش الواجهة.
   • ‏@page بلا اسم يفرض A4 بالاتجاه الصحيح — يلتزم به المتصفح دائمًا.
   • على الشاشة مخفية تمامًا؛ المعاينة تبقى كما هي في الصفحة.
   ===================================================================== */
export default function PrintPortal({ id, landscape = false, margin = "0", extraCss = "", children }) {
  const size = landscape ? "A4 landscape" : "A4 portrait";
  return createPortal(
    <div className="print-portal">
      <style dangerouslySetInnerHTML={{ __html: `
        .print-portal { display: none; }
        @page { size: ${size}; margin: ${margin}; }
        @media print {
          html, body { background: #fff !important; height: auto !important;
                       min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
          body > *:not(.print-portal) { display: none !important; }
          .print-portal { display: block !important; }
          #${id} { background: #fff; }
          #${id} .sheet { box-shadow: none !important; margin: 0 !important; transform: none !important; }
          .no-print { display: none !important; }
          ${extraCss}
        }
      ` }} />
      <div id={id}>{children}</div>
    </div>,
    document.body,
  );
}
