import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { activeYear, loadAutoCounts, loadPerfReference } from "../../lib/performance";
import { useSession } from "../../lib/session.jsx";
import PerformanceFile from "../../components/PerformanceFile.jsx";
import { ReviewEditor } from "../../components/PerformanceReview.jsx";
import Loader from "../../components/Loader.jsx";
import { byName } from "../../lib/sortAr.js";
import { useBackStep } from "../../lib/backStep.js";

/* =====================================================================
   تقييم الأداء الوظيفي — لمدير المدرسة، وللدعم الفني للمتابعة الفنية:
   • قائمة المعلمين مع عدد البنود التي شواهدها متوفرة، وملف كل معلم للاطلاع.
   • تقييم المعلم بمرحلتيه (للمدير وحده).
   (دورات الاختبار غير المكتملة انتقلت إلى «متابعة دورات الاختبار»: admin/QuizCycles.jsx)
   ===================================================================== */

export default function PerformanceAdmin() {
  const { adminRoles } = useSession();
  const principal = adminRoles.includes("principal");
  const [fileTab, setFileTab] = useState("file");
  const [teachers, setTeachers] = useState(null);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [year, els, { data: ts }] = await Promise.all([
          activeYear(), loadPerfReference(),
          supabase.from("teachers").select("user_id, full_name, specialization")
            .eq("is_active", true).not("user_id", "is", null).order("full_name"),
        ]);
        setTotal(els.filter((e) => !e.evaluator_only).reduce((a, e) => a + e.items.length, 0));
        const { data: ev, error } = await supabase.from("perf_evidence")
          .select("teacher_user_id, item_key").eq("academic_year", year);
        if (error) throw error;
        // عدد البنود المتوفرة لكل معلم (بند السجل يُعدّ مرة واحدة مهما تعددت مشاركاته)
        const m = {};
        for (const r of ev ?? []) (m[r.teacher_user_id] ??= new Set()).add(r.item_key);
        // والشواهد الآلية من عمل المعلم في البوابة
        const auto = await loadAutoCounts(null, year);
        for (const [uid, items] of Object.entries(auto))
          for (const [k, v] of Object.entries(items)) if (v.cnt > 0) (m[uid] ??= new Set()).add(k);
        setCounts(Object.fromEntries(Object.entries(m).map(([k, s]) => [k, s.size])));
        setTeachers((ts ?? []).sort(byName()));
      } catch (e) {
        setErr(e.message?.includes("perf_") ? "ملف الأداء غير مفعّل بعد في قاعدة البيانات." : (e.message ?? "تعذّر التحميل."));
        setTeachers([]);
      }
    })();
  }, []);

  const shown = useMemo(() => (teachers ?? []).filter((t) => !q.trim() || t.full_name.includes(q.trim())), [teachers, q]);

  useBackStep(!!picked, () => { setPicked(null); setFileTab("file"); }, "قائمة المعلمين");

  if (teachers === null) return <Loader />;

  const pill = (on) => `w-44 rounded-sm2 py-2 text-sm font-semibold ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`;

  if (picked) {
    return (
      <div className="space-y-5">
        <button className="btn-ghost" onClick={() => { setPicked(null); setFileTab("file"); }}>رجوع لقائمة المعلمين</button>
        {principal && (
          <div className="flex flex-wrap gap-2">
            <button className={pill(fileTab === "file")} onClick={() => setFileTab("file")}>ملف الشواهد</button>
            <button className={pill(fileTab === "review")} onClick={() => setFileTab("review")}>التقييم</button>
          </div>
        )}
        {principal && fileTab === "review"
          ? <ReviewEditor teacher={picked} />
          : <PerformanceFile uid={picked.user_id} name={picked.full_name} readOnly />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">تقييم الأداء الوظيفي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          شواهد كل معلم لعناصر التقييم وتقييمه بمرحلتيه. الملف للاطلاع، والتقييم لمدير المدرسة وحده. لا يرى الملف إلا المعلم صاحبه ومدير المدرسة والدعم الفني.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      <input className="field max-w-sm" placeholder="ابحث باسم المعلم…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card divide-y divide-line/60">
        {shown.map((t) => {
          const ok = counts[t.user_id] ?? 0;
          return (
            <button key={t.user_id} onClick={() => setPicked(t)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-canvas">
              <span className="min-w-0">
                <span className="block font-medium text-ink">{t.full_name}</span>
                {t.specialization && <span className="block text-xs text-muted">{t.specialization}</span>}
              </span>
              <span className="flex shrink-0 gap-2">
                <span className="chip w-24 justify-center bg-mint-light text-mint-deep">متوفر <span className="num mr-1">{ok}</span></span>
                <span className="chip w-28 justify-center bg-warning-light text-warning">غير متوفر <span className="num mr-1">{total - ok}</span></span>
              </span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="px-4 py-3 text-sm text-faint">لا نتائج.</p>}
      </div>
    </div>
  );
}
