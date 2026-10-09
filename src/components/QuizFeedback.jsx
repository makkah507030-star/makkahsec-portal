import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Loader from "./Loader.jsx";

/* =====================================================================
   التغذية الراجعة لاختبار قصير (supabase/quiz_publish_2.sql) — للطالب وولي
   أمره حين يتيحها المعلم: بطاقات مبسطة لدرجته ومتوسط فصله، وموقعه بين
   أدنى درجة وأعلاها، وحال كل فقرة مصحَّحة آليًا ونسبة إجابة فصله لها.
   لا يُعرض مفتاح الإجابة.
   ===================================================================== */

const KIND = { mcq: "اختيار متعدد", truefalse: "صح وخطأ", match: "مزاوجة" };
const n1 = (v) => Math.round(Number(v) * 10) / 10;
const pctOf = (s, t) => (Number(t) > 0 ? Math.round((100 * Number(s)) / Number(t)) : 0);

// كلمة مشجعة بحسب النسبة — تصحبها النسبة نفسها دائمًا
function verdict(p) {
  if (p >= 90) return { t: "أداء متفوق", d: "أحسنت، حافظ على هذا المستوى.", c: "text-present", bg: "bg-present/10" };
  if (p >= 75) return { t: "أداء جيد جدًا", d: "قريب من التفوق؛ راجع الفقرات التي أخطأت فيها.", c: "text-mint-deep", bg: "bg-mint-tint" };
  if (p >= 60) return { t: "أداء جيد", d: "راجع الفقرات التي أخطأت فيها، واسأل معلمك عمّا لم يتضح.", c: "text-late", bg: "bg-late/10" };
  return { t: "يحتاج إلى دعم", d: "راجع دروس الاختبار مع معلمك، وركّز على الفقرات التي أخطأت فيها.", c: "text-absent", bg: "bg-absent/10" };
}

const ITEM = {
  ok:      { t: "صحيحة",   c: "border-present/30 bg-present/10 text-present", s: "✓" },
  part:    { t: "جزئية",   c: "border-late/30 bg-late/10 text-late",          s: "½" },
  wrong:   { t: "خاطئة",   c: "border-absent/30 bg-absent/10 text-absent",    s: "✗" },
  skipped: { t: "لم تُجب", c: "border-line bg-canvas text-muted",            s: "—" },
};
const itemState = (m) => (m == null ? "skipped" : m >= 1 ? "ok" : m > 0 ? "part" : "wrong");

function Stat({ v, t, c = "text-ink", sub }) {
  return (
    <div className="rounded-card border border-line bg-white px-2 py-3 text-center">
      <p className={`num text-xl font-bold leading-none ${c}`}>{v}</p>
      {sub && <p className="mt-1 text-[11px] text-faint">{sub}</p>}
      <p className="mt-1.5 text-[11.5px] text-muted">{t}</p>
    </div>
  );
}

export default function QuizFeedback({ studentId, quizId }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    setD(null); setErr("");
    supabase.rpc("my_quiz_feedback", { p_student: studentId, p_quiz: quizId }).then(({ data, error }) => {
      if (!live) return;
      if (error) setErr(/my_quiz_feedback|schema cache/i.test(error.message)
        ? "لم تُفعَّل التغذية الراجعة بعد في قاعدة البيانات." : error.message);
      else setD(data);
    });
    return () => { live = false; };
  }, [studentId, quizId]);

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">{err}</p>;
  if (!d) return <div className="py-3"><Loader compact /></div>;
  if (d.absent) return <p className="rounded-sm2 bg-absent/10 px-3 py-2.5 text-sm text-absent">كنت غائبًا عن هذا الاختبار، فلا تغذية راجعة له.</p>;

  const total = Number(d.total);
  const mine = pctOf(d.score, total);
  const p = d.peers ?? {};
  const avgPct = p.count ? pctOf(p.avg, total) : null;
  const v = verdict(mine);
  const auto = (d.items ?? []).filter((x) => KIND[x.kind]);
  const showItems = d.answered && auto.length > 0;
  const counts = { ok: 0, part: 0, wrong: 0, skipped: 0 };
  auto.forEach((x) => { counts[itemState(x.mine)] += 1; });
  const byKind = Object.keys(KIND).map((k) => {
    const list = auto.filter((x) => x.kind === k);
    const got = list.reduce((a, x) => a + Number(x.mine ?? 0), 0);
    return { k, n: list.length, got: n1(got) };
  }).filter((x) => x.n);
  const review = auto.filter((x) => itemState(x.mine) !== "ok");
  const manual = (d.items ?? []).length - auto.length;

  // موقع الطالب ومتوسط الفصل على شريط بين أدنى درجة وأعلاها
  const lo = p.count ? pctOf(p.min, total) : 0;
  const hi = p.count ? pctOf(p.max, total) : 100;

  return (
    <div className="space-y-3">
      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-card px-4 py-3 ${v.bg}`}>
        <div>
          <p className={`text-sm font-bold ${v.c}`}>{v.t}</p>
          <p className="mt-0.5 text-xs text-muted">{v.d}</p>
        </div>
        <p className={`num text-2xl font-bold ${v.c}`}>{mine}٪</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat v={<span dir="ltr">{n1(d.score)} / {n1(total)}</span>} t="درجتك" c={v.c} />
        <Stat v={avgPct == null ? "—" : `${avgPct}٪`} sub={p.count ? <span className="num" dir="ltr">{n1(p.avg)} / {n1(total)}</span> : null} t="متوسط الفصل" />
        <Stat v={p.count ? n1(p.max) : "—"} t="أعلى درجة في الفصل" c="text-present" />
        <Stat v={p.count ?? 0} sub={p.absent ? `وغاب ${p.absent}` : null} t="أدّوا الاختبار" />
      </div>

      {p.count > 1 && (
        <div className="rounded-card border border-line bg-white px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">موقعك في الفصل</span>
            <span className={`chip ${mine >= avgPct ? "bg-present/10 text-present" : "bg-late/10 text-late"}`}>
              {mine > avgPct ? "أعلى من المتوسط" : mine === avgPct ? "عند المتوسط" : "دون المتوسط"}
            </span>
          </div>
          {/* يبدأ الشريط من اليمين: الصفر يمينًا والدرجة الكاملة يسارًا */}
          <div className="relative mt-5 h-2 rounded-pill bg-canvas">
            <div className="absolute inset-y-0 rounded-pill bg-mint-light" style={{ right: `${lo}%`, left: `${100 - hi}%` }} />
            <span className="absolute -top-1 h-4 w-0.5 bg-muted" style={{ right: `${avgPct}%` }} title="متوسط الفصل" />
            <span className={`absolute -top-1.5 h-5 w-5 translate-x-1/2 rounded-full border-2 border-white shadow ${mine >= avgPct ? "bg-present" : "bg-late"}`}
                  style={{ right: `${mine}%` }} title="درجتك" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-faint">
            <span>أدنى درجة <bdi className="num">{lo}٪</bdi></span>
            <span>متوسط الفصل <bdi className="num">{avgPct}٪</bdi></span>
            <span>أعلى درجة <bdi className="num">{hi}٪</bdi></span>
          </div>
        </div>
      )}

      {showItems && (
        <div className="rounded-card border border-line bg-white px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-ink">إجاباتك فقرةً فقرة</p>
            <p className="text-[11px] text-muted">
              صحيحة {counts.ok}{counts.part ? ` · جزئية ${counts.part}` : ""} · خاطئة {counts.wrong}
              {counts.skipped ? ` · لم تُجب ${counts.skipped}` : ""} — من {auto.length}
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {auto.map((x) => {
              const s = ITEM[itemState(x.mine)];
              return (
                <div key={x.n} title={`${s.t} · أجاب عنها ${x.class ?? 0}٪ من فصلك`}
                     className={`w-[52px] rounded-sm2 border px-1 py-1.5 text-center ${s.c}`}>
                  <p className="num text-[11px] font-semibold leading-none">{x.n}</p>
                  <p className="mt-1 text-sm font-bold leading-none">{s.s}</p>
                  <p className="num mt-1 text-[9.5px] leading-none opacity-75">{x.class ?? 0}٪</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-faint">الرقم أسفل كل فقرة: نسبة من أجاب عنها صحيحًا في فصلك.</p>

          {byKind.length > 1 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {byKind.map((k) => (
                <div key={k.k} className="rounded-sm2 bg-canvas px-3 py-2">
                  <p className="text-[11.5px] text-muted">{KIND[k.k]}</p>
                  <p className="text-sm font-bold text-ink"><bdi className="num">{k.got}</bdi> <span className="text-[11px] font-normal text-faint">من {k.n} فقرات</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showItems && review.length > 0 && (
        <div className="rounded-card border border-line bg-white px-4 py-3">
          <p className="text-xs font-semibold text-ink">فقرات تراجعها</p>
          <ul className="mt-2 space-y-1.5">
            {review.slice(0, 8).map((x) => (
              <li key={x.n} className="flex gap-2 text-[12.5px] leading-relaxed">
                <span className={`chip shrink-0 ${ITEM[itemState(x.mine)].c}`}><span className="num">{x.n}</span></span>
                <span className="min-w-0 text-ink">{x.text}</span>
              </li>
            ))}
          </ul>
          {review.length > 8 && <p className="mt-1.5 text-[11px] text-faint">و{review.length - 8} فقرات أخرى</p>}
        </div>
      )}

      {!showItems && (
        <p className="rounded-sm2 bg-canvas px-3 py-2 text-[11.5px] text-muted">
          رُصدت درجة هذا الاختبار بالمجموع، فلا تفصيل لفقراته.
        </p>
      )}
      {showItems && manual > 0 && (
        <p className="text-[11px] text-faint">و{manual} فقرات مكتوبة يصحّحها المعلم بنفسه، ودرجتها ضمن درجتك.</p>
      )}
    </div>
  );
}
