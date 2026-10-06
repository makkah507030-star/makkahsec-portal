// src/components/QuizPaper.jsx
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import logoIcon from "../assets/icon-mint.png";
import { CARD, cardLayout, groupQuestions } from "../lib/omrLayout.js";
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
  answerSheet: "بطاقة الإجابة", ltrs: ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن"],
  tf: ["صح", "خطأ"], q: "س",
  kinds: { mcq: "اختر الإجابة الصحيحة", truefalse: "ضع علامة صح أو خطأ",
           match: "زاوج بين العمودين" },
  teacher: "معلم المادة", good: "مع تمنياتي لكم بالتوفيق",
  colA: "العمود الأول", colB: "العمود الثاني", answerCol: "الإجابة",
  matchHint: "اكتب في خانة الإجابة حرف العنصر المقابل من العمود الثاني.",
  qShort: "س", fShort: "ف", item: "الفقرة", question: "السؤال", page: "صفحة", of: "من",
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
  answerSheet: "Answer Sheet", ltrs: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"],
  tf: ["True", "False"], q: "Q",
  kinds: { mcq: "Choose the correct answer", truefalse: "Write True or False",
           match: "Match column A with column B" },
  teacher: "Subject Teacher", good: "Good luck",
  colA: "Column A", colB: "Column B", answerCol: "Answer",
  matchHint: "Write the letter of the matching item from column B.",
  qShort: "Q", fShort: "P", item: "Item", question: "Question", page: "Page", of: "of",
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
   بطاقة الإجابة — تُرسم بمواضع مطلقة بالمليمتر من cardLayout (src/lib/omrLayout.js)،
   وهي نفس الأرقام التي يقرأ بها قارئ الكاميرا، فتتطابق الطباعة والقراءة تمامًا.
   علاماتها المرجعية الأربع 8 مم محاطة بفراغ أبيض ليسهل كشفها.
   ===================================================================== */
function AnswerCard({ questions = [], t, ltr, quiz, className, studentName }) {
  const L = cardLayout(questions, { ltr, labels: { qShort: t.qShort, fShort: t.fShort } });
  if (!L.rows.length) return null;
  const mm = (v) => `${v}mm`;
  const { MARK, PAD } = CARD;
  const abs = (x, y, w, h, extra = {}) =>
    ({ position: "absolute", left: mm(x), top: mm(y), width: mm(w), height: mm(h), ...extra });

  return (
    <div data-omr-card style={{ marginTop: "2mm", position: "relative", width: mm(L.W), height: mm(L.H), ...INK }}>
      {/* الإطار */}
      <div style={{ position: "absolute", inset: 0, border: "0.5mm solid #000" }} />

      {/* العلامات المرجعية */}
      {Object.entries(L.marks).map(([k, c]) => (
        <span key={k} style={abs(c.x - MARK / 2, c.y - MARK / 2, MARK, MARK, { background: "#000" })} />
      ))}

      {/* العنوان والتعليمات بين العلامتين العلويتين */}
      <div className="text-center" style={abs(PAD + MARK + 4, PAD, L.W - 2 * (PAD + MARK + 4), MARK)}>
        <p className="text-[11px] font-bold leading-[1.35]">{t.answerSheet}</p>
        <p className="text-[9px] leading-[1.3]" style={{ color: "#444" }}>{t.bubbleHint}</p>
      </div>

      {/* خانات الطالب */}
      {(() => {
        const x0 = CARD.SIDE, w = (L.W - 2 * CARD.SIDE - 4) / 3, y = 13, h = 6;
        const cells = [
          studentName
            ? <span key="n" className="truncate">{t.name}: <b className={studentName.length > 26 ? "text-[8px]" : ""}>{studentName}</b></span>
            : <>{t.name}: ____________________</>,
          <>{t.cls}: <b>{className || "__________"}</b></>,
          <>{t.marks}: _____ / <span className="num">{quiz?.total_marks}</span></>,
        ];
        return cells.map((c, i) => {
          const x = ltr ? x0 + i * (w + 2) : L.W - x0 - (i + 1) * w - i * 2;
          return (
            <div key={i} className="flex items-center overflow-hidden whitespace-nowrap px-1.5 text-[9.5px]"
                 style={abs(x, y, w, h, { border: "0.3mm solid #000",
                                          justifyContent: i === 2 ? "center" : "flex-start" })}>
              {c}
            </div>
          );
        });
      })()}

      {/* الصفوف: رقم الفقرة ودوائرها */}
      {L.rows.map((r) => {
        const letters = r.kind === "truefalse" ? [t.tf[0][0], t.tf[1][0]] : t.ltrs;
        return (
          <Fragment key={r.key}>
            <span className="num flex items-center text-[9px] font-bold"
                  style={abs(r.labelX, r.cy - 2.5, r.labelW, 5,
                             { justifyContent: ltr ? "flex-start" : "flex-end" })}>
              {r.label}
            </span>
            {r.bubbles.map((b, k) => (
              <span key={k} data-omr={`${r.key}:${k}`}
                    className="grid place-items-center rounded-full text-[7px]"
                    style={abs(b.x - L.D / 2, b.y - L.D / 2, L.D, L.D,
                               { border: "0.4mm solid #000", color: "#555", boxSizing: "border-box" })}>
                {letters[k] ?? k + 1}
              </span>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

/* رأس السؤال: رقمه ونوعه، ودرجته = مجموع درجات فقراته */
function GroupHead({ g, gi, t }) {
  const marks = Math.round(g.list.reduce((a, x) => a + Number(x.marks || 0), 0) * 100) / 100;
  return (
    <div className="flex items-center justify-between gap-2 rounded-[3px] px-2 py-[3px] text-[11px] font-bold"
         style={{ background: "#EFEFEF", color: "#000", ...INK }}>
      <span>{t.question} {t.ordinals[gi] ?? gi + 1}: {t.kinds[g.kind]}</span>
      <span className="num shrink-0 rounded-[3px] border bg-white px-2 py-[1px] text-[10px]"
            style={{ borderColor: "#000", ...INK }}>
        {t.markWord(marks)}
      </span>
    </div>
  );
}

// أكبر عدد خيارات في السؤال — لتوحيد عرض خانات الاختيار من متعدد
const maxOptsOf = (g) => Math.max(1, ...g.list.map((x) => (Array.isArray(x.options) ? x.options.length : 0)));

/* فقرة واحدة، والترقيم يبدأ من جديد في كل سؤال */
function QItem({ q, n, t, maxOpts }) {
  return (
    <div className="qbox text-[10.5px] leading-[1.5]">
      <div className="flex items-start gap-1.5">
        {/* dir=auto: «ف13)» بترتيب العربية، و«P13)» بترتيب الإنجليزية — لا num (يجعله ltr فيظهر «(ف13») */}
        <span dir="auto" className="w-[9mm] shrink-0 font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{t.fShort}{n})</span>
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
}

/* ترويسة الصفحة الأولى: الجهة والشعارات والعنوان وخانات الطالب والتعليمات */
function FirstHead({ quiz, t, className, studentName }) {
  return (
    <div>
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
        <div className="truncate rounded-[6px] border px-2 py-1.5" style={{ borderColor: "#999" }}>
          {t.name}: {studentName ? <b>{studentName}</b> : "________________________"}
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
    </div>
  );
}

/* ترويسة مختصرة للصفحات التالية */
function RunHead({ quiz, t, studentName, page, total }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10.5px]">
        <b className="truncate">{quiz?.title}</b>
        <span className="shrink-0" style={{ color: "#333" }}>
          {studentName ? <>{t.name}: <b>{studentName}</b> · </> : null}
          <span className="num">{t.page} {page} {t.of} {total}</span>
        </span>
      </div>
      <div className="mt-1 h-[1px] w-full" style={{ background: "#000", ...INK }} />
    </div>
  );
}

function Foot({ t, teacherName, page, total }) {
  return (
    <div className="mt-1.5 flex shrink-0 items-center justify-between gap-4 border-t pt-1.5"
         style={{ borderColor: "#999" }}>
      <span className="text-[10px]" dir="ltr" style={{ color: "#666" }}>
        makkahsec.com{total > 1 ? <span className="num"> · {page}/{total}</span> : null}
      </span>
      <p className="text-[11.5px] font-bold">{t.good}</p>
      <p className="text-[11px]">
        <span style={{ color: "#666" }}>{t.teacher}: </span>
        <b>{teacherName || "—"}</b>
      </p>
    </div>
  );
}

/* أجزاء الأسئلة بالتسلسل: رأس كل سؤال ثم فقراته — وحدة التوزيع على الصفحات */
function buildBlocks(groups) {
  const out = [];
  groups.forEach((g, gi) => {
    const maxOpts = maxOptsOf(g);
    out.push({ key: `h-${g.kind}`, head: true, g, gi });
    g.list.forEach((q, qi) => out.push({ key: q.id, q, n: qi + 1, maxOpts }));
  });
  return out;
}

function Block({ b, t, first }) {
  // padding لا margin: حتى يدخل الفراغ في قياس ارتفاع الجزء
  return b.head
    ? <div style={{ display: "flow-root", paddingTop: first ? 0 : "4px" }}><GroupHead g={b.g} gi={b.gi} t={t} /></div>
    : <div style={{ display: "flow-root", paddingTop: "3px" }}><QItem q={b.q} n={b.n} t={t} maxOpts={b.maxOpts} /></div>;
}

// أبعاد الورقة بالمليمتر (A4)
const PAGE_H = 296, PAD_T = 8, PAD_B = 5, PAD_X = 9;

/**
 * الورقة: إن اتّسعت الأسئلة مع البطاقة في صفحة واحدة (ولو بخطّ مصغَّر حتى ٦٥٪)
 * بقيت صفحة واحدة كما كانت. وإلا توزّعت الأسئلة بحجمها الطبيعي على صفحات،
 * وجاءت بطاقة الإجابة كاملة في آخرها (أو في صفحة مستقلة) لتبقى صالحة للكاميرا.
 * onFit({ zoom, fits, pages, cardFits })
 */
export default function QuizPaper({ quiz, questions = [], className = "", studentName = "", teacherName = "", onFit }) {
  const ltr = quiz?.lang === "en";
  const t = ltr ? EN : AR;
  const dir = ltr ? "ltr" : "rtl";
  const font = ltr ? "'IBM Plex Sans', system-ui, sans-serif" : "'IBM Plex Sans Arabic', sans-serif";

  // نفس تجميع بطاقة الإجابة (omrLayout) حتى يتطابق ترتيب الفقرات في الورقة والبطاقة
  const groups = groupQuestions(questions);
  const blocks = buildBlocks(groups);

  // pages: null = صفحة واحدة؛ وإلا [[فهارس الأجزاء]…] مع cardAlone إن احتاجت البطاقة صفحة
  const [plan, setPlan] = useState({ pages: null, cardAlone: false, cardFits: true });
  // إن قرّر القياس «صفحة واحدة» ثم لم تتّسع فعلًا بعد التصغير، نوزّع على صفحات
  const [overflowFor, setOverflowFor] = useState(null);

  const measRef = useRef(null);
  useLayoutEffect(() => {
    let dead = false;
    const run = () => {
      const root = measRef.current;
      if (!root || dead) return;
      const mm = root.querySelector("[data-mm]").getBoundingClientRect().height / 100;
      const outer = (el) => {
        if (!el) return 0;
        const cs = getComputedStyle(el);
        return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
      };
      const h = (sel) => outer(root.querySelector(sel)?.firstElementChild);
      const inner = (PAGE_H - PAD_T - PAD_B) * mm - 2;   // هامش أمان
      const gap = 1.5 * 4;                                // mt-1.5 فوق منطقة الأسئلة
      const head = h("[data-head]"), runHead = h("[data-runhead]");
      const foot = h("[data-foot]"), card = h("[data-card]");
      const heights = [...root.querySelectorAll("[data-block]")].map((el) => el.getBoundingClientRect().height);
      const total = heights.reduce((a, x) => a + x, 0);

      const single = inner - head - gap - card - foot;
      const cardFits = card <= inner - runHead - gap - foot;
      if (overflowFor !== questions && total * MIN_ZOOM <= single) {
        setPlan({ pages: null, cardAlone: false, cardFits: true });
        return;
      }

      const out = [[]];
      let room = inner - head - gap - foot;
      heights.forEach((bh, i) => {
        // رأس السؤال لا يبقى وحده أسفل الصفحة: يلزم أن تتّسع معه فقرته الأولى
        const need = blocks[i].head ? bh + (heights[i + 1] ?? 0) : bh;
        if (need > room && out[out.length - 1].length) { out.push([]); room = inner - runHead - gap - foot; }
        out[out.length - 1].push(i);
        room -= bh;
      });
      const cardAlone = card > room;
      setPlan({ pages: out, cardAlone, cardFits });
      onFit?.({ zoom: 1, fits: true, pages: out.length + (cardAlone ? 1 : 0), cardFits });
    };
    run();
    document.fonts?.ready?.then(run);
    return () => { dead = true; };
  }, [quiz, questions, className, studentName, teacherName, overflowFor]); // eslint-disable-line react-hooks/exhaustive-deps

  // الصفحة الواحدة: منطقة الأسئلة تأخذ ما بين الترويسة والبطاقة، وإن زادت
  // الأسئلة عنها نصغّرها تدريجيًا (zoom) حتى تتّسع كاملة.
  const areaRef = useRef(null);
  const innerRef = useRef(null);
  useLayoutEffect(() => {
    if (plan.pages) return;
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
    // هل اتّسع كل شيء فعلًا؟ إن لم يتّسع بعد أدنى تصغير نوزّع على صفحات
    const fits = inner.getBoundingClientRect().height <= area.getBoundingClientRect().height + 1;
    if (!fits) { setOverflowFor(questions); return; }
    onFit?.({ zoom: z, fits: true, pages: 1, cardFits: true });
  }, [plan, quiz, questions, className, studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheetStyle = {
    width: "210mm", height: `${PAGE_H}mm`, maxWidth: "210mm",
    padding: `${PAD_T}mm ${PAD_X}mm ${PAD_B}mm`,
    display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font,
  };
  const card = <AnswerCard questions={questions} t={t} ltr={ltr} quiz={quiz} className={className} studentName={studentName} />;
  const headProps = { quiz, t, className, studentName };

  // نسخة القياس — لا تظهر ولا تُطبع
  const measure = (
    <div ref={measRef} aria-hidden="true" dir={dir} className="no-print"
         style={{ position: "fixed", top: 0, left: -20000, visibility: "hidden", pointerEvents: "none",
                  width: `${210 - 2 * PAD_X}mm`, fontFamily: font }}>
      <div data-mm style={{ height: "100mm" }} />
      <div data-head style={{ display: "flow-root" }}><FirstHead {...headProps} /></div>
      <div data-runhead style={{ display: "flow-root" }}><RunHead {...headProps} page={2} total={2} /></div>
      <div data-foot style={{ display: "flow-root" }}><Foot t={t} teacherName={teacherName} page={1} total={2} /></div>
      <div data-card style={{ display: "flow-root" }}><div style={{ display: "flow-root" }}>{card}</div></div>
      {blocks.map((b, i) => <div key={b.key} data-block><Block b={b} t={t} first={i === 0} /></div>)}
    </div>
  );

  if (!plan.pages) {
    return (
      <>
        {measure}
        <div className="sheet mx-auto bg-white text-ink" dir={dir} style={sheetStyle}>
          <div className="shrink-0"><FirstHead {...headProps} /></div>

          {/* الأسئلة في الأعلى، والبطاقة في الأسفل — تُصغَّر الأسئلة لتتّسع */}
          <div ref={areaRef} className="mt-1.5 min-h-0 flex-1 overflow-hidden">
            <div ref={innerRef}>
              {blocks.map((b, i) => <Block key={b.key} b={b} t={t} first={i === 0} />)}
            </div>
          </div>

          <div className="shrink-0">{card}</div>
          <Foot t={t} teacherName={teacherName} page={1} total={1} />
        </div>
      </>
    );
  }

  const pages = plan.cardAlone ? [...plan.pages, []] : plan.pages;
  const total = pages.length;
  return (
    <>
      {measure}
      {pages.map((idx, pi) => {
        const last = pi === total - 1;
        return (
          <div key={pi} className="sheet mx-auto bg-white text-ink" dir={dir} style={sheetStyle}>
            <div className="shrink-0">
              {pi === 0 ? <FirstHead {...headProps} /> : <RunHead {...headProps} page={pi + 1} total={total} />}
            </div>
            <div className="mt-1.5 min-h-0 flex-1 overflow-hidden">
              {idx.map((i, k) => <Block key={blocks[i].key} b={blocks[i]} t={t} first={k === 0} />)}
            </div>
            {last && <div className="shrink-0">{card}</div>}
            <Foot t={t} teacherName={teacherName} page={pi + 1} total={total} />
          </div>
        );
      })}
    </>
  );
}
