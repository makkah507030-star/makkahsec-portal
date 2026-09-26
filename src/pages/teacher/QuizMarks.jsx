// src/pages/teacher/QuizMarks.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

/* =====================================================================
   التصحيح والدرجات.
   المعلم يختار اختباره وفصله، ثم يرصد إجابات كل طالب بضغطات سريعة،
   فيُصحَّح آليًا وتظهر درجته. والكشف يُطبع بهوية المدرسة.
   ===================================================================== */

const LETTERS = ["أ", "ب", "ج", "د", "هـ"];
const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

export default function QuizMarks() {
  const { session, profile } = useSession();
  const uid = session?.user?.id;

  const [quizzes, setQuizzes] = useState(null);
  const [quizId, setQuizId] = useState("");
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  const [subs, setSubs] = useState({});      // student_id -> submission
  const [active, setActive] = useState(null); // الطالب قيد الرصد
  const [fast, setFast] = useState(false);    // وضع الإدخال السريع
  const [msg, setMsg] = useState(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data } = await supabase.from("quizzes")
        .select("*").eq("teacher_id", uid)
        .in("status", ["ready", "marking", "closed"])
        .order("created_at", { ascending: false });
      setQuizzes(data ?? []);
    })();
  }, [uid]);

  const quiz = useMemo(
    () => (quizzes ?? []).find((q) => q.id === quizId), [quizzes, quizId]);

  // فصول الاختبار وأسئلته
  useEffect(() => {
    if (!quizId) { setClasses([]); setQuestions([]); setClassId(""); return; }
    (async () => {
      const [{ data: lk }, { data: qs }] = await Promise.all([
        supabase.from("quiz_classes")
          .select("class_id, classes(class_no, grade)").eq("quiz_id", quizId),
        supabase.from("quiz_questions")
          .select("*").eq("quiz_id", quizId).order("sort_order"),
      ]);
      setClasses((lk ?? []).map((l) => ({ id: l.class_id, ...l.classes })));
      setQuestions(qs ?? []);
      setClassId((lk ?? [])[0]?.class_id ?? "");
    })();
  }, [quizId]);

  // طلاب الفصل وإجاباتهم
  const loadClass = async () => {
    if (!classId || !quizId) { setStudents([]); setSubs({}); return; }
    const [{ data: en }, { data: sb }] = await Promise.all([
      supabase.from("student_enrollment")
        .select("students(id, full_name)").eq("class_id", classId).eq("status", "active"),
      supabase.from("quiz_submissions")
        .select("*").eq("quiz_id", quizId).eq("class_id", classId),
    ]);
    setStudents((en ?? []).map((x) => x.students).filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
    setSubs(Object.fromEntries((sb ?? []).map((x) => [x.student_id, x])));
  };

  useEffect(() => { loadClass(); }, [classId, quizId]);

  // حفظ إجابات طالب ثم تصحيحها آليًا
  const saveAnswers = async (student, answers, absent = false) => {
    const existing = subs[student.id];
    const payload = {
      quiz_id: quizId, class_id: classId, student_id: student.id,
      answers, absent, marked_by: uid,
    };
    let id = existing?.id;
    if (id) {
      await supabase.from("quiz_submissions").update(payload).eq("id", id);
    } else {
      const { data } = await supabase.from("quiz_submissions")
        .insert(payload).select("id").single();
      id = data?.id;
    }
    if (id && !absent) await supabase.rpc("grade_submission", { p_submission: id });

    const { data: fresh } = await supabase.from("quiz_submissions")
      .select("*").eq("id", id).maybeSingle();
    if (fresh) setSubs((s) => ({ ...s, [student.id]: fresh }));

    if (quiz?.status === "ready") {
      await supabase.from("quizzes").update({ status: "marking" }).eq("id", quizId);
    }
    setActive(null);
  };

  const markAbsent = async (student) => {
    await saveAnswers(student, {}, true);
    setMsg({ ok: true, text: `سُجّل غياب ${student.full_name}.` });
  };

  const stats = useMemo(() => {
    const done = students.filter((s) => subs[s.id] && !subs[s.id].absent);
    const scores = done.map((s) => Number(subs[s.id].score ?? 0));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      done: done.length,
      absent: students.filter((s) => subs[s.id]?.absent).length,
      avg: Math.round(avg * 10) / 10,
      pass: scores.filter((x) => x >= Number(quiz?.total_marks ?? 20) / 2).length,
    };
  }, [students, subs, quiz]);

  const pill = (on) =>
    `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-ink">التصحيح والدرجات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          اختر الاختبار وفصله، ثم ارصد إجابات كل طالب فتُصحَّح آليًا.
        </p>
      </div>

      <section className="no-print card space-y-3 p-4">
        <div>
          <label className="text-xs text-muted">الاختبار</label>
          <select className="field mt-1 w-full" value={quizId}
                  onChange={(e) => setQuizId(e.target.value)}>
            <option value="">اختر الاختبار…</option>
            {(quizzes ?? []).map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} — {q.subject_name ?? ""} ({q.total_marks} درجة)
              </option>
            ))}
          </select>
        </div>

        {classes.length > 0 && (
          <div>
            <label className="text-xs text-muted">الفصل</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {classes.map((c) => (
                <button key={c.id} className={pill(classId === c.id)}
                        onClick={() => setClassId(c.id)}>
                  {GRADE_NAMES[c.grade]} — فصل {c.class_no}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {msg && (
        <p className={`no-print rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {quizId && classId && students.length > 0 && (
        <>
          <div className="no-print grid grid-cols-4 gap-2 text-center">
            {[["رُصد", `${stats.done}/${students.length}`], ["الغياب", stats.absent],
              ["المتوسط", stats.avg], ["اجتازوا", stats.pass]].map(([t, v]) => (
              <div key={t} className="card px-3 py-3">
                <p className="num text-lg font-bold text-mint-deep">{v}</p>
                <p className="mt-0.5 text-[11px] text-muted">{t}</p>
              </div>
            ))}
          </div>

          <div className="no-print card divide-y divide-line overflow-hidden">
            {students.map((s) => {
              const sub = subs[s.id];
              return (
                <div key={s.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {s.full_name}
                    </p>
                    {sub?.absent ? (
                      <span className="chip bg-absent/10 text-absent">غائب</span>
                    ) : sub?.score != null ? (
                      <span className="num chip bg-present/10 text-present">
                        {sub.score} / {quiz?.total_marks}
                      </span>
                    ) : (
                      <span className="chip bg-canvas text-muted">لم يُرصد</span>
                    )}
                    <button onClick={() => setActive(active?.id === s.id ? null : s)}
                            className="shrink-0 rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">
                      {active?.id === s.id ? "إغلاق" : sub ? "تعديل" : "رصد"}
                    </button>
                  </div>

                  {active?.id === s.id && (
                    <AnswerSheet student={s} questions={questions}
                                 initial={sub?.answers ?? {}}
                                 onSave={(a) => saveAnswers(s, a)}
                                 onAbsent={() => markAbsent(s)} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button className="btn-primary flex-1" onClick={() => setFast(true)}>
              الإدخال السريع
            </button>
            <button className="flex-1 rounded-pill border border-line py-2 text-sm font-semibold text-muted hover:bg-canvas"
                    disabled={stats.done === 0}
                    onClick={() => { setPrinting(true); setTimeout(() => window.print(), 60); }}>
              طباعة كشف الدرجات
            </button>
          </div>
        </>
      )}

      {fast && (
        <FastEntry students={students} questions={questions} subs={subs} quiz={quiz}
                   onSave={saveAnswers} onAbsent={markAbsent}
                   onClose={() => { setFast(false); loadClass(); }} />
      )}

      {printing && quiz && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * { visibility: hidden !important; }
              #qz-sheet, #qz-sheet * { visibility: visible !important; }
              #qz-sheet { position: absolute; inset: 0; background: #fff; }
              #qz-sheet tr { break-inside: avoid; }
              .no-print { display: none !important; }
            }
            @page { size: 210mm 297mm; margin: 0; }
          ` }} />
          <div id="qz-sheet" className="hidden print:block">
            <div className="mx-auto bg-white text-ink"
                 style={{ width: "210mm", minHeight: "297mm", padding: "13mm 14mm",
                          fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="text-[11px] font-medium leading-[1.9]">
                  <div>المملكة العربية السعودية</div>
                  <div>وزارة التعليم</div>
                  <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
                  <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
                </div>
                <div className="flex items-center gap-4">
                  <img src={moeLogo} alt="" className="h-10 w-auto" />
                  <img src={logoIcon} alt="" className="h-10 w-auto" />
                </div>
              </div>
              <div className="mt-2.5 h-px w-full" style={{
                background: "linear-gradient(90deg,transparent,#3E635022 12%,#3E6350 50%,#3E635022 88%,transparent)",
                ...INK }} />

              <div className="mt-5 text-center">
                <span className="rounded-pill px-5 py-1.5 text-[12.5px] font-semibold"
                      style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
                  كشف درجات اختبار
                </span>
                <p className="mt-2 text-[15px] font-bold">{quiz.title}</p>
                <p className="num mt-1 text-[12px] text-muted">
                  {quiz.subject_name} ·{" "}
                  {classes.find((c) => c.id === classId)
                    ? `${GRADE_NAMES[classes.find((c) => c.id === classId).grade]} — فصل ${classes.find((c) => c.id === classId).class_no}`
                    : ""}
                  {" "}· من {quiz.total_marks} درجة
                </p>
              </div>

              <table className="mt-5 w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {["م", "اسم الطالب", "الدرجة", "النسبة", "ملاحظات"].map((h) => (
                      <th key={h} className="border border-line px-2 py-2 text-center font-semibold text-mint-deep"
                          style={{ background: "#EDFAF2", ...INK }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const sub = subs[s.id];
                    const sc = sub?.absent ? null : sub?.score;
                    return (
                      <tr key={s.id}>
                        <td className="num border border-line px-2 py-1.5 text-center">{i + 1}</td>
                        <td className="border border-line px-2 py-1.5">{s.full_name}</td>
                        <td className="num border border-line px-2 py-1.5 text-center">
                          {sub?.absent ? "غائب" : sc ?? "—"}
                        </td>
                        <td className="num border border-line px-2 py-1.5 text-center">
                          {sc != null ? `${Math.round((sc / Number(quiz.total_marks)) * 100)}%` : "—"}
                        </td>
                        <td className="border border-line px-2 py-1.5">&nbsp;</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="num mt-3 text-[11.5px] text-muted">
                المتوسط: {stats.avg} · اجتاز: {stats.pass} من {stats.done} · الغياب: {stats.absent}
              </p>

              <div className="mt-10 grid grid-cols-2 gap-8 text-center">
                <div>
                  <p className="text-[12px] text-muted">معلم المادة</p>
                  <div className="h-8" />
                  <div className="mx-auto h-px w-44 bg-line" />
                  <p className="mt-1.5 text-[12.5px] font-semibold">{profile?.full_name ?? "…"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted">مدير المدرسة</p>
                  <div className="h-8" />
                  <div className="mx-auto h-px w-44 bg-line" />
                  <p className="mt-1.5 text-[12.5px] font-semibold">عبدالله بن حسن سليمان الفيفي</p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[10px] text-faint">
                <span>بوابة مكة الثانوية الرقمية</span>
                <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------- رصد إجابات طالب بضغطات سريعة ------------------- */
function AnswerSheet({ student, questions, initial, onSave, onAbsent }) {
  const [ans, setAns] = useState(initial ?? {});
  const [busy, setBusy] = useState(false);

  const set = (qid, v) => setAns((a) => ({ ...a, [qid]: v }));

  const setMatch = (qid, i, v) =>
    setAns((a) => ({ ...a, [qid]: { ...(a[qid] ?? {}), [String(i)]: v } }));

  return (
    <div className="mt-3 space-y-3 rounded-sm2 bg-mint-tint/40 p-3">
      {questions.map((q, i) => (
        <div key={q.id}>
          <p className="text-xs font-medium text-ink">
            <span className="num">{i + 1}.</span>{" "}
            {q.text ? (q.text.length > 60 ? q.text.slice(0, 60) + "…" : q.text) : "—"}
            <span className="num text-faint"> ({q.marks})</span>
          </p>

          {q.kind === "mcq" && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(q.options ?? []).map((_, k) => (
                <button key={k} onClick={() => set(q.id, String(k))}
                  className={`h-9 w-9 rounded-full border text-xs font-bold transition-colors ${
                    String(ans[q.id]) === String(k)
                      ? "border-mint-deep bg-mint-deep text-white"
                      : "border-line bg-white text-muted hover:border-mint-deep"}`}>
                  {LETTERS[k]}
                </button>
              ))}
            </div>
          )}

          {q.kind === "truefalse" && (
            <div className="mt-1 flex gap-1.5">
              {[["true", "صح"], ["false", "خطأ"]].map(([v, t]) => (
                <button key={v} onClick={() => set(q.id, v)}
                  className={`rounded-pill px-4 py-1.5 text-xs font-semibold transition-colors ${
                    ans[q.id] === v ? "bg-mint-deep text-white"
                                    : "border border-line bg-white text-muted"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {q.kind === "match" && (
            <div className="mt-1 flex flex-wrap gap-2">
              {(q.options?.left ?? []).map((_, k) => (
                <div key={k} className="flex items-center gap-1">
                  <span className="num text-[11px] text-muted">{k + 1}</span>
                  <select className="field w-16 py-1 text-center text-xs"
                          value={ans[q.id]?.[String(k)] ?? ""}
                          onChange={(e) => setMatch(q.id, k, e.target.value)}>
                    <option value="">—</option>
                    {(q.options?.right ?? []).map((_, r) => (
                      <option key={r} value={String(r)}>{LETTERS[r] ?? r + 1}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn-primary flex-1" disabled={busy}
                onClick={async () => { setBusy(true); await onSave(ans); setBusy(false); }}>
          حفظ وتصحيح
        </button>
        <button onClick={onAbsent} disabled={busy}
                className="rounded-pill border border-absent/40 px-4 py-2 text-sm font-semibold text-absent hover:bg-absent/5">
          غائب
        </button>
      </div>
    </div>
  );
}


/* =====================================================================
   الإدخال السريع — الغرض منه ألّا يكون الرصد إعادة تصحيح يدوي:
   الطالب أمامك، والخيارات أزرار كبيرة، وبمجرد اختيار إجابة ينتقل
   للسؤال التالي، وبعد آخر سؤال يُحفظ ويُصحَّح وينتقل للطالب التالي.
   فثلاثة أسئلة = ثلاث ضغطات لكل طالب.
   ===================================================================== */
function FastEntry({ students, questions, subs, quiz, onSave, onAbsent, onClose }) {
  const [si, setSi] = useState(() => {
    const first = students.findIndex((s) => !subs[s.id]);
    return first >= 0 ? first : 0;
  });
  const [qi, setQi] = useState(0);
  const [ans, setAns] = useState({});
  const [busy, setBusy] = useState(false);
  const [lastScore, setLastScore] = useState(null);

  const student = students[si];
  const q = questions[qi];

  useEffect(() => { setAns(subs[student?.id]?.answers ?? {}); setQi(0); }, [si]);

  const finish = async (answers) => {
    setBusy(true);
    await onSave(student, answers);
    setBusy(false);
    setLastScore(student.full_name);
    if (si + 1 < students.length) { setSi(si + 1); }
    else { onClose(); }
  };

  const choose = (value) => {
    const next = { ...ans, [q.id]: value };
    setAns(next);
    if (qi + 1 < questions.length) setQi(qi + 1);
    else finish(next);
  };

  const chooseMatch = (k, v) => {
    const cur = { ...(ans[q.id] ?? {}), [String(k)]: v };
    const next = { ...ans, [q.id]: cur };
    setAns(next);
    // تنتقل تلقائيًا بعد إكمال كل عناصر المزاوجة
    if (Object.keys(cur).length >= (q.options?.left ?? []).length) {
      if (qi + 1 < questions.length) setQi(qi + 1);
      else finish(next);
    }
  };

  if (!student || !q) return null;
  const done = students.filter((s) => subs[s.id]).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* الرأس */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <button onClick={onClose}
                className="rounded-pill border border-line px-3 py-1 text-xs text-muted">
          إنهاء
        </button>
        <p className="num text-xs text-muted">
          الطالب {si + 1} من {students.length} · رُصد {done}
        </p>
      </div>

      {/* الطالب */}
      <div className="border-b border-line bg-mint-tint px-4 py-3 text-center">
        <p className="text-base font-bold text-ink">{student.full_name}</p>
        {subs[student.id] && (
          <p className="num mt-0.5 text-[11px] text-mint-deep">
            رُصد سابقًا: {subs[student.id].absent ? "غائب" : subs[student.id].score}
          </p>
        )}
      </div>

      {/* السؤال */}
      <div className="flex flex-1 flex-col justify-center px-5 py-6">
        <p className="num text-center text-xs text-faint">
          السؤال {qi + 1} من {questions.length}
        </p>
        <p className="mt-2 text-center text-sm leading-relaxed text-ink">
          {q.text || "—"}
        </p>

        {q.kind === "mcq" && (
          <div className="mx-auto mt-6 flex w-full max-w-sm flex-wrap justify-center gap-3">
            {(q.options ?? []).map((_, k) => (
              <button key={k} onClick={() => choose(String(k))} disabled={busy}
                className={`grid h-16 w-16 place-items-center rounded-2xl border-2 text-xl font-bold transition-colors ${
                  String(ans[q.id]) === String(k)
                    ? "border-mint-deep bg-mint-deep text-white"
                    : "border-line text-ink hover:border-mint-deep"}`}>
                {LETTERS[k]}
              </button>
            ))}
          </div>
        )}

        {q.kind === "truefalse" && (
          <div className="mx-auto mt-6 flex w-full max-w-sm gap-3">
            {[["true", "صح"], ["false", "خطأ"]].map(([v, t]) => (
              <button key={v} onClick={() => choose(v)} disabled={busy}
                className={`h-16 flex-1 rounded-2xl border-2 text-lg font-bold transition-colors ${
                  ans[q.id] === v ? "border-mint-deep bg-mint-deep text-white"
                                  : "border-line text-ink hover:border-mint-deep"}`}>
                {t}
              </button>
            ))}
          </div>
        )}

        {q.kind === "match" && (
          <div className="mx-auto mt-5 w-full max-w-md space-y-2">
            {(q.options?.left ?? []).map((l, k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="num w-6 shrink-0 text-sm font-bold text-muted">{k + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{l}</span>
                <div className="flex shrink-0 gap-1">
                  {(q.options?.right ?? []).map((_, r) => (
                    <button key={r} onClick={() => chooseMatch(k, String(r))} disabled={busy}
                      className={`h-9 w-9 rounded-lg border text-xs font-bold transition-colors ${
                        ans[q.id]?.[String(k)] === String(r)
                          ? "border-mint-deep bg-mint-deep text-white"
                          : "border-line text-muted"}`}>
                      {LETTERS[r]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* الأدوات */}
      <div className="flex gap-2 border-t border-line px-4 py-3">
        <button onClick={() => qi > 0 ? setQi(qi - 1) : si > 0 && setSi(si - 1)}
                disabled={busy || (qi === 0 && si === 0)}
                className="rounded-pill border border-line px-4 py-2 text-sm text-muted disabled:opacity-40">
          السابق
        </button>
        <button onClick={async () => { await onAbsent(student);
                          si + 1 < students.length ? setSi(si + 1) : onClose(); }}
                disabled={busy}
                className="rounded-pill border border-absent/40 px-4 py-2 text-sm font-semibold text-absent">
          غائب
        </button>
        <button onClick={() => finish(ans)} disabled={busy}
                className="btn-primary flex-1">
          {busy ? "جارٍ الحفظ…" : qi + 1 < questions.length ? "حفظ الآن" : "حفظ والتالي"}
        </button>
      </div>
    </div>
  );
}
