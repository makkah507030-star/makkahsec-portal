import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../../lib/session.jsx";
import { PERF_TRACKS, perfTrackOf } from "../../lib/performance";
import PerformanceFile from "../../components/PerformanceFile.jsx";
import Loader from "../../components/Loader.jsx";
import { useBackStep } from "../../lib/backStep.js";
import PerformanceAdmin from "./PerformanceAdmin.jsx";
import PageIntro from "../../components/PageIntro.jsx";

/* =====================================================================
   شواهد الأداء الوظيفي للموظفين من غير المعلمين، بنظام ملف أداء المعلم نفسه وتصميمه
   (supabase/lab_perf_*.sql و staff_perf_*.sql): الوكلاء، والموجهون الطلابيون، ومحضرو مختبرات
   العلوم ومعمل الحاسب، ورائد النشاط — كلٌّ بنموذج وظيفته في الدليل الإرشادي لإدارة الأداء الوظيفي.
   • mine: صاحب الوظيفة يتابع شواهده ويرفعها (/my-staff-performance).
   • وإلا: مدير المدرسة والدعم الفني يتابعون من صفحة واحدة (/staff-performance): المعلمين بشواهدهم
     وتقييمهم (PerformanceAdmin)، ثم ملف كل موظف بوظيفته.
   ===================================================================== */

const WARN = (by = "مدير المدرسة") => (
  <div role="note" className="flex gap-3 rounded-card border-2 border-danger/50 bg-danger-light px-4 py-3">
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger text-sm font-bold text-white">!</span>
    <p className="text-sm leading-relaxed text-danger">
      <b>تنبيه مهم:</b> تخضع الشواهد لتقييم {by} وتدقيقه. واكتمالها لا يعني الحصول على
      الدرجة الكاملة في التقييم، وإنما هو خطوة متقدمة نحو تقدير عالٍ.
    </p>
  </div>
);
const ORDER = ["deputy", "counselor", "activity", "science", "lab", "principal"];
const TEACHER = { label: "المعلمون", form: "المعلم (1)" };
const labelOf = (k) => (k === "teacher" ? TEACHER : PERF_TRACKS[k]);

export default function StaffPerformance({ mine = false }) {
  const { session, profile, adminRoles } = useSession();
  const own = perfTrackOf(adminRoles);
  if (mine) {
    if (!own) return <p className="card px-4 py-6 text-sm text-muted">لا ملف أداء لوظيفتك في البوابة بعد.</p>;
    const t = PERF_TRACKS[own];
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-ink">شواهد الأداء الوظيفي · {t.label}</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            شواهدك لعناصر نموذج «{t.form.replace(/ \(\d+\)$/, "")}» في الدليل الإرشادي لإدارة الأداء الوظيفي. بعضها يصل
            تلقائيًا من عملك في البوابة، والباقي يُرفع. {own === "principal" ? "لا يرى الملف غيرك إلا الدعم الفني لمعالجة الأعطال."
              : "لا يرى الملف غيرك إلا مدير المدرسة، والدعم الفني لمعالجة الأعطال."}
          </p>
        </div>
        {WARN(own === "principal" ? "الرئيس المباشر" : undefined)}
        <PerformanceFile uid={session.user.id} name={profile?.full_name} track={own} />
      </div>
    );
  }
  return <StaffList />;
}

/* قائمة المعلمين والموظفين بوظائفهم لمدير المدرسة والدعم الفني */
function StaffList() {
  const [rows, setRows] = useState(null);
  const [track, setTrack] = useState(() => { try { return sessionStorage.getItem("staffPerfTrack") || "teacher"; } catch { return "teacher"; } });
  const [picked, setPicked] = useState(null);
  const [teacherOpen, setTeacherOpen] = useState(false);   // ملف معلم مفتوح داخل تبويب المعلمين
  const pick = (k) => { setTrack(k); try { sessionStorage.setItem("staffPerfTrack", k); } catch { /* تجاهل */ } };
  useBackStep(!!picked, () => setPicked(null), "قائمة الموظفين");

  useEffect(() => {
    const roles = ORDER.flatMap((k) => PERF_TRACKS[k].roles);
    supabase.from("admin_roles").select("user_id, role_type, users(full_name, is_active)").in("role_type", roles)
      .then(({ data }) => setRows((data ?? []).filter((r) => r.users?.is_active !== false)));
  }, []);

  const list = useMemo(() => {
    const seen = new Set();
    if (track === "teacher") return [];
    return (rows ?? []).filter((r) => PERF_TRACKS[track].roles.includes(r.role_type))
      .filter((r) => !seen.has(r.user_id) && seen.add(r.user_id))
      .sort((a, b) => PERF_TRACKS[track].roles.indexOf(a.role_type) - PERF_TRACKS[track].roles.indexOf(b.role_type));
  }, [rows, track]);

  if (picked) {
    return (
      <div className="space-y-5">
        <button className="btn-ghost" onClick={() => setPicked(null)}>رجوع لقائمة الموظفين</button>
        <h1 className="text-lg font-bold text-ink">شواهد الأداء الوظيفي · {picked.users?.full_name}</h1>
        <PerformanceFile uid={picked.user_id} name={picked.users?.full_name} track={track} readOnly />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {!teacherOpen && (
        <>
          <div>
            <h1 className="text-lg font-bold text-ink">شواهد أداء الموظفين</h1>
            <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
              متابعة الأداء الوظيفي من صفحة واحدة: المعلمون بشواهدهم وتقييمهم، والوكلاء والموجهون الطلابيون ورائد النشاط
              ومحضرو المختبرات، كلٌّ بنموذج وظيفته في الدليل الإرشادي لإدارة الأداء الوظيفي.
            </PageIntro>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["teacher", ...ORDER].map((k) => (
              <button key={k} onClick={() => pick(k)}
                      className={`rounded-pill px-3.5 py-1.5 text-[13px] font-semibold ${track === k ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`}>
                {labelOf(k).label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">النموذج: {labelOf(track).form} · الإصدار الثاني</p>
        </>
      )}
      {track === "teacher" ? <PerformanceAdmin embedded onOpen={setTeacherOpen} /> : rows === null ? <Loader /> : list.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted">لم تُسند هذه الوظيفة لأحد بعد.</p>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((r) => (
            <button key={r.user_id} onClick={() => setPicked(r)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-canvas">
              <span className="text-sm font-semibold text-ink">{r.users?.full_name ?? "—"}</span>
              <span className="text-xs text-muted">{ADMIN_ROLE_LABEL[r.role_type] ?? r.role_type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
