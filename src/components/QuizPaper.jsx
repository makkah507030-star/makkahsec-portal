// src/components/QuizPaper.jsx
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
  colA: "العمود الأول", colB: "العمود الثاني",
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
  colA: "Column A", colB: "Column B",
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
        @page { size: 210mm 297mm; margin: 0; }
      ` }} />
      <div id="quiz-print">{children}</div>
    </>
  );
}

/* بطاقة التظليل — علامات مرجعية في الزوايا ودوائر منتظمة */
function BubbleSheet({ questions, t, ltr }) {
  const mcqLike = questions.filter((q) => q.kind === "mcq" || q.kind === "truefalse");
  if (!mcqLike.length) return null;

  const Mark = () => (
    <span className="inline-block h-[5mm] w-[5mm]" style={{ background: "#000", ...INK }} />
  );

  return (
    <div className="qbox rounded-[8px] border-2 border-black p-2"
         style={{ width: "52mm", ...INK }}>
      <div className="flex items-start justify-between">
        <Mark /><Mark />
      </div>

      <p className="mt-1 text-center text-[10px] font-bold">{t.answerSheet}</p>

      <div className="mt-1.5 space-y-1">
        <div className="border border-black px-1 py-[3px] text-[8.5px]">
          {t.name}: ______________
        </div>
        <div className="border border-black px-1 py-[3px] text-[8.5px]">
          {t.cls}: __________
        </div>
      </div>

      <div className="mt-2 space-y-[3px]">
        {mcqLike.map((q, i) => {
          const n = questions.indexOf(q) + 1;
          const count = q.kind === "truefalse" ? 2 : (q.options?.length ?? 4);
          return (
            <div key={q.id} className="flex items-center gap-1">
              <span className="num w-[6mm] text-[8.5px]" style={{ textAlign: ltr ? "left" : "right" }}>
                {n}
              </span>
              {Array.from({ length: count }).map((_, k) => (
                <span key={k}
                      className="grid h-[4.2mm] w-[4.2mm] place-items-center rounded-full border border-black text-[6.5px]">
                  {q.kind === "truefalse" ? (k === 0 ? t.tf[0][0] : t.tf[1][0]) : t.ltrs[k]}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-end justify-between">
        <Mark /><Mark />
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
         style={{ width: "210mm", minHeight: "297mm", padding: "12mm 12mm 10mm",
                  fontFamily: ltr ? "'IBM Plex Sans', system-ui, sans-serif"
                                  : "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* الترويسة */}
      <div className="flex items-start justify-between gap-4">
        <div className="text-[10.5px] font-medium leading-[1.85]">
          {t.gov.map((l) => <div key={l}>{l}</div>)}
          <div className="font-bold text-mint-deep">{t.school}</div>
        </div>
        <div className="flex items-center gap-3">
          <img src={moeLogo} alt="" className="h-9 w-auto" />
          <img src={logoIcon} alt="" className="h-9 w-auto" />
        </div>
      </div>
      <div className="mt-2 h-px w-full" style={{
        background: "linear-gradient(90deg,transparent,#3E635022 12%,#3E6350 50%,#3E635022 88%,transparent)",
        ...INK }} />

      {/* العنوان */}
      <div className="mt-3 text-center">
        <p className="text-[15px] font-bold text-mint-deep">{quiz?.title}</p>
        <p className="num mt-0.5 text-[11px] text-muted">
          {t.subject}: {quiz?.subject_name || "—"}
          {className ? ` · ${className}` : ""}
          {quiz?.duration_min ? ` · ${t.duration}: ${quiz.duration_min} ${t.minutes}` : ""}
        </p>
      </div>

      {/* خانات الطالب */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-[6px] border border-line px-2 py-1.5">
          {t.name}: ________________________
        </div>
        <div className="rounded-[6px] border border-line px-2 py-1.5">
          {t.cls}: ______________
        </div>
        <div className="rounded-[6px] border border-line px-2 py-1.5 text-center">
          {t.marks}: ______ / <span className="num">{quiz?.total_marks}</span>
        </div>
      </div>

      {quiz?.instructions && (
        <p className="mt-2 rounded-[6px] px-2.5 py-1.5 text-[10.5px]"
           style={{ background: "#EDFAF2", color: "#2F5544", ...INK }}>
          {quiz.instructions}
        </p>
      )}

      {/* الجسم: الأسئلة وبطاقة التظليل */}
      <div className="mt-3 flex gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          {groups.map((g, gi) => {
            const marks = g.list.reduce((a, x) => a + Number(x.marks || 0), 0);
            return (
              <div key={g.kind} className="qbox">
                <p className="rounded-[6px] px-2 py-1 text-[11.5px] font-bold"
                   style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
                  <span className="num">{gi + 1}. </span>{t.kinds[g.kind]}
                  <span className="num float-left text-[10px] font-medium">({marks})</span>
                </p>

                <div className="mt-1.5 space-y-1.5">
                  {g.list.map((q) => {
                    const n = questions.indexOf(q) + 1;
                    return (
                      <div key={q.id} className="qbox text-[11.5px] leading-[1.75]">
                        <p>
                          <span className="num font-bold">{n}) </span>
                          {q.text}
                          <span className="num text-faint"> ({q.marks})</span>
                        </p>

                        {q.kind === "mcq" && (
                          <div className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 px-4">
                            {(q.options ?? []).map((o, k) => (
                              <p key={k} className="text-[11px]">
                                <span className="num font-semibold">{t.ltrs[k]}) </span>{o}
                              </p>
                            ))}
                          </div>
                        )}

                        {q.kind === "truefalse" && (
                          <p className="px-4 text-[11px] text-faint">( &nbsp;&nbsp;&nbsp; )</p>
                        )}

                        {q.kind === "match" && (
                          <table className="mt-1 w-full border-collapse text-[11px]">
                            <thead>
                              <tr>
                                <th className="border border-line px-2 py-1" style={{ background: "#F7FCF9", ...INK }}>
                                  {t.colA}
                                </th>
                                <th className="w-[14mm] border border-line px-2 py-1"
                                    style={{ background: "#F7FCF9", ...INK }}>—</th>
                                <th className="border border-line px-2 py-1" style={{ background: "#F7FCF9", ...INK }}>
                                  {t.colB}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(q.options?.left ?? []).map((l, k) => (
                                <tr key={k}>
                                  <td className="border border-line px-2 py-1">
                                    <span className="num">{k + 1}. </span>{l}
                                  </td>
                                  <td className="border border-line px-2 py-1">&nbsp;</td>
                                  <td className="border border-line px-2 py-1">
                                    <span className="num">{t.ltrs[k] ?? k + 1}. </span>
                                    {(q.options?.right ?? [])[k] ?? ""}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <BubbleSheet questions={questions} t={t} ltr={ltr} />
      </div>

      {/* التذييل */}
      <div className="mt-5 flex items-end justify-between gap-4">
        <span className="text-[10px] text-faint" dir="ltr">makkahsec.com</span>
        <p className="text-[11.5px] font-semibold text-mint-deep">{t.good}</p>
        <div className="text-center">
          <p className="text-[10.5px] text-muted">{t.teacher}</p>
          <div className="h-6" />
          <div className="mx-auto h-px w-32 bg-line" />
          <p className="mt-0.5 text-[11px] font-semibold">{teacherName || "…"}</p>
        </div>
      </div>
    </div>
  );
}
