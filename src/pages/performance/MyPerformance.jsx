import { useSession } from "../../lib/session.jsx";
import PerformanceFile from "../../components/PerformanceFile.jsx";

/* ملف الأداء الوظيفي — المعلم يتابع شواهده ويرفعها. يطّلع عليه مدير المدرسة، والدعم الفني للمتابعة الفنية. */
export default function MyPerformance() {
  const { session, profile } = useSession();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">ملف الأداء الوظيفي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          شواهدك لعناصر نموذج تقييم أداء المعلم. لكل بند شاهد واحد وعداد، ودورات التطوير المهني تُرفق كلها.
          لا يرى الملف غيرك إلا مدير المدرسة، والدعم الفني لمعالجة الأعطال.
        </p>
      </div>
      <PerformanceFile uid={session.user.id} name={profile?.full_name} />
    </div>
  );
}
