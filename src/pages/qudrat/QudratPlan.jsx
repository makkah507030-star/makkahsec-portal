// src/pages/qudrat/QudratPlan.jsx
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtHijri } from "../../lib/dates";
import { SKILLS } from "../../qudrat-content/index.js";
import { APPROX, PHASES, addDays, buildPlan, daysBetween, isoDay } from "../../lib/qudratPlan.js";

/* =====================================================================
   بطاقة «خطتي للاختبار» في مركز التدريب: يدخل الطالب موعد اختباره أو
   يقدّره، ووقت تدريبه اليومي، فتُبنى خطة يوم بيوم (lib/qudratPlan.js)
   تتجدد كل يوم من مستواه. مهمة اليوم بزر يبدؤها، وتقدّمه فيها من سجله.
   ===================================================================== */

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dayName = (s) => DAYS[new Date(`${s}T12:00:00Z`).getUTCDay()];
const MINUTES = [15, 30, 45, 60, 90];

const describe = (d) => d.kind === "mock" ? "اختبار محاكٍ كامل بوقته (أربعة أقسام)"
  : d.kind === "rest" ? "مراجعة خفيفة لأخطائك، ثم راحة ونوم مبكر"
  : d.review ? `مراجعة ما أخطأت فيه · ${d.count} سؤالًا`
  : `${d.skills.map((k) => SKILLS[k]?.t).join(" + ")} · ${d.count} سؤالًا`;

export default function QudratPlan({ uid, plan, bySkill, doneToday, onSaved, onStart }) {
  const [edit, setEdit] = useState(false);
  const [all, setAll] = useState(false);

  if (!plan || edit) return <PlanForm uid={uid} plan={plan} onCancel={plan ? () => setEdit(false) : null}
                                      onSaved={(p) => { setEdit(false); onSaved(p); }} />;

  const today = isoDay();
  const left = daysBetween(today, plan.exam_date);
  if (left <= 0) {
    return (
      <section className="card px-4 py-4">
        <p className="font-bold text-ink">{left === 0 ? "اختبارك اليوم، وفقك الله!" : "مضى موعد اختبارك."}</p>
        <p className="mt-1 text-sm text-muted">إن كان لك اختبار آخر فحدّد موعده لتُبنى خطة جديدة.</p>
        <button className="btn-ghost mt-3" onClick={() => setEdit(true)}>تحديد موعد جديد</button>
      </section>
    );
  }
  const days = buildPlan(plan, bySkill, today);
  const d = days[0];
  const ph = PHASES[d.phase];
  const pct = d.kind === "mock" ? null : Math.min(100, Math.round((doneToday / d.count) * 100));

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-4 py-3">
        <div>
          <p className="text-xs text-muted">خطتي للاختبار</p>
          <p className="font-bold text-ink">
            باقٍ <span className="num text-mint-deep">{left}</span> {left === 1 ? "يوم" : left <= 10 ? "أيام" : "يومًا"} على الاختبار
            {plan.approx && <span className="chip mr-2 bg-canvas text-muted">موعد تقديري</span>}
          </p>
          <p className="flex flex-wrap gap-x-2 text-[11.5px] text-muted">
            <span>موعده {dayName(plan.exam_date)} <span className="num">{fmtHijri(plan.exam_date)}</span></span>
            <span>تدريبك <span className="num">{plan.daily_minutes}</span> دقيقة يوميًا</span>
          </p>
        </div>
        <button className="text-xs font-semibold text-mint-deep" onClick={() => setEdit(true)}>تعديل</button>
      </div>

      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink">مهمة اليوم</span>
          <span className={`chip ${ph.c}`}>مرحلة {ph.t}</span>
        </div>
        <p className="mt-1.5 text-[15px] text-ink">{describe(d)}</p>
        {pct != null && (
          <>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-canvas">
              <div className={`h-full rounded-full ${pct >= 100 ? "bg-present" : "bg-mint-deep"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              {pct >= 100 ? "أنجزت مهمة اليوم، أحسنت! وما زدت عليه يرفع مستواك." : <>أنجزت <span className="num">{Math.min(doneToday, d.count)}</span> من <span className="num">{d.count}</span></>}
            </p>
          </>
        )}
        <button className="btn-primary mt-3 w-full sm:w-auto" onClick={() => onStart(d)}>
          {d.kind === "mock" ? "ابدأ الاختبار المحاكي" : pct >= 100 ? "تدرّب أكثر" : "ابدأ مهمة اليوم"}
        </button>
      </div>

      {days.length > 1 && (
        <div className="border-t border-line/60">
          <button className="flex w-full justify-between px-4 py-2.5 text-sm font-semibold text-mint-deep" onClick={() => setAll((x) => !x)}>
            <span>{all ? "إخفاء الأيام القادمة" : "الأيام القادمة في الخطة"}</span>
            <span className="num text-muted">{days.length - 1}</span>
          </button>
          {all && (
            <ol className="max-h-80 divide-y divide-line/50 overflow-y-auto border-t border-line/60">
              {days.slice(1).map((x) => (
                <li key={x.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                  <span className="w-28 shrink-0 text-xs text-muted">{dayName(x.date)} <span className="num">{fmtHijri(x.date).slice(0, 5)}</span></span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${x.kind === "mock" ? "bg-excused" : x.kind === "rest" ? "bg-present" : x.phase === "base" ? "bg-mint-deep" : "bg-late"}`} />
                  <span className="min-w-0 flex-1 text-ink">{describe(x)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function PlanForm({ uid, plan, onCancel, onSaved }) {
  const today = isoDay();
  const [mode, setMode] = useState(plan?.approx ? "approx" : "date");
  const [date, setDate] = useState(plan?.exam_date && plan.exam_date > today ? plan.exam_date : "");
  const [approx, setApprox] = useState(30);
  const [minutes, setMinutes] = useState(plan?.daily_minutes ?? 30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    const exam_date = mode === "date" ? date : addDays(today, approx);
    if (!exam_date || exam_date <= today) return setErr("اختر موعدًا بعد اليوم.");
    setBusy(true); setErr("");
    const row = { user_id: uid, exam_date, approx: mode === "approx", daily_minutes: minutes, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("qudrat_plans").upsert(row).select().single();
    setBusy(false);
    if (error) return setErr(/qudrat_plans/.test(error.message) ? "الخطة غير مفعّلة بعد: يلزم تشغيل ملف supabase/qudrat_2.sql." : error.message);
    onSaved(data);
  };
  const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[13px] font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;

  return (
    <section className="card space-y-3.5 px-4 py-4">
      <div>
        <p className="font-bold text-ink">خطتي للاختبار</p>
        <p className="mt-0.5 text-sm text-muted">حدّد موعد اختبارك ووقت تدريبك اليومي، فنبني لك خطة يوم بيوم تبدأ بأضعف مهاراتك.</p>
      </div>
      <div className="flex gap-2">
        <button className={pill(mode === "date")} onClick={() => setMode("date")}>أعرف الموعد</button>
        <button className={pill(mode === "approx")} onClick={() => setMode("approx")}>موعد تقريبي</button>
      </div>
      {mode === "date" ? (
        <label className="block text-sm"><span className="text-muted">موعد الاختبار</span>
          <input type="date" className="field mt-1 max-w-xs" min={addDays(today, 1)} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      ) : (
        <div className="flex flex-wrap gap-2">
          {APPROX.map(([t, n]) => <button key={n} className={pill(approx === n)} onClick={() => setApprox(n)}>{t}</button>)}
        </div>
      )}
      <div>
        <p className="text-sm text-muted">وقت التدريب اليومي</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {MINUTES.map((m) => <button key={m} className={pill(minutes === m)} onClick={() => setMinutes(m)}><span className="num">{m}</span> دقيقة</button>)}
        </div>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "جاري الحفظ…" : "ابنِ خطتي"}</button>
        {onCancel && <button className="btn-ghost" onClick={onCancel}>إلغاء</button>}
      </div>
    </section>
  );
}
