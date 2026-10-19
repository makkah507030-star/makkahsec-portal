// src/pages/OfflineQuizMissing.jsx
// /offline-quiz حين لا تكون صفحة الاختبار دون إنترنت محفوظة على هذا الجهاز (يعرضها sw.js إن وُجدت).
import { Link } from "react-router-dom";

export default function OfflineQuizMissing() {
  return (
    <div className="card mx-auto max-w-lg space-y-3 p-5 text-sm leading-relaxed" dir="rtl">
      <p className="text-base font-bold text-ink">لا يوجد اختبار منزّل على هذا الجهاز</p>
      <p className="text-muted">
        افتح الاختبار من إشعاره أو من «الاختبارات الإلكترونية» في الصفحة الرئيسية، واضغط «تنزيل الاختبار على جوالي» وأنت متصل
        بالإنترنت. إن كنت نزّلته فافتح البوابة من المتصفح أو التطبيق نفسه الذي نزّلته منه.
      </p>
      <Link to="/" className="btn-primary inline-flex">الرئيسية</Link>
    </div>
  );
}
