// src/lab-player/OfflineQuiz.jsx
// صفحة الاختبار دون إنترنت على جوال الطالب (mode: "oq"). تُحفظ على الجوال عند تنزيل الاختبار
// من البوابة، ويعرضها sw.js حين لا يتصل (src/lib/offlineQuiz.js):
// ١. يختار الطالب الاختبار المنزّل. ٢. يمسح مفتاح الفتح من السبورة أو يكتبه، فتُفك الأسئلة
// ويبدأ الوقت. ٣. عند التسليم أو انتهاء الوقت يظهر رمز QR بإجاباته يمسحه المعلم.
// الإجابات الصحيحة ليست على الجوال؛ التصحيح عند المسح في البوابة.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import LabScanner from "../pages/lab/LabScanner.jsx";
import { groupQuestions } from "../lib/omrLayout.js";
import { decryptPackage, fmtKey, listPackages, loadAttempt, normKey, saveAttempt, shuffled, submitCode } from "../lib/offlineQuiz.js";
import logoIcon from "../assets/icon-mint.png";

const AR = { ltrs: ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن"], tf: [["true", "صح"], ["false", "خطأ"]], q: "س", f: "ف",
  kinds: { mcq: "اختر الإجابة الصحيحة", truefalse: "صح أم خطأ", match: "زاوج بين العمودين" }, listen: "الاستماع — استمع للمقطع ثم أجب" };
const EN = { ltrs: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"], tf: [["true", "True"], ["false", "False"]], q: "Q", f: "P",
  kinds: { mcq: "Choose the correct answer", truefalse: "True or False", match: "Match column A with column B" }, listen: "Listening — listen to the audio, then answer" };

const filled = (v) => v != null && String(v).trim() !== "";
const matchRows = (q) => (q.options?.left ?? []).map((l, k) => k).filter((k) => filled(q.options.left[k]));
const answered = (q, a) => q.kind === "match" ? (!matchRows(q).length || (!!a && matchRows(q).every((k) => filled(a[String(k)])))) : a != null;
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000)), p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 60))}:${p(s % 60)}`;
};

function Head({ title, sub }) {
  return (
    <header className="flex items-center gap-3 border-b border-line pb-3">
      <img src={logoIcon} alt="" className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{sub ?? "مدرسة مكة الثانوية · اختبار دون إنترنت"}</p>
        <p className="truncate text-base font-bold text-ink">{title}</p>
      </div>
    </header>
  );
}

export default function OfflineQuiz({ data }) {
  const [recs, setRecs] = useState(null);
  const [pick, setPick] = useState(null);
  useEffect(() => {
    listPackages().then((l) => {
      l.sort((a, b) => (b.downloaded_at ?? "").localeCompare(a.downloaded_at ?? ""));
      setRecs(l);
      if (l.length === 1) setPick(l[0]);
    }).catch(() => setRecs([]));
  }, []);

  if (pick) return <QuizRun rec={pick} origin={data.origin} onBack={recs?.length > 1 ? () => setPick(null) : null} />;
  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-4 p-4">
      <Head title="الاختبارات المنزّلة" />
      {recs == null ? <p className="text-sm text-muted">…</p>
        : !recs.length ? (
          <div className="card space-y-2 p-4 text-sm leading-relaxed">
            <p className="font-bold text-ink">لا توجد اختبارات منزّلة على هذا الجوال</p>
            <p className="text-muted">نزّل الاختبار من صفحته في البوابة وأنت متصل بالإنترنت، ثم افتح البوابة في الحصة ولو دون إنترنت.</p>
          </div>
        ) : recs.map((r) => {
          const at = loadAttempt(r);
          return (
            <button key={r.quiz_id} type="button" onClick={() => setPick(r)}
                    className="card flex w-full items-center gap-3 p-4 text-start hover:bg-canvas">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">{r.title}</span>
                <span className="text-xs text-muted">{r.subject ? `${r.subject} · ` : ""}{r.student}</span>
              </span>
              <span className={`chip ${at?.done ? "bg-present/10 text-present" : at?.started ? "bg-warning/10 text-warning" : "bg-mint-tint text-mint-deep"}`}>
                {at?.done ? "سُلّم — رمز التسليم" : at?.started ? "جارٍ" : "لم يبدأ"}
              </span>
            </button>
          );
        })}
    </div>
  );
}

function QuizRun({ rec, origin, onBack }) {
  const [at, setAt] = useState(() => loadAttempt(rec) ?? {});
  const [pkg, setPkg] = useState(null);
  const update = useCallback((fn) => setAt((p) => { const n = typeof fn === "function" ? fn(p) : fn; saveAttempt(rec, n); return n; }), [rec]);

  // بعد إعادة فتح الصفحة: تُفك الحزمة بالمفتاح المحفوظ
  useEffect(() => {
    if (at.key && !pkg) decryptPackage(rec.package, at.key).then(setPkg).catch(() => update((p) => ({ ...p, key: null })));
  }, [at.key, pkg, rec, update]);

  if (at.done) return <Submitted rec={rec} at={at} onBack={onBack} />;
  if (!at.key || !pkg) return <Unlock rec={rec} onBack={onBack} onOpen={(key, p) => { setPkg(p); update((x) => ({ ...x, key, started: x.started ?? Date.now(), answers: x.answers ?? {}, leaves: x.leaves ?? 0 })); }} />;
  return <Taking rec={rec} pkg={pkg} at={at} update={update} origin={origin} />;
}

function Unlock({ rec, onOpen, onBack }) {
  const [scan, setScan] = useState(false);
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const tryKey = async (raw) => {
    const key = normKey(raw);
    if (key.length < 16) { setErr("المفتاح 16 حرفًا ورقمًا — اكتبه كما على السبورة."); return; }
    setBusy(true); setErr("");
    try {
      const p = await decryptPackage(rec.package, key);
      setScan(false);
      if (window.confirm(`فتح «${rec.title}»؟\n\nيبدأ الوقت (${rec.duration_min} دقيقة) الآن ولا يتوقف.\n\nأتعهّد بعدم تصوير الاختبار أو نشره.`)) onOpen(key, p);
    } catch {
      setErr("المفتاح غير صحيح لهذا الاختبار. إن كان صحيحًا فقد تكون نسختك قديمة — أخبر معلمك.");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-4 p-4">
      <Head title={rec.title} />
      <div className="card space-y-3 p-4">
        <dl className="grid gap-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted">الطالب</dt><dd className="font-semibold text-ink">{rec.student}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">المدة</dt><dd className="text-ink"><bdi className="num">{rec.duration_min}</bdi> دقيقة</dd></div>
          {rec.total != null && <div className="flex justify-between"><dt className="text-muted">الدرجة</dt><dd className="num text-ink">{Number(rec.total)}</dd></div>}
        </dl>
        {rec.instructions && <p className="whitespace-pre-line rounded-card bg-canvas px-3 py-2 text-sm text-ink">{rec.instructions}</p>}
        <p className="rounded-card bg-mint-tint px-3 py-2 text-sm leading-relaxed text-ink">
          الأسئلة محفوظة على جوالك مقفلة. يفتحها <b>مفتاح الفتح</b> الذي يعرضه معلمك على السبورة في الحصة.
        </p>
        {scan ? (
          <>
            <LabScanner onCode={tryKey} deniedText="لم يُسمح باستخدام الكاميرا — اكتب المفتاح بدلًا من ذلك." />
            <button type="button" className="btn-ghost w-full" onClick={() => setScan(false)}>إلغاء المسح</button>
          </>
        ) : (
          <button type="button" className="btn-primary w-full" onClick={() => { setErr(""); setScan(true); }}>مسح مفتاح الفتح من السبورة</button>
        )}
        <div className="flex gap-2">
          <input className="field num flex-1 text-center tracking-widest" dir="ltr" placeholder="XXXX-XXXX-XXXX-XXXX"
                 value={txt} onChange={(e) => setTxt(fmtKey(e.target.value).slice(0, 19))} autoCapitalize="characters" autoComplete="off" />
          <button type="button" className="btn-primary" disabled={busy || !txt} onClick={() => tryKey(txt)}>فتح</button>
        </div>
        {err && <p className="rounded-card bg-danger-light px-3 py-2 text-sm text-absent">{err}</p>}
      </div>
      {onBack && <button type="button" className="text-xs text-muted underline" onClick={onBack}>اختبار آخر</button>}
    </div>
  );
}

function Taking({ rec, pkg, at, update, origin }) {
  const t = rec.lang === "en" ? EN : AR;
  const [now, setNow] = useState(Date.now());
  const [away, setAway] = useState(false);
  const awayRef = useRef(false);
  const [showMissing, setShowMissing] = useState(false);
  const answers = at.answers ?? {};
  const deadline = at.started + rec.duration_min * 60000;
  const left = deadline - now;

  const finish = useCallback(() => update((p) => {
    if (p.done) return p;
    const minutes = Math.max(1, Math.round((Date.now() - p.started) / 60000));
    const code = submitCode({ origin, assignment: rec.assignment, ver: rec.ver, token: rec.token,
      qs: pkg.qs, answers: p.answers ?? {}, leaves: p.leaves ?? 0, minutes });
    return { ...p, done: true, doneAt: Date.now(), code, minutes };
  }), [update, origin, rec, pkg]);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (left <= 0) finish(); }, [left, finish]);

  // تُخفى الأسئلة حين يغادر الطالب الصفحة، وتُعدّ مرات المغادرة في رمز التسليم
  useEffect(() => {
    const go = () => {
      if (!awayRef.current) update((p) => ({ ...p, leaves: (p.leaves ?? 0) + 1 }));
      awayRef.current = true; setAway(true);
    };
    const hide = () => { if (document.activeElement?.tagName !== "SELECT") go(); };
    const vis = () => { if (document.hidden) go(); };
    const block = (e) => e.preventDefault();
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("copy", block);
    document.addEventListener("contextmenu", block);
    return () => {
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", vis);
      document.removeEventListener("copy", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [update]);

  const setAnswer = useCallback((qid, v) => update((p) => {
    const prev = p.answers ?? {};
    return { ...p, answers: { ...prev, [qid]: typeof v === "function" ? v(prev[qid]) : v } };
  }), [update]);
  const pickMatch = useCallback((qid, k, v) =>
    setAnswer(qid, (prev) => ({ ...(prev && typeof prev === "object" ? prev : {}), [String(k)]: v })), [setAnswer]);

  const qs = pkg.qs;
  const listenGroups = useMemo(() => groupQuestions(qs.filter((q) => q.listening)), [qs]);
  const groups = useMemo(() => groupQuestions(qs.filter((q) => !q.listening)), [qs]);
  const missing = useMemo(() => qs.filter((q) => !answered(q, answers[q.id])), [qs, answers]);
  const seed = rec.student_id;

  const renderQ = (q, qi) => (
    <div key={q.id} id={`q-${q.id}`} className={`rounded-card border p-3 ${showMissing && !answered(q, answers[q.id]) ? "border-warning bg-warning-light/60" : "border-line/70"}`}>
      <div className="flex items-start gap-2">
        <span className="num shrink-0 rounded-pill bg-canvas px-2 py-0.5 text-[11px] font-semibold text-muted">{t.f}{qi + 1}</span>
        <p className="flex-1 whitespace-pre-line text-sm font-medium leading-relaxed text-ink">{q.text}</p>
        <span className="num shrink-0 text-[11px] text-faint">({Number(q.marks)})</span>
      </div>
      {q.img && <div className="mt-2 grid place-items-center rounded-card border border-line/70 bg-white p-2"><img src={q.img} alt="" className="max-h-[60vh] max-w-full object-contain" /></div>}
      {q.kind === "mcq" && (
        <div className="mt-2 grid gap-1.5">
          {shuffled((q.options ?? []).length, `${seed}:${q.id}`).map((k, pos) => {
            const on = answers[q.id] === String(k);
            return (
              <button key={k} type="button" onClick={() => setAnswer(q.id, String(k))}
                className={`flex items-center gap-2 rounded-card border px-3 py-2 text-start text-sm ${on ? "border-mint-deep bg-mint-tint" : "border-line bg-white"} text-ink`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${on ? "border-mint-deep bg-mint-deep text-white" : "border-line text-muted"}`}>{t.ltrs[pos]}</span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                  {q.optImgs?.[k] && <img src={q.optImgs[k]} alt="" className="max-h-40 max-w-full rounded-[6px] object-contain" />}
                  {q.options[k] && <span>{q.options[k]}</span>}
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
                className={`flex-1 rounded-card border px-3 py-2 text-sm font-semibold ${on ? (v === "true" ? "border-present bg-present text-white" : "border-absent bg-absent text-white") : "border-line bg-white text-muted"}`}>
                {label}
              </button>
            );
          })}
        </div>
      )}
      {q.kind === "match" && (
        <div className="mt-2 space-y-1.5">
          {matchRows(q).map((k, row) => {
            const cur = (answers[q.id] ?? {})[String(k)] ?? "";
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="num w-5 shrink-0 text-center text-xs font-bold text-muted">{row + 1}</span>
                <span className={`flex-1 rounded-card px-2.5 py-1.5 text-sm text-ink ${filled(cur) ? "bg-mint-tint ring-1 ring-mint-deep/40" : "bg-canvas"}`}>{q.options.left[k]}</span>
                <MatchSelect q={q} k={k} cur={cur} ltrs={t.ltrs} seed={`${seed}:${q.id}:r`} placeholder={rec.lang === "en" ? "Choose…" : "يقابله…"} onPick={pickMatch} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="140"><text x="130" y="75" text-anchor="middle" transform="rotate(-25 130 70)" font-family="Tahoma, sans-serif" font-size="14" fill="#101010" fill-opacity="0.09">${(rec.student ?? "").replace(/[<&>"]/g, "")}</text></svg>`;
  return (
    <div className="mx-auto max-w-2xl select-none space-y-4 p-3 pb-28" dir={rec.lang === "en" ? "ltr" : "rtl"} style={{ WebkitTouchCallout: "none" }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-30" style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` }} />
      {away && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-paper p-6" dir="rtl">
          <div className="max-w-sm text-center">
            <p className="text-base font-bold text-ink">الأسئلة مخفية</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">تُخفى الأسئلة حين تغادر صفحة الاختبار، ويرى معلمك عدد مرات المغادرة. الوقت مستمر وإجاباتك محفوظة.</p>
            <button className="btn-primary mt-4 w-full" onClick={() => { awayRef.current = false; setAway(false); }}>العودة للاختبار</button>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-20 flex items-center gap-3 rounded-card border border-line bg-white/95 px-3 py-2 shadow-card" dir="rtl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{rec.title}</p>
          <p className="text-[11px] text-muted">إجاباتك محفوظة على جوالك · {rec.student}</p>
        </div>
        <span className={`num rounded-pill px-3 py-1 text-base font-bold ${left <= 60000 ? "animate-pulse bg-absent text-white" : "bg-mint-tint text-mint-deep"}`}>{clock(left)}</span>
      </div>

      {listenGroups.length > 0 && (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">{t.q}<bdi className="num">1</bdi>: {t.listen}</p>
          {pkg.audio && <audio controls preload="auto" src={pkg.audio} className="w-full" controlsList="nodownload" />}
          {listenGroups.map((g) => <div key={g.kind} className="space-y-3">{g.list.map(renderQ)}</div>)}
        </section>
      )}
      {groups.map((g, gi) => (
        <section key={g.kind} className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">{t.q}<bdi className="num">{gi + 1 + (listenGroups.length ? 1 : 0)}</bdi>: {t.kinds[g.kind]}</p>
          {g.list.map(renderQ)}
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-[35] border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" dir="rtl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p className="flex-1 text-xs text-muted">
            {missing.length ? <>بقي <bdi className="num font-bold text-warning">{missing.length}</bdi> بلا إجابة</> : "أجبت عن كل الأسئلة"}
          </p>
          <button className={`btn-primary ${missing.length ? "opacity-60" : ""}`} onClick={() => {
            if (missing.length) {
              setShowMissing(true);
              document.getElementById(`q-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            if (window.confirm("تسليم الاختبار نهائيًا؟ لا يمكن التعديل بعده.")) finish();
          }}>تسليم</button>
        </div>
      </div>
    </div>
  );
}

const MatchSelect = memo(function MatchSelect({ q, k, cur, ltrs, seed, placeholder, onPick }) {
  const right = q.options?.right ?? [];
  const order = useMemo(() => shuffled(right.length, seed).filter((ri) => filled(right[ri])), [right, seed]);
  return (
    <select className={`field w-auto max-w-[55%] py-1.5 text-sm ${filled(cur) ? "border-mint-deep bg-mint-tint font-semibold" : ""}`}
            value={cur} onChange={(e) => onPick(q.id, k, e.target.value)}>
      <option value="">{placeholder}</option>
      {order.map((ri, pos) => <option key={ri} value={String(ri)}>{ltrs[pos] ?? pos + 1}) {right[ri]}</option>)}
    </select>
  );
});

function Submitted({ rec, at, onBack }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(at.code, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setSrc); }, [at.code]);
  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-4 p-4">
      <Head title={rec.title} />
      <div className="card space-y-3 p-5 text-center">
        <p className="text-base font-bold text-present">تم تسليم الاختبار ✓</p>
        <p className="text-sm font-semibold text-ink">{rec.student}</p>
        {src && <img src={src} alt="رمز التسليم" className="mx-auto w-72 max-w-full" />}
        <p className="rounded-card bg-mint-tint px-3 py-2 text-sm leading-relaxed text-ink">
          اعرض هذا الرمز على معلمك ليمسحه، فتُصحَّح إجاباتك وتُرصد درجتك. لا تغلق الصفحة قبل المسح، ويمكنك فتحها مرة أخرى في أي وقت.
        </p>
        <p className="text-xs text-muted">مدة الأداء: <bdi className="num">{at.minutes}</bdi> دقيقة</p>
      </div>
      {onBack && <button type="button" className="text-xs text-muted underline" onClick={onBack}>اختبار آخر</button>}
    </div>
  );
}
