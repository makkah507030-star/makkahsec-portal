// src/pages/ExamSchedules.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { DAY_NAMES, todayISO } from "../lib/schoolTime";
import { loadExamContext, loadScopeSlots, daysPhrase } from "../lib/examScope.js";
import { STUDENT_DEPUTY_NAME } from "../lib/signers.js";
import ExamTable, { ExamPrintArea } from "../components/ExamTable.jsx";
import Loader from "../components/Loader.jsx";

/* =====================================================================
   جداول الاختبارات — للطالب وولي الأمر والمعلم.
   الطالب يرى فصله، وولي الأمر أبناءه، والمعلم فصوله المسندة وموادّه فيها،
   والإدارة كل الفصول (النطاق في lib/examScope.js)، وكلها قابلة للطباعة.
   ===================================================================== */

const fmtG = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// اسم اليوم من التاريخ نفسه (لا من حقل اليوم المخزّن، فقد يخالف التاريخ)
const dayName = (slot) => slot.exam_date
  ? new Date(slot.exam_date + "T12:00:00").toLocaleDateString("ar-SA", { weekday: "long", timeZone: "Asia/Riyadh" })
  : DAY_NAMES[slot.day_of_week] ?? "";

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
  const [deputy, setDeputy] = useState("");
  const [deputySig, setDeputySig] = useState(null);

  // تحديد النطاق: الطالب فصله، وولي الأمر أبناؤه، والمعلم فصوله المسندة وموادّه فيها، والإدارة كل الفصول
  useEffect(() => {
    if (!uid) return;
    (async () => {
      // اسم الوكيل وتوقيعه: جدول الأدوار ومخزن التواقيع لا يقرؤهما الطالب والمعلم وولي الأمر،
      // فيُطلبان من الدالة deputy-signature، والاسم الاحتياطي من إعدادات الموقّعين
      setDeputy(STUDENT_DEPUTY_NAME);
      try {
        const { data: { session: ss } } = await supabase.auth.getSession();
        const res = await fetch("/.netlify/functions/deputy-signature", {
          method: "POST",
          headers: { Authorization: `Bearer ${ss?.access_token ?? ""}`, "Content-Type": "application/json" },
        });
        const j = await res.json();
        if (res.ok) {
          if (j.name) setDeputy(j.name);
          if (j.signature) { new Image().src = j.signature; setDeputySig(j.signature); }
        }
      } catch { /* يبقى مكان التوقيع للتوقيع اليدوي */ }

      const ctx = await loadExamContext(uid, effectiveRole);
      setTerms(ctx.terms);
      if (ctx.terms.length) setKind(ctx.terms[0].kind);
      setScopes(ctx.scopes); setScope(ctx.scopes[0] ?? null);
    })();
  }, [uid, effectiveRole]);

  // حصص الاختبار للنطاق المختار (للمعلم: موادّه فقط)
  useEffect(() => {
    if (!terms || !scope) return;
    const term = terms.find((t) => t.kind === kind);
    if (!term) { setSlots([]); return; }
    (async () => setSlots(await loadScopeSlots(term, scope)))();
  }, [terms, scope, kind]);

  const term = useMemo(() => (terms ?? []).find((t) => t.kind === kind), [terms, kind]);

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  if (!terms) return <Loader />;

  if (terms.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا جداول اختبارات منشورة</p>
        <p className="mt-1.5 text-sm text-muted">ستظهر هنا فور اعتمادها من الإدارة.</p>
      </div>
    );
  }

  if (!scopes.length && effectiveRole !== "admin") {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا جداول اختبارات تخصّك</p>
        <p className="mt-1.5 text-sm text-muted">
          {effectiveRole === "teacher" ? "لا فصول مسندة إليك في هذا الفصل الدراسي." : "لم يُربط الحساب بفصل دراسي بعد."}
        </p>
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
            <button key={s.key}
                    className={`${pill(scope?.key === s.key)} shrink-0`}
                    onClick={() => setScope(s)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {scope?.subjects?.length > 0 && (
        <p className="no-print text-xs text-muted">
          موادك في هذا الفصل: <b className="text-ink">{scope.subjects.map((x) => x.name).filter(Boolean).join("، ")}</b>
        </p>
      )}

      {term?.start_date && (
        <div className="no-print rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3">
          <p className="num text-sm font-semibold text-mint-deep">
            {fmtG(term.start_date)} — {fmtG(term.end_date)}
          </p>
          {nearest !== null && (
            <p className="mt-0.5 text-xs text-mint-deep/85">
              {nearest <= 1 ? `أول اختبار ${daysPhrase(nearest)}` : <>يبدأ أول اختبار <span className="num">{daysPhrase(nearest)}</span></>}
            </p>
          )}
        </div>
      )}

      <div className="no-print space-y-2">
        {slots.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-muted">
            {scope?.subjects ? "لا اختبارات لموادك في هذا الفصل." : "لم تُحدَّد اختبارات لهذا النطاق بعد."}
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
                  {dayName(s)} · {fmtG(s.exam_date)}
                  {kind === "final"
                    ? ` · الفترة ${s.period_no === 2 ? "الثانية" : "الأولى"}`
                    : ` · الحصة ${s.period_no}`}
                </p>
              </div>
              {!done && n !== null && n <= 3 && (
                <span className="chip shrink-0 bg-warning/15 text-warning">
                  {daysPhrase(n)}
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
            <ExamTable {...printing} deputy={deputy} deputySig={deputySig} />
          </ExamPrintArea>
        </div>
      )}
    </div>
  );
}
