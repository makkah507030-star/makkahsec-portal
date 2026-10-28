// src/pages/gifted/GiftedHub.jsx
import MawhibaTracker from "./MawhibaTracker.jsx";

/* =====================================================================
   برنامج الموهوبين — صفحة البرنامج (صلاحية «برنامج الموهوبين»، supabase/gifted_1.sql):
   متابعة البرنامج الوطني للكشف عن الموهوبين لطلاب الأول الثانوي.
   ===================================================================== */
export default function GiftedHub() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">برنامج الموهوبين</h1>
        <p className="mt-1 text-sm text-muted">متابعة طلاب الأول الثانوي في مقياس موهبة من التسجيل إلى النتيجة، وتذكيرهم وأولياء أمورهم بالواتساب.</p>
      </div>
      <MawhibaTracker />
    </div>
  );
}
