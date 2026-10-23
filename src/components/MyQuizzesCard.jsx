// src/components/MyQuizzesCard.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import QuizFeedback from "./QuizFeedback.jsx";
import { openQuizCard } from "../lib/quizCards.js";
import { countAr } from "../lib/arabicCount.js";

/* =====================================================================
   «اختباراتي» في الصفحة الرئيسية للطالب — جدول واحد بدل صندوقين:
   اسم الاختبار، ثم إعلانه (موعده وحالته)، ثم درجته إذا نشرها المعلم.
   المصدر: my_online_quizzes (المتاح والقادم والمسلَّم حديثًا)
   وmy_quiz_results (النتائج المنشورة، ومنها الاختبارات الورقية).
   ===================================================================== */

const PERIODS = { diagnostic: "تشخيصي", period1: "الفترة الأولى", period2: "الفترة الثانية", final: "النهائي" };
const SHOW = 6;

const fmtG = (s) => {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// موعد مختصر يتسع في عمود الجدول: «الخميس 23/10 · 11:20 ص»
const shortWhen = (iso) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("ar-SA", { weekday: "long", timeZone: "Asia/Riyadh" });
  const dm = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", timeZone: "Asia/Riyadh" });
  const h = Number(d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Riyadh" }));
  const m = d.toLocaleString("en-GB", { minute: "2-digit", timeZone: "Asia/Riyadh" }).padStart(2, "0");
  return `${day} ${dm} · ${h % 12 || 12}:${m} ${h < 12 ? "ص" : "م"}`;
};

export default function MyQuizzesCard({ studentId }) {
  const [online, setOnline] = useState(null);
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(null);     // الاختبار المفتوحة تغذيته الراجعة
  const [all, setAll] = useState(false);

  useEffect(() => {
    supabase.rpc("my_online_quizzes").then(({ data }) => setOnline(data ?? []));
  }, []);
  useEffect(() => {
    if (!studentId) { setResults([]); return; }
    supabase.rpc("my_quiz_results", { p_student: studentId }).then(({ data }) => setResults(data ?? []));
  }, [studentId]);

  // صف لكل اختبار: ما ينتظر الطالب أولًا (متاح، جارٍ، قادم)، ثم الأحدث نتيجة
  const rows = useMemo(() => {
    if (!online || !results) return null;
    const now = Date.now();
    const res = new Map(results.map((r) => [r.quiz_id, r]));
    const list = online.map((o) => {
      const opens = new Date(o.opens_at).getTime(), closes = new Date(o.closes_at).getTime();
      const st = o.submitted_at ? ["سُلِّم", "bg-present/10 text-present", 3]
        : o.started_at ? ["جارٍ — أكمل", "bg-warning/10 text-warning", 0]
        : now < opens ? ["قادم", "bg-canvas text-muted", 2]
        : now >= closes ? ["انتهى", "bg-absent/10 text-absent", 3]
        : ["متاح الآن", "bg-mint-deep text-white", 1];
      const r = res.get(o.quiz_id);
      res.delete(o.quiz_id);
      return { id: o.quiz_id, title: o.title, subject: o.subject_name, online: o, st, r,
               when: now < opens ? `يُفتح ${shortWhen(o.opens_at)}` : `يُغلق ${shortWhen(o.closes_at)}`,
               rank: r ? 3 : st[2], date: o.opens_at };
    });
    for (const r of res.values()) {
      list.push({ id: r.quiz_id, title: r.title, subject: r.subject_name, r, rank: 3, date: r.exam_date ?? "" });
    }
    return list.sort((a, b) => a.rank - b.rank || String(b.date).localeCompare(String(a.date)));
  }, [online, results]);

  if (!rows?.length) return null;

  const graded = (results ?? []).filter((r) => !r.absent && r.score != null);
  const avg = graded.length
    ? Math.round((graded.reduce((a, r) => a + (100 * Number(r.score) / Number(r.total)), 0) / graded.length) * 10) / 10
    : null;
  const shown = all ? rows : rows.slice(0, SHOW);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <p className="text-sm font-bold text-ink">اختباراتي</p>
        {avg !== null && (
          <p className="text-xs text-muted">
            المتوسط: <span className="num font-semibold text-mint-deep">{avg}%</span> · {countAr(graded.length, "quiz")}
          </p>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-canvas text-[11px] text-muted">
            <th className="px-3 py-2 text-right font-medium">الاختبار</th>
            <th className="px-2 py-2 text-right font-medium">الموعد</th>
            <th className="w-20 px-3 py-2 text-center font-medium">الدرجة</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((x) => {
            const r = x.r;
            const pct = r && !r.absent && r.score != null ? Math.round((Number(r.score) / Number(r.total)) * 100) : null;
            const tone = pct == null ? "text-muted" : pct >= 80 ? "text-present" : pct >= 50 ? "text-mint-deep" : "text-warning";
            const go = x.online && !x.online.submitted_at && x.st[2] <= 1;   // متاح أو جارٍ: يُفتح من الصف
            return [
              <tr key={x.id} className="border-t border-line/70 align-top">
                <td className="px-3 py-2.5">
                  {go
                    ? <Link to={`/quiz/${x.id}`} className="font-semibold text-mint-deep hover:underline">{x.title}</Link>
                    : <p className="font-medium text-ink">{x.title}</p>}
                  {x.subject && <p className="text-[11px] text-faint">{x.subject}</p>}
                  {r && !r.absent && (r.card_path || r.feedback) && (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] font-semibold text-mint-deep">
                      {r.feedback && (
                        <button onClick={() => setOpen(open === x.id ? null : x.id)}>
                          التغذية الراجعة {open === x.id ? "▴" : "▾"}
                        </button>
                      )}
                      {r.card_path && <button onClick={() => openQuizCard(r.card_path)}>بطاقة الإجابة ↗</button>}
                    </p>
                  )}
                </td>
                <td className="px-2 py-2.5 text-[11.5px] text-muted">
                  {x.online && !r ? (
                    <>
                      <span className={`chip ${x.st[1]}`}>{x.st[0]}</span>
                      <p className="mt-1">
                        {x.online.submitted_at ? "بانتظار النتيجة" : x.when}
                        {!x.online.submitted_at && <span className="block text-faint">المدة <bdi className="num">{x.online.duration_min}</bdi> دقيقة</span>}
                      </p>
                    </>
                  ) : (
                    <>
                      {r?.exam_date && <p className="text-right"><bdi className="num">{fmtG(r.exam_date)}</bdi></p>}
                      {r?.period && <p className="text-faint">{PERIODS[r.period] ?? ""}</p>}
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {!r ? <span className="text-faint">—</span>
                    : r.absent ? <span className="chip bg-absent/10 text-absent">غائب</span>
                    : r.score == null ? <span className="text-faint">—</span>
                    : (
                      <>
                        <p className={`num font-bold ${tone}`}>{r.score}<span className="text-[11px] font-normal text-faint"> / {r.total}</span></p>
                        <p className={`num text-[11px] ${tone}`}>{pct}%</p>
                      </>
                    )}
                </td>
              </tr>,
              open === x.id && (
                <tr key={x.id + "-fb"}>
                  <td colSpan={3} className="border-t border-line bg-canvas/50 p-3">
                    <QuizFeedback studentId={studentId} quizId={x.id} />
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      {rows.length > SHOW && (
        <button onClick={() => setAll((v) => !v)} className="w-full border-t border-line py-2 text-xs font-semibold text-mint-deep hover:bg-canvas">
          {all ? "عرض أقل" : `عرض الكل (${rows.length})`}
        </button>
      )}
    </section>
  );
}
