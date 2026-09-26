// src/components/QuizPaper.jsx
import { Fragment, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   ورقة الاختبار المطبوعة.
   • عربية من اليمين، وإنجليزية من اليسار بترويستها وتعليماتها.
   • بطاقة تظليل جانبية بعلامات مرجعية، تصلح للقراءة الضوئية لاحقًا.
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

// أدنى تصغير للأسئلة (٦٥٪) حتى تبقى مقروءة — بعده يُنبَّه المعلم لتقليل الفقرات
const MIN_ZOOM = 0.65;

const AR = {
  gov: ["المملكة العربية السعودية", "وزارة التعليم",
        "الإدارة العامة للتعليم بمنطقة مكة المكرمة"],
  school: "مدرسة مكة الثانوية",
  name: "الاسم", cls: "الصف", date: "التاريخ", marks: "الدرجة",
  subject: "المادة", duration: "المدة", minutes: "دقيقة",
  answerSheet: "بطاقة الإجابة", ltrs: ["أ", "ب", "ج", "د", "هـ"],
  tf: ["صح", "خطأ"], q: "س",
  kinds: { mcq: "اختر الإجابة الصحيحة", truefalse: "ضع علامة صح أو خطأ",
           match: "زاوج بين العمودين" },
  teacher: "معلم المادة", good: "مع تمنياتي لكم بالتوفيق",
  colA: "العمود الأول", colB: "العمود الثاني", answerCol: "الإجابة",
  matchHint: "اكتب في خانة الإجابة حرف العنصر المقابل من العمود الثاني.",
  qShort: "س", fShort: "ف", item: "الفقرة", question: "السؤال",
  bubbleHint: "ظلّل الدائرة كاملة بقلم رصاص، وامحُ محوًا تامًا عند التغيير",
  ordinals: ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"],
  markWord: (n) => `${n} ${n === 1 ? "درجة" : n === 2 ? "درجتان" : n <= 10 ? "درجات" : "درجة"}`,
};

const EN = {
  gov: ["Kingdom of Saudi Arabia", "Ministry of Education",
        "Makkah Education Directorate"],
  school: "Makkah Secondary School",
  name: "Name", cls: "Class", date: "Date", marks: "Marks",
  subject: "Subject", duration: "Time", minutes: "min",
  answerSheet: "Answer Sheet", ltrs: ["A", "B", "C", "D", "E"],
  tf: ["True", "False"], q: "Q",
  kinds: { mcq: "Choose the correct answer", truefalse: "Write True or False",
           match: "Match column A with column B" },
  teacher: "Subject Teacher", good: "Good luck",
  colA: "Column A", colB: "Column B", answerCol: "Answer",
  matchHint: "Write the letter of the matching item from column B.",
  qShort: "Q", fShort: "P", item: "Item", question: "Question",
  bubbleHint: "Fill the circle completely with a pencil; erase fully to change",
  ordinals: ["One", "Two", "Three", "Four", "Five", "Six"],
  markWord: (n) => `${n} ${n === 1 ? "mark" : "marks"}`,
};

/* منطقة الطباعة:
   • تُركَّب مباشرة في <body> (بوابة React) — فعند الطباعة نُخفي كل ما عداها
     بـ display:none، فلا تُضيف واجهة البوابة المخفية صفحات بيضاء زائدة.
   • على الشاشة تبقى خارج مجال الرؤية لكن "مرسومة"، حتى تقيس الورقة محتواها
     وتصغّره ليتّسع في صفحة واحدة قبل فتح نافذة الطباعة.
   • @page بلا اسم يفرض A4 عمودية — الصفحة المسمّاة وحدها لا تكفي في بعض
     المتصفحات، فتخرج الورقة أفقية ويتوزّع الاختبار على صفحتين. */
export function QuizPrintArea({ children }) {
  return createPortal(
    <div className="quiz-print-host">
      <style dangerouslySetInnerHTML={{ __html: `
        .quiz-print-host { position: fixed; top: 0; left: -10000px;
                           visibility: hidden; pointer-events: none; }
        @page { size: A4 portrait; margin: 0; }
        @page quizport { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: #fff !important; height: auto !important; }
          body > *:not(.quiz-print-host) { display: none !important; }
          .quiz-print-host { position: static !important; left: auto !important;
                             visibility: visible !important; }
          #quiz-print { page: quizport; background: #fff; }
          #quiz-print .sheet { box-shadow: none !important; margin: 0 !important;
                               break-after: page; }
          #quiz-print .sheet:last-child { break-after: auto; }
          .no-print { display: none !important; }
        }
      ` }} />
      <div id="quiz-print">{children}</div>
    </div>,
    document.body,
  );
}

/* =====================================================================
   بطاقة التظليل — في الثلث السفلي من الورقة بعرضها كاملًا،
   تفصلها عن الأسئلة قصاصة متقطّعة. دوائرها 6 مم متباعدة،
   وعلاماتها المرجعية 8 مم محاطة بفراغ أبيض ليسهل كشفها بالكاميرا.
   ===================================================================== */
function BubbleSheet({ groups = [], t, ltr, quiz, className }) {
  if (!groups.length) return null;

  // الترقيم يبدأ من جديد مع كل سؤال: س1: ف1، ف2 … ثم س2: ف1، ف2
  const rows = [];
  groups.forEach((g, gi) => {
    g.list.forEach((q, qi) => {
      if (q.kind === "match") {
        (q.options?.left ?? []).forEach((_, k) => {
          rows.push({
            key: `${q.id}-${k}`,
            label: `${t.qShort}${gi + 1}: ${t.fShort}${k + 1}`,
            count: (q.options?.right ?? []).length || 4,
            letters: t.ltrs,
          });
        });
      } else {
        rows.push({
          key: q.id,
          label: `${t.qShort}${gi + 1}: ${t.fShort}${qi + 1}`,
          count: q.kind === "truefalse" ? 2 : (q.options?.length ?? 4),
          letters: q.kind === "truefalse" ? [t.tf[0][0], t.tf[1][0]] : t.ltrs,
        });
      }
    });
  });

  // ثلاثة أعمدة بعرض الصفحة، وأربعة للاختبارات الطويلة حتى لا تأكل البطاقة مساحة الأسئلة
  const nCols = rows.length > 15 ? 4 : 3;
  const perCol = Math.ceil(rows.length / nCols);
  const cols = Array.from({ length: nCols }, (_, i) => rows.slice(i * perCol, (i + 1) * perCol));
  const dense = nCols === 4;

  const Mark = () => (
    <span className="inline-block" style={{ width: "8mm", height: "8mm",
                                            background: "#000", ...INK }} />
  );

  return (
    <div>
      {/* البطاقة: فراغ أبيض حولها ليسهل كشف العلامات */}
      <div style={{ padding: "3mm 0" }}>
        <div className="border-2 border-black" style={{ padding: "3mm", ...INK }}>

          <div className="flex items-start justify-between">
            <Mark />
            <div className="px-3 text-center">
              <p className="text-[11px] font-bold">{t.answerSheet}</p>
              <p className="text-[9px]" style={{ color: "#444" }}>{t.bubbleHint}</p>
            </div>
            <Mark />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-[9.5px]">
            <div className="border px-1.5 py-1" style={{ borderColor: "#000" }}>
              {t.name}: ____________________
            </div>
            <div className="border px-1.5 py-1" style={{ borderColor: "#000" }}>
              {t.cls}: <b>{className || "__________"}</b>
            </div>
            <div className="border px-1.5 py-1 text-center" style={{ borderColor: "#000" }}>
              {t.marks}: _____ / <span className="num">{quiz?.total_marks}</span>
            </div>
          </div>

          <div className="mt-2 grid gap-x-3"
               style={{ gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))` }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column",
                                     gap: dense ? "1.4mm" : "2mm" }}>
                {col.map((r) => (
                  <div key={r.key} className="flex items-center gap-[1.2mm]">
                    <span className="num text-[9px] font-bold"
                          style={{ width: dense ? "12mm" : "14mm", textAlign: ltr ? "left" : "right" }}>
                      {r.label}
                    </span>
                    {Array.from({ length: r.count }).map((_, k) => (
                      <span key={k}
                            className="grid place-items-center rounded-full text-[7px]"
                            style={{ width: dense ? "5mm" : "6mm", height: dense ? "5mm" : "6mm",
                                     border: "0.4mm solid #000", color: "#555", ...INK }}>
                        {r.letters[k] ?? k + 1}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-end justify-between">
            <Mark /><Mark />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuizPaper({ quiz, questions = [], className = "", teacherName = "", onFit }) {
  const ltr = quiz?.lang === "en";
  const t = ltr ? EN : AR;
  const dir = ltr ? "ltr" : "rtl";

  // تجميع الأسئلة بأنماطها لتظهر كمجموعات مرقّمة
  const groups = [];
  ["mcq", "truefalse", "match"].forEach((kind) => {
    const list = questions.filter((q) => q.kind === kind);
    if (list.length) groups.push({ kind, list });
  });

  // ملاءمة الصفحة الواحدة: الورقة بارتفاع A4 ثابت، والبطاقة والتذييل بارتفاعهما
  // الطبيعي، ومنطقة الأسئلة تأخذ الباقي. إن زادت الأسئلة عن المساحة نصغّرها
  // تدريجيًا (zoom) حتى تتّسع كاملة — فلا يُقتطع سؤال ولا ينتقل لصفحة ثانية.
  const areaRef = useRef(null);
  const innerRef = useRef(null);
  useLayoutEffect(() => {
    const area = areaRef.current, inner = innerRef.current;
    if (!area || !inner) return;
    let z = 1;
    inner.style.zoom = "1";
    for (let i = 0; i < 12; i++) {
      const avail = area.getBoundingClientRect().height;
      const need = inner.getBoundingClientRect().height;
      if (!avail || need <= avail) break;
      z = Math.max(MIN_ZOOM, z * Math.min(0.97, avail / need));
      inner.style.zoom = String(z);
      if (z === MIN_ZOOM) break;
    }
    inner.dataset.zoom = z.toFixed(2);
    // هل اتّسع كل شيء فعلًا؟ (بعد أدنى تصغير قد يبقى جزء مقتطعًا)
    const fits = inner.getBoundingClientRect().height <= area.getBoundingClientRect().height + 1;
    onFit?.({ zoom: z, fits });
  }, [quiz, questions, className]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sheet mx-auto bg-white text-ink" dir={dir}
         style={{ width: "210mm", height: "296mm", maxWidth: "210mm",
                  padding: "8mm 9mm 5mm",
                  display: "flex", flexDirection: "column", overflow: "hidden",
                  fontFamily: ltr ? "'IBM Plex Sans', system-ui, sans-serif"
                                  : "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* الترويسة */}
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div className="text-[9.5px] font-medium leading-[1.7]">
          {t.gov.map((l) => <div key={l}>{l}</div>)}
          <div className="font-bold">{t.school}</div>
        </div>
        <div className="flex items-center gap-3">
          <img src={moeLogo} alt="" className="h-8 w-auto" />
          <img src={logoIcon} alt="" className="h-8 w-auto" />
        </div>
      </div>
      <div className="mt-2 h-[1.5px] w-full" style={{ background: "#000", ...INK }} />

      {/* العنوان */}
      <div className="mt-1.5 shrink-0 text-center">
        <p className="text-[14px] font-bold">{quiz?.title}</p>
        <p className="num mt-0.5 text-[11px]" style={{ color: "#333" }}>
          {t.subject}: <b>{quiz?.subject_name || "—"}</b>
          {className ? <> · {t.cls}: <b>{className}</b></> : null}
          {quiz?.duration_min ? ` · ${t.duration}: ${quiz.duration_min} ${t.minutes}` : ""}
        </p>
      </div>

      {/* خانات الطالب */}
      <div className="mt-1.5 grid shrink-0 grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-[6px] border px-2 py-1.5" style={{ borderColor: "#999" }}>
          {t.name}: ________________________
        </div>
        <div className="rounded-[6px] border px-2 py-1.5" style={{ borderColor: "#999" }}>
          {t.cls}: <b>{className || "______________"}</b>
        </div>
        <div className="rounded-[6px] border px-2 py-1.5 text-center" style={{ borderColor: "#999" }}>
          {t.marks}: ______ / <span className="num">{quiz?.total_marks}</span>
        </div>
      </div>

      {quiz?.instructions && (
        <p className="mt-2 rounded-[6px] border px-2.5 py-1.5 text-[10.5px]"
           style={{ borderColor: "#999", ...INK }}>
          {quiz.instructions}
        </p>
      )}

      {/* الأسئلة في الأعلى، والبطاقة في الأسفل — تُصغَّر الأسئلة لتتّسع */}
      <div ref={areaRef} className="mt-1.5 min-h-0 flex-1 overflow-hidden">
        <div ref={innerRef} className="space-y-1">
          {groups.map((g, gi) => {
            // درجة السؤال كاملًا = مجموع درجات فقراته، تظهر بجانب عنوان السؤال
            const marks = Math.round(g.list.reduce((a, x) => a + Number(x.marks || 0), 0) * 100) / 100;
            // أكبر عدد خيارات في السؤال — لتوحيد عرض خانات الاختيار من متعدد
            const maxOpts = Math.max(1, ...g.list.map((x) => (Array.isArray(x.options) ? x.options.length : 0)));
            return (
              <div key={g.kind} className="qbox">
                <div className="flex items-center justify-between gap-2 rounded-[3px] px-2 py-[3px] text-[11px] font-bold"
                     style={{ background: "#EFEFEF", color: "#000", ...INK }}>
                  <span>{t.question} {t.ordinals[gi] ?? gi + 1}: {t.kinds[g.kind]}</span>
                  <span className="num shrink-0 rounded-[3px] border bg-white px-2 py-[1px] text-[10px]"
                        style={{ borderColor: "#000", ...INK }}>
                    {t.markWord(marks)}
                  </span>
                </div>

                <div className="mt-1 space-y-[3px]">
                  {g.list.map((q, qi) => {
                    const n = qi + 1;   // الترقيم يبدأ من جديد في كل سؤال
                    return (
                      <div key={q.id} className="qbox text-[10.5px] leading-[1.5]">
                        <div className="flex items-start gap-1.5">
                          <span className="num w-[9mm] shrink-0 font-bold">{t.fShort}{n})</span>
                          <p className="min-w-0 flex-1">{q.text}</p>
                          {q.kind === "truefalse" && (
                            <span className="flex shrink-0 border-collapse">
                              {t.tf.map((x, k) => (
                                <span key={k} className="border px-3 py-[1px] text-center text-[10px] font-semibold"
                                      style={{ borderColor: "#000", minWidth: "14mm",
                                               marginInlineStart: k ? "-1px" : 0 }}>
                                  {x}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>

                        {q.kind === "mcq" && (
                          // جدول ثابت التخطيط: خانات الخيارات متساوية العرض، وأعمدتها
                          // متحاذية في كل فقرات السؤال (حتى لو اختلف عدد الخيارات)
                          <table className="mt-[2px] border-collapse text-[10px]"
                                 style={{ marginInlineStart: "6mm", width: "calc(100% - 6mm)",
                                          tableLayout: "fixed" }}>
                            <colgroup>
                              {Array.from({ length: maxOpts }).map((_, k) => (
                                <Fragment key={k}>
                                  <col style={{ width: "6mm" }} />
                                  <col />
                                </Fragment>
                              ))}
                            </colgroup>
                            <tbody>
                              <tr>
                                {(q.options ?? []).map((o, k) => (
                                  <Fragment key={k}>
                                    <td className="num border px-1 py-[2px] text-center font-bold"
                                        style={{ borderColor: "#000", width: "6mm",
                                                 background: "#F5F5F5", ...INK }}>
                                      {t.ltrs[k]}
                                    </td>
                                    <td className="border px-1.5 py-[2px]" style={{ borderColor: "#000" }}>
                                      {o}
                                    </td>
                                  </Fragment>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        )}

                        {q.kind === "match" && (
                          <div className="mt-1" style={{ paddingInlineStart: "7mm" }}>
                            <table className="w-full border-collapse text-[11px]">
                              <thead>
                                <tr style={{ background: "#EFEFEF", ...INK }}>
                                  <th className="border px-1 py-1 text-center font-bold"
                                      style={{ borderColor: "#000", width: "8mm" }}>م</th>
                                  <th className="border px-2 py-1 text-center font-bold"
                                      style={{ borderColor: "#000" }}>
                                    {t.colA} ({t.ltrs[0]})
                                  </th>
                                  <th className="border px-1 py-1 text-center font-bold"
                                      style={{ borderColor: "#000", width: "14mm" }}>
                                    {t.answerCol}
                                  </th>
                                  <th className="border px-1 py-1 text-center font-bold"
                                      style={{ borderColor: "#000", width: "8mm" }}>{t.ltrs[1]}</th>
                                  <th className="border px-2 py-1 text-center font-bold"
                                      style={{ borderColor: "#000" }}>
                                    {t.colB} ({t.ltrs[1]})
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(q.options?.left ?? []).map((l, k) => (
                                  <tr key={k}>
                                    <td className="num border px-1 py-1 text-center font-bold"
                                        style={{ borderColor: "#000", background: "#F5F5F5", ...INK }}>
                                      {k + 1}
                                    </td>
                                    <td className="border px-2 py-[3px]" style={{ borderColor: "#000" }}>
                                      {l}
                                    </td>
                                    <td className="border px-1 py-[3px]" style={{ borderColor: "#000" }}>
                                      &nbsp;
                                    </td>
                                    <td className="num border px-1 py-1 text-center font-bold"
                                        style={{ borderColor: "#000", background: "#F5F5F5", ...INK }}>
                                      {t.ltrs[k] ?? k + 1}
                                    </td>
                                    <td className="border px-2 py-[3px]" style={{ borderColor: "#000" }}>
                                      {(q.options?.right ?? [])[k] ?? ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="mt-1 text-[10px]" style={{ color: "#555" }}>
                              {t.matchHint}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0">
        <BubbleSheet groups={groups} t={t} ltr={ltr} quiz={quiz} className={className} />
      </div>

      {/* التذييل */}
      <div className="mt-1.5 flex shrink-0 items-center justify-between gap-4 border-t pt-1.5"
           style={{ borderColor: "#999" }}>
        <span className="text-[10px]" dir="ltr" style={{ color: "#666" }}>makkahsec.com</span>
        <p className="text-[11.5px] font-bold">{t.good}</p>
        <p className="text-[11px]">
          <span style={{ color: "#666" }}>{t.teacher}: </span>
          <b>{teacherName || "—"}</b>
        </p>
      </div>
    </div>
  );
}
