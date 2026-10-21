// src/pages/SectionHub.jsx
/* =====================================================================
   صفحة القسم العام (/s/:key) — بطاقات أقسامه الفرعية: أيقونة واسم وسطر يشرح
   عملها، وعلى البطاقة عدد ما ينتظر إجراءك. تعرض ما تعرضه القائمة للمستخدم
   بالضبط (lib/navContext.js)، فلا تُظهر صفحة لا يملك صلاحيتها.
   ===================================================================== */
import { Link, useParams } from "react-router-dom";
import { useNav } from "../lib/navContext.js";
import { Icon } from "../components/Layout.jsx";

const TONE = {
  students: "bg-mint-tint text-mint-deep",
  academic: "bg-excused/10 text-excused",
  forms:    "bg-late/10 text-late",
  comms:    "bg-present/10 text-present",
  settings: "bg-canvas text-muted",
};

// سطر يشرح عمل كل صفحة
const DESC = {
  "/students": "قوائم الطلاب بالصف والفصل وبياناتهم",
  "/student-file": "كل ما يتعلق بالطالب بمؤشرات تكشف ما يحتاج متابعة",
  "/student-admission": "قبول طالب جديد وإدخال بياناته",
  "/student-certificate": "إصدار تعريف بانتظام الطالب",
  "/permissions": "طلبات خروج الطلاب أثناء الدوام",
  "/dropouts": "بلاغات الانقطاع وطي القيد والعودة",
  "/student-notes": "الملاحظات الصحية والسلوكية والنفسية",
  "/results-admin": "نتائج الطلاب ورفعها لأولياء الأمور",
  "/exams-admin": "جداول الاختبارات ونشرها",
  "/referrals": "إحالات المعلمين ومتابعتها مع الموجه",
  "/behavior": "التعهدات والإشعارات والدعوات والمحاضر",
  "/student-affairs": "الحضور والتأخر والإنذارات والتقرير الشهري",
  "/guidance": "الطلاب الأكثر احتياجًا وحالات التوجيه",
  "/general-schedule": "الجدول الشامل بالفصول والمعلمين",
  "/teacher-schedules": "جدول كل معلم",
  "/student-schedules": "جدول كل فصل",
  "/schedule-import": "استيراد الجدول من ملف",
  "/substitute-report": "توزيع حصص الانتظار ومتابعتها",
  "/noor-grades": "متابعة رصد المعلمين للدرجات في نور",
  "/quiz-cycles": "الاختبارات القصيرة ودوراتها غير المكتملة",
  "/duty": "جداول المناوبة والإشراف اليومي",
  "/ethics-report": "إقرارات المعلمين بالميثاق",
  "/plc-departments": "الأقسام ورؤساؤها وأعضاؤها",
  "/activities": "الأنشطة والألعاب الصفية وحصص الانتظار",
  "/qudrat/admin": "متابعة تدريب الطلاب على القدرات",
  "/lab": "الحجوزات والأجهزة والأعطال",
  "/forms": "الشهادات والخطابات والنماذج الرسمية",
  "/forms-review": "ما ينتظر اعتمادك من النماذج",
  "/my-documents": "ما صدر باسمك من نماذج",
  "/plc": "مجتمعات التعلم المهني والزيارات",
  "/forms-admin": "قوالب النماذج وإعداداتها",
  "/performance": "تقييم المعلمين وشواهدهم",
  "/improve": "حلقات التحسين والتوصيات وأثرها",
  "/dfiles-admin": "إدارة ملفات المعلمين الرقمية",
  "/dfile-opinions": "رأي الإدارة في ملفات المعلمين",
  "/notifications": "رسائل المعلمين وأولياء الأمور والطلاب",
  "/notifications-review": "الإشعارات التي تنتظر الاعتماد",
  "/announcements": "رسالة تظهر للمستخدمين عند الدخول",
  "/news-admin": "أخبار المدرسة ومقالاتها",
  "/guides-admin": "الأدلة والملفات الإرشادية",
  "/events": "الأحداث والمناسبات والمشاركون فيها",
  "/events-reports": "تقارير الأحداث وإحصاءاتها",
  "/scouts": "أعضاء الفريق الكشفي وبرامجه",
  "/studio": "تصاميم بهوية البوابة",
  "/accounts": "حسابات المستخدمين",
  "/staff": "أعضاء الإدارة وأدوارهم",
  "/teacher-permissions": "ما يظهر لكل معلم من صفحات",
  "/calendar-admin": "التقويم الدراسي والإجازات",
  "/season": "أوقات الحصص الصيفية والشتوية",
  "/import": "استيراد بيانات نور",
  "/records-manual": "تعديل السجلات يدويًا",
  "/password-reset": "إعادة تعيين كلمات المرور",
  "/feedback-admin": "طلبات الدعم والمساندة",
  "/support-report": "تقرير طلبات الدعم ومتابعتها",
  "/login-log": "سجل دخول المستخدمين وخروجهم",
  "/site-metrics": "زيارات الموقع وأداؤه",
  "/usage-report": "استخدام البوابة حسب الصفحات والمستخدمين",
  "/audit-log": "كل العمليات على البيانات",
  "/quizzes": "الاطلاع على اختبارات المعلمين",
  "/quiz-marks": "الاطلاع على التصحيح والدرجات",
  "/quiz-analytics": "تحليل نتائج الاختبارات",
  "/maintenance": "إيقاف البوابة مؤقتًا للصيانة",
};

export default function SectionHub() {
  const { key } = useParams();
  const nav = useNav();
  if (!nav) return null;
  const s = nav.sections.find((x) => x.key === key);
  if (!s) return <p className="card px-4 py-6 text-center text-sm text-muted">لا صفحات متاحة لك في هذا القسم.</p>;
  const tone = TONE[s.key] ?? TONE.settings;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-card ${tone}`}><Icon name={s.icon} className="h-6 w-6" /></span>
        <div>
          <h1 className="text-lg font-bold text-ink">{s.title}</h1>
          <p className="text-sm text-muted">{s.hint}</p>
        </div>
      </div>
      {s.groups.map((g) => (
        <section key={g.title} className="space-y-2">
          {s.groups.length > 1 && <h2 className="text-sm font-bold text-muted">{g.title}</h2>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((i) => {
              const n = nav.badgeOf(i.to);
              return (
                <Link key={i.to} to={i.to}
                  className="card relative flex h-full flex-col gap-2 p-3.5 transition-shadow hover:shadow-md hover:ring-1 hover:ring-mint-light">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`grid h-10 w-10 place-items-center rounded-sm2 ${tone}`}><Icon name={i.icon} className="h-5 w-5" /></span>
                    {n > 0 && <span className="num rounded-pill bg-absent px-2 py-0.5 text-[11px] font-bold text-white">{n}</span>}
                  </div>
                  <p className="text-sm font-semibold leading-snug text-ink">{i.label}</p>
                  {DESC[i.to] && <p className="text-[11.5px] leading-snug text-muted">{DESC[i.to]}</p>}
                  {n > 0 && <p className="mt-auto text-[11px] font-semibold text-absent">بانتظار إجرائك</p>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
