// src/pages/lab/exams/ExamPage.jsx
// صفحة اختبار في مركز اختبارات التقنية الرقمية بتبويباتها:
// • المحتوى: الأسئلة بإجاباتها، أو مهام العملي وبطاقاته بمعاييرها.
// • الطباعة: ورقة الاختبار لكل طالب ببطاقة إجابة تُقرأ بالكاميرا ومفتاح الإجابة، أو بطاقات المهام لكل طالب.
// • الأجهزة: ملف الاختبار لأجهزة المعمل دون إنترنت، ومفتاح الفتح يُعرض على السبورة.
// • الرصد: الدرجات لكل فصل من رموز الأجهزة وبطاقات الإجابة وسلّم التقدير، وتُنقل إلى سجل التطبيقات.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { notify } from "../../../lib/notice";
import { confirmDanger } from "../../../lib/danger";
import QuizPaper, { QuizPrintArea } from "../../../components/QuizPaper.jsx";
import { EXAM_GRADES, paperQuiz, sealPayload } from "../../../lib/labExam.js";
import { PRACTICAL_MODES } from "../../../lib/labPractical.js";
import { classStudents, gradeClasses } from "../../../lib/labExamData.js";
import { buildLabFile, downloadText } from "../labFile.js";
import { ExamQuestion } from "./ExamBank.jsx";
import ExamRecord from "./ExamRecord.jsx";
import { TaskCardsPrint } from "./ExamPrint.jsx";

// صور الأسئلة: لا صور في بنك المعمل، وكائن ثابت لأن الورقة تعيد القياس كلما تغيّر
const NO_IMAGES = {};
const tab = (on) => `w-28 shrink-0 rounded-sm2 py-2 text-sm font-semibold ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`;

export default function ExamPage({ exam: initial, onBack, onDeleted }) {
  const [exam, setExam] = useState(initial);
  const theory = exam.kind === "theory";
  const hasDevice = theory || exam.body?.autoMarks > 0;
  const TABS = [["content", "المحتوى"], ["print", "الطباعة"], ...(hasDevice ? [["device", "الأجهزة"]] : []), ["record", "الرصد"]];
  const [t, setT] = useState("content");
  const [classes, setClasses] = useState([]);
  useEffect(() => { gradeClasses(exam.grade, exam.lab_id).then((c) => setClasses(c.filter((x) => exam.classes.includes(x.class_id)))); }, [exam]);

  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف «${exam.title}»`, impact: ["تُحذف نتائج الطلاب في هذا الاختبار. الدرجات المنقولة إلى سجل التطبيقات تبقى فيه، وتُحذف من هناك إن أردت."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("lab_exams").delete().eq("id", exam.id);
    if (error) notify({ ok: false, text: error.message }); else onDeleted();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" onClick={onBack}>رجوع</button>
        <span className="flex-1" />
        <button type="button" className="text-sm text-danger" onClick={remove}>حذف</button>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-muted">{theory ? "نظري" : `عملي · ${PRACTICAL_MODES[exam.body?.mode]?.t}`} · {EXAM_GRADES[exam.grade]?.t} · من <span className="num">{exam.total}</span>{exam.duration ? <> · <span className="num">{exam.duration}</span> دقيقة</> : null}</p>
        <h2 className="text-lg font-bold text-ink">{exam.title}</h2>
        <p className="text-[12px] text-muted">الفصول: {classes.map((c) => c.class_no).join("، ") || "—"}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto">{TABS.map(([k, l]) => <button key={k} type="button" className={tab(t === k)} onClick={() => setT(k)}>{l}</button>)}</div>
      {t === "content" && (theory ? <TheoryContent exam={exam} /> : <PracticalContent exam={exam} />)}
      {t === "print" && <PrintTab exam={exam} classes={classes} />}
      {t === "device" && <DeviceTab exam={exam} classes={classes} onExam={setExam} />}
      {t === "record" && <ExamRecord exam={exam} classes={classes} />}
    </div>
  );
}

function TheoryContent({ exam }) {
  const qs = exam.body?.questions ?? [];
  return <div className="space-y-2">{qs.map((q, i) => <ExamQuestion key={q.id} q={q} n={i + 1} />)}</div>;
}

function PracticalContent({ exam }) {
  const b = exam.body ?? {};
  return (
    <div className="space-y-3">
      {b.autoMarks > 0 && (
        <section className="card space-y-2 p-4">
          <h3 className="font-bold text-ink">مهام الأجهزة <span className="num text-sm font-normal text-muted">({b.autoMarks} درجة)</span></h3>
          {b.tasks.map((x, i) => <p key={x.id} className="text-sm text-ink"><span className="num text-muted">{i + 1}.</span> {x.title} <span className="text-[11.5px] text-muted">· {x.lessonTitle} · {x.marks} درجة</span></p>)}
        </section>)}
      {b.rubricMarks > 0 && b.cards.map((c) => (
        <section key={c.id} className="card space-y-2 p-4">
          <h3 className="font-bold text-ink">{c.title} <span className="text-[12px] font-normal text-muted">· {c.app}</span></h3>
          <p className="text-sm leading-relaxed text-ink">{c.task}</p>
          <table className="w-full text-sm"><tbody>{c.criteria.map((x) => (
            <tr key={x.t} className="border-t border-line/60"><td className="py-1.5 text-ink">{x.t}</td><td className="num w-16 py-1.5 text-left font-semibold text-mint-deep">{x.m}</td></tr>))}</tbody></table>
        </section>))}
    </div>
  );
}

/* ---------------- الطباعة ---------------- */
function PrintTab({ exam, classes }) {
  const [cls, setCls] = useState(classes[0]?.class_id ?? null);
  const [students, setStudents] = useState(null);
  const [printing, setPrinting] = useState(null);   // "papers" | "key" | "blank" | "cards"
  useEffect(() => { if (!cls && classes[0]) setCls(classes[0].class_id); }, [classes, cls]);
  useEffect(() => { if (cls) classStudents(cls, exam.lab_id).then(setStudents); }, [cls, exam.lab_id]);
  useEffect(() => {
    if (!printing) return undefined;
    const t = setTimeout(() => { window.print(); setPrinting(null); }, 900);
    return () => clearTimeout(t);
  }, [printing]);
  const qs = exam.body?.questions ?? [];
  // كائن ثابت: الورقة تعيد القياس كلما تغيّر، فكائن جديد في كل عرض يدخلها في حلقة
  const quiz = useMemo(() => paperQuiz(exam), [exam]);
  const cName = classes.find((c) => c.class_id === cls);
  const keyQs = useMemo(() => qs.map((q) => ({ ...q })), [qs]);

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="text-sm text-muted">الفصل</span>
        {classes.map((c) => <button key={c.class_id} type="button" onClick={() => setCls(c.class_id)}
          className={`num rounded-pill px-3 py-1 text-xs ${cls === c.class_id ? "bg-mint-deep text-white" : "border border-line text-muted"}`}>{c.class_no}</button>)}
        <span className="text-[12px] text-muted">· <span className="num">{students?.length ?? 0}</span> طالبًا</span>
      </div>
      {exam.kind === "theory" ? (
        <div className="card space-y-2 p-4">
          <p className="text-sm leading-relaxed text-muted">ورقة لكل طالب باسمه، وفي آخرها بطاقة الإجابة بعلاماتها ورمز الطالب، فتُقرأ بالكاميرا من «الرصد» ويُعرف صاحبها تلقائيًا.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!students?.length} onClick={() => setPrinting("papers")}>طباعة أوراق الفصل ({students?.length ?? 0})</button>
            <button type="button" className="btn-ghost" onClick={() => setPrinting("blank")}>ورقة بلا اسم</button>
            <button type="button" className="btn-ghost" onClick={() => setPrinting("key")}>مفتاح الإجابة</button>
          </div>
          <p className="text-[11.5px] text-faint">في نافذة الطباعة: الورق A4، والهوامش «بلا»، وفعّل «طباعة الخلفيات».</p>
        </div>
      ) : (
        <div className="card space-y-2 p-4">
          <p className="text-sm leading-relaxed text-muted">{exam.body?.rubricMarks > 0 ? "بطاقة لكل طالب باسمه فيها مهمته بالقرعة ومعايير تقييمها، وفيها مهام الأجهزة إن وُجدت." : "ورقة تعليمات لكل طالب بمهام الأجهزة ومفتاح الفتح يُعلن عند البدء."}</p>
          <button type="button" className="btn-primary" disabled={!students?.length} onClick={() => setPrinting("cards")}>طباعة بطاقات الفصل ({students?.length ?? 0})</button>
        </div>
      )}
      {printing && exam.kind === "theory" && (
        <QuizPrintArea>
          {printing === "papers" && students.map((s) => <QuizPaper key={s.id} images={NO_IMAGES} quiz={quiz} questions={qs} className={`فصل ${cName?.class_no ?? ""}`} studentName={s.full_name} studentId={s.id} />)}
          {printing === "blank" && <QuizPaper images={NO_IMAGES} quiz={quiz} questions={qs} className={`فصل ${cName?.class_no ?? ""}`} />}
          {printing === "key" && <AnswerKeySheet exam={exam} questions={keyQs} />}
        </QuizPrintArea>
      )}
      {printing === "cards" && students && <TaskCardsPrint exam={exam} students={students} classNo={cName?.class_no} />}
    </div>
  );
}

function AnswerKeySheet({ exam, questions }) {
  const L = ["أ", "ب", "ج", "د", "هـ", "و"];
  const ans = (q) => (q.kind === "mcq" ? L[Number(q.answer)] : q.kind === "truefalse" ? (q.answer === "true" ? "صح" : "خطأ")
    : Object.keys(q.answer).map((k) => `${Number(k) + 1}←${L[Number(q.answer[k])]}`).join("  "));
  return (
    <div className="sheet" dir="rtl" style={{ width: "210mm", minHeight: "297mm", padding: "16mm", background: "#fff", fontFamily: "'IBM Plex Sans Arabic', sans-serif", color: "#000" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>مفتاح الإجابة · {exam.title}</h1>
      <p style={{ fontSize: 12, marginBottom: 10 }}>{EXAM_GRADES[exam.grade]?.subject} · من {exam.total} درجة</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead><tr style={{ background: "#EEE" }}><th style={{ border: "1px solid #000", padding: 4 }}>م</th><th style={{ border: "1px solid #000", padding: 4 }}>السؤال</th><th style={{ border: "1px solid #000", padding: 4 }}>الإجابة</th><th style={{ border: "1px solid #000", padding: 4 }}>الدرجة</th></tr></thead>
        <tbody>{questions.map((q, i) => (
          <tr key={q.id}><td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{i + 1}</td><td style={{ border: "1px solid #000", padding: 4 }}>{q.text}</td>
            <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: 700 }}>{ans(q)}</td><td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{q.marks}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

/* ---------------- ملف الأجهزة ---------------- */
function DeviceTab({ exam, classes, onExam }) {
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      // قوائم الفصول تُحفظ مع الاختبار، فيُعرف الطالب في رمز نتيجته برقم فصله ورقمه في القائمة
      const rosters = await Promise.all(classes.map(async (c) => ({ class_id: c.class_id, no: c.class_no, students: await classStudents(c.class_id, exam.lab_id) })));
      const body = { ...exam.body, rosters: rosters.map((r) => ({ class_id: r.class_id, ids: r.students.map((s) => s.id) })) };
      const { error } = await supabase.from("lab_exams").update({ body }).eq("id", exam.id);
      if (error) throw error;
      onExam({ ...exam, body });
      const content = exam.kind === "theory"
        ? { questions: exam.body.questions.map(({ answer, ...q }) => q) }      // الإجابات الصحيحة ليست في الملف
        : { tasks: exam.body.tasks };
      const html = await buildLabFile({ mode: "exam", title: exam.title, exam: { code: exam.code, secret: exam.secret, kind: exam.kind, title: exam.title,
        total: exam.kind === "theory" ? exam.total : exam.body.autoMarks, duration: exam.duration, subject: EXAM_GRADES[exam.grade]?.subject,
        classes: rosters.map((r) => ({ no: r.no, roster: r.students.map((s) => s.full_name) })), sealed: sealPayload(content, exam.open_key) } });
      downloadText(html, `اختبار-${exam.code}.html`);
    } catch (e) { notify({ ok: false, text: "تعذّر تجهيز الملف: " + (e.message ?? e) }); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <section className="card space-y-2 p-4">
        <h3 className="font-bold text-ink">١. ملف الاختبار لأجهزة المعمل</h3>
        <p className="text-sm leading-relaxed text-muted">ملف واحد يعمل دون إنترنت، يُنسخ إلى كل جهاز (أو مجلد مشترك) قبل الاختبار. الأسئلة فيه مشفّرة لا تُقرأ قبل إدخال مفتاح الفتح، والإجابات الصحيحة ليست فيه.</p>
        <button type="button" className="btn-primary" disabled={busy || !classes.length} onClick={download}>{busy ? "جارٍ التجهيز…" : "تنزيل ملف الاختبار"}</button>
        <p className="text-[11.5px] text-faint">أعد التنزيل إن تغيّرت قوائم الفصول، فالطالب يُعرف برقمه في قائمة فصله.</p>
      </section>
      <section className="card space-y-2 p-4">
        <h3 className="font-bold text-ink">٢. مفتاح الفتح عند البدء</h3>
        <p className="text-sm text-muted">اعرضه على السبورة لحظة البدء، فيكتبه الطلاب ويبدأ الوقت.</p>
        <button type="button" className="btn-ghost" onClick={() => setBoard(true)}>عرض المفتاح على السبورة</button>
      </section>
      <section className="card space-y-1 p-4 text-sm text-muted">
        <h3 className="font-bold text-ink">٣. التسليم والرصد</h3>
        <p>عند التسليم أو انتهاء الوقت يظهر على شاشة الطالب رمز QR بإجاباته موقّعًا. امسحه من «الرصد ← مسح رموز الأجهزة»، فيُصحَّح ويُرصد في سجل التطبيقات.</p>
      </section>
      {board && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-mint-deep p-6 text-white" onClick={() => setBoard(false)}>
          <p className="text-2xl font-bold">{exam.title}</p>
          <p className="text-lg opacity-80">مفتاح الفتح</p>
          <p className="num text-[18vw] font-bold leading-none tracking-[0.15em]" dir="ltr">{exam.open_key}</p>
          <p className="text-sm opacity-70">اضغط في أي مكان للإغلاق</p>
        </div>
      )}
    </div>
  );
}
