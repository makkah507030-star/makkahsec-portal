// src/pages/admin/QuizCycles.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { activeYear } from "../../lib/performance";
import { fmtDate } from "../../lib/dates";
import { byName } from "../../lib/sortAr.js";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   متابعة دورات الاختبار (الشؤون التعليمية) — للمدير ووكيل الشؤون التعليمية
   والدعم الفني: اختبارات الفترات والتشخيصي التي لم تُغلق دورتها بعد، لكل
   معلم، والمرحلة التي توقفت عندها (perf_open_cycles في quiz_verify_3.sql،
   ومعه وكيل الشؤون التعليمية في quiz_cycles_access.sql).
   كانت تبويبًا في «تقييم الأداء الوظيفي»، ومكانها متابعة الاختبارات.
   • لكل اختبار ملخّص خططه (العلاجية والإثرائية والثانية) وحالة تنفيذها وقياس أثرها،
     والدورات المكتملة في تبويب مستقل.
   • للمدير والدعم الفني: «فتح الدورة» (اختبارات المعلمين للاطلاع: الخطط والتحقق كاملة)
     و«التحليل والتقرير» (تحليل النتائج وتقريره المطبوع) للمعلم نفسه.
   ===================================================================== */

const PERIOD_LABEL = { diagnostic: "تشخيصي", period1: "الفترة الأولى", period2: "الفترة الثانية" };
// مراحل الدورة بترتيبها (كما تعيدها perf_open_cycles)
const STAGES = ["البناء والتطبيق", "التصحيح والرصد", "التحليل", "الخطة", "التنفيذ", "التحقق من الأثر", "الخطة الثانية", "التكريم والإغلاق"];
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

/* ملخّص خطط اختبار: النوع والحالة، وأثر العلاجية بعد قياسه */
function PlanChips({ plans }) {
  if (!plans?.length) return <span className="text-xs text-faint">لا خطط بعد</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {plans.map((p) => {
        const name = p.kind === "enrichment" ? "إثرائية" : (p.round ?? 1) > 1 ? "علاجية ثانية" : "علاجية";
        const im = p.impact ?? null;
        const n = (p.students ?? []).length;
        const effect = p.kind === "remedial" && p.measured_at && im
          ? ` · الأثر: ${Number(im.below) > 0 ? `بقي ${im.below} دون 60%` : "تجاوزوا جميعًا"}`
          : p.kind === "remedial" && p.status === "done" ? " · بانتظار قياس الأثر" : "";
        return (
          <span key={p.id} className={`chip ${p.status === "done" ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
            {name} ({n}) · {p.status === "done" ? "نُفّذت" : "قيد التنفيذ"}{effect}
          </span>
        );
      })}
    </span>
  );
}

export default function QuizCycles() {
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [err, setErr] = useState("");
  const [stage, setStage] = useState("all");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("open");
  const [closed, setClosed] = useState([]);   // دورات أُغلقت هذا العام
  const [plans, setPlans] = useState({});     // الاختبار ← خططه
  const { adminRoles, effectiveRole } = useSession();
  // فتح الدورة والتقرير للاطلاع: للمدير والدعم الفني (QuizTeacherPicker)
  const canView = effectiveRole === "admin" && (adminRoles ?? []).some((r) => r === "tech_support" || r === "principal");

  useEffect(() => {
    (async () => {
      const year = await activeYear();
      const [{ data, error }, { data: ts }, { data: cz }] = await Promise.all([
        supabase.rpc("perf_open_cycles", { p_year: year }),
        supabase.from("teachers").select("user_id, full_name").not("user_id", "is", null),
        supabase.from("quizzes").select("id, title, period, teacher_id, created_at, cycle_closed_at")
          .not("cycle_closed_at", "is", null).eq("academic_year", year).order("cycle_closed_at", { ascending: false }),
      ]);
      if (error) setErr(/perf_open_cycles/.test(error.message) ? "المتابعة غير مفعّلة بعد: يلزم تشغيل ملف supabase/quiz_verify_3.sql." : error.message);
      setNames(Object.fromEntries((ts ?? []).map((t) => [t.user_id, t.full_name])));
      const closedRows = (cz ?? []).map((z) => ({ quiz_id: z.id, title: z.title, period: z.period, teacher_user_id: z.teacher_id,
                                                  created_at: z.created_at, closed_at: z.cycle_closed_at }));
      setClosed(closedRows);
      setRows(data ?? []);
      // خطط الاختبارات المعروضة (المفتوحة والمكتملة)
      const ids = [...(data ?? []).map((r) => r.quiz_id), ...closedRows.map((r) => r.quiz_id)];
      const m = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data: ps } = await supabase.from("quiz_plans")
          .select("id, quiz_id, kind, round, status, students, measured_at, impact").in("quiz_id", ids.slice(i, i + 200));
        (ps ?? []).forEach((p) => (m[p.quiz_id] ??= []).push(p));
      }
      Object.values(m).forEach((l) => l.sort((a, b) => (a.kind === "enrichment") - (b.kind === "enrichment") || (a.round ?? 1) - (b.round ?? 1)));
      setPlans(m);
    })();
  }, []);

  const byStage = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, (rows ?? []).filter((r) => r.stage === s).length])), [rows]);
  const groups = useMemo(() => {
    const t = q.trim();
    const src = tab === "closed" ? closed : rows ?? [];
    const list = src.filter((r) => (tab === "closed" || stage === "all" || r.stage === stage) && (!t || (names[r.teacher_user_id] ?? "").includes(t)));
    const m = {};
    list.forEach((r) => (m[r.teacher_user_id] ??= []).push(r));
    return Object.entries(m).map(([uid, l]) => ({ uid, full_name: names[uid] ?? "معلم", list: l }))
      .sort((a, b) => b.list.length - a.list.length || byName()(a, b));
  }, [rows, closed, tab, names, stage, q]);

  if (rows === null) return <Loader />;
  const teachersN = new Set(rows.map((r) => r.teacher_user_id)).size;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">متابعة دورات الاختبار</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          اختبارات الفترات والتشخيصي ومراحل دورتها: البناء، فالرصد، فالتحليل، فالخطة العلاجية وتنفيذها
          والتحقق من أثرها، ثم التكريم والإغلاق. ولكل اختبار خططه وحالة تنفيذها وأثرها.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["دورات مفتوحة", rows.length, "text-late"], ["معلمون لديهم دورات مفتوحة", teachersN, "text-ink"],
          ["عند التصحيح والرصد", byStage["التصحيح والرصد"], "text-absent"], ["مكتملة هذا العام", closed.length, "text-present"]].map(([t, v, c]) => (
          <div key={t} className="card px-4 py-3 text-center">
            <p className={`num text-2xl font-bold ${c}`}>{v}</p>
            <p className="text-[11.5px] text-muted">{t}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button className={pill(tab === "open")} onClick={() => setTab("open")}>الدورات المفتوحة <span className="num">({rows.length})</span></button>
        <button className={pill(tab === "closed")} onClick={() => setTab("closed")}>المكتملة هذا العام <span className="num">({closed.length})</span></button>
      </div>

      {tab === "open" && rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button className={pill(stage === "all")} onClick={() => setStage("all")}>كل المراحل <span className="num">({rows.length})</span></button>
          {STAGES.filter((s) => byStage[s]).map((s) => (
            <button key={s} className={pill(stage === s)} onClick={() => setStage(s)}>{s} <span className="num">({byStage[s]})</span></button>
          ))}
        </div>
      )}
      {teachersN > 5 && <input className="field max-w-sm" placeholder="ابحث باسم المعلم…" value={q} onChange={(e) => setQ(e.target.value)} />}

      {tab === "open" && !rows.length ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا دورات اختبار مفتوحة. كل الدورات مكتملة.</p>
      ) : tab === "closed" && !closed.length ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا دورات مكتملة هذا العام بعد.</p>
      ) : !groups.length ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا نتائج بهذه التصفية.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.uid} className="card overflow-hidden">
              <p className="flex items-center justify-between border-b border-line/60 px-4 py-2.5">
                <span className="font-bold text-ink">{g.full_name}</span>
                <span className={`chip ${tab === "closed" ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
                  {tab === "closed" ? "مكتملة" : "مفتوحة"} <span className="num mr-1">{g.list.length}</span>
                </span>
              </p>
              <div className="divide-y divide-line/60">
                {g.list.map((r) => (
                  <div key={r.quiz_id} className="space-y-1.5 px-4 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="min-w-0 flex-1 font-medium text-ink">{r.title}</span>
                      <span className="text-xs text-muted">{PERIOD_LABEL[r.period] ?? ""} · {fmtDate(r.created_at)}</span>
                      <span className="chip w-36 justify-center bg-canvas text-ink">
                        {tab === "closed" ? `أُغلقت ${fmtDate(r.closed_at)}` : `عند: ${r.stage}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PlanChips plans={plans[r.quiz_id]} />
                      {canView && (
                        <span className="mr-auto flex gap-3 text-xs">
                          <Link className="font-semibold text-mint-deep underline" to={`/quizzes?t=${r.teacher_user_id}&q=${r.quiz_id}`}>فتح الدورة</Link>
                          <Link className="font-semibold text-mint-deep underline" to={`/quiz-analytics?t=${r.teacher_user_id}`}>التحليل والتقرير</Link>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
