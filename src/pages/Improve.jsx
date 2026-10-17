import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { fmtDate } from "../lib/dates";
import { todayISO } from "../lib/schoolTime.js";
import { activeYear, elementColor } from "../lib/performance.js";
import { gradeTone } from "../lib/rubric.js";
import { ELEMENTS } from "../lib/dfile.js";
import { refreshNavBadges } from "../lib/navBadges.js";
import {
  EL_TITLE, FOLLOW_DAYS, LATE_AFTER, OPEN, SCORE_LABEL, SOURCE_LABEL, STATUS, SUPPORT_PRESETS,
  act, addDays, dueState, loadGoals,
} from "../lib/improve.js";
import Loader from "../components/Loader.jsx";
import { supabase } from "../lib/supabase";
import { excelBoard, printBoard, printGoal, printRecord } from "../lib/improvePrint.js";

/* =====================================================================
   خطط التطوير — حلقة التحسين (src/lib/improve.js):
   • «خططي» للمعلم: يكتب خطته لكل توصية، ويسجّل ما نفّذه حين يحلّ موعد المتابعة.
   • «متابعتي» للزائر أو المدير: يعتمد الخطة أو يعيدها، ويصدر زيارة المتابعة.
   • «لوحة المدير»: المفتوح والمتأخر والمغلق ونسبة التحسّن وأكثر البنود احتياجًا.
   الأثر يُقاس آليًا من درجة البند في الزيارة أو التقييم التالي.
   ===================================================================== */

const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
const add = (cur, t) => (cur?.trim() ? `${cur.trim()}\n${t}` : t);

function ScoreChip({ v, prefix }) {
  const tone = gradeTone(v);
  if (!tone) return <span className="chip bg-canvas text-muted">{prefix} غير مقدَّر</span>;
  return (
    <span className="chip" style={{ background: tone.bg, color: tone.fg }}>
      {prefix} <span className="num mx-1 font-bold">{v}</span>· {SCORE_LABEL[v]}
    </span>
  );
}

function Box({ title, children, tone = "bg-canvas" }) {
  return (
    <div className={`rounded-sm2 px-3 py-2 text-sm ${tone}`}>
      <p className="text-xs font-semibold text-muted">{title}</p>
      <div className="mt-0.5 whitespace-pre-line text-ink">{children}</div>
    </div>
  );
}

/* --------------------------- بطاقة التوصية --------------------------- */
function Goal({ g, uid, boss, onDone, focus }) {
  const navigate = useNavigate();
  const mine = g.teacher_user_id === uid;
  const follower = g.owner_user_id === uid || boss;
  const due = dueState(g);
  const [f, setF] = useState({ actions: g.plan_actions ?? "", support: g.plan_support ?? "",
    date: g.follow_up_date ?? addDays(todayISO(), FOLLOW_DAYS), note: "", progress: g.progress_note ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);    // return | reschedule | cancel | progress
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const run = async (action, opts, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setErr("");
    try { await act(g, action, opts); setOpen(null); onDone(); refreshNavBadges(true); }
    catch (e) { setErr(e.message ?? "تعذّر الحفظ."); }
    setBusy(false);
  };

  return (
    <section id={`g-${g.id}`} className={`card space-y-3 p-4 ${focus ? "ring-2 ring-mint-deep/50" : ""}`}>
      <h2 className="font-bold" style={{ color: elementColor(g.element_key) }}>{EL_TITLE[g.element_key]}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {g.cycle > 1 && <span className="chip bg-absent/10 text-absent">الدورة <span className="num mx-1">{g.cycle}</span>· دعم أعلى</span>}
        {due === "late" ? <span className="chip bg-absent/10 text-absent">متأخرة المتابعة</span>
          : due === "due" ? <span className="chip bg-warning-light text-warning">حلّ موعد المتابعة</span> : null}
        <span className={`chip ${STATUS[g.status]?.c}`}>{STATUS[g.status]?.t}</span>
      </div>

      <p className="text-xs text-faint">
        {!mine && <>المعلم <b className="text-ink">{g.teacher?.full_name ?? "—"}</b> · </>}
        من {SOURCE_LABEL[g.source]} في {fmtDate(g.source_date)}
        {g.owner?.full_name && g.owner_user_id !== uid && <> · يتابعها {g.owner.full_name}</>}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <ScoreChip v={g.baseline} prefix="خط الأساس" />
        {g.status === "closed" && <>
          <span className="text-muted" aria-hidden="true">←</span>
          <ScoreChip v={g.result_score} prefix="بعد الخطة" />
          <span className={`chip ${g.improved ? "bg-mint-light text-mint-deep" : "bg-absent/10 text-absent"}`}>
            {g.improved ? "تحسّن" : "لم يتحسّن · فُتحت دورة تالية بدعم أعلى"}
          </span>
        </>}
      </div>

      <Box title="التوصية">{g.recommendation}</Box>

      {g.status === "plan" && g.plan_return_note && (
        <Box title="أُعيدت الخطة بملاحظة" tone="bg-warning-light">{g.plan_return_note}</Box>
      )}

      {/* المعلم يكتب خطته */}
      {mine && g.status === "plan" ? (
        <div className="space-y-3 rounded-sm2 border border-line p-3">
          {g.cycle > 1 && (
            <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs leading-relaxed text-absent">
              لم يتحسّن البند بعد الخطة السابقة، فهذه دورة ثانية بدعم أعلى: غيّر الإجراءات، واطلب دعمًا أقرب
              كدرس تطبيقي أو زيارة تبادلية أو برنامج تدريبي.
            </p>
          )}
          <div>
            <label className="label">الإجراءات التي ستنفّذها</label>
            <textarea className="field min-h-[90px]" value={f.actions} onChange={(e) => set("actions", e.target.value)}
                      placeholder="مثال: أطبّق استراتيجية التعلم التعاوني في حصتين أسبوعيًا، وأوثّق أثرها." />
          </div>
          <div>
            <label className="label">الدعم الذي تحتاجه (اختياري)</label>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {SUPPORT_PRESETS.map((t) => (
                <button key={t} type="button" onClick={() => set("support", add(f.support, t))}
                        className="rounded-[14px] border border-mint-light bg-mint-tint px-3 py-1 text-[11.5px] text-mint-deep hover:bg-mint-light">{t}</button>
              ))}
            </div>
            <textarea className="field min-h-[70px]" value={f.support} onChange={(e) => set("support", e.target.value)} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">موعد المتابعة</label>
              <input type="date" className="field num" min={todayISO()} value={f.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <p className="pb-2 text-xs text-muted">الافتراضي بعد <span className="num">{FOLLOW_DAYS / 7}</span> أسابيع، ويعتمده الزائر.</p>
          </div>
          <button className="btn-primary" disabled={busy || !f.actions.trim()}
                  onClick={() => run("plan", { note: f.actions, support: f.support, date: f.date })}>إرسال الخطة للاعتماد</button>
        </div>
      ) : g.plan_actions ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Box title="الإجراءات">{g.plan_actions}</Box>
          <Box title="الدعم المطلوب">{g.plan_support || "—"}</Box>
          <Box title="موعد المتابعة"><span className="num">{g.follow_up_date ? fmtDate(g.follow_up_date) : "—"}</span></Box>
          {g.progress_note && <Box title={`ما نفّذه المعلم · ${fmtDate(g.progress_at)}`}>{g.progress_note}</Box>}
        </div>
      ) : null}

      {g.status === "cancelled" && g.cancel_note && <Box title="سبب الإلغاء">{g.cancel_note}</Box>}

      {/* المعلم: ما نفّذه حين يحلّ الموعد */}
      {mine && g.status === "active" && (open === "progress" || (due && !g.progress_at)) && (
        <div className="space-y-2 rounded-sm2 border border-line p-3">
          <label className="label">ما نفّذته من الخطة</label>
          <textarea className="field min-h-[70px]" value={f.progress} onChange={(e) => set("progress", e.target.value)} />
          <button className="btn-primary" disabled={busy || !f.progress.trim()} onClick={() => run("progress", { note: f.progress })}>حفظ</button>
        </div>
      )}
      {mine && g.status === "active" && open !== "progress" && !(due && !g.progress_at) && (
        <button className="text-sm text-mint-deep underline" onClick={() => setOpen("progress")}>
          {g.progress_at ? "تعديل ما نفّذته" : "سجّل ما نفّذته"}
        </button>
      )}

      {/* المتابع: الاعتماد والإعادة والموعد والإلغاء */}
      {follower && g.status === "review" && (
        <div className="space-y-2 rounded-sm2 border border-line p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">موعد المتابعة</label>
              <input type="date" className="field num" min={todayISO()} value={f.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <button className="btn-primary" disabled={busy} onClick={() => run("approve", { date: f.date })}>اعتماد الخطة</button>
            <button className="btn-ghost" disabled={busy} onClick={() => setOpen(open === "return" ? null : "return")}>إعادة للمعلم</button>
          </div>
        </div>
      )}
      {follower && g.status === "active" && (
        <div className="flex flex-wrap gap-2">
          {g.owner_user_id === uid && (
            <button className="btn-primary" onClick={() => navigate("/forms", { state: { visitFor: g.teacher_user_id } })}>
              إصدار زيارة المتابعة
            </button>
          )}
          <button className="btn-ghost" onClick={() => setOpen(open === "reschedule" ? null : "reschedule")}>تغيير الموعد</button>
        </div>
      )}
      {follower && OPEN.includes(g.status) && open !== "cancel" && (
        <button className="text-xs text-muted hover:underline" onClick={() => setOpen("cancel")}>إلغاء التوصية</button>
      )}

      {follower && open === "return" && (
        <div className="space-y-2">
          <textarea className="field min-h-[60px]" placeholder="ملاحظتك للمعلم" value={f.note} onChange={(e) => set("note", e.target.value)} />
          <button className="btn-primary" disabled={busy || !f.note.trim()} onClick={() => run("return", { note: f.note })}>إعادة الخطة</button>
        </div>
      )}
      {follower && open === "reschedule" && (
        <div className="flex flex-wrap items-end gap-2">
          <input type="date" className="field num" min={todayISO()} value={f.date} onChange={(e) => set("date", e.target.value)} />
          <button className="btn-primary" disabled={busy} onClick={() => run("reschedule", { date: f.date })}>حفظ الموعد</button>
        </div>
      )}
      {follower && open === "cancel" && (
        <div className="space-y-2">
          <textarea className="field min-h-[60px]" placeholder="سبب الإلغاء" value={f.note} onChange={(e) => set("note", e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !f.note.trim()} onClick={() => run("cancel", { note: f.note }, "إلغاء هذه التوصية؟ لن يُقاس أثرها.")}>تأكيد الإلغاء</button>
            <button className="btn-ghost" onClick={() => setOpen(null)}>تراجع</button>
          </div>
        </div>
      )}

      {g.status === "active" && (
        <p className="text-xs text-faint">
          يُقاس الأثر آليًا من درجة هذا البند في أول زيارة دعم أو تقييم أداء يصدر للمعلم بعد اعتماد الخطة.
        </p>
      )}
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      <button className="text-xs text-mint-deep underline" onClick={() => printGoal(g)}>طباعة الخطة</button>
    </section>
  );
}

/* ----------------------------- لوحة المدير ----------------------------- */
function Board({ rows, onPick }) {
  const today = todayISO();
  const open = rows.filter((g) => OPEN.includes(g.status));
  const late = rows.filter((g) => dueState(g, today) === "late");
  const closed = rows.filter((g) => g.status === "closed");
  const better = closed.filter((g) => g.improved).length;
  const rate = closed.length ? Math.round((100 * better) / closed.length) : null;
  const need = ELEMENTS.map(([k, t]) => ({ k, t, n: rows.filter((g) => g.element_key === k && g.status !== "cancelled").length }))
    .filter((x) => x.n).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...need.map((x) => x.n));
  const tile = (n, t, c = "text-ink") => (
    <div className="card px-3 py-3 text-center"><p className={`num text-2xl font-bold ${c}`}>{n}</p><p className="text-xs text-muted">{t}</p></div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile(open.length, "مفتوحة")}
        {tile(late.length, `متأخرة (أكثر من ${LATE_AFTER} أيام)`, late.length ? "text-absent" : "text-ink")}
        {tile(closed.length, "مغلقة بقياس الأثر")}
        {tile(rate == null ? "—" : `${rate}%`, `نسبة التحسّن${closed.length ? ` (${better} من ${closed.length})` : ""}`, "text-mint-deep")}
      </div>

      <section className="card p-4">
        <h2 className="font-bold text-ink">أكثر البنود احتياجًا</h2>
        <p className="text-xs text-muted">عدد التوصيات في كل بند هذا العام، عدا الملغاة</p>
        {need.length === 0 ? <p className="mt-3 text-sm text-muted">لا توصيات بعد.</p> : (
          <div className="mt-3 space-y-2">
            {need.map((x) => (
              <div key={x.k} className="flex items-center gap-2 text-sm">
                <span className="w-48 shrink-0 truncate" style={{ color: elementColor(x.k) }}>{x.t}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-canvas">
                  <span className="block h-full rounded-pill" style={{ width: `${(100 * x.n) / max}%`, background: elementColor(x.k) }} />
                </span>
                <span className="num w-8 text-left text-ink">{x.n}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line/60 px-4 py-2.5 font-bold text-ink">المتأخرة</h2>
        {late.length === 0 ? <p className="px-4 py-4 text-sm text-muted">لا متابعات متأخرة.</p> : (
          <div className="divide-y divide-line/60">
            {late.map((g) => (
              <button key={g.id} onClick={() => onPick(g)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-right text-sm hover:bg-canvas">
                <span className="min-w-0 flex-1 text-ink">{g.teacher?.full_name ?? "معلم"} · {EL_TITLE[g.element_key]}</span>
                <span className="text-xs text-muted">الموعد {fmtDate(g.follow_up_date)} · يتابعها {g.owner?.full_name ?? "—"}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* --------------- أثر الخطط العلاجية في دورة الاختبار (quiz_plans_board) --------------- */
const VERIFY_LATE_DAYS = 14;
function QuizBoard({ rows }) {
  if (!rows) return <Loader compact />;
  const done = rows.filter((r) => r.status === "done");
  const measured = done.filter((r) => r.measured_at && r.impact?.n);
  const waiting = done.filter((r) => !r.measured_at);
  const late = waiting.filter((r) => r.done_at && Date.now() - new Date(r.done_at) > VERIFY_LATE_DAYS * 864e5);
  const n = measured.reduce((a, r) => a + Number(r.impact.n), 0);
  const passed = measured.reduce((a, r) => a + Number(r.impact.passed), 0);
  const stuck = measured.filter((r) => r.round > 1 && Number(r.impact.below) > 0);
  const tile = (v, t, c = "text-ink") => (
    <div className="card px-3 py-3 text-center"><p className={`num text-2xl font-bold ${c}`}>{v}</p><p className="text-xs text-muted">{t}</p></div>
  );
  const line = (r, extra) => (
    <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
      <span className="min-w-0 flex-1 text-ink">{r.teacher ?? "معلم"} · {r.title}{r.round > 1 ? " · الخطة الثانية" : ""}</span>
      <span className="text-xs text-muted">{extra}</span>
    </div>
  );
  return (
    <section className="space-y-3">
      <h2 className="px-1 font-bold text-ink">أثر الخطط العلاجية في دورة الاختبار</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile(done.length, "خطط علاجية نُفّذت")}
        {tile(measured.length, "قيس أثرها باختبار تحقق")}
        {tile(n ? `${Math.round((100 * passed) / n)}%` : "—", `من طلابها بلغوا 60%${n ? ` (${passed} من ${n})` : ""}`, "text-mint-deep")}
        {tile(late.length, `بلا تحقق أكثر من ${VERIFY_LATE_DAYS} يومًا`, late.length ? "text-absent" : "text-ink")}
      </div>
      {(stuck.length > 0 || late.length > 0) && (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {stuck.map((r) => line(r, `بقي ${r.impact.below} دون 60% بعد الخطة الثانية`))}
          {late.map((r) => line(r, `نُفّذت ${fmtDate(r.done_at)} ولم يُتحقق من أثرها`))}
        </div>
      )}
      {measured.length > 0 && (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {measured.slice(0, 12).map((r) => line(r, `المتوسط ${r.impact.before}% ← ${r.impact.after}% · بلغ 60% ${r.impact.passed} من ${r.impact.n}`))}
        </div>
      )}
    </section>
  );
}

export default function Improve() {
  const { session, adminRoles } = useSession();
  const uid = session?.user?.id;
  const boss = (adminRoles ?? []).some((r) => r === "principal" || r === "tech_support");
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [year, setYear] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const focusId = params.get("g");
  const [quizRows, setQuizRows] = useState(null);   // الخطط العلاجية في دورة الاختبار (للوحة المدير)
  useEffect(() => {
    if (!boss || !year) return;
    supabase.rpc("quiz_plans_board", { p_year: year }).then(({ data, error }) => setQuizRows(error ? [] : data ?? []));
  }, [boss, year]);

  const load = useCallback(async () => {
    try {
      const [y, data] = await Promise.all([activeYear(), loadGoals()]);
      setYear(y); setRows(data);
    } catch (e) {
      setErr(/improvement_goals|schema cache/i.test(e.message ?? "")
        ? "لم تُفعَّل حلقة التحسين بعد في قاعدة البيانات." : e.message);
      setRows([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const mine = useMemo(() => (rows ?? []).filter((g) => g.teacher_user_id === uid), [rows, uid]);
  const follow = useMemo(() => (rows ?? []).filter((g) => g.owner_user_id === uid || (boss && g.teacher_user_id !== uid)), [rows, uid, boss]);
  const yearRows = useMemo(() => (rows ?? []).filter((g) => !g.academic_year || g.academic_year === year), [rows, year]);

  const tabs = [
    mine.length > 0 && { k: "mine", t: "خططي" },
    follow.length > 0 && { k: "follow", t: boss ? "كل الخطط" : "متابعتي" },
    boss && { k: "board", t: "لوحة المدير" },
  ].filter(Boolean);
  const linked = tabs.some((x) => x.k === params.get("tab")) ? params.get("tab") : null;
  const focused = focusId && (rows ?? []).find((g) => g.id === focusId);
  const cur = tab ?? linked ?? (focused ? (focused.teacher_user_id === uid ? "mine" : "follow") : tabs[0]?.k);

  useEffect(() => {
    if (!focusId || !rows) return;
    document.getElementById(`g-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, rows, cur]);

  if (!rows) return <Loader />;

  // المفتوح أولًا: ما ينتظر إجراءك، ثم الأقرب موعدًا
  const urgency = (g) => {
    if (g.status === "plan" && g.teacher_user_id === uid) return 0;
    if (g.status === "review" && g.teacher_user_id !== uid) return 0;
    if (dueState(g)) return 1;
    return OPEN.includes(g.status) ? 2 : 3;
  };
  const list = (cur === "mine" ? mine : follow)
    .filter((g) => showClosed || OPEN.includes(g.status) || g.id === focusId)
    .sort((a, b) => urgency(a) - urgency(b) || String(a.follow_up_date ?? "9").localeCompare(String(b.follow_up_date ?? "9")));
  const hiddenClosed = (cur === "mine" ? mine : follow).filter((g) => !OPEN.includes(g.status)).length;

  return (
    <div className="space-y-5">
      <div>
        <Link to={boss ? "/performance" : "/my-performance"} className="text-xs text-muted hover:underline">الأداء الوظيفي ← خطط التطوير</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">خطط التطوير</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          توصية من زيارة الدعم أو تقييم الأداء ← خطة يكتبها المعلم ويعتمدها الزائر ← متابعة في موعدها ← أثر يُقاس آليًا
          من درجة البند نفسه في الزيارة التالية. وما لم يتحسّن تُفتح له دورة ثانية بدعم أعلى.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t.k} className={pill(cur === t.k)} onClick={() => { setTab(t.k); setParams({}, { replace: true }); }}>{t.t}</button>
          ))}
        </div>
      )}

      {!tabs.length && !err ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا توصيات تطوير بعد. تظهر هنا حين يؤكد الزائر توصية في زيارة الدعم أو تقييم الأداء.</p>
      ) : cur === "board" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => printBoard(yearRows, quizRows, year)}>طباعة التقرير</button>
            <button className="btn-ghost" disabled={!yearRows.length} onClick={() => excelBoard(yearRows, year)}>تصدير Excel</button>
          </div>
          <Board rows={yearRows} onPick={(g) => { setTab("follow"); setParams({ g: g.id }, { replace: true }); }} />
          <QuizBoard rows={quizRows} />
        </div>
      ) : (
        <div className="space-y-3">
          {cur === "mine" && (
            <button className="btn-ghost" onClick={() => printRecord(mine.filter((g) => !g.academic_year || g.academic_year === year),
              mine[0]?.teacher?.full_name ?? "", year)}>طباعة سجل التطوير</button>
          )}
          {list.length === 0 && <p className="card px-4 py-6 text-center text-sm text-muted">لا خطط مفتوحة هنا.</p>}
          {list.map((g) => <Goal key={g.id} g={g} uid={uid} boss={boss} onDone={load} focus={g.id === focusId} />)}
          {hiddenClosed > 0 && (
            <button className="text-sm text-mint-deep underline" onClick={() => setShowClosed((v) => !v)}>
              {showClosed ? "إخفاء المغلقة" : `عرض المغلقة والملغاة (${hiddenClosed})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
