// src/components/QuizPaper.jsx
import { Fragment } from "react";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   ورقة الاختبار المطبوعة.
   • عربية من اليمين، وإنجليزية من اليسار بترويستها وتعليماتها.
   • بطاقة تظليل جانبية بعلامات مرجعية، تصلح للقراءة الضوئية لاحقًا.
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

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
  cut: "✂ يُقص من هنا",
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
  cut: "✂ cut here",
  bubbleHint: "Fill the circle completely with a pencil; erase fully to change",
  ordinals: ["One", "Two", "Three", "Four", "Five", "Six"],
  markWord: (n) => `${n} ${n === 1 ? "mark" : "marks"}`,
};

export function QuizPrintArea({ children }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #quiz-print, #quiz-print * { visibility: visible !important; }
          #quiz-print { position: absolute; inset: 0; background: #fff; }
          #quiz-print .sheet { box-shadow: none !important; margin: 0 !important;
                               break-after: page; }
          #quiz-print .sheet:last-child { break-after: auto; }
          #quiz-print .qbox { break-inside: avoid; }
          .no-print { display: none !important; }
        }
        @page quizland { size: A4 landscape; margin: 0; }
        @page { size: A4 landscape; margin: 0; }
        @media print {
          html, body { width: 297mm; height: 210mm; }
          #quiz-print { page: quizland; }
        }
      ` }} />
      <div id="quiz-print">{children}</div>
    </>
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

  // عمودان في البطاقة الجانبية
  const perCol = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, perCol), rows.slice(perCol)];

  const Mark = () => (
    <span className="inline-block" style={{ width: "8mm", height: "8mm",
                                            background: "#000", ...INK }} />
  );

  return (
    <div className="flex h-full flex-col">
      {/* خط القص الرأسي */}
      <div className="mb-1 flex items-center gap-1.5" style={{ color: "#666" }}>
        <span className="text-[8px]">{t.cut}</span>
        <span className="h-px flex-1"
              style={{ backgroundImage: "repeating-linear-gradient(90deg,#666 0 2mm,transparent 2mm 4mm)",
                       ...INK }} />
      </div>

      {/* البطاقة: فراغ أبيض حولها ليسهل كشف العلامات */}
      <div style={{ padding: "3mm 2mm" }}>
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

          <div className="mt-2 grid grid-cols-2 gap-x-3">
            {cols.map((col, ci) => (
              <div key={ci} className="space-y-[2mm]">
                {col.map((r) => (
                  <div key={r.key} className="flex items-center gap-[1.5mm]">
                    <span className="num text-[9px] font-bold"
                          style={{ width: "14mm", textAlign: ltr ? "left" : "right" }}>
                      {r.label}
                    </span>
                    {Array.from({ length: r.count }).map((_, k) => (
                      <span key={k}
                            className="grid place-items-center rounded-full text-[7px]"
                            style={{ width: "6mm", height: "6mm",
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

export default function QuizPaper({ quiz, questions = [], className = "", teacherName = "" }) {
  const ltr = quiz?.lang === "en";
  const t = ltr ? EN : AR;
  const dir = ltr ? "ltr" : "rtl";

  // تجميع الأسئلة بأنماطها لتظهر كمجموعات مرقّمة
  const groups = [];
  ["mcq", "truefalse", "match"].forEach((kind) => {
    const list = questions.filter((q) => q.kind === kind);
    if (list.length) groups.push({ kind, list });
  });

  return (
    <div className="sheet mx-auto bg-white text-ink" dir={dir}
         style={{ width: "297mm", height: "209mm", maxWidth: "297mm",
                  padding: "8mm 10mm 6mm",
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

      {/* عمودان: الأسئلة والبطاقة */}
      <div className="mt-2 flex min-h-0 flex-1 gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {groups.map((g, gi) => {
            const marks = g.list.reduce((a, x) => a + Number(x.marks || 0), 0);
            return (
              <div key={g.kind} className="qbox">
                <p className="rounded-[3px] px-2 py-[3px] text-[11px] font-bold"
                   style={{ background: "#EFEFEF", color: "#000", ...INK }}>
                  {t.question} {t.ordinals[gi] ?? gi + 1}: {t.kinds[g.kind]}
                </p>

                <div className="mt-1.5 space-y-1.5">
                  {g.list.map((q, qi) => {
                    const n = qi + 1;   // الترقيم يبدأ من جديد في كل سؤال
                    return (
                      <div key={q.id} className="qbox text-[10.5px] leading-[1.7]">
                        <div className="flex items-start gap-1.5">
                          <span className="num w-[9mm] shrink-0 font-bold">{t.fShort}{n})</span>
                          <p className="min-w-0 flex-1">{q.text}</p>
                          <span className="num shrink-0 rounded-[3px] border px-1.5 py-[1px] text-[9px] font-bold"
                                style={{ borderColor: "#999", color: "#333" }}>
                            {t.markWord(Number(q.marks))}
                          </span>
                        </div>

                        {q.kind === "mcq" && (
                          <table className="mt-1 w-full border-collapse text-[10px]"
                                 style={{ marginInlineStart: "6mm", width: "calc(100% - 6mm)" }}>
                            <tbody>
                              <tr>
                                {(q.options ?? []).map((o, k) => (
                                  <Fragment key={k}>
                                    <td className="num border px-1 py-1 text-center font-bold"
                                        style={{ borderColor: "#000", width: "6mm",
                                                 background: "#F5F5F5", ...INK }}>
                                      {t.ltrs[k]}
                                    </td>
                                    <td className="border px-1.5 py-1" style={{ borderColor: "#000" }}>
                                      {o}
                                    </td>
                                  </Fragment>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        )}

                        {q.kind === "truefalse" && (
                          <table className="mt-1 border-collapse text-[10px]"
                                 style={{ marginInlineStart: "6mm" }}>
                            <tbody>
                              <tr>
                                {t.tf.map((x, k) => (
                                  <td key={k} className="border px-4 py-[3px] text-center font-semibold"
                                      style={{ borderColor: "#000", minWidth: "20mm" }}>
                                    {x}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        )}

                        {q.kind === "match" && (
                          <div className="mt-1.5" style={{ paddingInlineStart: "7mm" }}>
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
                                    <td className="border px-2 py-1.5" style={{ borderColor: "#000" }}>
                                      {l}
                                    </td>
                                    <td className="border px-1 py-1.5" style={{ borderColor: "#000" }}>
                                      &nbsp;
                                    </td>
                                    <td className="num border px-1 py-1 text-center font-bold"
                                        style={{ borderColor: "#000", background: "#F5F5F5", ...INK }}>
                                      {t.ltrs[k] ?? k + 1}
                                    </td>
                                    <td className="border px-2 py-1.5" style={{ borderColor: "#000" }}>
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

        <div style={{ width: "88mm", flexShrink: 0 }}>
          <BubbleSheet groups={groups} t={t} ltr={ltr} quiz={quiz} className={className} />
        </div>
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
