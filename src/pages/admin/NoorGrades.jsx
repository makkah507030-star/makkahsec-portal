import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate, fmtHijri } from "../../lib/dates";
import { GRADE_NAMES, todayISO } from "../../lib/schoolTime";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import Loader from "../../components/Loader.jsx";
import { countAr } from "../../lib/arabicCount.js";

/* =====================================================================
   متابعة رصد درجات الفترات في نظام نور — لوكيل الشؤون التعليمية والدعم الفني
   والمدير (supabase/noor_grades_1.sql … noor_grades_5.sql).
   • الكشف من الجدول الدراسي: كل مادة بكل فصولها ومعلميها كما في كشف نور،
     وموعد الاختبار من «جداول الاختبارات» إن وُجد (وإلا «بلا تاريخ» دون لون مهلة).
   • نسبة الرصد لكل مادة وصف وفترة (الجزئي نصف)، ولا يُحسب ما لم يحن اختباره.
   • عرضان: «حسب المادة» (الأساس، يطابق كشف نور: المادة ← صفوفها ← فصولها) و«حسب الصف».
     إدخال سريع: تُختار حالة ثم تُضغط الخانات، أو تُطبَّق على كل فصول الصف.
   • الحالة لكل فصل: تم الرصد، أو رصد جزئي (لم يكتمل الفصل)، أو لم يرصد.
     يدخلها الوكيل أو الدعم الفني يدويًا بعد مراجعة نور، ولا إجراء على المعلم.
   • لون الخانة للحالة (أخضر تم، أزرق جزئي، وردي لم يرصد)، ورقمها الأيام منذ
     الاختبار بلون المهلة: حتى يومين أخضر، ومن 3 إلى 5 برتقالي، وبعدها أحمر متأخر.
   ===================================================================== */

// ألوان الحالة كما في كشف المتابعة المعتاد: أخضر تم، وأزرق جزئي، ووردي لم يرصد
const STATUS = {
  done:    { t: "تم الرصد", on: "bg-mint-deep text-white",  cell: "bg-mint-light" },
  partial: { t: "رصد جزئي", on: "bg-excused text-white",    cell: "bg-[#D6E4F5]" },
  none:    { t: "لم يرصد",  on: "bg-danger text-white",     cell: "bg-danger-light" },
};
// لون بطاقة المادة بحسب نسبة رصدها: 90% فأكثر أخضر، ومن 60% برتقالي، وأقل أحمر
function pctTone(p) {
  if (p === null) return { card: "border-line bg-canvas", bar: "bg-faint", text: "text-muted" };
  if (p >= 90) return { card: "border-mint-deep/30 bg-mint-light", bar: "bg-mint-deep", text: "text-mint-deep" };
  if (p >= 60) return { card: "border-warning/30 bg-warning-light", bar: "bg-warning", text: "text-warning" };
  return { card: "border-danger/30 bg-danger-light", bar: "bg-danger", text: "text-danger" };
}
// اسم المادة دون رقم المستوى («الكيمياء 2» و«الرياضيات 1-1» ← الاسم وحده) لتجميعها عبر الصفوف
const baseSubject = (n) => String(n ?? "—").replace(/[\s\d\-–_/()]+$/u, "").trim() || String(n ?? "—");
// رمز الفصل الكامل كما في نور: الصف × 100 + رقم الفصل (101، 205…)
const classCode = (grade, no) => (Number(no) >= 100 ? Number(no) : (Number(grade) || 0) * 100 + (Number(no) || 0));
// لون رقم الأيام داخل الخانة غير المكتملة بحسب المهلة
const DAYS_TONE = { green: "text-mint-deep", orange: "text-warning", late: "text-danger" };

// الفرق بالأيام بين تاريخين بصيغة YYYY-MM-DD
const dayNo = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const daysBetween = (a, b) => dayNo(b) - dayNo(a);
const weekday = (iso) => new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** مهلة الصف: أيام منذ الاختبار ولونها (لما لم يكتمل رصده) */
function timing(r, today) {
  if (!r.exam_date) return { key: "nodate", t: "بلا تاريخ", c: "bg-canvas text-muted" };
  const d = daysBetween(r.exam_date, today);
  if (d < 0) return { key: "soon", d, t: `لم يحن · بعد ${countAr(-d, "day", { acc: true })}`, c: "bg-canvas text-muted" };
  const since = d === 0 ? "اليوم" : d === 1 ? "أمس" : `منذ ${countAr(d, "day", { acc: true })}`;
  if (d <= 2) return { key: "green", d, t: since, c: "bg-mint-light text-mint-deep" };
  if (d <= 5) return { key: "orange", d, t: since, c: "bg-warning-light text-warning" };
  return { key: "late", d, t: `متأخر · ${since}`, c: "bg-danger-light text-danger" };
}

export default function NoorGrades() {
  const { profile } = useSession();
  const [terms, setTerms] = useState(null);
  const [termId, setTermId] = useState(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [gradeF, setGradeF] = useState(0);   // 0 = لم يُختر صف بعد، فلا تظهر المواد
  const [busy, setBusy] = useState(null);
  const [sel, setSel] = useState(null);      // الخانة المفتوحة تفاصيلها (slot_id)
  const [view, setView] = useState("subject");   // subject: كما في كشف نور، grade: نظرة عامة بالصف
  const [brush, setBrush] = useState("detail");  // detail أو حالة تُطبَّق بالضغط على الخانة
  const [subKey, setSubKey] = useState(null);    // المادة المفتوحة في العرض حسب المادة
  const today = todayISO();

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
      const { data } = await supabase.from("exam_terms").select("*")
        .eq("academic_year", st?.value ?? "").in("kind", ["period1", "period2"]).order("kind");
      setTerms(data ?? []);
      // الفترة الافتراضية: أول فترة لم تنتهِ مهلة رصدها، وإلا الأخيرة
      const open = (data ?? []).find((t) => !t.grading_deadline || t.grading_deadline >= todayISO());
      setTermId((open ?? data?.[data.length - 1])?.id ?? null);
    })();
  }, []);

  const load = async (id) => {
    setRows(null); setErr("");
    const { data, error } = await supabase.rpc("noor_grade_matrix", { p_term: id });
    if (error) setErr(error.message?.includes("noor_grade_matrix")
      ? "المتابعة غير مفعّلة بعد في قاعدة البيانات: شغّل ملفي noor_grades_4.sql و noor_grades_5.sql."
      : error.message);
    setRows(data ?? []);
  };
  useEffect(() => { if (termId) load(termId); }, [termId]);

  const term = terms?.find((t) => t.id === termId);

  const setDeadline = async (v) => {
    const { error } = await supabase.from("exam_terms").update({ grading_deadline: v || null }).eq("id", termId);
    if (error) { alert(error.message); return; }
    setTerms((ts) => ts.map((t) => (t.id === termId ? { ...t, grading_deadline: v || null } : t)));
  };

  // يسجّل حالة فصل أو عدة فصول دفعة واحدة. «لم يرصد» = حذف السجل.
  const applyStatus = async (list, status, note = null) => {
    const todo = list.filter((r) => r.st !== status || (status === "partial" && note !== null));
    if (!todo.length) return;
    const ids = todo.map((r) => r.slot_id);
    const stamp = new Date().toISOString();
    setBusy(ids.length === 1 ? ids[0] : "bulk");
    const { error } = await supabase.rpc("noor_grade_set", {
      p_term: termId, p_status: status, p_note: status === "partial" ? note : null,
      p_name: profile?.full_name ?? null,
      p_items: todo.map((r) => ({ class_id: r.class_id, subject_id: r.subject_id })),
    });
    setBusy(null);
    if (error) { alert(error.message); return; }
    const set = new Set(ids);
    setRows((rs) => rs.map((x) => (set.has(x.slot_id)
      ? { ...x, status: status === "none" ? null : status, note: status === "partial" ? note?.trim() || null : null,
          updated_name: status === "none" ? null : profile?.full_name ?? null, updated_at: stamp }
      : x)));
  };

  // من لوحة التفاصيل: الجزئي يُسأل فيه عن الناقص
  const setStatus = (r, status) => {
    if (status !== "partial") return applyStatus([r], status);
    const note = window.prompt("ما الناقص في رصد هذا الفصل؟ (اختياري)", r.note ?? "");
    if (note !== null) applyStatus([r], status, note);
  };

  // الضغط على خانة: يفتح تفاصيلها، أو يلوّنها بالحالة المختارة في «الإدخال السريع»
  const onCell = (r) => {
    if (brush === "detail") setSel(sel === r.slot_id ? null : r.slot_id);
    else applyStatus([r], brush);
  };

  // الصفوف مع مهلتها، والملخص، والتجميع: الصف ← المادة × الفصول
  const all = useMemo(() => (rows ?? []).map((r) => ({ ...r, st: r.status ?? "none", tm: timing(r, today) })), [rows, today]);
  // الصف المختار وحده؛ قبل اختياره لا يظهر شيء
  const scoped = useMemo(() => (gradeF ? all.filter((r) => r.grade === gradeF) : []), [all, gradeF]);
  const due = scoped.filter((r) => r.tm.key !== "soon");   // ما حلّ موعد اختباره
  const pct = (list) => {
    const d = list.filter((r) => r.tm.key !== "soon");
    if (!d.length) return null;
    return Math.round((100 * d.reduce((a, r) => a + (r.st === "done" ? 1 : r.st === "partial" ? 0.5 : 0), 0)) / d.length);
  };
  const sum = {
    done: due.filter((r) => r.st === "done").length,
    partial: due.filter((r) => r.st === "partial").length,
    none: due.filter((r) => r.st === "none").length,
    late: due.filter((r) => r.st !== "done" && r.tm.key === "late").length,
  };
  // تصفية الحالة تُبهت ما لا يطابقها في الجدول ولا تحذفه
  const match = (r) => filter === "all" ? true
    : filter === "late" ? r.st !== "done" && r.tm.key === "late"
    : r.st === filter && r.tm.key !== "soon";

  const grades = useMemo(() => {
    const byGrade = new Map();
    for (const r of scoped) {
      const g = byGrade.get(r.grade) ?? { grade: r.grade, classes: new Set(), subjects: new Map() };
      g.classes.add(r.class_no);
      const sub = g.subjects.get(r.subject_name) ?? { name: r.subject_name ?? "—", cells: new Map(), list: [] };
      // اختباران للمادة في الفصل نفسه (أسبوعان): يُعرض الأقدم
      if (!sub.cells.has(r.class_no)) sub.cells.set(r.class_no, r);
      sub.list.push(r);
      g.subjects.set(r.subject_name, sub);
      byGrade.set(r.grade, g);
    }
    return [...byGrade.values()].sort((a, b) => a.grade - b.grade).map((g) => {
      const subjects = [...g.subjects.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        .map((sub) => ({ ...sub, pct: pct(sub.list) }));
      return { grade: g.grade, classes: [...g.classes].sort((a, b) => a - b), subjects,
               pct: pct(subjects.flatMap((s) => s.list)) };
    }).filter((g) => g.subjects.length);
  }, [scoped]);

  // العرض حسب المادة: كل مادة وفيها صفوفها، وكل صف بفصوله
  const subjects = useMemo(() => {
    const m = new Map();
    for (const r of scoped) {
      const k = baseSubject(r.subject_name);
      const sub = m.get(k) ?? { key: k, list: [], grades: new Map() };
      sub.list.push(r);
      const g = sub.grades.get(r.grade) ?? { grade: r.grade, cells: new Map(), list: [] };
      if (!g.cells.has(r.class_no)) g.cells.set(r.class_no, r);
      g.list.push(r);
      sub.grades.set(r.grade, g);
      m.set(k, sub);
    }
    return [...m.values()]
      .map((sub) => {
        const grades = [...sub.grades.values()].sort((a, b) => a.grade - b.grade).map((g) => ({
          ...g, pct: pct(g.list), names: [...new Set(g.list.map((r) => r.subject_name))],
          due: g.list.filter((r) => r.tm.key !== "soon"),
          // فصول الصف مرتبة متتالية؛ رقم الفصل قد يُخزَّن 3 أو 303، فلا يُتخذ فهرسًا للأعمدة
          cellList: [...g.cells.values()].sort((a, b) => a.class_no - b.class_no),
        }));
        const open = sub.list.filter((r) => r.st !== "done" && r.tm.key !== "soon");
        return { ...sub, grades, pct: pct(sub.list), open: open.length,
                 late: open.filter((r) => r.tm.key === "late").length,
                 maxClass: Math.max(...grades.map((g) => g.cellList.length)) };
      })
      .sort((a, b) => a.key.localeCompare(b.key, "ar"));
  }, [scoped]);
  const subject = subjects.find((s) => s.key === subKey) ?? subjects[0];

  const selRow = all.find((r) => r.slot_id === sel);
  const left = term?.grading_deadline ? daysBetween(today, term.grading_deadline) : null;
  const now = new Date();
  const stamp = `${weekday(today)} ${fmtHijri(today)} الساعة ${new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit", numberingSystem: "latn" }).format(now)}`;

  // كشف الطباعة: مواد الصف المختار ومعلموها الذين حلّ موعد اختبارهم ولم يكتمل رصدهم
  const print = () => {
    const pend = scoped.filter((r) => r.st !== "done" && r.exam_date && r.tm.key !== "soon");
    if (!pend.length) { alert(`لا فصول حلّ موعد اختبارها ولم تُرصد في ${GRADE_NAMES[gradeF] ?? "الصف"}.`); return; }
    const m = new Map();
    for (const r of pend) {
      const k = `${r.subject_name}|${r.teacher_name ?? ""}`;
      const g = m.get(k) ?? { subject: r.subject_name, teacher: r.teacher_name ?? "غير محدد في الجدول", list: [] };
      g.list.push(r);
      m.set(k, g);
    }
    const groups = [...m.values()].sort((a, b) => a.subject.localeCompare(b.subject, "ar") || a.teacher.localeCompare(b.teacher, "ar"));
    const rows = groups.map((g, i) => {
      g.list.sort((a, b) => a.class_no - b.class_no);
      const oldest = g.list.reduce((a, r) => (r.exam_date < a ? r.exam_date : a), g.list[0].exam_date);
      const days = Math.max(...g.list.map((r) => r.tm.d ?? 0));
      return [
        i + 1, g.subject, g.teacher,
        g.list.map((r) => `${classCode(r.grade, r.class_no)}${r.st === "partial" ? " (جزئي)" : ""}`).join("، "),
        fmtHijri(oldest),
        days > 5 ? `<b style="color:#A23B3B">${days} · متأخر</b>` : days,
      ];
    });
    printReport({
      title: `كشف المتابعة: درجات لم تُرصد في نور · ${GRADE_NAMES[gradeF] ?? ""}`,
      subtitle: `${term?.title ?? ""} · حتى ${stamp}`
        + (term?.grading_deadline ? ` · نهاية الرصد ${weekday(term.grading_deadline)} ${fmtHijri(term.grading_deadline)}` : ""),
      headers: ["م", "المادة", "المعلم", "الفصول غير المرصودة", "تاريخ الاختبار", "الأيام منذ الاختبار"],
      rows,
      note: `عدد الفصول التي حلّ موعد اختبارها ولم يكتمل رصدها: ${pend.length}. «جزئي»: رُصد بعض الفصل. الأيام لأقدم اختبار في الصف.`,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [{ title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    });
  };

  if (!terms) return <Loader />;

  // withCode: رمز الفصل داخل الخانة (العرض حسب المادة، حيث تختلف الفصول بين الصفوف)
  const cellBtn = (r, withCode = false) => {
    const soon = r.tm.key === "soon";
    const mark = soon ? (r.st === "none" ? "—" : "") : r.st === "done" ? "" : r.tm.d;
    return (
      <button onClick={() => onCell(r)} disabled={busy === "bulk" || busy === r.slot_id}
              title={`فصل ${classCode(r.grade, r.class_no)} · ${r.teacher_name ?? "معلم غير محدد"} · ${STATUS[r.st].t}${soon ? " · لم يحن" : ""}`}
              className={`num flex w-full flex-col items-center justify-center text-[11px] font-bold leading-tight transition ${withCode ? "h-11" : "h-9"}
                ${soon && r.st === "none" ? "bg-canvas text-faint" : `${STATUS[r.st].cell} ${DAYS_TONE[r.tm.key] ?? "text-muted"}`}
                ${sel === r.slot_id ? "ring-2 ring-inset ring-ink" : ""} ${brush !== "detail" ? "hover:brightness-95" : ""}
                ${match(r) ? "" : "opacity-25"}`}>
        {withCode ? <><span className="text-[11px] font-semibold text-ink">{classCode(r.grade, r.class_no)}</span>
          <span className="min-h-[12px] text-[10px]">{mark}</span></> : mark}
      </button>
    );
  };

  const detail = selRow && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-mint-tint px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">
          {selRow.subject_name} · {GRADE_NAMES[selRow.grade] ?? ""} · فصل <span className="num">{classCode(selRow.grade, selRow.class_no)}</span>
        </p>
        <p className="text-xs text-muted">
          <span className={selRow.teacher_name ? "text-ink" : "text-warning"}>{selRow.teacher_name ?? "معلم غير محدد في الجدول"}</span>
          {" · "}{selRow.exam_date ? <>اختبار {weekday(selRow.exam_date)} <span className="num">{fmtHijri(selRow.exam_date)}</span></> : "بلا تاريخ"}
          {selRow.note && <> · <span className="text-warning">{selRow.note}</span></>}
          {selRow.updated_name && <> · سجّله {selRow.updated_name}</>}
        </p>
      </div>
      {selRow.st !== "done" && <span className={`chip ${selRow.tm.c}`}>{selRow.tm.t}</span>}
      <div className="flex overflow-hidden rounded-sm2 border border-line">
        {["none", "partial", "done"].map((k) => (
          <button key={k} disabled={busy === selRow.slot_id} onClick={() => setStatus(selRow, k)}
                  className={`px-2.5 py-1 text-xs ${selRow.st !== k ? "bg-paper text-muted hover:bg-canvas" : k === "none" && selRow.tm.key === "soon" ? "bg-canvas text-ink" : STATUS[k].on}`}>
            {STATUS[k].t}
          </button>
        ))}
      </div>
      <button className="text-xs text-muted underline" onClick={() => setSel(null)}>إغلاق</button>
    </div>
  );

  // شريط الإدخال: فتح التفاصيل، أو تلوين الخانات مباشرة بحالة
  const BRUSH = [
    ["detail", "عرض التفاصيل", "bg-paper text-ink"],
    ["done", "تم الرصد", STATUS.done.on], ["partial", "رصد جزئي", STATUS.partial.on], ["none", "لم يرصد", STATUS.none.on],
  ];
  const brushBar = (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-paper px-3 py-2">
      <span className="text-xs font-semibold text-ink">الضغط على الخانة:</span>
      {BRUSH.map(([k, t, on]) => (
        <button key={k} onClick={() => { setBrush(k); setSel(null); }}
                className={`rounded-sm2 px-3 py-1 text-xs ${brush === k ? `${on} ring-2 ring-ink/30` : "border border-line bg-paper text-muted"}`}>
          {k === "detail" ? t : `يسجّل «${t}»`}
        </button>
      ))}
      {brush !== "detail" && <span className="text-[11px] text-muted">إدخال سريع: كل خانة تضغطها تُحفظ فورًا.</span>}
    </div>
  );

  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {["none", "done", "partial"].map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-5 rounded-sm border border-line ${STATUS[k].cell}`} />{k === "none" ? "لم يتم الرصد" : STATUS[k].t}
        </span>
      ))}
      <span>· الرقم في الخانة: الأيام منذ الاختبار (<span className="text-mint-deep">حتى يومين</span>،{" "}
        <span className="text-warning">3–5</span>، <span className="text-danger">متأخر بعد 5</span>)</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">متابعة رصد الدرجات في نظام نور</h1>
        <p className="mt-0.5 text-sm text-muted">
          اختر الصف ثم المادة كما في كشف متابعة نور، وسجّل حالة كل فصل في صفوفها. للإدخال السريع اختر الحالة ثم اضغط الخانات، أو طبّقها على الصف كله.
        </p>
      </div>

      {!terms.length ? (
        <p className="card p-4 text-sm text-muted">لا توجد فترات اختبار للعام الدراسي النشط. أنشئها من «جداول الاختبارات».</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <button key={t.id} onClick={() => { setTermId(t.id); setSel(null); }}
                      className={`rounded-sm2 px-4 py-1.5 text-sm ${t.id === termId ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`}>
                {t.title}
              </button>
            ))}
          </div>

          {term && (
            <section className="card flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">نهاية فترة رصد الدرجات</p>
                {term.grading_deadline ? (
                  <p className="mt-0.5 font-bold text-ink">
                    {weekday(term.grading_deadline)} <span className="num">{fmtDate(term.grading_deadline)}</span>
                  </p>
                ) : <p className="mt-0.5 text-sm text-warning">لم يُحدَّد آخر يوم للرصد بعد.</p>}
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  تعديل:
                  <input type="date" className="field num w-44 py-1 text-sm" value={term.grading_deadline ?? ""}
                         onChange={(e) => setDeadline(e.target.value)} />
                </label>
              </div>
              {left !== null && (
                <div className={`rounded-card px-5 py-3 text-center ${left < 0 ? "bg-danger-light text-danger"
                  : left <= 3 ? "bg-warning-light text-warning" : "bg-mint-light text-mint-deep"}`}>
                  {left < 0 ? <p className="font-bold">انتهت مهلة الرصد</p>
                    : left === 0 ? <p className="font-bold">اليوم آخر يوم للرصد</p>
                    : <><p className="text-xs">باقي</p><p className="num text-3xl font-bold leading-none">{left}</p>
                      <p className="mt-1 text-xs">{left === 1 ? "يوم" : left === 2 ? "يومان" : left <= 10 ? "أيام" : "يومًا"}</p></>}
                </div>
              )}
            </section>
          )}

          {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
          {!rows ? <Loader /> : !err && (
            <>
              {/* اختيار الصف أولًا: الصفحة فارغة حتى يُختار */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((g) => {
                  const p = pct(all.filter((r) => r.grade === g));
                  const on = gradeF === g;
                  return (
                    <button key={g} onClick={() => { setGradeF(g); setSubKey(null); setSel(null); }}
                            className={`rounded-card border px-3 py-3 text-center ${on ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-ink hover:bg-canvas"}`}>
                      <span className="block font-bold">{GRADE_NAMES[g]}</span>
                      <span className={`block text-xs ${on ? "text-white/80" : "text-muted"}`}>
                        {p === null ? "—" : <>نسبة الرصد <span className="num">{p}%</span></>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!gradeF ? (
                <p className="card p-6 text-center text-sm text-muted">اختر الصف لعرض مواده وفصوله.</p>
              ) : (<>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="col-span-2 rounded-card bg-mint-deep px-3 py-2 text-center text-white sm:col-span-1">
                  <span className="num block text-2xl font-bold leading-tight">{pct(scoped) ?? "—"}{pct(scoped) === null ? "" : "%"}</span>
                  <span className="block text-xs">نسبة {GRADE_NAMES[gradeF]}</span>
                </div>
                {[["done", "تم الرصد", "bg-mint-light text-mint-deep"], ["partial", "رصد جزئي", "bg-[#D6E4F5] text-excused"],
                  ["none", "لم يرصد", "bg-danger-light text-danger"], ["late", "متأخر", "bg-danger text-white"]].map(([k, t, c]) => (
                  <button key={k} onClick={() => setFilter(filter === k ? "all" : k)}
                          className={`rounded-card px-3 py-2 text-center ${c} ${filter === k ? "ring-2 ring-ink/40" : ""}`}>
                    <span className="num block text-2xl font-bold leading-tight">{sum[k]}</span>
                    <span className="block text-xs">{t}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                الأعداد بالفصول التي حلّ موعد اختبارها، والنسبة تحسب الرصد الجزئي نصفًا. اضغط عددًا لإبراز خاناته في الجداول.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-sm2 border border-line">
                  {[["subject", "حسب المادة"], ["grade", "حسب الصف"]].map(([k, t]) => (
                    <button key={k} onClick={() => { setView(k); setSel(null); }}
                            className={`px-3 py-1 text-sm ${view === k ? "bg-mint-deep text-white" : "bg-paper text-ink"}`}>{t}</button>
                  ))}
                </div>
                <div className="flex-1" />
                <button className="btn-ghost" onClick={print}>طباعة كشف غير المرصود</button>
              </div>
              {legend}
              {brushBar}

              {view === "subject" && (!subject ? <p className="card p-4 text-sm text-muted">لا نتائج.</p> : (
                <>
                  {/* المواد: اختر المادة التي تراجع كشفها في نور */}
                  {/* بطاقات بمقاس واحد: الاسم، وتحته النسبة وشريطها وعدد المتأخر */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {subjects.map((sub) => {
                      const on = sub.key === subject.key;
                      const tone = pctTone(sub.pct);
                      return (
                        <button key={sub.key} onClick={() => { setSubKey(sub.key); setSel(null); }}
                                className={`flex h-[4.5rem] flex-col justify-between rounded-card border px-3 py-2 text-right transition
                                  ${tone.card} ${on ? "ring-2 ring-ink/60 ring-offset-1" : "hover:brightness-[.97]"}`}>
                          <span className="flex items-center gap-1">
                            <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-ink" title={sub.key}>{sub.key}</span>
                            {on && <span className="text-[10px] font-semibold text-ink/70">مفتوحة</span>}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-white/70">
                              <span className={`block h-full rounded-pill ${tone.bar}`} style={{ width: `${sub.pct ?? 0}%` }} />
                            </span>
                            <span className={`num w-9 text-left text-xs font-bold ${tone.text}`}>
                              {sub.pct === null ? "—" : `${sub.pct}%`}
                            </span>
                            {sub.late > 0 && (
                              <span className="num grid h-5 min-w-[1.25rem] place-items-center rounded-pill bg-danger px-1 text-[11px] text-white"
                                    title="فصول متأخرة">{sub.late}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <section className="card overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-mint-deep px-4 py-2 text-white">
                      <h2 className="font-bold">{subject.key}</h2>
                      <p className="text-sm">نسبة رصد المادة <span className="num font-bold">{subject.pct === null ? "—" : `${subject.pct}%`}</span>
                        {subject.open ? <> · غير مكتمل <span className="num font-bold">{subject.open}</span></> : null}</p>
                    </div>
                    <div className="hidden overflow-x-auto sm:block">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-canvas text-xs text-muted">
                            <th className="min-w-[8rem] border border-line/60 px-2 py-1.5 text-right">الصف</th>
                            <th colSpan={subject.maxClass} className="border border-line/60 px-1 py-1.5">الفصول</th>
                            <th className="w-16 border border-line/60 px-1 py-1.5">نسبة الرصد</th>
                            {brush !== "detail" && <th className="w-20 border border-line/60 px-1 py-1.5">الصف كله</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {subject.grades.map((g) => (
                            <tr key={g.grade}>
                              <td className="border border-line/60 px-2 py-1.5">
                                <p className="font-semibold text-ink">{GRADE_NAMES[g.grade] ?? `الصف ${g.grade}`}</p>
                                {g.names.some((n) => n !== subject.key) && (
                                  <p className="text-[10px] text-faint">{g.names.join("، ")}</p>
                                )}
                              </td>
                              {Array.from({ length: subject.maxClass }, (_, i) => {
                                const r = g.cellList[i];
                                return r ? <td key={i} className="min-w-[2.75rem] border border-line/60 p-0">{cellBtn(r, true)}</td>
                                  : <td key={i} className="border border-line/60 bg-paper" />;
                              })}
                              <td className="num border border-line/60 text-center font-bold text-mint-deep">{g.pct === null ? "—" : `${g.pct}%`}</td>
                              {brush !== "detail" && (
                                <td className="border border-line/60 p-1 text-center">
                                  <button disabled={busy === "bulk" || !g.due.length}
                                          onClick={() => applyStatus(g.due, brush)}
                                          title="يطبّق الحالة على كل فصول الصف التي حلّ موعد اختبارها"
                                          className={`w-full rounded-sm2 px-1 py-1 text-[11px] ${STATUS[brush].on} disabled:opacity-40`}>
                                    {STATUS[brush].t}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* الجوال: بطاقة لكل صف، وفصولها خانات كبيرة تلتف بلا سحب أفقي */}
                    <div className="divide-y divide-line sm:hidden">
                      {subject.grades.map((g) => (
                        <div key={g.grade} className="space-y-2 px-3 py-3">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-ink">{GRADE_NAMES[g.grade] ?? `الصف ${g.grade}`}</p>
                            </div>
                            <span className="num text-sm font-bold text-mint-deep">{g.pct === null ? "—" : `${g.pct}%`}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {g.cellList.map((r) => (
                              <div key={r.slot_id} className="overflow-hidden rounded-sm2 border border-line/60">{cellBtn(r, true)}</div>
                            ))}
                          </div>
                          {brush !== "detail" && (
                            <button disabled={busy === "bulk" || !g.due.length} onClick={() => applyStatus(g.due, brush)}
                                    className={`w-full rounded-sm2 py-1.5 text-xs ${STATUS[brush].on} disabled:opacity-40`}>
                              «{STATUS[brush].t}» لكل فصول {GRADE_NAMES[g.grade] ?? "الصف"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {selRow && baseSubject(selRow.subject_name) === subject.key && detail}
                  </section>
                </>
              ))}

              {view === "grade" && !grades.length && <p className="card p-4 text-sm text-muted">لا نتائج.</p>}
              {view === "grade" && grades.map((g) => (
                <section key={g.grade} className="card overflow-hidden">
                  <h2 className="bg-mint-deep px-4 py-2 text-center font-bold text-white">{GRADE_NAMES[g.grade] ?? `الصف ${g.grade}`}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-canvas text-xs text-muted">
                          <th className="w-8 border border-line/60 px-1 py-1.5">م</th>
                          <th className="min-w-[9rem] border border-line/60 px-2 py-1.5 text-right">المادة</th>
                          {g.classes.map((c) => <th key={c} className="num w-11 border border-line/60 px-1 py-1.5">{classCode(g.grade, c)}</th>)}
                          <th className="w-16 border border-line/60 px-1 py-1.5">نسبة الرصد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.subjects.map((sub, i) => (
                          <tr key={sub.name}>
                            <td className="num border border-line/60 text-center text-xs text-muted">{i + 1}</td>
                            <td className="border border-line/60 px-2 py-1.5">
                              <p className="font-semibold text-ink">{sub.name}</p>
                            </td>
                            {g.classes.map((c) => {
                              const r = sub.cells.get(c);
                              if (!r) return <td key={c} className="border border-line/60" />;
                              return <td key={c} className="border border-line/60 p-0">{cellBtn(r)}</td>;
                            })}
                            <td className="num border border-line/60 text-center font-bold text-mint-deep">
                              {sub.pct === null ? "—" : `${sub.pct}%`}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-canvas text-xs">
                          <td colSpan={g.classes.length + 2} className="border border-line/60 px-2 py-1.5 text-center text-muted">
                            النسبة الإجمالية للرصد حتى {stamp}
                          </td>
                          <td className="num border border-line/60 text-center font-bold text-ink">{g.pct === null ? "—" : `${g.pct}%`}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {selRow && selRow.grade === g.grade && detail}
                </section>
              ))}
              </>)}
            </>
          )}
        </>
      )}
    </div>
  );
}
