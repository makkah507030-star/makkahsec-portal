// src/pages/teacher/MyQuizzes.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES, todayISO } from "../../lib/schoolTime";
import QuizPaper, { QuizPrintArea } from "../../components/QuizPaper.jsx";

/* =====================================================================
   اختباراتي — اختبارات المعلم القصيرة.
   الاختبار وحدة مستقلة يملكها المعلم، يُسندها لفصل أو أكثر،
   وأنماط أسئلته ثلاثة تُصحَّح آليًا: اختيار متعدد، صح وخطأ، مزاوجة.
   ===================================================================== */

// حدود التصميم: الورقة العرضية تتّسع لهذا العدد فقط، ليبقى شكلها
// موحّدًا وبطاقتها قابلة للقراءة الآلية.
const KINDS = [
  { key: "mcq",       label: "اختيار متعدد", max: 5 },
  { key: "truefalse", label: "صح وخطأ",      max: 5 },
  { key: "match",     label: "مزاوجة",       max: 1 },
];
const MATCH_MAX_ITEMS = 5;

const PERIODS = [
  { key: "period1", label: "الفترة الأولى" },
  { key: "period2", label: "الفترة الثانية" },
  { key: "final",   label: "النهائي" },
];

const STATUS = {
  draft:   { t: "مسودة",        c: "bg-canvas text-muted" },
  ready:   { t: "جاهز للطباعة", c: "bg-mint-tint text-mint-deep" },
  marking: { t: "قيد التصحيح",  c: "bg-warning/10 text-warning" },
  closed:  { t: "مُقفل",        c: "bg-present/10 text-present" },
};

const LETTERS = ["أ", "ب", "ج", "د", "هـ"];

export default function MyQuizzes() {
  const { session, profile } = useSession();
  const uid = session?.user?.id;

  const [list, setList] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("quizzes")
      .select("*").eq("teacher_id", uid).order("created_at", { ascending: false });
    setList(data ?? []);
  };

  useEffect(() => { if (uid) load(); }, [uid]);

  const open = (list ?? []).find((q) => q.id === openId);
  if (open) {
    return <QuizEditor quiz={open} uid={uid}
                       onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">اختباراتي</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            اختبارات قصيرة تُصحَّح آليًا وتُرصد في كشف المادة.
            النموذج الواحد يُسند لأكثر من فصل.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setCreating((v) => !v)}>
          {creating ? "إغلاق" : "اختبار جديد"}
        </button>
      </div>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {creating && (
        <NewQuiz uid={uid} onDone={(id, t) => {
          setCreating(false); setMsg(t); load(); if (id) setOpenId(id);
        }} />
      )}

      {!list && <p className="text-sm text-muted">جارٍ التحميل…</p>}
      {list?.length === 0 && (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          لا اختبارات بعد. ابدأ بـ«اختبار جديد».
        </p>
      )}

      <div className="space-y-2">
        {(list ?? []).map((q) => {
          const st = STATUS[q.status] ?? STATUS.draft;
          return (
            <div key={q.id} className="card p-4 transition-colors hover:border-[#CCF2DB]">
              <div className="flex items-start gap-3">
                <button onClick={() => setOpenId(q.id)} className="min-w-0 flex-1 text-right">
                  <p className="truncate text-sm font-bold text-ink">{q.title}</p>
                  <p className="num mt-1 text-xs text-faint">
                    {q.subject_name || "—"}
                    {q.grade ? ` · ${GRADE_NAMES[q.grade]}` : ""}
                    {` · ${PERIODS.find((p) => p.key === q.period)?.label ?? ""}`}
                    {` · ${q.total_marks} درجة`}
                    {q.exam_date ? ` · ${q.exam_date}` : ""}
                  </p>
                </button>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5">
                    {q.lang === "en" && (
                      <span className="chip bg-mint-tint text-mint-deep" dir="ltr">EN</span>
                    )}
                    <span className={`chip ${st.c}`}>{st.t}</span>
                  </div>
                  <button onClick={async () => {
                            if (!window.confirm(
                              `حذف «${q.title}» نهائيًا؟\n\nسيُحذف معه كل أسئلته ودرجات الطلاب.`)) return;
                            await supabase.from("quizzes").delete().eq("id", q.id);
                            load();
                          }}
                          title="حذف الاختبار"
                          className="grid h-7 w-7 place-items-center rounded-full border border-line text-faint transition-colors hover:border-absent hover:bg-absent/10 hover:text-absent">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- اختبار جديد --------------------------- */
function NewQuiz({ uid, onDone }) {
  const [subjects, setSubjects] = useState([]);
  const [f, setF] = useState({
    title: "", subject_id: "", grade: "", period: "period1", lang: "ar",
    total_marks: 20, exam_date: todayISO(), duration_min: 30, instructions: "",
  });
  const [busy, setBusy] = useState(false);

  // مواد المعلم وصفوفه من جدوله
  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));

      const { data: t } = await supabase.from("teachers")
        .select("id").eq("user_id", uid).maybeSingle();
      if (!t) return;

      const { data: sch } = await supabase.from("schedule")
        .select("subject_id, subjects(name), classes(grade)")
        .eq("teacher_id", t.id)
        .eq("academic_year", m.active_year ?? "")
        .eq("term", Number(m.active_term ?? 1));

      const seen = new Map();
      (sch ?? []).forEach((r) => {
        if (r.subject_id && !seen.has(r.subject_id)) {
          seen.set(r.subject_id, { id: r.subject_id, name: r.subjects?.name ?? "" });
        }
      });
      setSubjects([...seen.values()]);
    })();
  }, [uid]);

  const save = async () => {
    if (f.title.trim().length < 3) return;
    setBusy(true);
    const { data: st } = await supabase.from("settings")
      .select("key, value").in("key", ["active_year", "active_term"]);
    const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
    const subj = subjects.find((s) => s.id === f.subject_id);

    const { data, error } = await supabase.from("quizzes").insert({
      teacher_id: uid,
      title: f.title.trim(),
      subject_id: f.subject_id || null,
      subject_name: subj?.name ?? null,
      grade: f.grade ? Number(f.grade) : null,
      period: f.period,
      total_marks: Number(f.total_marks) || 20,
      exam_date: f.exam_date || null,
      duration_min: Number(f.duration_min) || null,
      instructions: f.instructions.trim() || null,
      lang: f.lang,
      academic_year: m.active_year ?? null,
      term: Number(m.active_term ?? 1),
    }).select("id").single();

    setBusy(false);
    if (error) { onDone(null, { ok: false, text: error.message }); return; }
    onDone(data.id, { ok: true, text: "أُنشئ الاختبار. أضف أسئلته الآن." });
  };

  return (
    <section className="card space-y-4 p-4">
      <div>
        <label className="text-xs text-muted">عنوان الاختبار</label>
        <input className="field mt-1 w-full" value={f.title}
               placeholder="مثال: اختبار الفترة الأولى — الوحدة الثانية"
               onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted">المادة</label>
          <select className="field mt-1 w-full" value={f.subject_id}
                  onChange={(e) => setF((x) => ({ ...x, subject_id: e.target.value }))}>
            <option value="">اختر المادة…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">الصف</label>
          <select className="field mt-1 w-full" value={f.grade}
                  onChange={(e) => setF((x) => ({ ...x, grade: e.target.value }))}>
            <option value="">كل الصفوف</option>
            {[1, 2, 3].map((g) => <option key={g} value={g}>{GRADE_NAMES[g]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">لغة ورقة الاختبار</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[["ar", "عربية — من اليمين"], ["en", "English — left to right"]].map(([v, t]) => (
            <button key={v} type="button"
                    onClick={() => setF((x) => ({
                      ...x, lang: v,
                      instructions: x.instructions ||
                        (v === "en" ? "Read each question carefully before answering." : ""),
                    }))}
              className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                f.lang === v ? "bg-mint-deep text-white"
                             : "border border-line bg-white text-muted hover:bg-canvas"}`}
              dir={v === "en" ? "ltr" : "rtl"}>
              {t}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-faint">
          الإنجليزية تقلب اتجاه الورقة وترويستها وتعليماتها.
        </p>
      </div>

      <div>
        <label className="text-xs text-muted">الفترة</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} type="button"
                    onClick={() => setF((x) => ({ ...x, period: p.key }))}
              className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                f.period === p.key ? "bg-mint-deep text-white"
                                   : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted">الدرجة الكلية</label>
          <input className="field num mt-1 w-full" inputMode="numeric" value={f.total_marks}
                 onChange={(e) => setF((x) => ({ ...x, total_marks: e.target.value.replace(/\D/g, "") }))} />
        </div>
        <div>
          <label className="text-xs text-muted">تاريخ الاختبار</label>
          <input type="date" className="field num mt-1 w-full" value={f.exam_date}
                 onChange={(e) => setF((x) => ({ ...x, exam_date: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted">المدة (دقيقة)</label>
          <input className="field num mt-1 w-full" inputMode="numeric" value={f.duration_min}
                 onChange={(e) => setF((x) => ({ ...x, duration_min: e.target.value.replace(/\D/g, "") }))} />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted">
          {f.lang === "en" ? "Instructions shown on the paper" : "تعليمات تظهر أعلى الورقة"}
        </label>
        <input className="field mt-1 w-full" value={f.instructions}
               dir={f.lang === "en" ? "ltr" : "rtl"}
               placeholder={f.lang === "en"
                 ? "e.g. Read each question carefully before answering."
                 : "مثال: اقرأ السؤال جيدًا قبل الإجابة"}
               onChange={(e) => setF((x) => ({ ...x, instructions: e.target.value }))} />
      </div>

      <button className="btn-primary w-full" onClick={save}
              disabled={busy || f.title.trim().length < 3}>
        {busy ? "جارٍ الحفظ…" : "إنشاء الاختبار"}
      </button>
    </section>
  );
}

/* --------------------------- محرّر الاختبار --------------------------- */
function QuizEditor({ quiz, uid, onBack }) {
  const { profile } = useSession();
  const [printing, setPrinting] = useState(null);
  // هل تتّسع الورقة في صفحة واحدة؟ تقيسها نسخة غير مرئية تتحدّث مع كل تعديل
  const [fit, setFit] = useState(null);
  const [q, setQ] = useState(quiz);
  const [questions, setQuestions] = useState(null);
  const [classes, setClasses] = useState([]);
  const [linked, setLinked] = useState([]);
  const [tab, setTab] = useState("questions");
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const [{ data: qs }, { data: lk }] = await Promise.all([
      supabase.from("quiz_questions").select("*").eq("quiz_id", q.id).order("sort_order"),
      supabase.from("quiz_classes").select("*, classes(class_no, grade)").eq("quiz_id", q.id),
    ]);
    setQuestions(qs ?? []);
    setLinked(lk ?? []);
  };

  useEffect(() => { load(); }, [q.id]);

  // فصول المعلم لهذه المادة
  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const { data: t } = await supabase.from("teachers")
        .select("id").eq("user_id", uid).maybeSingle();
      if (!t) return;

      let sq = supabase.from("schedule")
        .select("class_id, classes(class_no, grade)")
        .eq("teacher_id", t.id)
        .eq("academic_year", m.active_year ?? "")
        .eq("term", Number(m.active_term ?? 1));
      if (q.subject_id) sq = sq.eq("subject_id", q.subject_id);

      const { data } = await sq;
      const seen = new Map();
      (data ?? []).forEach((r) => {
        if (r.class_id && !seen.has(r.class_id)) {
          seen.set(r.class_id, { id: r.class_id, ...r.classes });
        }
      });
      setClasses([...seen.values()].filter((c) => !q.grade || c.grade === q.grade));
    })();
  }, [uid, q.subject_id, q.grade]);

  const marksUsed = useMemo(
    () => (questions ?? []).reduce((a, x) => a + Number(x.marks || 0), 0), [questions]);

  const countOf = (kind) => (questions ?? []).filter((x) => x.kind === kind).length;

  const addQuestion = async (kind) => {
    const k = KINDS.find((x) => x.key === kind);
    if (k && countOf(kind) >= k.max) {
      setMsg({ ok: false,
               text: `الحد الأعلى لأسئلة «${k.label}» ${k.max}. التصميم يتّسع لهذا العدد فقط.` });
      return;
    }

    const base = {
      quiz_id: q.id,
      sort_order: (questions?.length ?? 0) + 1,
      kind,
      text: "",
      marks: 1,
    };
    const payload =
      kind === "mcq"
        ? { ...base, options: ["", "", ""], answer: "0" }
        : kind === "truefalse"
        ? { ...base, options: null, answer: "true" }
        : { ...base, options: { left: ["", ""], right: ["", ""] }, answer: {} };

    const { data } = await supabase.from("quiz_questions").insert(payload).select().single();
    if (data) setQuestions((prev) => [...(prev ?? []), data]);
  };

  const patchQ = async (row, fields) => {
    setQuestions((prev) => prev.map((x) => (x.id === row.id ? { ...x, ...fields } : x)));
    await supabase.from("quiz_questions").update(fields).eq("id", row.id);
  };

  const removeQ = async (row) => {
    if (!window.confirm("حذف السؤال؟")) return;
    await supabase.from("quiz_questions").delete().eq("id", row.id);
    setQuestions((prev) => prev.filter((x) => x.id !== row.id));
  };

  const toggleClass = async (c) => {
    const ex = linked.find((l) => l.class_id === c.id);
    if (ex) {
      await supabase.from("quiz_classes").delete().eq("id", ex.id);
      setLinked((prev) => prev.filter((l) => l.id !== ex.id));
    } else {
      const { data } = await supabase.from("quiz_classes")
        .insert({ quiz_id: q.id, class_id: c.id, exam_date: q.exam_date })
        .select("*, classes(class_no, grade)").single();
      if (data) setLinked((prev) => [...prev, data]);
    }
  };

  const removeQuiz = async () => {
    if (!window.confirm(
      `حذف «${q.title}» نهائيًا؟\n\nسيُحذف معه ${questions?.length ?? 0} سؤالًا وكل درجات الطلاب.`)) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", q.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    onBack();
  };

  const setStatus = async (status) => {
    await supabase.from("quizzes").update({ status }).eq("id", q.id);
    setQ((x) => ({ ...x, status }));
    setMsg({ ok: true, text: status === "ready" ? "الاختبار جاهز للطباعة." : "حُفظ." });
  };

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack}
                className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
          ← اختباراتي
        </button>
        <div className="flex items-center gap-2">
          {(questions?.length ?? 0) > 0 && (
            <select className="field py-1.5 text-xs"
                    value=""
                    onChange={(e) => {
                      if (fit && !fit.fits &&
                          !window.confirm("الاختبار أطول من صفحة واحدة: سيُقتطع جزء من الأسئلة عند الطباعة.\nيُفضَّل تقليل عدد الفقرات أو اختصار نصوصها.\n\nهل تريد الطباعة رغم ذلك؟")) {
                        e.target.value = "";
                        return;
                      }
                      const c = linked.find((l) => l.class_id === e.target.value);
                      setPrinting({
                        quiz: q, questions,
                        className: c
                          ? `${GRADE_NAMES[c.classes?.grade] ?? ""} — ${c.classes?.class_no}`
                          : "",
                      });
                      setTimeout(() => window.print(), 200);
                    }}>
              <option value="">طباعة ورقة الاختبار…</option>
              <option value="">بلا تحديد فصل</option>
              {linked.map((l) => (
                <option key={l.class_id} value={l.class_id}>
                  {GRADE_NAMES[l.classes?.grade] ?? ""} — فصل {l.classes?.class_no}
                </option>
              ))}
            </select>
          )}
          <span className={`chip ${(STATUS[q.status] ?? STATUS.draft).c}`}>
            {(STATUS[q.status] ?? STATUS.draft).t}
          </span>
        </div>
      </div>

      {/* مؤشر الصفحة الواحدة — يتحدّث مع كل إضافة أو تعديل في الأسئلة */}
      {(questions?.length ?? 0) > 0 && fit && (
        <p className={`rounded-card px-3 py-2 text-xs ${
          !fit.fits ? "bg-absent/10 text-absent"
          : fit.zoom < 0.85 ? "bg-warning/10 text-warning"
          : "bg-present/10 text-present"}`}>
          {!fit.fits
            ? "الاختبار أطول من صفحة واحدة — سيُقتطع جزء منه عند الطباعة. قلّل عدد الفقرات أو اختصر نصوصها."
            : fit.zoom < 0.85
            ? `الاختبار كامل مع بطاقة الإجابة في صفحة واحدة، بخطّ مصغَّر (${Math.round(fit.zoom * 100)}٪).`
            : "الاختبار كامل مع بطاقة الإجابة في صفحة واحدة."}
        </p>
      )}
      {(questions?.length ?? 0) > 0 && (
        <div aria-hidden="true"
             style={{ position: "fixed", top: 0, left: -10000, visibility: "hidden", pointerEvents: "none" }}>
          <QuizPaper quiz={q} questions={questions} teacherName={profile?.full_name ?? ""}
                     onFit={setFit} />
        </div>
      )}

      {/* الورقة تُرسم خارج الشاشة (لتقيس نفسها وتتّسع في صفحة واحدة) ولا تظهر إلا عند الطباعة */}
      {printing && (
        <QuizPrintArea>
          <QuizPaper {...printing} teacherName={profile?.full_name ?? ""} />
        </QuizPrintArea>
      )}

      <div>
        <h1 className="text-lg font-bold text-ink">{q.title}</h1>
        <p className="num mt-1 text-xs text-muted">
          {q.subject_name || "—"}
          {q.grade ? ` · ${GRADE_NAMES[q.grade]}` : ""}
          {` · ${q.total_marks} درجة`}
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-1.5">
        <button className={pill(tab === "questions")} onClick={() => setTab("questions")}>
          الأسئلة {questions && <span className="num">({questions.length})</span>}
        </button>
        <button className={pill(tab === "classes")} onClick={() => setTab("classes")}>
          الفصول {linked.length > 0 && <span className="num">({linked.length})</span>}
        </button>
      </div>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {tab === "questions" && (
        <div className="no-print space-y-3">
          <div className={`rounded-card border px-4 py-3 ${
            marksUsed === Number(q.total_marks)
              ? "border-[#CCF2DB] bg-mint-tint" : "border-warning/35 bg-warning/5"}`}>
            <p className={`num text-sm font-semibold ${
              marksUsed === Number(q.total_marks) ? "text-mint-deep" : "text-warning"}`}>
              مجموع الدرجات: {marksUsed} من {q.total_marks}
            </p>
            {marksUsed !== Number(q.total_marks) && (
              <p className="mt-0.5 text-xs text-warning/90">
                {marksUsed < Number(q.total_marks)
                  ? `ينقص ${Number(q.total_marks) - marksUsed} درجة`
                  : `تجاوزت ${marksUsed - Number(q.total_marks)} درجة`}
              </p>
            )}
          </div>

          {(questions ?? []).map((row, i) => (
            <QuestionCard key={row.id} row={row} index={i + 1} lang={q.lang ?? "ar"}
                          onPatch={patchQ} onRemove={removeQ} />
          ))}

          <div className="card p-4">
            <p className="text-xs text-muted">إضافة سؤال</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KINDS.map((k) => {
                const n = countOf(k.key);
                const full = n >= k.max;
                return (
                  <button key={k.key} onClick={() => addQuestion(k.key)} disabled={full}
                    className={`rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors ${
                      full ? "border-line bg-canvas text-faint"
                           : "border-[#CCF2DB] bg-mint-tint text-mint-deep hover:bg-[#CCF2DB]"}`}>
                    {k.label} <span className="num opacity-75">({n}/{k.max})</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              الحدود ثابتة ليبقى تصميم الورقة موحّدًا وبطاقتها قابلة للقراءة الآلية.
            </p>
          </div>

          {q.status === "draft" && (questions?.length ?? 0) > 0 && (
            <button className="btn-primary w-full" onClick={() => setStatus("ready")}>
              اعتماد الاختبار وجعله جاهزًا
            </button>
          )}
        </div>
      )}

      <div className="no-print flex justify-end">
        <button onClick={removeQuiz}
                className="flex items-center gap-1.5 rounded-pill border border-absent/40 px-4 py-1.5 text-xs font-semibold text-absent transition-colors hover:bg-absent hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
          حذف الاختبار
        </button>
      </div>

      {tab === "classes" && (
        <section className="no-print card p-4">
          <p className="text-sm font-semibold text-ink">الفصول المسند إليها الاختبار</p>
          <p className="mt-0.5 text-xs text-muted">
            النموذج الواحد يُسند لأكثر من فصل، ولكل فصل كشف تصحيح مستقل.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {classes.map((c) => {
              const on = linked.some((l) => l.class_id === c.id);
              return (
                <button key={c.id} onClick={() => toggleClass(c)}
                  className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    on ? "bg-mint-deep text-white"
                       : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                  {GRADE_NAMES[c.grade]} — فصل {c.class_no}
                </button>
              );
            })}
            {classes.length === 0 && (
              <p className="text-sm text-muted">لا فصول مسندة إليك في هذه المادة.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* --------------------------- بطاقة السؤال --------------------------- */
function QuestionCard({ row, index, onPatch, onRemove, lang = "ar" }) {
  const ltr = lang === "en";
  const [local, setLocal] = useState(row);

  useEffect(() => { setLocal(row); }, [row.id]);

  const save = (fields) => { setLocal((x) => ({ ...x, ...fields })); onPatch(row, fields); };

  const kindLabel = KINDS.find((k) => k.key === row.kind)?.label ?? row.kind;

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-mint-deep text-xs font-bold text-white">
          {index}
        </span>
        <span className="chip bg-mint-tint text-mint-deep">{kindLabel}</span>
        <div className="mr-auto flex items-center gap-2">
          <label className="text-xs text-muted">الدرجة</label>
          <input className="field num w-16 py-1 text-center" inputMode="decimal"
                 value={local.marks}
                 onChange={(e) => setLocal((x) => ({ ...x, marks: e.target.value }))}
                 onBlur={() => save({ marks: Number(local.marks) || 0 })} />
          <button onClick={() => onRemove(row)}
                  className="text-xs font-medium text-absent hover:underline">حذف</button>
        </div>
      </div>

      <textarea rows={2} className="field w-full" value={local.text ?? ""}
                dir={ltr ? "ltr" : "rtl"}
                placeholder={ltr ? "Question text" : "نص السؤال"}
                onChange={(e) => setLocal((x) => ({ ...x, text: e.target.value }))}
                onBlur={() => save({ text: local.text })} />

      {row.kind === "mcq" && (
        <McqEditor local={local} setLocal={setLocal} save={save} ltr={ltr} />
      )}

      {row.kind === "truefalse" && (
        <div className="flex gap-2">
          {(ltr ? [["true", "True"], ["false", "False"]]
                : [["true", "صح"], ["false", "خطأ"]]).map(([v, t]) => (
            <button key={v} onClick={() => save({ answer: v })}
              className={`flex-1 rounded-sm2 border py-2 text-sm font-medium transition-colors ${
                String(local.answer).replace(/"/g, "") === v
                  ? "border-mint-deep bg-mint-deep text-white"
                  : "border-line text-muted hover:bg-canvas"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {row.kind === "match" && (
        <MatchEditor local={local} setLocal={setLocal} save={save} ltr={ltr} />
      )}
    </section>
  );
}

function McqEditor({ local, setLocal, save, ltr = false }) {
  const LTRS = ltr ? ["A", "B", "C", "D", "E"] : LETTERS;
  const opts = Array.isArray(local.options) ? local.options : ["", "", ""];
  const answer = String(local.answer ?? "0").replace(/"/g, "");

  const setOpt = (i, v) => {
    const next = [...opts];
    next[i] = v;
    setLocal((x) => ({ ...x, options: next }));
  };

  return (
    <div className="space-y-2">
      {opts.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <button onClick={() => save({ answer: String(i) })}
            title="تحديدها إجابة صحيحة"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
              answer === String(i) ? "border-mint-deep bg-mint-deep text-white"
                                   : "border-line text-muted hover:border-mint-deep"}`}>
            {LTRS[i]}
          </button>
          <input className="field flex-1" value={o} dir={ltr ? "ltr" : "rtl"}
                 placeholder={ltr ? `Option ${LTRS[i]}` : `الخيار ${LTRS[i]}`}
                 onChange={(e) => setOpt(i, e.target.value)}
                 onBlur={() => save({ options: opts })} />
          {opts.length > 2 && (
            <button onClick={() => {
                      const next = opts.filter((_, k) => k !== i);
                      save({ options: next,
                             answer: String(Math.min(Number(answer), next.length - 1)) });
                    }}
                    className="shrink-0 text-xs text-absent">×</button>
          )}
        </div>
      ))}
      {opts.length < 5 && (
        <button onClick={() => save({ options: [...opts, ""] })}
                className="text-xs font-medium text-mint-deep hover:underline">
          {ltr ? "+ Another option" : "+ خيار آخر"}
        </button>
      )}
      <p className="text-[11px] text-faint">اضغط الحرف لتحديد الإجابة الصحيحة.</p>
    </div>
  );
}

function MatchEditor({ local, setLocal, save, ltr = false }) {
  const LTRS = ltr ? ["A", "B", "C", "D", "E"] : LETTERS;
  const o = local.options ?? { left: ["", ""], right: ["", ""] };
  const left = o.left ?? [];
  const right = o.right ?? [];
  const ans = (typeof local.answer === "object" && local.answer) || {};

  const setSide = (side, i, v) => {
    const next = { ...o, [side]: (side === "left" ? [...left] : [...right]) };
    next[side][i] = v;
    setLocal((x) => ({ ...x, options: next }));
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-faint">
        اكتب عناصر العمودين، ثم اختر لكل عنصر في الأول ما يقابله في الثاني.
      </p>
      {left.map((l, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="num shrink-0 text-xs text-muted">{i + 1}</span>
          <input className="field min-w-[120px] flex-1" value={l} dir={ltr ? "ltr" : "rtl"}
                 placeholder={ltr ? "Column A" : "العمود الأول"}
                 onChange={(e) => setSide("left", i, e.target.value)}
                 onBlur={() => save({ options: o })} />
          <input className="field min-w-[120px] flex-1" value={right[i] ?? ""}
                 dir={ltr ? "ltr" : "rtl"}
                 placeholder={ltr ? "Column B" : "العمود الثاني"}
                 onChange={(e) => setSide("right", i, e.target.value)}
                 onBlur={() => save({ options: o })} />
          <select className="field w-24 shrink-0" value={ans[String(i)] ?? ""}
                  onChange={(e) => save({ answer: { ...ans, [String(i)]: e.target.value } })}>
            <option value="">يقابل…</option>
            {right.map((_, k) => (
              <option key={k} value={String(k)}>{LTRS[k] ?? k + 1}</option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex gap-2">
        {left.length < MATCH_MAX_ITEMS && (
          <button onClick={() => save({ options: { left: [...left, ""], right: [...right, ""] } })}
                  className="text-xs font-medium text-mint-deep hover:underline">
            + زوج آخر
          </button>
        )}
        {left.length > 2 && (
          <button onClick={() => save({
                    options: { left: left.slice(0, -1), right: right.slice(0, -1) } })}
                  className="text-xs font-medium text-absent hover:underline">
            حذف الأخير
          </button>
        )}
      </div>
    </div>
  );
}
