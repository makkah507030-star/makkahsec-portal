// src/pages/admin/ExamsAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DAY_NAMES, GRADE_NAMES } from "../../lib/schoolTime";
import ExamTable, { ExamPrintArea } from "../../components/ExamTable.jsx";

/* =====================================================================
   جداول الاختبارات.
   • الفترة الأولى والثانية: جدول لكل فصل، مبنيّ على جدوله الدراسي،
     يُظلَّل فيه ما هو اختبار ويُحدَّد تاريخه.
   • النهائية: جدول موحّد لكل صف، تُدخل فيه المواد بتواريخها.
   ===================================================================== */

const KINDS = [
  { key: "period1", label: "اختبار الفترة الأولى" },
  { key: "period2", label: "اختبار الفترة الثانية" },
  { key: "final",   label: "الاختبارات النهائية" },
];

const iso = (d) => d.toISOString().slice(0, 10);

const fmtG = (s) => {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// تاريخ اليوم داخل أسبوع الاختبارات: الأحد = 1 … الخميس = 5
// week = 1 للأسبوع الأول، و2 للأسبوع الثاني إن امتدّت الاختبارات أسبوعين
const dateOfDay = (start, dow, week = 1) => {
  if (!start || !dow) return null;
  const d = new Date(start + "T00:00:00");
  const shift = (dow - 1) - ((d.getDay() + 7) % 7) + (week - 1) * 7;
  d.setDate(d.getDate() + shift);
  return iso(d);
};

// عدد أسابيع الفترة من تاريخي بدايتها ونهايتها
const weeksOf = (start, end) => {
  if (!start || !end) return 1;
  const days = Math.round((new Date(end) - new Date(start)) / 86400000);
  return days >= 7 ? 2 : 1;
};

export default function ExamsAdmin() {
  const [deputy, setDeputy] = useState("");
  const [kind, setKind] = useState("period1");
  const [term, setTerm] = useState(null);
  const [classes, setClasses] = useState([]);
  const [grade, setGrade] = useState(null);
  const [classId, setClassId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [printing, setPrinting] = useState(null);

  // الفترة وبيانات الفصول
  // اسم وكيل شؤون الطلاب للتوقيع على الجداول المطبوعة
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_roles")
        .select("users(full_name)").eq("role_type", "deputy_students").maybeSingle();
      setDeputy(data?.users?.full_name ?? "");
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));

      const { data: t } = await supabase.from("exam_terms")
        .select("*").eq("kind", kind)
        .eq("academic_year", m.active_year ?? "")
        .maybeSingle();
      setTerm(t ?? null);

      if (!classes.length) {
        const { data: c } = await supabase.from("classes")
          .select("id, class_no, grade")
          .eq("academic_year", m.active_year ?? "")
          .order("grade").order("class_no");
        setClasses(c ?? []);
      }
      setClassId(null);
    })();
  }, [kind]);

  const byGrade = useMemo(() => {
    const g = {};
    classes.forEach((c) => { (g[c.grade] ??= []).push(c); });
    return g;
  }, [classes]);

  const saveTerm = async (fields) => {
    if (!term) return;
    const { error } = await supabase.from("exam_terms").update(fields).eq("id", term.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setTerm((t) => ({ ...t, ...fields }));
    setMsg({ ok: true, text: "حُفظ." });
  };

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-5">
      <div className="no-print">
        <h1 className="text-lg font-bold text-ink">جداول الاختبارات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          حدّد أسبوع الاختبارات، ثم ظلّل حصص الاختبار في جدول كل فصل.
          وعند النشر تظهر للمعلم والطالب وولي الأمر.
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button key={k.key} className={pill(kind === k.key)} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>

      {term && (
        <section className="no-print card space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted">بداية فترة الاختبارات</label>
              <input type="date" className="field num mt-1 w-full" value={term.start_date ?? ""}
                     onChange={(e) => saveTerm({ start_date: e.target.value || null })} />
            </div>
            <div>
              <label className="text-xs text-muted">نهايته</label>
              <input type="date" className="field num mt-1 w-full" value={term.end_date ?? ""}
                     onChange={(e) => saveTerm({ end_date: e.target.value || null })} />
            </div>
            <div>
              <label className="text-xs text-muted">ملاحظة تظهر أسفل الجدول</label>
              <input className="field mt-1 w-full" defaultValue={term.note ?? ""}
                     placeholder="مثال: يبدأ الاختبار الساعة السابعة صباحًا"
                     onBlur={(e) => saveTerm({ note: e.target.value || null })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={term.is_published}
                   onChange={(e) => saveTerm({ is_published: e.target.checked })} />
            منشور — يظهر للمعلمين والطلاب وأولياء الأمور
          </label>

          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
        </section>
      )}

      {/* اختيار الفصل أو الصف */}
      {kind === "final" ? (
        <div className="no-print grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((g) => (
            <button key={g} onClick={() => setGrade(g)}
              className={`rounded-card border p-5 text-center transition-colors ${
                grade === g ? "border-mint-deep bg-mint-tint" : "border-line bg-white hover:bg-canvas"}`}>
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-mint-tint">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-mint-deep"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
                </svg>
              </span>
              <p className="text-sm font-bold text-ink">{GRADE_NAMES[g]}</p>
              <p className="num mt-0.5 text-xs text-muted">
                {(byGrade[g] ?? []).length} فصلًا
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="no-print space-y-3">
          {[1, 2, 3].map((g) => (
            (byGrade[g] ?? []).length > 0 && (
              <section key={g} className="card p-4">
                <h2 className="text-sm font-bold text-mint-deep">{GRADE_NAMES[g]}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(byGrade[g] ?? []).map((c) => (
                    <button key={c.id} onClick={() => setClassId(c.id)}
                      className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        classId === c.id ? "bg-mint-deep text-white"
                                         : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                      فصل {c.class_no}
                    </button>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      )}

      {/* المحرّر */}
      {term && kind !== "final" && classId && (
        <ClassExamEditor term={term} cls={classes.find((c) => c.id === classId)}
                         onPrint={setPrinting} />
      )}

      {term && kind === "final" && grade && (
        <FinalExamEditor term={term} grade={grade} onPrint={setPrinting} />
      )}

      {printing && (
        <div className="hidden print:block">
          <ExamPrintArea>
            <ExamTable {...printing} deputy={deputy} />
          </ExamPrintArea>
        </div>
      )}
    </div>
  );
}

/* ------------------- جدول فصل: ظلّل حصص الاختبار ------------------- */
function ClassExamEditor({ term, cls, onPrint }) {
  const [rows, setRows] = useState(null);
  const [slots, setSlots] = useState({});   // "scheduleId|week" -> slot
  const [busy, setBusy] = useState(false);
  const [week, setWeek] = useState(1);      // الأسبوع الجاري تحريره
  const weeks = weeksOf(term.start_date, term.end_date);

  const load = async () => {
    const { data: st } = await supabase.from("settings")
      .select("key, value").in("key", ["active_year", "active_term"]);
    const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));

    const [{ data: sch }, { data: sl }] = await Promise.all([
      supabase.from("schedule")
        .select("id, day_of_week, period_no, subject_id, subjects(name)")
        .eq("class_id", cls.id)
        .eq("academic_year", m.active_year ?? "")
        .eq("term", Number(m.active_term ?? 1))
        .order("day_of_week").order("period_no"),
      supabase.from("exam_slots")
        .select("*").eq("exam_term_id", term.id).eq("class_id", cls.id),
    ]);

    setRows(sch ?? []);
    setSlots(Object.fromEntries((sl ?? []).map((x) => [`${x.schedule_id}|${x.exam_week ?? 1}`, x])));
  };

  useEffect(() => { load(); }, [term.id, cls.id]);

  const key = (row) => `${row.id}|${week}`;

  const toggle = async (row) => {
    setBusy(true);
    const k = key(row);
    const existing = slots[k];
    if (existing) {
      await supabase.from("exam_slots").delete().eq("id", existing.id);
      setSlots((s) => { const n = { ...s }; delete n[k]; return n; });
    } else {
      const payload = {
        exam_term_id: term.id,
        class_id: cls.id,
        grade: cls.grade,
        schedule_id: row.id,
        subject_id: row.subject_id,
        subject_name: row.subjects?.name ?? "",
        day_of_week: row.day_of_week,
        period_no: row.period_no,
        exam_week: week,
        exam_date: dateOfDay(term.start_date, row.day_of_week, week),
      };
      const { data } = await supabase.from("exam_slots").insert(payload).select().single();
      if (data) setSlots((s) => ({ ...s, [k]: data }));
    }
    setBusy(false);
  };

  const grid = useMemo(() => {
    const g = {};
    (rows ?? []).forEach((r) => { (g[r.day_of_week] ??= {})[r.period_no] = r; });
    return g;
  }, [rows]);

  const periods = useMemo(() => {
    const p = new Set();
    (rows ?? []).forEach((r) => p.add(r.period_no));
    return [...p].sort((a, b) => a - b);
  }, [rows]);

  const exams = Object.values(slots).sort((a, b) =>
    ((a.exam_week ?? 1) - (b.exam_week ?? 1)) ||
    (a.day_of_week - b.day_of_week) || (a.period_no - b.period_no));

  if (!rows) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <section className="no-print card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ink">
            {GRADE_NAMES[cls.grade]} — فصل <span className="num">{cls.class_no}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            اضغط الحصة لتحديدها اختبارًا، واضغطها ثانية لإلغائها.
            {term.start_date && <> التاريخ يُحسب من فترة الاختبارات تلقائيًا.</>}
          </p>
        </div>
        <button className="btn-primary" disabled={exams.length === 0}
                onClick={() => { onPrint({ title: term.title, subtitle:
                  `${GRADE_NAMES[cls.grade]} — فصل ${cls.class_no}`, rows: exams, note: term.note });
                  setTimeout(() => window.print(), 50); }}>
          طباعة جدول الفصل
        </button>
      </div>

      {!term.start_date && (
        <p className="mt-3 rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
          حدّد بداية فترة الاختبارات أعلاه ليُحسب تاريخ كل اختبار تلقائيًا.
        </p>
      )}

      {weeks > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">الأسبوع:</span>
          {[1, 2].map((w) => (
            <button key={w} onClick={() => setWeek(w)}
              className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                week === w ? "bg-mint-deep text-white"
                           : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              الأسبوع {w === 1 ? "الأول" : "الثاني"}
              <span className="num opacity-75">
                {" "}({Object.values(slots).filter((x) => (x.exam_week ?? 1) === w).length})
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="border border-line bg-mint-tint px-2 py-2 text-mint-deep">اليوم</th>
              {periods.map((p) => (
                <th key={p} className="border border-line bg-mint-tint px-2 py-2 text-mint-deep">
                  الحصة <span className="num">{p}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((d) => (
              <tr key={d}>
                <td className="border border-line bg-canvas px-2 py-2 font-semibold text-ink">
                  {DAY_NAMES[d]}
                </td>
                {periods.map((p) => {
                  const row = grid[d]?.[p];
                  const on = row && slots[key(row)];
                  return (
                    <td key={p} className="border border-line p-0">
                      {row ? (
                        <button onClick={() => toggle(row)} disabled={busy}
                          className={`h-full w-full px-2 py-2.5 transition-colors ${
                            on ? "bg-mint-deep text-white" : "hover:bg-mint-tint"}`}>
                          <span className="block text-[11.5px] font-medium">
                            {row.subjects?.name ?? "—"}
                          </span>
                          {on && slots[key(row)].exam_date && (
                            <span className="num mt-0.5 block text-[10px] opacity-90">
                              {fmtG(slots[key(row)].exam_date)}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="block px-2 py-3 text-faint">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        المحدّد: <span className="num font-semibold text-mint-deep">{exams.length}</span> اختبارًا
      </p>
    </section>
  );
}

/* ------------------- الاختبارات النهائية: جدول الصف ------------------- */
function FinalExamEditor({ term, grade, onPrint }) {
  const [rows, setRows] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [nf, setNf] = useState({ subject: "", date: "", period: 1 });

  const load = async () => {
    const [{ data: sl }, { data: subs }] = await Promise.all([
      supabase.from("exam_slots").select("*")
        .eq("exam_term_id", term.id).eq("grade", grade)
        .is("class_id", null).order("exam_date").order("period_no"),
      supabase.from("subjects").select("id, name").order("name"),
    ]);
    setRows(sl ?? []);
    setSubjects(subs ?? []);
  };

  useEffect(() => { load(); }, [term.id, grade]);

  const add = async () => {
    if (!nf.subject || !nf.date) return;
    const s = subjects.find((x) => x.id === nf.subject);
    const d = new Date(nf.date + "T00:00:00");
    await supabase.from("exam_slots").insert({
      exam_term_id: term.id, grade,
      subject_id: s?.id ?? null, subject_name: s?.name ?? "",
      exam_date: nf.date, period_no: Number(nf.period) || 1,
      day_of_week: ((d.getDay() + 1) <= 5 ? d.getDay() + 1 : null),
    });
    setNf({ subject: "", date: "", period: 1 });
    load();
  };

  const remove = async (r) => {
    await supabase.from("exam_slots").delete().eq("id", r.id);
    load();
  };

  if (!rows) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <section className="no-print card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">
          {term.title} — {GRADE_NAMES[grade]}
        </h2>
        <button className="btn-primary" disabled={rows.length === 0}
                onClick={() => { onPrint({ title: term.title, subtitle: GRADE_NAMES[grade],
                  rows, note: term.note, final: true });
                  setTimeout(() => window.print(), 50); }}>
          طباعة الجدول
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="text-xs text-muted">المادة</label>
          <select className="field mt-1 w-full" value={nf.subject}
                  onChange={(e) => setNf((f) => ({ ...f, subject: e.target.value }))}>
            <option value="">اختر المادة…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted">تاريخ الاختبار</label>
          <input type="date" className="field num mt-1 w-full" value={nf.date}
                 onChange={(e) => setNf((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted">الفترة</label>
          <select className="field mt-1 w-full" value={nf.period}
                  onChange={(e) => setNf((f) => ({ ...f, period: e.target.value }))}>
            <option value={1}>الفترة الأولى</option>
            <option value={2}>الفترة الثانية</option>
          </select>
        </div>
      </div>

      <button className="btn-primary" onClick={add} disabled={!nf.subject || !nf.date}>
        إضافة اختبار
      </button>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">لم تُضف اختبارات لهذا الصف بعد.</p>
      ) : (
        <div className="divide-y divide-line rounded-card border border-line">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{r.subject_name}</p>
                <p className="num mt-0.5 text-xs text-muted">
                  {fmtG(r.exam_date)}
                  {r.day_of_week ? ` · ${DAY_NAMES[r.day_of_week]}` : ""}
                  {` · الفترة ${r.period_no}`}
                </p>
              </div>
              <button onClick={() => remove(r)}
                      className="shrink-0 text-xs font-medium text-absent hover:underline">
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
