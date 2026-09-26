// src/pages/QuizTake.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { groupQuestions } from "../lib/omrLayout.js";

/* =====================================================================
   الاختبار الإلكتروني — صفحة الطالب (/quiz/:id).
   • يبدأ الطالب متى شاء داخل نافذة الاختبار، ويُحسب وقته من لحظة البدء.
   • الإجابات تُحفظ على الجهاز فورًا وفي الخادم كل ثانيتين تقريبًا،
     فلا تضيع لو انقطع الاتصال أو أُغلق المتصفح.
   • يُسلَّم تلقائيًا عند انتهاء الوقت، ولا يُسلَّم إلا مرة واحدة.
   • الأسئلة تصل بلا إجاباتها الصحيحة، والتصحيح يتم في الخادم.
   ===================================================================== */

const AR = { ltrs: ["أ", "ب", "ج", "د", "هـ"], tf: [["true", "صح"], ["false", "خطأ"]], q: "س", f: "ف",
  kinds: { mcq: "اختر الإجابة الصحيحة", truefalse: "صح أم خطأ", match: "زاوج بين العمودين" } };
const EN = { ltrs: ["A", "B", "C", "D", "E"], tf: [["true", "True"], ["false", "False"]], q: "Q", f: "P",
  kinds: { mcq: "Choose the correct answer", truefalse: "True or False", match: "Match column A with column B" } };

const lsKey = (id) => `online-quiz:${id}`;
const lsGet = (id) => { try { return JSON.parse(localStorage.getItem(lsKey(id)) || "null"); } catch { return null; } };
const lsSet = (id, v) => { try { localStorage.setItem(lsKey(id), JSON.stringify(v)); } catch { /* */ } };
const lsDel = (id) => { try { localStorage.removeItem(lsKey(id)); } catch { /* */ } };

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
};

const answered = (q, a) => {
  if (a == null) return false;
  if (q.kind !== "match") return true;
  const n = (q.options?.left ?? []).length;
  return n > 0 && Object.values(a).filter((v) => v !== "" && v != null).length >= n;
};

export default function QuizTake() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState("idle");       // idle | saving | saved | offline
  const offset = useRef(0);                          // فرق ساعة الجهاز عن الخادم
  const submitting = useRef(false);
  const lastAuto = useRef(0);
  const saveTimer = useRef(null);

  const apply = useCallback((d) => {
    if (d?.now) offset.current = new Date(d.now).getTime() - Date.now();
    setData(d);
    if (d?.state === "in_progress") {
      const local = lsGet(id);
      setAnswers({ ...(d.attempt?.draft ?? {}), ...(local ?? {}) });
    }
    if (d?.state === "submitted") lsDel(id);
  }, [id]);

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc("get_online_quiz", { p_quiz: id });
    if (error) { setErr(error.message); return; }
    apply(d);
  }, [id, apply]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const serverNow = now + offset.current;
  const state = data?.state;
  const deadline = data?.attempt?.deadline_at ? new Date(data.attempt.deadline_at).getTime() : null;
  const opensAt = data?.online?.opens_at ? new Date(data.online.opens_at).getTime() : null;
  const left = deadline ? deadline - serverNow : null;

  // حين يحين موعد الفتح تتحدّث الصفحة وحدها
  useEffect(() => {
    if (state === "upcoming" && opensAt && serverNow >= opensAt) load();
  }, [state, opensAt, serverNow, load]);

  const submit = useCallback(async (auto = false) => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setErr(null);
    clearTimeout(saveTimer.current);
    const { data: d, error } = await supabase.rpc("submit_online_quiz", { p_quiz: id, p_answers: answers });
    setBusy(false);
    if (error) {
      submitting.current = false;
      setErr(auto ? "انتهى الوقت ولم يصل التسليم — تحقّق من الاتصال، وستُعتمد آخر إجابات محفوظة."
                  : `تعذّر التسليم: ${error.message}`);
      return;
    }
    apply(d);
  }, [id, answers, apply]);

  // التسليم التلقائي عند انتهاء الوقت
  useEffect(() => {
    if (state !== "in_progress" || left == null || left > 0) return;
    if (Date.now() - lastAuto.current < 5000) return;     // إعادة المحاولة كل ٥ ثوانٍ عند انقطاع الاتصال
    lastAuto.current = Date.now();
    submit(true);
  }, [state, left, submit]);

  // تنبيه عند مغادرة الصفحة أثناء الاختبار
  useEffect(() => {
    if (state !== "in_progress") return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state]);

  const setAnswer = (qid, v) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: v };
      lsSet(id, next);
      clearTimeout(saveTimer.current);
      setSaved("saving");
      saveTimer.current = setTimeout(async () => {
        const { data: ok, error } = await supabase.rpc("save_online_draft", { p_quiz: id, p_answers: next });
        setSaved(error ? "offline" : ok ? "saved" : "idle");
      }, 1500);
      return next;
    });
  };

  const start = async () => {
    if (!window.confirm("بمجرد البدء يبدأ العدّ التنازلي ولا يتوقف حتى لو خرجت من الصفحة.\n\nهل أنت مستعد؟")) return;
    setBusy(true); setErr(null);
    const { data: d, error } = await supabase.rpc("start_online_quiz", { p_quiz: id });
    setBusy(false);
    if (error) { setErr(error.message); load(); return; }
    apply(d);
  };

  const qs = useMemo(() => data?.questions ?? [], [data]);
  const groups = useMemo(() => groupQuestions(qs), [qs]);
  const pending = qs.filter((q) => !answered(q, answers[q.id])).length;
  const ltr = data?.quiz?.lang === "en";
  const t = ltr ? EN : AR;

  if (err && !data) return <Box><p className="text-sm text-absent">{err}</p></Box>;
  if (!data) return <Box><p className="text-sm text-muted">جارٍ التحميل…</p></Box>;

  const head = (
    <div>
      <h1 className="text-lg font-bold text-ink">{data.quiz?.title}</h1>
      <p className="mt-0.5 text-xs text-muted">
        {data.quiz?.subject_name || "اختبار إلكتروني"}
        {data.quiz?.total_marks != null && <> · <bdi className="num">{data.quiz.total_marks}</bdi> درجات</>}
      </p>
    </div>
  );

  if (state === "not_assigned") {
    return (
      <Box>
        <p className="font-semibold text-ink">هذا الاختبار غير مُسند إليك</p>
        <p className="mt-1 text-sm text-muted">الاختبار الإلكتروني يظهر فقط للطلاب الذين اختارهم المعلم.</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">الرئيسية</Link>
      </Box>
    );
  }

  if (state === "upcoming" || state === "open" || state === "closed") {
    return (
      <Box>
        {head}
        <dl className="mt-4 grid gap-2 text-sm">
          <Row k="يُفتح">{fmtDateTime(data.online.opens_at)}</Row>
          <Row k="يُغلق">{fmtDateTime(data.online.closes_at)}</Row>
          <Row k="المدة"><bdi className="num">{data.online.duration_min}</bdi> دقيقة من لحظة البدء</Row>
          <Row k="الأسئلة">تصل عند البدء</Row>
        </dl>
        {data.quiz?.instructions && (
          <p className="mt-3 whitespace-pre-line rounded-card bg-canvas px-3 py-2 text-sm text-ink">
            {data.quiz.instructions}
          </p>
        )}
        {state === "upcoming" && (
          <p className="mt-4 rounded-card bg-warning/10 px-3 py-2 text-sm text-warning">
            لم يُفتح بعد — يُفتح بعد <bdi className="num font-bold">{clock(opensAt - serverNow)}</bdi>
          </p>
        )}
        {state === "closed" && (
          <p className="mt-4 rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">
            انتهى وقت هذا الاختبار ولم تبدأه.
          </p>
        )}
        {state === "open" && (
          <>
            <ul className="mt-4 list-disc space-y-1 pr-5 text-xs leading-relaxed text-muted">
              <li>يبدأ العدّ من لحظة الضغط على «ابدأ الاختبار» ولا يتوقف.</li>
              <li>إجاباتك تُحفظ تلقائيًا، ولو انقطع الاتصال عُد لنفس الرابط وأكمل.</li>
              <li>يُسلَّم الاختبار تلقائيًا عند انتهاء الوقت، ولا يمكن التسليم إلا مرة واحدة.</li>
            </ul>
            <button className="btn-primary mt-4 w-full" disabled={busy} onClick={start}>
              {busy ? "جارٍ البدء…" : "ابدأ الاختبار"}
            </button>
          </>
        )}
        {err && <p className="mt-3 text-sm text-absent">{err}</p>}
      </Box>
    );
  }

  if (state === "submitted") {
    const r = data.result;
    return (
      <Box>
        {head}
        <div className="mt-5 rounded-card bg-present/10 px-4 py-5 text-center">
          <p className="text-base font-bold text-present">تم تسليم الاختبار ✓</p>
          <p className="mt-1 text-xs text-muted">وقت التسليم: {fmtDateTime(data.attempt.submitted_at)}</p>
          {r?.score != null ? (
            <p className="mt-3 text-sm text-ink">
              درجتك: <bdi className="num text-2xl font-bold text-mint-deep">{Number(r.score)}</bdi>
              {" "}من <bdi className="num">{Number(r.total)}</bdi>
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">ستظهر النتيجة بعد أن يعتمدها المعلم.</p>
          )}
        </div>
        <Link to="/" className="btn-primary mt-4 inline-flex w-full justify-center">الرئيسية</Link>
      </Box>
    );
  }

  // ——— المحاولة الجارية ———
  const urgent = left != null && left <= 60000;
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24" dir={ltr ? "ltr" : "rtl"}>
      <div className="sticky top-0 z-20 -mx-1 flex items-center gap-3 rounded-card border border-line bg-white/95 px-3 py-2 shadow-card backdrop-blur" dir="rtl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{data.quiz?.title}</p>
          <p className="text-[11px] text-muted">
            {saved === "saving" ? "جارٍ الحفظ…" : saved === "saved" ? "الإجابات محفوظة" :
             saved === "offline" ? "محفوظة على جهازك — تحقّق من الاتصال" : "أجب ثم اضغط «تسليم»"}
          </p>
        </div>
        <span className={`num rounded-pill px-3 py-1 text-base font-bold ${
          urgent ? "animate-pulse bg-absent text-white" : "bg-mint-tint text-mint-deep"}`}>
          {left != null ? clock(left) : "—"}
        </span>
      </div>

      {groups.map((g, gi) => (
        <section key={g.kind} className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">
            {t.q}<bdi className="num">{gi + 1}</bdi>: {t.kinds[g.kind]}
          </p>
          {g.list.map((q, qi) => (
            <div key={q.id} className="rounded-card border border-line/70 p-3">
              <div className="flex items-start gap-2">
                <span className="num shrink-0 rounded-pill bg-canvas px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {t.f}{qi + 1}
                </span>
                <p className="flex-1 whitespace-pre-line text-sm font-medium leading-relaxed text-ink">{q.text}</p>
                <span className="num shrink-0 text-[11px] text-faint">({Number(q.marks)})</span>
              </div>

              {q.kind === "mcq" && (
                <div className="mt-2 grid gap-1.5">
                  {(q.options ?? []).map((o, k) => {
                    const on = answers[q.id] === String(k);
                    return (
                      <button key={k} type="button" onClick={() => setAnswer(q.id, String(k))}
                        className={`flex items-center gap-2 rounded-card border px-3 py-2 text-start text-sm transition-colors ${
                          on ? "border-mint-deep bg-mint-tint text-ink" : "border-line bg-white text-ink hover:bg-canvas"}`}>
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                          on ? "border-mint-deep bg-mint-deep text-white" : "border-line text-muted"}`}>{t.ltrs[k]}</span>
                        <span className="flex-1">{o}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.kind === "truefalse" && (
                <div className="mt-2 flex gap-2">
                  {t.tf.map(([v, label]) => {
                    const on = answers[q.id] === v;
                    return (
                      <button key={v} type="button" onClick={() => setAnswer(q.id, v)}
                        className={`flex-1 rounded-card border px-3 py-2 text-sm font-semibold transition-colors ${
                          on ? (v === "true" ? "border-present bg-present text-white" : "border-absent bg-absent text-white")
                             : "border-line bg-white text-muted hover:bg-canvas"}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.kind === "match" && (
                <div className="mt-2 space-y-1.5">
                  {(q.options?.left ?? []).map((l, k) => {
                    const cur = (answers[q.id] ?? {})[String(k)] ?? "";
                    return (
                      <div key={k} className="flex items-center gap-2">
                        <span className="num w-5 shrink-0 text-center text-xs font-bold text-muted">{k + 1}</span>
                        <span className="flex-1 rounded-card bg-canvas px-2.5 py-1.5 text-sm text-ink">{l}</span>
                        <select className="field w-auto max-w-[55%] py-1.5 text-sm" value={cur}
                                onChange={(e) => setAnswer(q.id, { ...(answers[q.id] ?? {}), [String(k)]: e.target.value })}>
                          <option value="">{ltr ? "Choose…" : "يقابله…"}</option>
                          {(q.options?.right ?? []).map((r, ri) => (
                            <option key={ri} value={String(ri)}>{t.ltrs[ri] ?? ri + 1}) {r}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent" dir="rtl">{err}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur" dir="rtl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p className="flex-1 text-xs text-muted">
            {pending ? <>بقي <bdi className="num font-bold text-warning">{pending}</bdi> بلا إجابة</> : "أجبت عن كل الأسئلة"}
          </p>
          <button className="btn-primary" disabled={busy}
                  onClick={() => {
                    const msg = pending
                      ? `لم تُجب عن ${pending} ${pending === 1 ? "سؤال" : "أسئلة"}.\nهل تريد التسليم نهائيًا؟`
                      : "تسليم الاختبار نهائيًا؟ لا يمكن التعديل بعده.";
                    if (window.confirm(msg)) submit(false);
                  }}>
            {busy ? "جارٍ التسليم…" : "تسليم"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Box({ children }) {
  return <div className="card mx-auto max-w-lg p-5" dir="rtl">{children}</div>;
}

function Row({ k, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-1.5">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}
