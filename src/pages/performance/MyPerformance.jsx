import { useSession } from "../../lib/session.jsx";
import PerformanceFile from "../../components/PerformanceFile.jsx";

/* ملف الأداء الوظيفي — المعلم يتابع شواهده ويرفعها. لا يراه غيره إلا مدير المدرسة. */
export default function MyPerformance() {
  const { session, profile } = useSession();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">ملف الأداء الوظيفي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          شواهدك لعناصر نموذج تقييم أداء المعلم. لكل بند شاهد واحد وعداد، ودورات التطوير المهني تُرفق كلها.
          لا يرى الملف غيرك إلا مدير المدرسة.
        </p>
      </div>
      <PerformanceFile uid={session.user.id} name={profile?.full_name} />
    </div>
  );
}
