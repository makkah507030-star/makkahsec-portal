// src/pages/StudentRequests.jsx
import { Requests } from "./GuidanceMore.jsx";

/* =====================================================================
   طلبات التواصل مع وكيل شؤون الطلاب (supabase/deputy_requests.sql):
   يطلبها الطالب أو ولي أمره من حسابه، حضورية بموعد أو عن بعد، كطلب مقابلة الموجه.
   للوكيل والمدير والدعم الفني، ولا يراها الموجهون.
   ===================================================================== */
export default function StudentRequests() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">طلبات التواصل مع الوكيل</h1>
        <p className="mt-1 text-sm text-muted">طلبات الطلاب وأولياء الأمور لمقابلة وكيل شؤون الطلاب أو سؤاله عن بعد.</p>
      </div>
      <Requests target="deputy" />
    </div>
  );
}
