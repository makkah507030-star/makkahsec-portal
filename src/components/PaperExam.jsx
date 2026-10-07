// src/components/PaperExam.jsx
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import { BLANK_RE, MODEL_LABEL, groupPaper, linesOf, paperOpts, shuffledOrder, variantFor } from "../lib/paperExam.js";

/* =====================================================================
   ورقة الاختبار الورقي — صفحات A4 تتوزّع عليها الأسئلة تلقائيًا.
   • تُقاس كل فقرة في نسخة غير مرئية، ثم تُرصّ في الصفحات دون أن تنقسم
     فقرة بين صفحتين، ولا يبقى عنوان سؤال وحيدًا أسفل صفحة.
   • الصفحة الأولى بترويستها واسم الطالب وصفه وجدول الدرجات، وما بعدها
     بترويسة مختصرة. في التذييل رقم الصفحة و«يتبع» أو «انتهت الأسئلة».
   • نسخة لكل طالب بأسمائهم، أو نموذج واحد بلا أسماء، أو نموذج الإجابة.
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const KEY = "#0B7A43";   // لون الإجابات في نموذج الإجابة

const PAGE_H = 297, PAD_Y = 10, PAD_X = 11;   // بالمليمتر

const AR = {
  gov: ["المملكة العربية السعودية", "وزارة التعليم", "الإدارة العامة للتعليم بمنطقة مكة المكرمة"],
  school: "مدرسة مكة الثانوية",
  name: "اسم الطالب", cls: "الصف", subject: "المادة",
  date: "التاريخ", duration: "الزمن", minutes: "دقيقة", total: "الدرجة الكلية",
  question: "السؤال", ordinals: ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن"],
  kinds: {
    mcq: "اختر الإجابة الصحيحة فيما يلي بوضع دائرة حول حرفها",
    truefalse: "ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة",
    match: "زاوج بين العمودين بكتابة حرف العنصر المناسب من العمود الثاني",
    fill: "أكمل الفراغات التالية بما يناسبها",
    order: "رتّب ما يلي ترتيبًا صحيحًا بكتابة الأرقام في المربعات",
    short: "أجب عمّا يلي باختصار",
    essay: "أجب عمّا يلي",
  },
  ltrs: ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن"],
  colA: "العمود الأول", colB: "العمود الثاني", answer: "الإجابة", statement: "العبارة",
  marksTable: "جدول الدرجات", obtained: "الدرجة المستحقة", sum: "المجموع",
  page: (a, b) => `الصفحة ${a} من ${b}`, cont: "يتبع في الصفحة التالية ←", end: "انتهت الأسئلة",
  good: "مع تمنياتي لكم بالتوفيق والنجاح", teacher: "معلم المادة",
  key: "نموذج الإجابة", tf: ["✓", "✗"], contHead: "تابع", model: "النموذج",
  markWord: (n) => `${n} ${n === 1 ? "درجة" : n === 2 ? "درجتان" : n <= 10 ? "درجات" : "درجة"}`,
};
const EN = {
  gov: ["Kingdom of Saudi Arabia", "Ministry of Education", "Makkah Education Directorate"],
  school: "Makkah Secondary School",
  name: "Student name", cls: "Class", subject: "Subject",
  date: "Date", duration: "Time", minutes: "min", total: "Total marks",
  question: "Question", ordinals: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"],
  kinds: {
    mcq: "Circle the letter of the correct answer",
    truefalse: "Put (✓) for the correct statement and (✗) for the wrong one",
    match: "Match column A with column B by writing the correct letter",
    fill: "Fill in the blanks",
    order: "Put the following in the correct order by writing numbers in the boxes",
    short: "Answer the following briefly",
    essay: "Answer the following",
  },
  ltrs: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"],
  colA: "Column A", colB: "Column B", answer: "Answer", statement: "Statement",
  marksTable: "Marks", obtained: "Obtained", sum: "Total",
  page: (a, b) => `Page ${a} of ${b}`, cont: "Continued on next page →", end: "End of questions",
  good: "Good luck", teacher: "Subject teacher",
  key: "Answer key", tf: ["✓", "✗"], contHead: "Continued", model: "Version",
  markWord: (n) => `${n} ${n === 1 ? "mark" : "marks"}`,
};

const round = (n) => Math.round(n * 100) / 100;
const ansOf = (q) => (typeof q.answer === "string" ? q.answer.replace(/^"|"$/g, "") : q.answer);

/** كتل الورقة: عنوان كل سؤال ملتصق بأول فقراته، ثم بقية الفقرات كتلة كتلة */
function buildBlocks(questions) {
  const blocks = [];
  groupPaper(questions).forEach((g, gi) => {
    const marks = round(g.list.reduce((a, x) => a + Number(x.marks || 0), 0));
    // أكبر عدد خيارات في السؤال — لتتساوى خانات الخيارات في كل فقراته
    const maxOpts = Math.max(2, ...g.list.map((x) => (Array.isArray(x.options) ? x.options.length : 0)));
    g.list.forEach((q, qi) => {
      blocks.push({ key: q.id, gi, qi, q, kind: g.kind, maxOpts,
                    head: qi === 0 ? { marks, count: g.list.length } : null });
    });
  });
  return blocks;
}

/* ------------------------------ المكوّن ------------------------------ */
/**
 * copies: [{ student?: { full_name }, className? }] — نسخة لكل عنصر
 * answerKey: نموذج الإجابة
 * onLayout({ pages, starts }) — عدد الصفحات وأين تبدأ كل صفحة (للمعلم)
 */
export default function PaperExam({ quiz, questions: base = [], teacherName = "", copies = [{}],
                                    answerKey = false, onLayout, scale, model = null, images = {} }) {
  const ltr = quiz?.lang === "en";
  const t = ltr ? EN : AR;
  const opts = paperOpts(quiz);
  // النموذج (ب) بترتيب مختلف للفقرات والخيارات
  const questions = model ? variantFor(base, model) : base;
  const blocks = buildBlocks(questions);
  const groups = groupPaper(questions);

  const measRef = useRef(null);
  const [pages, setPages] = useState(null);   // [[blockIndex…], …]

  // القياس والتوزيع — يُعاد مع كل تعديل وبعد تحميل الخطوط
  useLayoutEffect(() => {
    let dead = false;
    const run = () => {
      const root = measRef.current;
      if (!root || dead) return;
      const mm = root.querySelector("[data-mm]").getBoundingClientRect().height / 100;
      const h = (sel) => root.querySelector(sel)?.getBoundingClientRect().height ?? 0;
      const inner = (PAGE_H - 2 * PAD_Y) * mm - 2;   // هامش أمان
      const foot = h("[data-foot]");
      const first = inner - h("[data-head]") - foot;
      const next = inner - h("[data-runhead]") - foot;
      const heights = [...root.querySelectorAll("[data-block]")].map((el) => {
        const cs = getComputedStyle(el);
        return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
      });

      const out = [[]];
      let room = first;
      heights.forEach((bh, i) => {
        if (bh > room && out[out.length - 1].length) { out.push([]); room = next; }
        out[out.length - 1].push(i);
        room -= bh;
      });
      setPages(out);
      onLayout?.({
        pages: out.length,
        starts: out.slice(1).map((p) => {
          const b = blocks[p[0]];
          return b ? { gi: b.gi, qi: b.qi, label: `${t.question} ${t.ordinals[b.gi] ?? b.gi + 1}${b.qi ? ` — ${ltr ? "item" : "الفقرة"} ${b.qi + 1}` : ""}` } : null;
        }).filter(Boolean),
      });
    };
    run();
    document.fonts?.ready?.then(run);
    // الصور تغيّر ارتفاع فقراتها حين تكتمل — يُعاد التوزيع بعد تحميل كل صورة
    const imgs = [...(measRef.current?.querySelectorAll("img") ?? [])];
    imgs.forEach((im) => { if (!im.complete) im.addEventListener("load", run, { once: true }); });
    return () => { dead = true; };
  }, [quiz, base, answerKey, model, images]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = {
    // خط البوابة للغتين: IBM Plex Sans Arabic يحوي حروفًا لاتينية بتصميم Plex (src/fonts.css)
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
    fontSize: opts.compact ? "11.5px" : "12.5px",
    lineHeight: opts.compact ? 1.55 : 1.75,
  };
  const ctx = { quiz, t, ltr, opts, answerKey, groups, teacherName, model, images };

  return (
    <>
      {/* نسخة القياس — لا تظهر */}
      <div ref={measRef} aria-hidden="true" dir={ltr ? "ltr" : "rtl"}
           style={{ position: "fixed", top: 0, left: -20000, visibility: "hidden", pointerEvents: "none",
                    width: `${210 - 2 * PAD_X}mm`, ...style }}>
        <div data-mm style={{ height: "100mm" }} />
        <div data-head><FirstHead {...ctx} copy={{}} /></div>
        <div data-runhead><RunHead {...ctx} copy={{}} /></div>
        <div data-foot><Foot {...ctx} page={1} total={2} last={false} /></div>
        {/* flow-root: حتى لا يخرج هامش الفقرة العلوي من حدود قياسها */}
        {blocks.map((b) => <div key={b.key} data-block style={{ display: "flow-root" }}><Block b={b} {...ctx} /></div>)}
      </div>

      {pages && copies.map((copy, ci) => pages.map((idx, pi) => (
        <div key={`${ci}-${pi}`} className="sheet mx-auto bg-white text-ink" dir={ltr ? "ltr" : "rtl"}
             style={{ width: "210mm", height: `${PAGE_H - 0.5}mm`, padding: `${PAD_Y}mm ${PAD_X}mm`,
                      display: "flex", flexDirection: "column", overflow: "hidden", ...style,
                      ...(scale ? { zoom: scale, marginBottom: 12, boxShadow: "0 10px 30px -18px rgba(0,0,0,.35)" } : {}) }}>
          {pi === 0 ? <FirstHead {...ctx} copy={copy} /> : <RunHead {...ctx} copy={copy} />}
          <div className="min-h-0 flex-1">
            {idx.map((i) => <Block key={blocks[i].key} b={blocks[i]} {...ctx} />)}
          </div>
          <Foot {...ctx} page={pi + 1} total={pages.length} last={pi === pages.length - 1} />
        </div>
      )))}
    </>
  );
}

/* ------------------------------ الترويسة ------------------------------ */
function FirstHead({ quiz, t, opts, answerKey, groups, copy, model }) {
  const name = copy?.student?.full_name;
  const cls = copy?.className;
  return (
    <div className="pb-1">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[10px] font-medium leading-[1.65]">
          {t.gov.map((l) => <div key={l}>{l}</div>)}
          <div className="font-bold">{t.school}</div>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-bold leading-tight">{quiz?.title}</p>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            {model && (
              <span className="inline-block rounded-[4px] border-[1.5px] px-2 py-[1px] text-[11px] font-bold"
                    style={{ borderColor: "#000" }}>{t.model} ({MODEL_LABEL[model] ?? model})</span>
            )}
            {answerKey && (
              <span className="inline-block rounded-[4px] px-2 py-[1px] text-[11px] font-bold text-white"
                    style={{ background: KEY, ...INK }}>{t.key}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <img src={moeLogo} alt="" className="h-9 w-auto" />
          <img src={logoIcon} alt="" className="h-9 w-auto" />
        </div>
      </div>
      <div className="mt-1.5 h-[1.5px] w-full" style={{ background: "#000", ...INK }} />

      <div className="num mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-[11px]" style={{ color: "#222" }}>
        <span>{t.subject}: <b>{quiz?.subject_name || "—"}</b></span>
        {quiz?.exam_date && <span>{t.date}: <b>{quiz.exam_date}</b></span>}
        {quiz?.duration_min ? <span>{t.duration}: <b>{quiz.duration_min} {t.minutes}</b></span> : null}
        <span>{t.total}: <b>{quiz?.total_marks}</b></span>
      </div>

      {/* خانات الطالب */}
      <div className="mt-1.5 grid gap-1.5 text-[11.5px]" style={{ gridTemplateColumns: "2.3fr 1.2fr" }}>
        <Cell label={t.name} value={name} />
        <Cell label={t.cls} value={cls} />
      </div>

      {opts.marksTable && !answerKey && <MarksTable t={t} groups={groups} total={quiz?.total_marks} />}

      {quiz?.instructions && (
        <p className="mt-1.5 rounded-[5px] border px-2.5 py-1 text-[11px]" style={{ borderColor: "#999" }}>
          {quiz.instructions}
        </p>
      )}
    </div>
  );
}

const Cell = ({ label, value }) => (
  <div className="flex items-baseline gap-1.5 rounded-[5px] border px-2 py-1" style={{ borderColor: "#888" }}>
    <span style={{ color: "#444" }}>{label}:</span>
    {value ? <b className="truncate">{value}</b>
           : <span className="flex-1 border-b border-dotted" style={{ borderColor: "#777", minHeight: "1em" }} />}
  </div>
);

/** جدول الدرجات: خانة لكل سؤال، والمجموع */
function MarksTable({ t, groups, total }) {
  const cell = "border px-1 py-[2px] text-center";
  const bc = { borderColor: "#000" };
  return (
    <table className="num mt-1.5 w-full border-collapse text-[10.5px]" style={{ tableLayout: "fixed" }}>
      <tbody>
        <tr style={{ background: "#EFEFEF", ...INK }}>
          <th className={cell} style={{ ...bc, width: "22mm" }}>{t.question}</th>
          {groups.map((g, i) => <th key={g.kind} className={cell} style={bc}>{t.ordinals[i] ?? i + 1}</th>)}
          <th className={cell} style={{ ...bc, width: "22mm" }}>{t.sum}</th>
        </tr>
        <tr>
          <th className={cell} style={bc}>{t.obtained}</th>
          {groups.map((g) => {
            const m = round(g.list.reduce((a, x) => a + Number(x.marks || 0), 0));
            return (
              <td key={g.kind} className={cell} style={{ ...bc, height: "8mm", verticalAlign: "bottom" }}>
                <span className="text-[9px]" style={{ color: "#666" }}>/{m}</span>
              </td>
            );
          })}
          <td className={cell} style={{ ...bc, verticalAlign: "bottom" }}>
            <span className="text-[9px]" style={{ color: "#666" }}>/{total}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function RunHead({ quiz, t, copy, model }) {
  const name = copy?.student?.full_name;
  return (
    <div className="mb-2 flex items-center justify-between gap-3 border-b pb-1 text-[10.5px]" style={{ borderColor: "#999" }}>
      <span><b>{t.contHead}:</b> {quiz?.title}{model ? ` — ${t.model} (${MODEL_LABEL[model] ?? model})` : ""}</span>
      <span>{t.name}: {name ? <b>{name}</b> : "………………………………"}</span>
    </div>
  );
}

function Foot({ t, page, total, last, teacherName }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3 border-t pt-1 text-[10.5px]" style={{ borderColor: "#999" }}>
      <span className="num" style={{ color: "#555" }}>{t.page(page, total)}</span>
      <b>{last ? t.good : t.cont}</b>
      <span>{last ? <>{t.teacher}: <b>{teacherName || "—"}</b></> : <span style={{ color: "#555" }}>makkahsec.com</span>}</span>
    </div>
  );
}

/* ------------------------------ الفقرات ------------------------------ */
// الأنماط المجدولة: فقراتها جداول متلاصقة تبدو جدولًا واحدًا (تتراكب حدودها بـ -1px)
const TABLED = new Set(["mcq", "truefalse", "fill"]);

function Block({ b, t, answerKey, opts, images }) {
  const { q, qi, gi, head, kind, maxOpts } = b;
  const gap = opts.compact ? "3px" : "5px";
  const hasImg = !!(q.image_path && images?.[q.image_path]);
  const img = hasImg ? <QImage q={q} images={images} /> : null;
  const top = head ? (opts.compact ? "7px" : "10px") : TABLED.has(kind) ? "-1px" : gap;
  return (
    <div style={{ marginTop: top }}>
      {head && (
        <div className="mb-1 flex items-center justify-between gap-2 rounded-[3px] px-2 py-[3px] text-[12px] font-bold"
             style={{ background: "#EAEAEA", ...INK }}>
          <span>{t.question} {t.ordinals[gi] ?? gi + 1}: {t.kinds[kind]}</span>
          <span className="shrink-0 rounded-[3px] border bg-white px-2 text-[11px]" style={{ borderColor: "#000", ...INK }}>
            {t.markWord(head.marks)}
          </span>
        </div>
      )}
      <Item q={q} n={qi + 1} t={t} answerKey={answerKey} img={img} first={qi === 0} maxOpts={maxOpts} />
    </div>
  );
}

const Num = ({ n }) => <span className="num shrink-0 font-bold" style={{ minWidth: "6mm" }}>{n}-</span>;
const Mark = ({ q, t }) => (
  <span className="shrink-0 text-[10px]" style={{ color: "#555" }}>({t.markWord(Number(q.marks || 0))})</span>
);
const Key = ({ children }) => <span style={{ color: KEY, fontWeight: 700, ...INK }}>{children}</span>;

/* خلايا الجداول */
const TB = { borderColor: "#000" };
const CELL = "border px-2 py-[3px] align-middle";
const NumCell = ({ n, rows = 1 }) => (
  <td rowSpan={rows} className="num border text-center align-middle font-bold"
      style={{ ...TB, background: "#F2F2F2", ...INK }}>{n}</td>
);
const ImgRow = ({ img, span }) => (img ? <tr><td colSpan={span} className="border" style={TB}>{img}</td></tr> : null);

// img: صورة السؤال — تأتي بعد نصه مباشرة، قبل الخيارات أو أسطر الإجابة
function Item({ q, n, t, answerKey, img, first, maxOpts = 4 }) {
  const a = ansOf(q);

  // اختيار من متعدد: رقم الفقرة في خانة مستقلة، ثم السؤال، ثم الخيارات بخانات متساوية
  if (q.kind === "mcq") {
    const opts = Array.isArray(q.options) ? q.options : [];
    const span = maxOpts * 2;
    return (
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "9mm" }} />
          {Array.from({ length: maxOpts }).map((_, k) => (
            <Fragment key={k}><col style={{ width: "7mm" }} /><col /></Fragment>
          ))}
        </colgroup>
        <tbody>
          <tr>
            <NumCell n={n} rows={img ? 3 : 2} />
            <td colSpan={span} className={`${CELL} font-medium`} style={TB}>{q.text}</td>
          </tr>
          <ImgRow img={img} span={span} />
          <tr>
            {Array.from({ length: maxOpts }).map((_, k) => {
              const has = opts[k] != null;
              const hit = answerKey && has && String(k) === String(a);
              return (
                <Fragment key={k}>
                  <td className="border text-center align-middle font-bold" style={{ ...TB, background: "#F7F7F7", ...INK }}>
                    {has && (hit
                      ? <span className="inline-grid h-[5.2mm] w-[5.2mm] place-items-center rounded-full"
                              style={{ border: `0.5mm solid ${KEY}`, color: KEY, ...INK }}>{t.ltrs[k]}</span>
                      : t.ltrs[k])}
                  </td>
                  <td className={CELL} style={TB}>{has ? opts[k] : ""}</td>
                </Fragment>
              );
            })}
          </tr>
        </tbody>
      </table>
    );
  }

  // صح وخطأ: رقم | العبارة | خانة الإجابة — وعناوين الأعمدة فوق أول فقرة
  if (q.kind === "truefalse") {
    return (
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "9mm" }} /><col /><col style={{ width: "20mm" }} /></colgroup>
        {first && (
          <thead>
            <tr style={{ background: "#EFEFEF", ...INK }}>
              <th className={`${CELL} text-center`} style={TB}>م</th>
              <th className={`${CELL} text-center`} style={TB}>{t.statement}</th>
              <th className={`${CELL} text-center`} style={TB}>{t.answer}</th>
            </tr>
          </thead>
        )}
        <tbody>
          <tr>
            <NumCell n={n} rows={img ? 2 : 1} />
            <td className={CELL} style={TB}>{q.text}</td>
            <td rowSpan={img ? 2 : 1} className="border text-center align-middle text-[14px] font-bold" style={TB}>
              {answerKey ? <Key>{a === "false" ? t.tf[1] : t.tf[0]}</Key> : ""}
            </td>
          </tr>
          {img && <tr><td className="border" style={TB}>{img}</td></tr>}
        </tbody>
      </table>
    );
  }

  if (q.kind === "match") {
    const left = q.options?.left ?? [], right = q.options?.right ?? [];
    const map = (a && typeof a === "object") ? a : {};
    const rows = Math.max(left.length, right.length);
    const c = "border px-2 py-[3px]";
    const bc = { borderColor: "#000" };
    return (
      <div className="px-1">
        {q.text && <div className="mb-1 flex gap-1"><Num n={n} /><p className="flex-1">{q.text}</p></div>}
        {img}
        <table className="w-full border-collapse text-[11.5px]" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#EFEFEF", ...INK }}>
              <th className={c} style={{ ...bc, width: "8mm" }}>م</th>
              <th className={c} style={bc}>{t.colA}</th>
              <th className={c} style={{ ...bc, width: "16mm" }}>{t.answer}</th>
              <th className={c} style={{ ...bc, width: "8mm" }} />
              <th className={c} style={bc}>{t.colB}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, k) => (
              <tr key={k}>
                <td className={`${c} num text-center font-bold`} style={bc}>{left[k] != null ? k + 1 : ""}</td>
                <td className={c} style={bc}>{left[k] ?? ""}</td>
                <td className={`${c} text-center`} style={bc}>
                  {answerKey && map[String(k)] != null ? <Key>{t.ltrs[Number(map[String(k)])]}</Key> : ""}
                </td>
                <td className={`${c} text-center font-bold`} style={bc}>{right[k] != null ? t.ltrs[k] ?? k + 1 : ""}</td>
                <td className={c} style={bc}>{right[k] ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // أكمل الفراغ: رقم | العبارة بفراغاتها
  if (q.kind === "fill") {
    const answers = Array.isArray(a) ? a : [];
    const parts = String(q.text ?? "").split(BLANK_RE);
    return (
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup><col style={{ width: "9mm" }} /><col /></colgroup>
        <tbody>
          <tr>
            <NumCell n={n} rows={img ? 2 : 1} />
            <td className={CELL} style={{ ...TB, lineHeight: 2.1 }}>
              {parts.map((p, k) => (
                <Fragment key={k}>
                  {p}
                  {k < parts.length - 1 && (
                    <span className="inline-block border-b border-dotted text-center align-baseline"
                          style={{ borderColor: "#000", minWidth: "30mm", paddingInline: "2mm" }}>
                      {answerKey ? <Key>{answers[k] ?? ""}</Key> : "\u00a0"}
                    </span>
                  )}
                </Fragment>
              ))}
            </td>
          </tr>
          {img && <tr><td className="border" style={TB}>{img}</td></tr>}
        </tbody>
      </table>
    );
  }

  if (q.kind === "order") {
    const items = shuffledOrder(q);
    return (
      <div className="px-1">
        {q.text && <div className="flex gap-1"><Num n={n} /><p className="flex-1">{q.text}</p></div>}
        {img}
        <div className="mt-[2px] grid gap-x-4 gap-y-[3px]"
             style={{ paddingInlineStart: q.text ? "6mm" : 0, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
          {items.map((it) => (
            <div key={it.i} className="flex items-center gap-2">
              <span className="num grid h-[6mm] w-[8mm] shrink-0 place-items-center border text-[12px] font-bold"
                    style={{ borderColor: "#000" }}>
                {answerKey ? <Key>{it.i + 1}</Key> : ""}
              </span>
              <span className="min-w-0">{it.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // أجب باختصار / مقالي: أسطر منقّطة للإجابة
  const lines = linesOf(q);
  const model = typeof a === "string" ? a : "";
  return (
    <div className="px-1">
      <div className="flex items-start gap-1"><Num n={n} /><p className="min-w-0 flex-1">{q.text}</p><Mark q={q} t={t} /></div>
      {img}
      <div style={{ paddingInlineStart: "6mm" }}>
        {answerKey && model
          ? <p className="mt-1 whitespace-pre-line" style={{ color: KEY, ...INK }}>{model}</p>
          : Array.from({ length: lines }).map((_, k) => (
              <div key={k} className="border-b border-dotted" style={{ borderColor: "#666", height: "8mm" }} />
            ))}
      </div>
    </div>
  );
}

/** صورة السؤال تحته، بعرضها المحدّد (نسبة من عرض الورقة) */
function QImage({ q, images }) {
  const src = q.image_path ? images?.[q.image_path] : null;
  if (!src) return null;
  return (
    <div className="my-1 flex justify-center px-1">
      <img src={src} alt="" style={{ width: `${Math.min(100, Math.max(20, Number(q.image_width) || 60))}%`,
                                     maxHeight: "95mm", objectFit: "contain", display: "block" }} />
    </div>
  );
}
