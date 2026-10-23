// src/pages/teacher/QuestionBank.jsx
/* بنك الأسئلة — للمعلمين ووكيل الشؤون التعليمية والمدير والدعم الفني (supabase/qbank_1..2.sql).
   أسئلة الاختبارات تدخل بنك صاحبها تلقائيًا، ويشاركها مع معلمي المدرسة متى شاء. */
import { useSession } from "../../lib/session.jsx";
import QBankBrowser from "../../components/QBankBrowser.jsx";

export default function QuestionBank() {
  const { session } = useSession();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">بنك الأسئلة</h1>
        <p className="text-sm leading-relaxed text-muted">
          كل سؤال تكتبه في اختباراتك يُحفظ في «أسئلتي» تلقائيًا. حدّد درسه وصعوبته، وشاركه ليظهر لمعلمي المدرسة
          باسمك في «بنك المدرسة». وفي إعداد أي اختبار اضغط «إضافة من البنك».
        </p>
      </div>
      <QBankBrowser mode="page" uid={session?.user?.id} />
    </div>
  );
}
