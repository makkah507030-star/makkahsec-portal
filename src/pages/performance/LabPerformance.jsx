import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import PerformanceFile from "../../components/PerformanceFile.jsx";
import Loader from "../../components/Loader.jsx";
import PageIntro from "../../components/PageIntro.jsx";

/* شواهد الأداء الوظيفي لمحضر معمل الحاسب الآلي — بنظام ملف أداء المعلم نفسه (supabase/lab_perf_*.sql):
   المحضر يتابع شواهده ويرفعها، ومدير المدرسة والدعم الفني يطّلعون على ملفه. */
export default function LabPerformance() {
  const { session, profile, adminRoles } = useSession();
  const mine = adminRoles.includes("computer_lab");
  const [prep, setPrep] = useState(mine ? { id: session.user.id, name: profile?.full_name } : undefined);
  useEffect(() => {
    if (mine) { setPrep({ id: session.user.id, name: profile?.full_name }); return; }
    supabase.from("admin_roles").select("user_id, users(full_name)").eq("role_type", "computer_lab").limit(1).maybeSingle()
      .then(({ data }) => setPrep(data ? { id: data.user_id, name: data.users?.full_name } : null));
  }, [mine, session, profile]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">شواهد الأداء الوظيفي · محضر معمل الحاسب الآلي</h1>
        <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
          شواهدك لعناصر نموذج تقييم أداء محضر المختبر في دليل الأداء الوظيفي، مطبّقة على معمل الحاسب. كثير منها يصل
          تلقائيًا من عملك في المعمل، والباقي يُرفع. لا يرى الملف غيرك إلا مدير المدرسة، والدعم الفني لمعالجة الأعطال.
        </PageIntro>
      </div>
      <div role="note" className="flex gap-3 rounded-card border-2 border-danger/50 bg-danger-light px-4 py-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger text-sm font-bold text-white">!</span>
        <p className="text-sm leading-relaxed text-danger">
          <b>تنبيه مهم:</b> تخضع الشواهد لتقييم مدير المدرسة وتدقيقه. واكتمالها لا يعني الحصول على
          الدرجة الكاملة في التقييم، وإنما هو خطوة متقدمة نحو تقدير عالٍ.
        </p>
      </div>
      {prep === undefined ? <Loader /> : !prep ? <p className="card px-4 py-6 text-sm text-muted">لم يُسند دور محضر معمل الحاسب الآلي لأحد بعد.</p>
        : <PerformanceFile uid={prep.id} name={prep.name} track="lab" readOnly={!mine} />}
    </div>
  );
}
