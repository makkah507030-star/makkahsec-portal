import { useSession } from "../../lib/session.jsx";
import PerformanceFile from "../../components/PerformanceFile.jsx";
import { TeacherReviews } from "../../components/PerformanceReview.jsx";
import PageIntro from "../../components/PageIntro.jsx";

/* ملف الأداء الوظيفي — المعلم يتابع شواهده ويرفعها. يطّلع عليه مدير المدرسة، والدعم الفني للمتابعة الفنية.
   ورائد النشاط (معلم) بنموذج «معلم مسند له نشاط طالبي»: عناصر المعلم نفسها بشواهدها وأوزانه، والعناصر الأربعة للنشاط. */
export default function MyPerformance() {
  const { session, profile, adminRoles } = useSession();
  const activity = adminRoles.includes("activity_leader");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">شواهد الأداء الوظيفي</h1>
        <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
          {activity ? "شواهدك لعناصر نموذج تقييم أداء «معلم مسند له نشاط طالبي» (رائد النشاط): عناصر المعلم والعناصر الخاصة بالنشاط الطلابي."
            : "شواهدك لعناصر نموذج تقييم أداء المعلم."} لكل بند شاهد واحد وعداد، ودورات التطوير المهني تُرفق كلها.
          لا يرى الملف غيرك إلا مدير المدرسة، والدعم الفني لمعالجة الأعطال.
        </PageIntro>
      </div>
      <div role="note" className="flex gap-3 rounded-card border-2 border-danger/50 bg-danger-light px-4 py-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger text-sm font-bold text-white">!</span>
        <p className="text-sm leading-relaxed text-danger">
          <b>تنبيه مهم:</b> تخضع الشواهد لتقييم مدير المدرسة وتدقيقه. واكتمالها لا يعني الحصول على
          الدرجة الكاملة في التقييم، وإنما هو خطوة متقدمة نحو تقدير عالٍ.
        </p>
      </div>
      <TeacherReviews uid={session.user.id} name={profile?.full_name} />
      <PerformanceFile uid={session.user.id} name={profile?.full_name} track={activity ? "activity" : "teacher"} />
    </div>
  );
}
