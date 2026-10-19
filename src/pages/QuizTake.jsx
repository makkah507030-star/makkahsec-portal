// src/pages/QuizTake.jsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { groupQuestions } from "../lib/omrLayout.js";
import Loader from "../components/Loader.jsx";
import { useSession } from "../lib/session.jsx";
import { shuffled } from "../lib/offlineQuiz.js";
import OfflineQuizDownload from "../components/OfflineQuizDownload.jsx";

/* =====================================================================
   الاختبار الإلكتروني — صفحة الطالب (/quiz/:id).
   • يبدأ الطالب متى شاء داخل نافذة الاختبار، ويُحسب وقته من لحظة البدء.
   • الإجابات تُحفظ على الجهاز فورًا وفي الخادم كل ثانيتين تقريبًا،
     فلا تضيع لو انقطع الاتصال أو أُغلق المتصفح.
   • يُسلَّم تلقائيًا عند انتهاء الوقت، ولا يُسلَّم إلا مرة واحدة.
   • الأسئلة تصل بلا إجاباتها الصحيحة، والتصحيح يتم في الخادم.
   • الحدّ من تسريب الأسئلة بالتصوير (المتصفح لا يمنعه فعليًا): علامة مائية
     باسم الطالب وهويته تكشف مصدر أي صورة، وإخفاء الأسئلة حين يغادر الطالب
     الصفحة، ومنع النسخ والطباعة، وترتيب للخيارات يختلف من طالب لآخر.
   ===================================================================== */

const AR = { ltrs: ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن"], tf: [["true", "صح"], ["false", "خطأ"]], q: "س", f: "ف",
  kinds: { mcq: "اختر الإجابة الصحيحة", truefalse: "صح أم خطأ", match: "زاوج بين العمودين" },
  listen: "الاستماع — استمع للمقطع ثم أجب", noAudio: "تعذّر تحميل المقطع الصوتي — حدّث الصفحة." };
const EN = { ltrs: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"], tf: [["true", "True"], ["false", "False"]], q: "Q", f: "P",
  kinds: { mcq: "Choose the correct answer", truefalse: "True or False", match: "Match column A with column B" },
  listen: "Listening — listen to the audio, then answer", noAudio: "The audio could not be loaded — refresh the page." };

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

// علامة مائية متكررة باسم الطالب وهويته تغطي الصفحة
function Watermark({ text }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="140">` +
    `<text x="130" y="75" text-anchor="middle" transform="rotate(-25 130 70)" ` +
    `font-family="IBM Plex Sans Arabic, Tahoma, sans-serif" font-size="14" fill="#101010" fill-opacity="0.09">` +
    `${text.replace(/[<&>"]/g, "")}</text></svg>`;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-30"
         style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` }} />
  );
}

// المزاوجة: الأسطر الفارغة في العمودين (زوج أُضيف ولم يُكتب، أو قيمة null من الحفظ)
// لا تُعرض ولا تُطلب — كانت تُبقي السؤال «بلا إجابة» فلا يُقبل التسليم
const filled = (v) => v != null && String(v).trim() !== "";
const matchRows = (q) => (q.options?.left ?? []).map((l, k) => k).filter((k) => filled(q.options.left[k]));

const answered = (q, a) => {
  if (q.kind === "match") {
    const rows = matchRows(q);
    if (!rows.length) return true;
    return !!a && rows.every((k) => filled(a[String(k)]));
  }
  return a != null;
};

export default function QuizTake() {
  const { id } = useParams();
  const { profile } = useSession();
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

  // الاختبار دون إنترنت (supabase/quiz_offline_2.sql): يُنزَّل هنا ولا يُبدأ من البوابة
  const [off, setOff] = useState(undefined);   // undefined = تحميل
  const loadOff = useCallback(() => {
    supabase.rpc("quiz_offline_available", { p_quiz: id }).then(({ data: d }) => setOff(d ?? null));
  }, [id]);
  useEffect(() => { loadOff(); }, [loadOff]);

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

  // تُخفى الأسئلة حين يغادر الطالب الصفحة أو التطبيق (أداة تصوير، تطبيق آخر، تقسيم الشاشة)
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (state !== "in_progress") return;
    // قائمة «يقابله…» المفتوحة في المزاوجة قد تُفقد النافذة تركيزها على بعض الأجهزة
    const hide = () => { if (document.activeElement?.tagName !== "SELECT") setAway(true); };
    const vis = () => { if (document.hidden) setAway(true); };
    // زر تصوير الشاشة في ويندوز: تُخفى الأسئلة ويُفرَّغ ما نُسخ
    const key = (e) => {
      if (e.key === "PrintScreen") { setAway(true); navigator.clipboard?.writeText("").catch(() => {}); }
      if ((e.ctrlKey || e.metaKey) && ["p", "s", "c"].includes(e.key?.toLowerCase())) e.preventDefault();
    };
    const block = (e) => e.preventDefault();
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("keyup", key);
    window.addEventListener("keydown", key);
    document.addEventListener("copy", block);
    document.addEventListener("contextmenu", block);
    return () => {
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("keyup", key);
      window.removeEventListener("keydown", key);
      document.removeEventListener("copy", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [state]);

  // v قيمة أو دالة تُحسب من الإجابة السابقة (للمزاوجة: تُضاف الفقرة إلى آخر حالة لا إلى نسخة قديمة)
  const setAnswer = useCallback((qid, v) => {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: typeof v === "function" ? v(prev[qid]) : v };
      lsSet(id, next);
      clearTimeout(saveTimer.current);
      setSaved("saving");
      saveTimer.current = setTimeout(async () => {
        const { data: ok, error } = await supabase.rpc("save_online_draft", { p_quiz: id, p_answers: next });
        setSaved(error ? "offline" : ok ? "saved" : "idle");
      }, 1500);
      return next;
    });
  }, [id]);
  const pickMatch = useCallback((qid, k, v) =>
    setAnswer(qid, (prev) => ({ ...(prev && typeof prev === "object" ? prev : {}), [String(k)]: v })), [setAnswer]);

  const start = async () => {
    if (!window.confirm("بمجرد البدء يبدأ العدّ التنازلي ولا يتوقف حتى لو خرجت من الصفحة.\n\nأتعهّد بعدم تصوير الاختبار أو نشره.\n\nهل أنت مستعد؟")) return;
    setBusy(true); setErr(null);
    const { data: d, error } = await supabase.rpc("start_online_quiz", { p_quiz: id });
    setBusy(false);
    if (error) { setErr(error.message); load(); return; }
    apply(d);
  };

  const qs = useMemo(() => data?.questions ?? [], [data]);
  // أسئلة الاستماع قسم مستقل أولًا مع المقطع الصوتي، ثم بقية الأسئلة بحسب نوعها
  const listenGroups = useMemo(() => groupQuestions(qs.filter((q) => q.listening)), [qs]);
  const groups = useMemo(() => groupQuestions(qs.filter((q) => !q.listening)), [qs]);
  const audioPath = data?.quiz?.listening_audio;
  const [audioUrl, setAudioUrl] = useState(undefined);   // undefined = تحميل، null = تعذّر
  useEffect(() => {
    if (state !== "in_progress" || !audioPath) return;
    supabase.storage.from("quiz-audio").createSignedUrl(audioPath, 3 * 3600)
      .then(({ data: d }) => setAudioUrl(d?.signedUrl ?? null));
  }, [state, audioPath]);
  // صور الأسئلة والخيارات: مخزن خاص يفتحه للطالب بدء المحاولة، فتُعرض بروابط مؤقتة
  const [imgs, setImgs] = useState({});
  useEffect(() => {
    if (state !== "in_progress") return;
    const paths = [...new Set(qs.flatMap((q) => [q.image_path, ...(q.option_images ?? [])]).filter(Boolean))];
    if (!paths.length) return;
    supabase.storage.from("quiz-images").createSignedUrls(paths, 3 * 3600).then(({ data: d }) => {
      setImgs(Object.fromEntries((d ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path, x.signedUrl])));
    });
  }, [state, qs]);
  const ltr = data?.quiz?.lang === "en";
  const t = ltr ? EN : AR;
  // الأسئلة الناقصة بترتيب ظهورها، وعنوان كل منها كما يراه الطالب: «س2 ف3» أو «Q2 P3»
  const missing = useMemo(() => {
    const out = [];
    const add = (list, no) => list.forEach((q, qi) => {
      if (!answered(q, answers[q.id])) out.push({ id: q.id, label: `${t.q}${no} ${t.f}${qi + 1}` });
    });
    listenGroups.forEach((g) => add(g.list, 1));
    groups.forEach((g, gi) => add(g.list, gi + 1 + (listenGroups.length ? 1 : 0)));
    return out;
  }, [listenGroups, groups, answers, t]);
  const pending = missing.length;
  const [showMissing, setShowMissing] = useState(false);

  if (err && !data) return <Box><p className="text-sm text-absent">{err}</p></Box>;
  if (!data) return <Box><Loader compact /></Box>;

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

  if (off === undefined && (state === "upcoming" || state === "open")) return <Box><Loader compact /></Box>;
  if (off?.offline && (state === "upcoming" || state === "open" || state === "closed")) {
    return (
      <Box>
        {head}
        <dl className="mt-4 grid gap-2 text-sm">
          <Row k="آخر موعد للتنزيل">{fmtDateTime(data.online.closes_at)}</Row>
          <Row k="المدة"><bdi className="num">{data.online.duration_min}</bdi> دقيقة من فتحه في الحصة</Row>
        </dl>
        {data.quiz?.instructions && (
          <p className="mt-3 whitespace-pre-line rounded-card bg-canvas px-3 py-2 text-sm text-ink">{data.quiz.instructions}</p>
        )}
        {state === "closed" ? (
          <p className="mt-4 rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">انتهى وقت هذا الاختبار.</p>
        ) : off.available ? (
          <OfflineQuizDownload quizId={id} info={off} online={data.online} onDone={loadOff} />
        ) : (
          <p className="mt-4 rounded-card bg-warning/10 px-3 py-2 text-sm text-warning">لم يجهّز المعلم الاختبار للتنزيل بعد — عُد لاحقًا.</p>
        )}
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
        {state !== "closed" && (
          <div className="mt-4 rounded-card border border-absent/30 bg-danger-light px-3 py-2.5 text-sm leading-relaxed">
            <p className="font-bold text-absent">تنبيه: يُمنع تصوير الاختبار أو نشره</p>
            <p className="mt-1 text-ink">
              يُمنع تصوير أسئلة الاختبار أو تسجيلها بالفيديو أو نسخها أو إرسالها لأي أحد. تظهر على الشاشة
              علامة باسمك ورقم هويتك، فأي صورة تُنشر يُعرف صاحبها، ويُعدّ ذلك غشًّا تُطبَّق عليه لائحة
              السلوك والمواظبة. وتُخفى الأسئلة إن خرجت من صفحة الاختبار.
            </p>
          </div>
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
  const renderQ = (q, qi) => (
    <div key={q.id} id={`q-${q.id}`} className={`scroll-mt-24 rounded-card border p-3 ${
      showMissing && !answered(q, answers[q.id]) ? "border-warning bg-warning-light/60" : "border-line/70"}`}>
      <div className="flex items-start gap-2">
        <span className="num shrink-0 rounded-pill bg-canvas px-2 py-0.5 text-[11px] font-semibold text-muted">
          {t.f}{qi + 1}
        </span>
        <p className="flex-1 whitespace-pre-line text-sm font-medium leading-relaxed text-ink">{q.text}</p>
        <span className="num shrink-0 text-[11px] text-faint">({Number(q.marks)})</span>
      </div>
      {q.image_path && (
        <div className="mt-2 grid place-items-center rounded-card border border-line/70 bg-white p-2">
          {imgs[q.image_path]
            ? <img src={imgs[q.image_path]} alt="" className="max-h-[60vh] max-w-full object-contain" />
            : <span className="py-6 text-xs text-faint">…</span>}
        </div>
      )}

      {q.kind === "mcq" && (
        <div className="mt-2 grid gap-1.5">
          {shuffled((q.options ?? []).length, `${profile?.id}:${q.id}`).map((k, pos) => {
            const o = q.options[k];
            const on = answers[q.id] === String(k);
            return (
              <button key={k} type="button" onClick={() => setAnswer(q.id, String(k))}
                className={`flex items-center gap-2 rounded-card border px-3 py-2 text-start text-sm transition-colors ${
                  on ? "border-mint-deep bg-mint-tint text-ink" : "border-line bg-white text-ink hover:bg-canvas"}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                  on ? "border-mint-deep bg-mint-deep text-white" : "border-line text-muted"}`}>{t.ltrs[pos]}</span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                  {q.option_images?.[k] && (
                    imgs[q.option_images[k]]
                      ? <img src={imgs[q.option_images[k]]} alt="" className="max-h-40 max-w-full rounded-[6px] object-contain" />
                      : <span className="text-xs text-faint">…</span>
                  )}
                  {o && <span>{o}</span>}
                </span>
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
          {matchRows(q).map((k, row) => {
            const l = q.options.left[k];
            const cur = (answers[q.id] ?? {})[String(k)] ?? "";
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="num w-5 shrink-0 text-center text-xs font-bold text-muted">{row + 1}</span>
                <span className={`flex-1 rounded-card px-2.5 py-1.5 text-sm text-ink ${
                  filled(cur) ? "bg-mint-tint ring-1 ring-mint-deep/40" : "bg-canvas"}`}>{l}</span>
                <MatchSelect q={q} k={k} cur={cur} ltrs={t.ltrs} seed={`${profile?.id}:${q.id}:r`}
                             placeholder={ltr ? "Choose…" : "يقابله…"} onPick={pickMatch} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  return (
    <div className="mx-auto max-w-2xl select-none space-y-4 pb-24 print:hidden" dir={ltr ? "ltr" : "rtl"}
         style={{ WebkitTouchCallout: "none" }}>
      <Watermark text={`${profile?.full_name ?? ""} · ${profile?.username ?? ""}`} />
      {away && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-paper p-6" dir="rtl">
          <div className="max-w-sm text-center">
            <p className="text-base font-bold text-ink">الأسئلة مخفية</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              تُخفى الأسئلة حين تغادر صفحة الاختبار. الوقت مستمر، وإجاباتك محفوظة.
            </p>
            <button className="btn-primary mt-4 w-full" onClick={() => setAway(false)}>العودة للاختبار</button>
          </div>
        </div>
      )}
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

      {listenGroups.length > 0 && (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">
            {t.q}<bdi className="num">1</bdi>: {t.listen}
          </p>
          <div className="sticky top-16 z-10 rounded-card border border-mint-light bg-mint-tint p-2">
            {audioUrl ? <audio controls preload="auto" src={audioUrl} className="w-full" controlsList="nodownload" />
              : audioUrl === null || !audioPath ? <p className="px-1 text-xs text-absent">{t.noAudio}</p>
              : <Loader compact />}
          </div>
          {listenGroups.map((g) => (
            <div key={g.kind} className="space-y-3">
              {listenGroups.length > 1 && <p className="text-xs font-semibold text-muted">{t.kinds[g.kind]}</p>}
              {g.list.map((q, qi) => renderQ(q, qi))}
            </div>
          ))}
        </section>
      )}

      {groups.map((g, gi) => (
        <section key={g.kind} className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">
            {t.q}<bdi className="num">{gi + 1 + (listenGroups.length ? 1 : 0)}</bdi>: {t.kinds[g.kind]}
          </p>
          {g.list.map((q, qi) => renderQ(q, qi))}
        </section>
      ))}

      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent" dir="rtl">{err}</p>}

      {/* فوق أي شريط آخر للبوابة، وفوق منطقة الإيماءات أسفل شاشات iPhone */}
      <div className="fixed inset-x-0 bottom-0 z-[35] border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur" dir="rtl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p className="flex-1 text-xs text-muted">
            {pending ? (showMissing
              ? <>أكمل قبل التسليم: <span className="font-bold text-warning">{missing.slice(0, 8).map((m, i) => <span key={m.id}>{i > 0 && "، "}<bdi className="num">{m.label}</bdi></span>)}{pending > 8 ? "…" : ""}</span></>
              : <>بقي <bdi className="num font-bold text-warning">{pending}</bdi> بلا إجابة</>) : "أجبت عن كل الأسئلة"}
          </p>
          {/* لا يُسلَّم يدويًا إلا بعد الإجابة عن كل الأسئلة (وكل فقرات المزاوجة)؛
              أما عند انتهاء الوقت فيُسلَّم تلقائيًا بما فيه */}
          <button className={`btn-primary ${pending ? "opacity-60" : ""}`} disabled={busy}
                  onClick={() => {
                    if (pending) {
                      setShowMissing(true);
                      document.getElementById(`q-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      return;
                    }
                    if (window.confirm("تسليم الاختبار نهائيًا؟ لا يمكن التعديل بعده.")) submit(false);
                  }}>
            {busy ? "جارٍ التسليم…" : "تسليم"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* قائمة «يقابله…» في المزاوجة — مكوّن مستقل لا يُعاد رسمه مع عدّاد الوقت (كل ثانية).
   إعادة الرسم كانت تُرجع القائمة المفتوحة على الجوال إلى قيمتها السابقة، فيظهر للطالب
   اختياره ولا يُحتسب، ويبقى السؤال «بلا إجابة» فلا يُقبل التسليم. */
const MatchSelect = memo(function MatchSelect({ q, k, cur, ltrs, seed, placeholder, onPick }) {
  const right = q.options?.right ?? [];
  const order = useMemo(() => {
    const r = q.options?.right ?? [];
    return shuffled(r.length, seed).filter((ri) => filled(r[ri]));
  }, [q, seed]);
  return (
    <select className={`field w-auto max-w-[55%] py-1.5 text-sm ${filled(cur) ? "border-mint-deep bg-mint-tint font-semibold" : ""}`}
            value={cur} onChange={(e) => onPick(q.id, k, e.target.value)}>
      <option value="">{placeholder}</option>
      {order.map((ri, pos) => (
        <option key={ri} value={String(ri)}>{ltrs[pos] ?? pos + 1}) {right[ri]}</option>
      ))}
    </select>
  );
});

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
