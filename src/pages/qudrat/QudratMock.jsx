// src/pages/qudrat/QudratMock.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CMP, MOCK_SETS, SECS, SKILLS } from "../../qudrat-content/index.js";
import { LETTERS, OptText, Passage, Stem, pctOf } from "./shared.jsx";
import { AskButton } from "./AskTeacher.jsx";

/* =====================================================================
   الاختبار المحاكي في مركز التدريب (القدرات): اختبار تجريبي كامل كما في
   قياس، أربعة أقسام لكل قسم 24 سؤالًا و25 دقيقة، ولا رجوع إلى قسم انتهى.
   داخل القسم يتنقل الطالب ويعلّم الأسئلة للمراجعة. ينتقل القسم وحده عند
   انتهاء وقته. التقدم محفوظ في المتصفح فلا يضيع بتحديث الصفحة.
   في النهاية: الدرجة والقسمان والمهارات والمقارنة بالمحاولة السابقة،
   ومراجعة كل سؤال بطريقة حله. تُحفظ في qudrat_mocks (qudrat_2.sql).
   ===================================================================== */

const storeKey = (uid) => `qudrat.mock.${uid}`;
const load = (uid) => { try { return JSON.parse(localStorage.getItem(storeKey(uid)) ?? "null"); } catch { return null; } };
const keep = (uid, v) => { try { v ? localStorage.setItem(storeKey(uid), JSON.stringify(v)) : localStorage.removeItem(storeKey(uid)); } catch { /* لا شيء */ } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function QudratMock({ uid, bank, mocks, onExit, onDone }) {
  const [st, setSt] = useState(() => load(uid));   // { code, part, answers, flags, ends, startedAt }
  const [result, setResult] = useState(null);
  const set = MOCK_SETS.find((s) => s.code === st?.code);
  const qs = useMemo(() => (st ? bank.filter((q) => q.set === st.code).sort((a, b) => a.n - b.n) : []), [bank, st?.code]);

  const update = (f) => setSt((s) => { const n = typeof f === "function" ? f(s) : f; keep(uid, n); return n; });
  const begin = (code) => update({ code, part: 1, answers: {}, flags: [], ends: Date.now() + MOCK_SETS.find((s) => s.code === code).minutes * 60000, startedAt: Date.now() });
  const quit = () => { if (window.confirm("الخروج يلغي هذه المحاولة. هل تريد الخروج؟")) { keep(uid, null); onExit(); } };

  const finish = async (s) => {
    keep(uid, null);
    const by = {}; let c = 0; const sec = { quant: [0, 0], verbal: [0, 0] };
    qs.forEach((q) => {
      const ok = s.answers[q.key] === q.a;
      const b = (by[q.skill] ??= [0, 0]); b[1] += 1; sec[q.sec][1] += 1;
      if (ok) { c += 1; b[0] += 1; sec[q.sec][0] += 1; }
    });
    const row = {
      set_code: s.code, total: qs.length, correct: c, by_skill: by,
      quant_pct: pctOf(...sec.quant), verbal_pct: pctOf(...sec.verbal),
      answers: Object.fromEntries(qs.filter((q) => s.answers[q.key] != null).map((q) => [q.n, s.answers[q.key]])),
      duration_s: Math.round((Date.now() - s.startedAt) / 1000),
    };
    const prev = mocks[0] ?? null;
    setResult({ row, answers: s.answers, prev, saveErr: "" });
    setSt(null);
    const [{ error }] = await Promise.all([
      supabase.from("qudrat_mocks").insert(row),
      supabase.from("qudrat_answers").insert(qs.filter((q) => s.answers[q.key] != null).map((q) => ({
        qkey: q.key, sec: q.sec, skill: q.skill, correct: s.answers[q.key] === q.a, mode: "mock" }))),
    ]);
    if (error) setResult((r) => ({ ...r, saveErr: /qudrat_mocks/.test(error.message) ? "لم تُحفظ النتيجة: يلزم تشغيل ملف supabase/qudrat_2.sql." : error.message }));
    onDone({ ...row, created_at: new Date().toISOString() });
  };

  if (result) return <MockResult qs={bank.filter((q) => q.set === result.row.set_code).sort((a, b) => a.n - b.n)} {...result} onExit={onExit} />;
  if (!st || !set) return <MockStart mocks={mocks} onBegin={begin} onExit={onExit} />;
  return <MockRun key={st.part} st={st} set={set} qs={qs.filter((q) => q.part === st.part)} update={update} quit={quit}
                  next={() => (st.part < set.parts
                    ? update((s) => ({ ...s, part: s.part + 1, ends: Date.now() + set.minutes * 60000 }))
                    : finish(st))} />;
}

/* ---------- قبل البدء ---------- */
function MockStart({ mocks, onBegin, onExit }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button className="text-sm font-semibold text-muted hover:text-ink" onClick={onExit}>رجوع إلى المركز</button>
      <section className="card px-5 py-5">
        <h1 className="text-lg font-bold text-ink">الاختبار المحاكي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">اختبار كامل بظروف الاختبار الحقيقي، يقيس جاهزيتك ويحدد ما تراجعه.</p>
        <ul className="mt-3 list-disc space-y-1 pr-5 text-sm leading-relaxed text-ink">
          <li>أربعة أقسام، في كل قسم <span className="num">24</span> سؤالًا ووقته <span className="num">25</span> دقيقة.</li>
          <li>تتنقل بين أسئلة القسم وتعلّم ما تريد مراجعته، ولا ترجع إلى قسم انتهى.</li>
          <li>ينتقل القسم تلقائيًا عند انتهاء وقته، فراقب العدّاد.</li>
          <li>لا تظهر الإجابات أثناء الاختبار؛ النتيجة وطرق الحل في النهاية.</li>
          <li>اختر وقتًا هادئًا تقارب فيه ساعتين دون انقطاع.</li>
        </ul>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {MOCK_SETS.map((s) => {
          const tries = mocks.filter((m) => m.set_code === s.code);
          const best = tries.length ? Math.max(...tries.map((m) => pctOf(m.correct, m.total))) : null;
          return (
            <button key={s.code} className="card px-4 py-4 text-right transition-colors hover:border-mint" onClick={() => onBegin(s.code)}>
              <p className="font-bold text-ink">{s.t}</p>
              <p className="mt-1 text-xs text-muted">
                {tries.length ? <>أديته <span className="num">{tries.length}</span> {tries.length === 1 ? "مرة" : "مرات"} · أفضل نتيجة <span className="num">{best}%</span></> : "لم تؤدّه بعد"}
              </p>
              <span className="btn-primary mt-3 w-full">ابدأ</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- قسم جارٍ ---------- */
function MockRun({ st, set, qs, update, quit, next }) {
  const [i, setI] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showPassage, setShowPassage] = useState(true);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.round((st.ends - now) / 1000));
  useEffect(() => { if (left === 0) next(); }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = qs[i];
  if (!q) return null;
  const flags = new Set(st.flags);
  const answered = qs.filter((x) => st.answers[x.key] != null).length;
  const opts = q.cmp ? CMP : q.o;
  const go = (k) => { setI(k); if (qs[k]?.passage?.key !== q.passage?.key) setShowPassage(true); window.scrollTo(0, 0); };
  const endPart = () => {
    const miss = qs.length - answered;
    const msg = `${miss ? `بقي ${miss} سؤالًا دون إجابة. ` : ""}${st.part < set.parts ? "إنهاء القسم والانتقال إلى التالي؟ لا رجوع إلى هذا القسم." : "إنهاء الاختبار وعرض النتيجة؟"}`;
    if (window.confirm(msg)) next();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-2 rounded-card border border-line bg-paper/95 px-3 py-2 backdrop-blur">
        <button className="text-xs font-semibold text-muted" onClick={quit}>خروج</button>
        <p className="text-sm text-ink">القسم <span className="num font-bold">{st.part}</span> من <span className="num">{set.parts}</span>
          <span className="text-muted"> · أجبت <span className="num">{answered}</span>/<span className="num">{qs.length}</span></span></p>
        <span className={`num rounded-pill px-2.5 py-1 text-sm font-bold ${left < 180 ? "bg-absent text-white" : "bg-mint-tint text-mint-deep"}`}>{mmss(left)}</span>
      </div>

      {q.passage && <Passage passage={q.passage} open={showPassage} onToggle={() => setShowPassage((x) => !x)} />}

      <section className="card px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-muted">السؤال <span className="num text-ink">{q.n}</span></span>
          <button className={`chip ${flags.has(q.key) ? "bg-late text-white" : "bg-late/10 text-late"}`}
                  onClick={() => update((s) => ({ ...s, flags: flags.has(q.key) ? s.flags.filter((k) => k !== q.key) : [...s.flags, q.key] }))}>
            {flags.has(q.key) ? "معلَّم للمراجعة" : "علّم للمراجعة"}
          </button>
        </div>
        <Stem q={q} />
        <div className="mt-4 grid gap-2">
          {opts.map((o, k) => {
            const on = st.answers[q.key] === k;
            return (
              <button key={k} onClick={() => update((s) => ({ ...s, answers: { ...s.answers, [q.key]: k } }))}
                      className={`flex items-center gap-3 rounded-sm2 border-2 px-3 py-2.5 text-right transition-colors ${on ? "border-mint-deep bg-mint-tint" : "border-line hover:bg-canvas"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${on ? "bg-mint-deep text-white" : "bg-canvas text-ink"}`}>{LETTERS[k]}</span>
                <OptText text={o} />
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" disabled={i === 0} onClick={() => go(i - 1)}>السابق</button>
          {i + 1 < qs.length
            ? <button className="btn-primary flex-1" onClick={() => go(i + 1)}>التالي</button>
            : <button className="btn-primary flex-1" onClick={endPart}>{st.part < set.parts ? "إنهاء القسم" : "إنهاء الاختبار"}</button>}
        </div>
      </section>

      <section className="card px-4 py-3">
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
          {qs.map((x, k) => (
            <button key={x.key} onClick={() => go(k)}
                    className={`num relative rounded-sm2 py-1.5 text-xs font-semibold ${k === i ? "ring-2 ring-mint-deep" : ""} ${
                      st.answers[x.key] != null ? "bg-mint-deep text-white" : "bg-canvas text-ink"}`}>
              {x.n}{flags.has(x.key) && <span className="absolute -top-1 left-0.5 h-2 w-2 rounded-full bg-late" />}
            </button>
          ))}
        </div>
        <button className="mt-3 w-full text-sm font-semibold text-mint-deep" onClick={endPart}>
          {st.part < set.parts ? "إنهاء القسم والانتقال إلى التالي" : "إنهاء الاختبار"}
        </button>
      </section>
    </div>
  );
}

/* ---------- النتيجة والمراجعة ---------- */
function MockResult({ qs, row, answers, prev, saveErr, onExit }) {
  const [only, setOnly] = useState(true);
  const [open, setOpen] = useState(null);
  const p = pctOf(row.correct, row.total);
  const pp = prev ? pctOf(prev.correct, prev.total) : null;
  const list = qs.filter((q) => !only || answers[q.key] !== q.a);
  const line = p >= 85 ? "مستوى ممتاز، حافظ عليه بمراجعة خفيفة." : p >= 70 ? "مستوى جيد جدًا، ركّز على المهارات الأضعف أدناه." : p >= 50 ? "مستوى متوسط، والتدريب على المهارات الأضعف سيرفعه سريعًا." : "بداية، والخطة اليومية ستأخذك خطوة بخطوة.";
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="card px-5 py-6 text-center">
        <p className="text-sm text-muted">نتيجة الاختبار المحاكي</p>
        <p className={`num mt-2 text-5xl font-bold ${p >= 70 ? "text-present" : p >= 50 ? "text-late" : "text-absent"}`}>{p}%</p>
        <p className="mt-1 text-sm text-muted"><span className="num">{row.correct}</span> صحيحة من <span className="num">{row.total}</span> · المدة <span className="num">{Math.round(row.duration_s / 60)}</span> دقيقة</p>
        {pp != null && <p className={`mt-1 text-sm font-semibold ${p >= pp ? "text-present" : "text-absent"}`}>
          {p === pp ? "مثل محاولتك السابقة" : <>{p > pp ? "تحسّن" : "تراجع"} <span className="num">{Math.abs(p - pp)}</span> نقطة عن محاولتك السابقة</>}</p>}
        <p className="mt-3 font-semibold text-ink">{line}</p>
        {saveErr && <p className="mt-2 text-xs text-absent">{saveErr}</p>}
        <p className="mt-2 text-[11px] text-faint">النسبة تقديرية للتدريب، وليست درجة قياس الرسمية.</p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        {[["quant", row.quant_pct], ["verbal", row.verbal_pct]].map(([s, v]) => (
          <div key={s} className="card px-4 py-3 text-center">
            <p className={`num text-2xl font-bold ${SECS[s].c}`}>{v}%</p>
            <p className="text-xs text-muted">القسم {SECS[s].t}</p>
          </div>
        ))}
      </div>
      <section className="card divide-y divide-line/60">
        {Object.entries(row.by_skill).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([k, [c, t]]) => (
          <div key={k} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-40 shrink-0 text-ink">{SKILLS[k]?.t ?? k}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
              <div className={`h-full rounded-full ${pctOf(c, t) >= 65 ? "bg-present" : "bg-late"}`} style={{ width: `${pctOf(c, t)}%` }} />
            </div>
            <span className="num w-14 shrink-0 text-left text-muted">{c}/{t}</span>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ink">مراجعة الأسئلة</h2>
          <button className="text-sm font-semibold text-mint-deep" onClick={() => setOnly((x) => !x)}>{only ? "عرض كل الأسئلة" : "الأخطاء فقط"}</button>
        </div>
        {list.map((q) => {
          const mine = answers[q.key]; const ok = mine === q.a; const opts = q.cmp ? CMP : q.o;
          return (
            <div key={q.key} className="card overflow-hidden">
              <button className="flex w-full items-center gap-3 px-4 py-2.5 text-right" onClick={() => setOpen(open === q.key ? null : q.key)}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${ok ? "bg-present" : "bg-absent"}`}>{q.n}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{q.q}</span>
                <span className="shrink-0 text-xs text-muted">{SKILLS[q.skill]?.t}</span>
              </button>
              {open === q.key && (
                <div className="space-y-2 border-t border-line/60 px-4 py-3">
                  <Stem q={q} />
                  <p className="text-sm"><span className="text-muted">إجابتك: </span>
                    <b className={ok ? "text-present" : "text-absent"}>{mine == null ? "لم تُجب" : `(${LETTERS[mine]}) ${opts[mine]}`}</b></p>
                  {!ok && <p className="text-sm"><span className="text-muted">الصحيحة: </span><b className="text-present">({LETTERS[q.a]}) {opts[q.a]}</b></p>}
                  {q.method && <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm leading-loose text-ink"><b className="text-mint-deep">طريقة الحل: </b>{q.method}</p>}
                  <AskButton q={q} />
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="card px-4 py-6 text-center text-sm text-present">لا أخطاء، أحسنت!</p>}
      </section>
      <button className="btn-primary w-full" onClick={onExit}>العودة إلى المركز</button>
    </div>
  );
}
