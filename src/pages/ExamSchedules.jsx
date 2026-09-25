// src/pages/ExamSchedules.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { DAY_NAMES, GRADE_NAMES, todayISO } from "../lib/schoolTime";
import ExamTable, { ExamPrintArea } from "../components/ExamTable.jsx";

/* =====================================================================
   جداول الاختبارات — للطالب وولي الأمر والمعلم.
   يعرض الجدول المنشور الذي يخصّ فصل الطالب أو صفّه،
   وللمعلم كل الجداول المنشورة، وكلها قابلة للطباعة.
   ===================================================================== */

const fmtG = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const daysTo = (s) => {
  if (!s) return null;
  return Math.round((new Date(s + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
};

export default function ExamSchedules() {
  const { session, effectiveRole } = useSession();
  const uid = session?.user?.id;

  const [terms, setTerms] = useState(null);
  const [slots, setSlots] = useState([]);
  const [scope, setScope] = useState(null);      // { classId, grade, label }
  const [scopes, setScopes] = useState([]);      // لولي الأمر: أبناؤه
  const [kind, setKind] = useState("period1");
  const [printing, setPrinting] = useState(null);

  // تحديد النطاق: الطالب فصله، وولي الأمر أبناؤه، والمعلم كل الفصول
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year"]);
      const year = (st ?? []).find((r) => r.key === "active_year")?.value ?? "";

      const { data: t } = await supabase.from("exam_terms")
        .select("*").eq("is_published", true).eq("academic_year", year);
      setTerms(t ?? []);
      if (t?.length) setKind(t[0].kind);

      if (effectiveRole === "student") {
        const { data: s } = await supabase.from("students")
          .select("id, class_id, classes(class_no, grade)").eq("user_id", uid).maybeSingle();
        if (s) {
          const one = { classId: s.class_id, grade: s.classes?.grade,
                        label: `${GRADE_NAMES[s.classes?.grade] ?? ""} — فصل ${s.classes?.class_no}` };
          setScopes([one]); setScope(one);
        }
        return;
      }

      if (effectiveRole === "guardian") {
        const { data: g } = await supabase.from("guardians")
          .select("id").eq("user_id", uid).maybeSingle();
        if (!g) return;
        const { data: kids } = await supabase.from("guardian_student")
          .select("students(id, full_name, class_id, classes(class_no, grade))")
          .eq("guardian_id", g.id);
        const list = (kids ?? []).map((k) => k.students).filter(Boolean).map((s) => ({
          classId: s.class_id, grade: s.classes?.grade,
          label: `${s.full_name} — فصل ${s.classes?.class_no}`,
        }));
        setScopes(list); setScope(list[0] ?? null);
        return;
      }

      // المعلم والإدارة: كل الفصول
      const { data: cs } = await supabase.from("classes")
        .select("id, class_no, grade").eq("academic_year", year)
        .order("grade").order("class_no");
      const list = (cs ?? []).map((c) => ({
        classId: c.id, grade: c.grade,
        label: `${GRADE_NAMES[c.grade] ?? ""} — فصل ${c.class_no}`,
      }));
      setScopes(list); setScope(list[0] ?? null);
    })();
  }, [uid, effectiveRole]);

  // حصص الاختبار للنطاق المختار
  useEffect(() => {
    if (!terms || !scope) return;
    const term = terms.find((t) => t.kind === kind);
    if (!term) { setSlots([]); return; }
    (async () => {
      let q = supabase.from("exam_slots").select("*").eq("exam_term_id", term.id);
      q = kind === "final"
        ? q.eq("grade", scope.grade).is("class_id", null)
        : q.eq("class_id", scope.classId);
      const { data } = await q.order("exam_date").order("period_no");
      setSlots(data ?? []);
    })();
  }, [terms, scope, kind]);

  const term = useMemo(() => (terms ?? []).find((t) => t.kind === kind), [terms, kind]);

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  if (!terms) return <p className="py-8 text-center text-sm text-muted">جارٍ التحميل…</p>;

  if (terms.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا جداول اختبارات منشورة</p>
        <p className="mt-1.5 text-sm text-muted">ستظهر هنا فور اعتمادها من الإدارة.</p>
      </div>
    );
  }

  const soon = slots.map((s) => daysTo(s.exam_date)).filter((n) => n !== null && n >= 0);
  const nearest = soon.length ? Math.min(...soon) : null;

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-ink">جداول الاختبارات</h1>
        <p className="mt-1 text-sm text-muted">الجداول المعتمدة من إدارة المدرسة.</p>
      </div>

      <div className="no-print flex flex-wrap gap-1.5">
        {terms.map((t) => (
          <button key={t.kind} className={pill(kind === t.kind)} onClick={() => setKind(t.kind)}>
            {t.title}
          </button>
        ))}
      </div>

      {scopes.length > 1 && (
        <div className="no-print -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {scopes.map((s) => (
            <button key={s.classId}
                    className={`${pill(scope?.classId === s.classId)} shrink-0`}
                    onClick={() => setScope(s)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {term?.start_date && (
        <div className="no-print rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3">
          <p className="num text-sm font-semibold text-mint-deep">
            {fmtG(term.start_date)} — {fmtG(term.end_date)}
          </p>
          {nearest !== null && (
            <p className="mt-0.5 text-xs text-mint-deep/85">
              {nearest === 0 ? "أول اختبار اليوم"
                : nearest === 1 ? "أول اختبار غدًا"
                : <>يبدأ أول اختبار بعد <span className="num">{nearest}</span> يومًا</>}
            </p>
          )}
        </div>
      )}

      <div className="no-print space-y-2">
        {slots.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-muted">
            لم تُحدَّد اختبارات لهذا النطاق بعد.
          </p>
        ) : slots.map((s) => {
          const n = daysTo(s.exam_date);
          const done = n !== null && n < 0;
          return (
            <div key={s.id}
                 className={`card flex items-center gap-3 p-3.5 ${done ? "opacity-60" : ""}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-center">
                <span className="num text-[15px] font-bold leading-none text-mint-deep">
                  {s.exam_date ? new Date(s.exam_date + "T00:00:00").getDate() : "—"}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{s.subject_name}</p>
                <p className="num mt-0.5 text-xs text-muted">
                  {DAY_NAMES[s.day_of_week] ?? ""} · {fmtG(s.exam_date)}
                  {kind === "final"
                    ? ` · الفترة ${s.period_no === 2 ? "الثانية" : "الأولى"}`
                    : ` · الحصة ${s.period_no}`}
                </p>
              </div>
              {!done && n !== null && n <= 3 && (
                <span className="chip shrink-0 bg-warning/15 text-warning">
                  {n === 0 ? "اليوم" : n === 1 ? "غدًا" : `بعد ${n} أيام`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {slots.length > 0 && (
        <button className="no-print btn-primary w-full"
                onClick={() => { setPrinting({
                  title: term.title, subtitle: scope?.label, rows: slots,
                  note: term.note, final: kind === "final" });
                  setTimeout(() => window.print(), 50); }}>
          طباعة / حفظ PDF
        </button>
      )}

      {printing && (
        <div className="hidden print:block">
          <ExamPrintArea>
            <ExamTable {...printing} />
          </ExamPrintArea>
        </div>
      )}
    </div>
  );
}
