// src/pages/admin/QuizCycles.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
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
   ===================================================================== */

const PERIOD_LABEL = { diagnostic: "تشخيصي", period1: "الفترة الأولى", period2: "الفترة الثانية" };
// مراحل الدورة بترتيبها (كما تعيدها perf_open_cycles)
const STAGES = ["البناء والتطبيق", "التصحيح والرصد", "التحليل", "الخطة", "التنفيذ", "التحقق من الأثر", "الخطة الثانية", "التكريم والإغلاق"];
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export default function QuizCycles() {
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [err, setErr] = useState("");
  const [stage, setStage] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const year = await activeYear();
      const [{ data, error }, { data: ts }] = await Promise.all([
        supabase.rpc("perf_open_cycles", { p_year: year }),
        supabase.from("teachers").select("user_id, full_name").not("user_id", "is", null),
      ]);
      if (error) setErr(/perf_open_cycles/.test(error.message) ? "المتابعة غير مفعّلة بعد: يلزم تشغيل ملف supabase/quiz_verify_3.sql." : error.message);
      setNames(Object.fromEntries((ts ?? []).map((t) => [t.user_id, t.full_name])));
      setRows(data ?? []);
    })();
  }, []);

  const byStage = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, (rows ?? []).filter((r) => r.stage === s).length])), [rows]);
  const groups = useMemo(() => {
    const t = q.trim();
    const list = (rows ?? []).filter((r) => (stage === "all" || r.stage === stage) && (!t || (names[r.teacher_user_id] ?? "").includes(t)));
    const m = {};
    list.forEach((r) => (m[r.teacher_user_id] ??= []).push(r));
    return Object.entries(m).map(([uid, l]) => ({ uid, full_name: names[uid] ?? "معلم", list: l }))
      .sort((a, b) => b.list.length - a.list.length || byName()(a, b));
  }, [rows, names, stage, q]);

  if (rows === null) return <Loader />;
  const teachersN = new Set(rows.map((r) => r.teacher_user_id)).size;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">متابعة دورات الاختبار</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          اختبارات الفترات والتشخيصي التي لم تُغلق دورتها بعد، والمرحلة التي توقف عندها كل اختبار:
          البناء، فالرصد، فالتحليل، فالخطة العلاجية وتنفيذها والتحقق من أثرها، ثم التكريم والإغلاق.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[["دورات مفتوحة", rows.length, "text-late"], ["معلمون لديهم دورات مفتوحة", teachersN, "text-ink"],
          ["عند التصحيح والرصد", byStage["التصحيح والرصد"], "text-absent"]].map(([t, v, c]) => (
          <div key={t} className="card px-4 py-3 text-center">
            <p className={`num text-2xl font-bold ${c}`}>{v}</p>
            <p className="text-[11.5px] text-muted">{t}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button className={pill(stage === "all")} onClick={() => setStage("all")}>كل المراحل <span className="num">({rows.length})</span></button>
          {STAGES.filter((s) => byStage[s]).map((s) => (
            <button key={s} className={pill(stage === s)} onClick={() => setStage(s)}>{s} <span className="num">({byStage[s]})</span></button>
          ))}
        </div>
      )}
      {teachersN > 5 && <input className="field max-w-sm" placeholder="ابحث باسم المعلم…" value={q} onChange={(e) => setQ(e.target.value)} />}

      {!rows.length ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا دورات اختبار مفتوحة. كل الدورات مكتملة.</p>
      ) : !groups.length ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا نتائج بهذه التصفية.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.uid} className="card overflow-hidden">
              <p className="flex items-center justify-between border-b border-line/60 px-4 py-2.5">
                <span className="font-bold text-ink">{g.full_name}</span>
                <span className="chip bg-warning-light text-warning">مفتوحة <span className="num mr-1">{g.list.length}</span></span>
              </p>
              <div className="divide-y divide-line/60">
                {g.list.map((r) => (
                  <div key={r.quiz_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                    <span className="min-w-0 flex-1 text-ink">{r.title}</span>
                    <span className="text-xs text-muted">{PERIOD_LABEL[r.period] ?? ""} · {fmtDate(r.created_at)}</span>
                    <span className="chip w-36 justify-center bg-canvas text-ink">عند: {r.stage}</span>
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
