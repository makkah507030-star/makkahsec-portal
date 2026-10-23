// src/pages/qudrat/Qudrat.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useBackStep } from "../../lib/backStep";
import { useSession } from "../../lib/session.jsx";
import Loader from "../../components/Loader.jsx";
import { CMP, SECS, SKILLS, SOURCE, fromRow, loadBank } from "../../qudrat-content/index.js";
import { LETTERS, OptText, Passage, Stem, pctOf } from "./shared.jsx";
import { isoDay } from "../../lib/qudratPlan.js";
import QudratPlan from "./QudratPlan.jsx";
import QudratMock from "./QudratMock.jsx";
import QudratResults from "./QudratResults.jsx";
import { AskButton, MyAsks } from "./AskTeacher.jsx";
import SadeedGuide from "./SadeedGuide.jsx";

/* =====================================================================
   مركز التدريب — القدرات العامة (الدفعة الأولى): التدريب الحر بالمهارة.
   الرئيسية: مستوى الحساب في كل مهارة من سجل إجاباته (qudrat_answers)،
   والتدريب: عشرة أسئلة يُقدَّم فيها ما لم يُحَل ثم ما أخطأ فيه.
   شاشة السؤال: التلميح واستراتيجية المهارة قبل الحل، وطريقة الحل بعده.
   مفتوح لكل الصفوف ولكل حساب (supabase/qudrat_1.sql).
   ===================================================================== */

const ROUND = 10;
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const levelOf = (p, t) => (!t ? { t: "لم تبدأ بعد", c: "text-faint" } : t < 5 ? { t: "تدرّب أكثر لنقيس مستواك", c: "text-faint" } : p >= 85 ? { t: "متمكن", c: "text-present" }
  : p >= 65 ? { t: "جيد", c: "text-mint-deep" } : p >= 45 ? { t: "يحتاج تدريبًا", c: "text-late" } : { t: "ابدأ من الأساس", c: "text-absent" });

// عبارات التحفيز بعد كل إجابة
const CHEER = ["إجابة صحيحة، أحسنت!", "ممتاز، استمر!", "رائع، تفكير سليم.", "صحيح، أنت على الطريق.", "أحسنت، هذا هو المطلوب."];
const LEARN = ["لا بأس، الخطأ هنا خطوة للتعلّم.", "راجع طريقة الحل، وستجده أسهل في المرة القادمة.", "قريب! تأمّل الحل جيدًا.", "كل خطأ تفهمه درجة تكسبها في الاختبار."];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default function Qudrat() {
  const { session, effectiveRole, adminRoles } = useSession();
  const uid = session?.user?.id;
  const [bank, setBank] = useState(null);
  const [log, setLog] = useState([]);       // إجابات الحساب: { qkey, sec, skill, correct }
  const [err, setErr] = useState("");
  const [round, setRound] = useState(null); // { title, list }
  const [plan, setPlan] = useState(null);
  const [mocks, setMocks] = useState([]);   // الأحدث أولًا
  const [mock, setMock] = useState(false);  // شاشة الاختبار المحاكي
  // التدريب والاختبار المحاكي يُفتحان داخل الصفحة: زر الرجوع يعيد إلى المركز
  useBackStep(!!round, () => setRound(null), "رجوع إلى المركز");
  useBackStep(mock, () => setMock(false), "رجوع إلى المركز");

  useEffect(() => {
    (async () => {
      const [official, { data: tq }, { data: ans, error }, { data: pl }, { data: mk }] = await Promise.all([
        loadBank(),
        supabase.from("qudrat_questions").select("*").eq("published", true),
        supabase.from("qudrat_answers").select("qkey, sec, skill, correct, mode, created_at").eq("user_id", uid).order("created_at").limit(5000),
        supabase.from("qudrat_plans").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("qudrat_mocks").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      ]);
      setPlan(pl ?? null);
      setMocks(mk ?? []);
      if (error) setErr(/qudrat_answers/.test(error.message) ? "المركز غير مفعّل بعد: يلزم تشغيل ملف supabase/qudrat_1.sql." : error.message);
      setBank([...official, ...(tq ?? []).map(fromRow)]);
      setLog(ans ?? []);
    })();
  }, [uid]);

  // آخر حالة لكل سؤال (صح أو خطأ) وإحصاء كل مهارة
  const { last, bySkill, total, correct } = useMemo(() => {
    const last = new Map(); const bySkill = {};
    log.forEach((r) => {
      last.set(r.qkey, r.correct);
      const s = (bySkill[r.skill] ??= { t: 0, c: 0 }); s.t += 1; if (r.correct) s.c += 1;
    });
    return { last, bySkill, total: log.length, correct: log.filter((r) => r.correct).length };
  }, [log]);

  if (!bank) return <Loader />;

  // جولة تدريب: ما لم يُحَل أولًا، ثم ما أُخطئ فيه، ثم الباقي
  const start = (title, pool, n = ROUND) => {
    const fresh = shuffle(pool.filter((q) => !last.has(q.key)));
    const wrong = shuffle(pool.filter((q) => last.get(q.key) === false));
    const rest = shuffle(pool.filter((q) => last.get(q.key) === true));
    const list = [...fresh, ...wrong, ...rest].slice(0, n);
    // أسئلة القطعة الواحدة متتالية ليُقرأ النص مرة
    list.sort((a, b) => (a.passage?.key ?? a.key).localeCompare(b.passage?.key ?? b.key) || (a.n ?? 0) - (b.n ?? 0));
    setRound({ title, list, id: Date.now() });
    window.scrollTo(0, 0);
  };
  const onAnswer = (row) => setLog((l) => [...l, { ...row, created_at: new Date().toISOString() }]);
  // مهمة اليوم من الخطة
  const startDay = (d) => {
    if (d.kind === "mock") return setMock(true);
    const wrong = bank.filter((q) => last.get(q.key) === false);
    if (d.review || d.kind === "rest") return start(d.kind === "rest" ? "مراجعة خفيفة" : "مراجعة ما أخطأت فيه", wrong.length ? wrong : bank, d.count);
    start("مهمة اليوم", bank.filter((q) => d.skills.includes(q.skill)), d.count);
  };
  if (mock) return <QudratMock uid={uid} bank={bank} mocks={mocks} onExit={() => { setMock(false); window.scrollTo(0, 0); }}
                               onDone={(m) => setMocks((x) => [m, ...x])} />;

  if (round) return <Practice key={round.id} round={round} onAnswer={onAnswer} onExit={() => setRound(null)}
                              onRetry={(list) => setRound({ title: "إعادة ما أخطأت فيه", list, id: Date.now() })} />;

  const isStaff = effectiveRole === "teacher" || (effectiveRole === "admin" && ["principal", "deputy_academic", "tech_support"].some((r) => adminRoles.includes(r)));
  const isManager = effectiveRole === "admin" && ["principal", "deputy_academic", "tech_support"].some((r) => adminRoles.includes(r));
  const wrongNow = bank.filter((q) => last.get(q.key) === false);
  const p = pctOf(correct, total);
  const today = isoDay();
  const doneToday = log.filter((r) => r.mode !== "mock" && isoDay(r.created_at) === today).length;
  const mockOpen = (() => { try { return !!localStorage.getItem(`qudrat.mock.${uid}`); } catch { return false; } })();

  return (
    <div className="space-y-5">
      <header className="card overflow-hidden">
        <div className="bg-gradient-to-l from-mint-tint to-paper px-5 py-5">
          <p className="text-xs font-semibold text-mint-deep">مركز التدريب</p>
          <h1 className="mt-1 text-xl font-bold text-ink">اختبار القدرات العامة</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            تدرّب على كل مهارة بأسئلة من الاختبارات التجريبية الرسمية: تلميح واستراتيجية قبل الحل، وطريقة الحل بعده،
            ويُحفظ مستواك في كل مهارة لتعرف أين تركّز.
          </p>
          <p className="mt-2 text-[11px] text-faint">{SOURCE}</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-line/60 border-t border-line/60 text-center">
          {[["سؤالًا أجبت عنه", total, "text-ink"], ["نسبة الصواب", total ? `${p}%` : "—", p >= 65 ? "text-present" : total ? "text-late" : "text-faint"],
            ["في البنك", bank.length, "text-mint-deep"]].map(([t, v, c]) => (
            <div key={t} className="px-2 py-3">
              <p className={`num text-xl font-bold ${c}`}>{v}</p>
              <p className="text-[11.5px] text-muted">{t}</p>
            </div>
          ))}
        </div>
      </header>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {mockOpen && (
        <button className="card flex w-full items-center justify-between border-late/40 bg-late/5 px-4 py-3 text-right" onClick={() => setMock(true)}>
          <span className="font-semibold text-ink">لديك اختبار محاكٍ لم يكتمل</span>
          <span className="chip bg-late text-white">أكمله</span>
        </button>
      )}

      <MyAsks uid={uid} />
      {!isStaff && <SadeedGuide />}
      <QudratPlan uid={uid} plan={plan} bySkill={bySkill} doneToday={doneToday} onSaved={setPlan} onStart={startDay} />

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => start("تدريب شامل", bank)}>تدريب شامل · <span className="num">{ROUND}</span> أسئلة</button>
        {wrongNow.length > 0 && (
          <button className="btn-ghost" onClick={() => start("إعادة ما أخطأت فيه", wrongNow)}>
            أعد ما أخطأت فيه <span className="chip bg-absent/10 text-absent num">{wrongNow.length}</span>
          </button>
        )}
        <button className="btn-ghost" onClick={() => setMock(true)}>اختبار محاكٍ كامل</button>
        {isStaff && <Link to="/qudrat/questions" className="btn-ghost">أسئلة المعلمين</Link>}
        {isStaff && <Link to="/qudrat/asks" className="btn-ghost">أسئلة الطلاب</Link>}
        {isManager && <Link to="/qudrat/admin" className="btn-ghost">لوحة المتابعة</Link>}
      </div>

      {Object.entries(SECS).map(([sec, S]) => {
        const pool = bank.filter((q) => q.sec === sec);
        return (
          <section key={sec} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">القسم {S.t}</h2>
              <button className="text-sm font-semibold text-mint-deep" onClick={() => start(`القسم ${S.t}`, pool)}>تدرّب على القسم كله</button>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(SKILLS).filter(([, k]) => k.sec === sec).map(([key, k]) => {
                const qs = pool.filter((q) => q.skill === key);
                const st = bySkill[key] ?? { t: 0, c: 0 };
                const sp = pctOf(st.c, st.t); const lv = levelOf(sp, st.t);
                const done = qs.filter((q) => last.has(q.key)).length;
                return (
                  <button key={key} disabled={!qs.length} onClick={() => start(k.t, qs)}
                          className="card px-4 py-3.5 text-right transition-colors hover:border-mint disabled:opacity-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ink">{k.t}</p>
                      <span className={`text-xs font-semibold ${lv.c}`}>{lv.t}</span>
                    </div>
                    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-canvas">
                      <div className={`h-full rounded-full ${sp >= 65 ? "bg-present" : "bg-late"}`} style={{ width: `${st.t ? sp : 0}%` }} />
                    </div>
                    <p className="mt-1.5 flex justify-between text-[11.5px] text-muted">
                      <span>حللت <span className="num">{done}</span> من <span className="num">{qs.length}</span></span>
                      {st.t > 0 && <span>الصواب <span className="num">{sp}%</span></span>}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <QudratResults mocks={mocks} refreshKey={`${mocks.length}-${Math.floor(total / 10)}`} />
    </div>
  );
}

/* ---------------- شاشة التدريب ---------------- */
function Practice({ round, onAnswer, onExit, onRetry }) {
  const { list, title } = round;
  const [i, setI] = useState(0);
  const [sel, setSel] = useState(null);
  const [done, setDone] = useState(false);     // تم التحقق من الإجابة
  const [hint, setHint] = useState(false);
  const [guide, setGuide] = useState(false);
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState([]);          // { q, correct }
  const [saveErr, setSaveErr] = useState("");
  const [showPassage, setShowPassage] = useState(true);
  const t0 = useRef(Date.now());
  const q = list[i];

  useEffect(() => { t0.current = Date.now(); }, [i]);

  if (!q) return <Summary title={title} res={res} onExit={onExit} onRetry={onRetry} />;

  const opts = q.cmp ? CMP : q.o;
  const streak = (() => { let n = 0; for (let k = res.length - 1; k >= 0 && res[k].correct; k--) n += 1; return n; })();

  const check = async () => {
    if (sel == null) return;
    const ok = sel === q.a;
    setDone(true);
    setRes((r) => [...r, { q, correct: ok }]);
    setMsg(ok ? (streak + 1 >= 3 ? `${streak + 1} إجابات صحيحة متتالية! استمر.` : pick(CHEER)) : pick(LEARN));
    const row = { qkey: q.key, sec: q.sec, skill: q.skill, correct: ok, hinted: hint, ms: Date.now() - t0.current, mode: "practice" };
    onAnswer(row);
    const { error } = await supabase.from("qudrat_answers").insert(row);
    if (error) setSaveErr("لم تُحفظ الإجابة في سجلك: " + error.message);
  };
  const next = () => {
    const samePassage = list[i + 1]?.passage?.key && list[i + 1].passage.key === q.passage?.key;
    setI(i + 1); setSel(null); setDone(false); setHint(false); setGuide(false); setMsg("");
    if (!samePassage) setShowPassage(true);
    window.scrollTo(0, 0);
  };

  const sk = SKILLS[q.skill];
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button className="text-sm font-semibold text-muted hover:text-ink" onClick={onExit}>إنهاء التدريب</button>
        <p className="text-sm text-muted">{title} · سؤال <span className="num font-bold text-ink">{i + 1}</span> من <span className="num">{list.length}</span></p>
      </div>
      <div className="flex gap-1">
        {list.map((_, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k < res.length ? (res[k].correct ? "bg-present" : "bg-absent") : k === i ? "bg-mint" : "bg-line"}`} />
        ))}
      </div>

      {q.passage && <Passage passage={q.passage} open={showPassage} onToggle={() => setShowPassage((x) => !x)} />}

      <section className="card px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className={`chip ${SECS[q.sec]?.bg} ${SECS[q.sec]?.c}`}>{SECS[q.sec]?.t}</span>
          <span className="chip bg-canvas text-ink">{sk?.t ?? q.skill}</span>
          <span className="text-[11px] text-faint">{q.setTitle}</span>
        </div>
        <Stem q={q} />

        {!done && (
          <div className="mt-3 flex flex-wrap gap-2">
            {q.hint && <button className={`chip ${hint ? "bg-late text-white" : "bg-late/10 text-late"}`} onClick={() => setHint(true)}>تلميح</button>}
            {sk?.guide && <button className={`chip ${guide ? "bg-mint-deep text-white" : "bg-mint-tint text-mint-deep"}`} onClick={() => setGuide((x) => !x)}>استراتيجية {sk.t}</button>}
          </div>
        )}
        {hint && q.hint && <p className="mt-2 rounded-sm2 bg-late/10 px-3 py-2 text-sm leading-relaxed text-ink"><b className="text-late">تلميح: </b>{q.hint}</p>}
        {guide && sk?.guide && (
          <ul className="mt-2 list-disc space-y-1 rounded-sm2 bg-mint-tint px-3 py-2 pr-7 text-sm leading-relaxed text-ink">
            {sk.guide.map((g) => <li key={g}>{g}</li>)}
          </ul>
        )}

        <div className="mt-4 grid gap-2">
          {opts.map((o, k) => {
            const state = !done ? (sel === k ? "border-mint-deep bg-mint-tint" : "border-line hover:bg-canvas")
              : k === q.a ? "border-present bg-present/10" : k === sel ? "border-absent bg-absent/10" : "border-line opacity-60";
            return (
              <button key={k} disabled={done} onClick={() => setSel(k)}
                      className={`flex items-center gap-3 rounded-sm2 border-2 px-3 py-2.5 text-right transition-colors ${state}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  done && k === q.a ? "bg-present text-white" : done && k === sel ? "bg-absent text-white" : sel === k ? "bg-mint-deep text-white" : "bg-canvas text-ink"}`}>{LETTERS[k]}</span>
                <OptText text={o} />
              </button>
            );
          })}
        </div>

        {!done ? (
          <button className="btn-primary mt-4 w-full" disabled={sel == null} onClick={check}>تحقّق من الإجابة</button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className={`rounded-sm2 px-3 py-2 text-sm font-bold ${sel === q.a ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg}{sel !== q.a && <> الإجابة الصحيحة: ({LETTERS[q.a]}) {opts[q.a]}</>}
            </p>
            {q.method && (
              <div className="rounded-sm2 border border-line bg-canvas px-3 py-2.5">
                <p className="text-xs font-bold text-mint-deep">طريقة الحل</p>
                <p className="mt-1 text-sm leading-loose text-ink">{q.method}</p>
              </div>
            )}
            <AskButton key={q.key} q={q} />
            {saveErr && <p className="text-xs text-absent">{saveErr}</p>}
            <button className="btn-primary w-full" onClick={next}>{i + 1 < list.length ? "السؤال التالي" : "عرض النتيجة"}</button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- نتيجة الجولة ---------------- */
function Summary({ title, res, onExit, onRetry }) {
  const c = res.filter((r) => r.correct).length;
  const p = pctOf(c, res.length);
  const wrong = res.filter((r) => !r.correct).map((r) => r.q);
  const skills = {};
  res.forEach((r) => { const s = (skills[r.q.skill] ??= { t: 0, c: 0 }); s.t += 1; if (r.correct) s.c += 1; });
  const line = p >= 90 ? "أداء ممتاز! أنت جاهز لمستوى أعلى." : p >= 70 ? "أداء جيد جدًا، راجع أخطاءك لتكتمل." : p >= 50 ? "بداية جيدة، والتدريب المنتظم يرفع مستواك." : "لا تقلق، راجع طرق الحل وأعد المحاولة؛ التحسن يأتي بالتكرار.";
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="card px-5 py-6 text-center">
        <p className="text-sm text-muted">{title}</p>
        <p className={`num mt-2 text-5xl font-bold ${p >= 70 ? "text-present" : p >= 50 ? "text-late" : "text-absent"}`}>{p}%</p>
        <p className="mt-1 text-sm text-muted"><span className="num">{c}</span> صحيحة من <span className="num">{res.length}</span></p>
        <p className="mt-3 font-semibold text-ink">{line}</p>
      </section>
      {Object.keys(skills).length > 0 && (
        <section className="card divide-y divide-line/60">
          {Object.entries(skills).map(([k, s]) => (
            <p key={k} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-ink">{SKILLS[k]?.t ?? k}</span>
              <span className={s.c === s.t ? "text-present" : "text-muted"}><span className="num">{s.c}</span> من <span className="num">{s.t}</span></span>
            </p>
          ))}
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        {wrong.length > 0 && <button className="btn-primary flex-1" onClick={() => onRetry(wrong)}>أعد ما أخطأت فيه (<span className="num">{wrong.length}</span>)</button>}
        <button className="btn-ghost flex-1" onClick={onExit}>العودة إلى المركز</button>
      </div>
    </div>
  );
}
