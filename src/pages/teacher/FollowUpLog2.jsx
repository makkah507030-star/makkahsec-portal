import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { printReport, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { noEra } from "../../lib/dates";
import { countAr } from "../../lib/arabicCount.js";

/* =====================================================================
   سجل المتابعة الإلكتروني 2 — بفكرة السجل الأول نفسها، مع فرق واحد:
   يوزّع المعلم في الشريط العلوي درجات «المهام الأدائية والمشاركة والتفاعل»
   (40 درجة) على بنودها كما يراه، فيظهر لكل بند أمام اسم الطالب خانات بعدد
   درجاته، لكل خانة درجة: ضغطة = ✓ (تُحتسب)، ضغطتان = ✗ أحمر، ثالثة = تُمسح.

   الرصد في teacher_follow_up ببنود مستقلة (r2_*) فلا يتأثر السجل الأول:
   mark = 1 للصح و0 للخطأ، وحذف الصف = خانة فارغة. والتوزيع في
   teacher_follow_up_weights (supabase/follow_up_v2.sql).
   ===================================================================== */

const TERM_LABEL = { 1: "الأول", 2: "الثاني" };
const PERIODS = ["الفترة الأولى", "الفترة الثانية"];
const TASKS_TOTAL = 40;

// بنود المهام الأدائية والمشاركة والتفاعل — خانة لكل درجة
const BOX_ITEMS = [
  { key: "homework", label: "الواجبات" },
  { key: "participation", label: "المشاركة" },
  { key: "classwork", label: "التطبيقات الصفية" },
];
// تقويم تحريري وتطبيقات عملية — درجة رقمية كالسجل الأول
const SCORE_ITEMS = [
  { key: "written", label: "نظري" },
  { key: "practical", label: "عملي" },
];
const dbKey = (k) => `r2_${k}`;
const EMPTY_W = { homework: "", participation: "", classwork: "" };

const markKey = (studentId, itemKey, slotNo) => `${studentId}::${itemKey}::${slotNo}`;
const lsKey = (teacherId, subject, year, term) => `followup2-weights:${teacherId}:${subject}:${year}:${term}`;

const sumW = (w) => BOX_ITEMS.reduce((a, it) => a + (Number(w?.[it.key]) || 0), 0);

export default function FollowUpLog2() {
  const { session } = useSession();
  const [me, setMe] = useState(null);
  const [groups, setGroups] = useState(null);
  const [year, setYear] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [term, setTerm] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [groupKey, setGroupKey] = useState("");
  const [period, setPeriod] = useState(PERIODS[0]);
  const [itemKey, setItemKey] = useState("");

  // التوزيع المعتمد للمادة، ومسودته أثناء التعديل
  const [weights, setWeights] = useState(null);
  const [draft, setDraft] = useState(EMPTY_W);
  const [editingW, setEditingW] = useState(false);
  const [wMissing, setWMissing] = useState(false);   // جدول التوزيع لم يُنشأ بعد
  const [wSaving, setWSaving] = useState(false);

  const [marks, setMarks] = useState({});
  const [marksLoading, setMarksLoading] = useState(false);
  const [saveState, setSaveState] = useState({});
  const [errorMsg, setErrorMsg] = useState({});

  /* ---------- تحميل الإسنادات وطلابها (كالسجل الأول) ---------- */
  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;

      const [{ data: st }, { data: t0 }] = await Promise.all([
        supabase.from("settings").select("key, value")
          .in("key", ["active_year", "active_term", "active_year_label"]),
        supabase.from("teachers").select("id, full_name, specialization")
          .eq("user_id", uid).maybeSingle(),
      ]);

      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
      setYearLabel(noEra(m.active_year_label) ?? y);
      const t = Number(m.active_term ?? 1);
      setYear(y);
      setTerm(t);

      setMe(t0 ?? null);
      if (!t0) { setGroups([]); setLoading(false); return; }

      const { data: sch } = await supabase
        .from("schedule")
        .select("class_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t0.id)
        .eq("academic_year", y)
        .eq("term", t);

      const map = new Map();
      (sch ?? []).forEach((r) => {
        const subject = r.subjects?.name ?? "—";
        const key = `${r.class_id}::${subject}`;
        if (!map.has(key)) {
          map.set(key, {
            key, subject, class_id: r.class_id,
            class_no: r.classes?.class_no ?? 0, grade: r.classes?.grade ?? 0, students: [],
          });
        }
      });

      const list = [...map.values()];
      const classIds = [...new Set(list.map((g) => g.class_id))];
      if (classIds.length) {
        const { data: enr } = await supabase
          .from("student_enrollment")
          .select("class_id, students(id, full_name, national_id)")
          .in("class_id", classIds)
          .eq("status", "active");
        const byClass = {};
        (enr ?? []).forEach((e) => { if (e.students) (byClass[e.class_id] ??= []).push(e.students); });
        Object.values(byClass).forEach((arr) => arr.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
        list.forEach((g) => { g.students = byClass[g.class_id] ?? []; });
      }
      list.sort((a, b) => a.subject.localeCompare(b.subject, "ar") || a.class_no - b.class_no);

      setGroups(list);
      if (list.length) setGroupKey(list[0].key);
      setLoading(false);
    })();
  }, [session]);

  const group = useMemo(() => (groups ?? []).find((g) => g.key === groupKey) ?? null, [groups, groupKey]);

  /* ---------- تحميل توزيع الدرجات لمادة هذا الفصل ---------- */
  useEffect(() => {
    (async () => {
      if (!me || !group) return;
      setWeights(null);
      const { data, error } = await supabase
        .from("teacher_follow_up_weights")
        .select("weights")
        .eq("teacher_id", me.id).eq("subject", group.subject)
        .eq("academic_year", year).eq("term", term)
        .maybeSingle();
      let w = data?.weights ?? null;
      if (error) {
        // الجدول لم يُنشأ بعد: نحفظ التوزيع على هذا الجهاز مؤقتًا
        setWMissing(true);
        try { w = JSON.parse(localStorage.getItem(lsKey(me.id, group.subject, year, term)) || "null"); } catch { w = null; }
      }
      const ok = w && sumW(w) === TASKS_TOTAL;
      setWeights(ok ? w : null);
      setDraft(ok ? Object.fromEntries(BOX_ITEMS.map((it) => [it.key, String(w[it.key] ?? 0)])) : EMPTY_W);
      setEditingW(!ok);
    })();
  }, [me, group?.subject, year, term]);   // eslint-disable-line react-hooks/exhaustive-deps

  // البنود المتاحة: بنود الخانات التي لها درجة، ثم نظري وعملي
  const items = useMemo(() => [
    ...BOX_ITEMS.filter((it) => Number(weights?.[it.key]) > 0)
      .map((it) => ({ ...it, type: "box", slots: Number(weights[it.key]) })),
    ...SCORE_ITEMS.map((it) => ({ ...it, type: "score", slots: 1 })),
  ], [weights]);
  const activeItem = items.find((it) => it.key === itemKey) ?? items[0] ?? null;
  useEffect(() => { if (activeItem && activeItem.key !== itemKey) setItemKey(activeItem.key); }, [activeItem, itemKey]);
  // بعد اعتماد التوزيع أو تغييره يبدأ من أول بند خانات
  useEffect(() => { setItemKey(""); }, [weights]);

  /* ---------- تحميل الرصد لهذا الفصل × المادة × الفترة ---------- */
  useEffect(() => {
    (async () => {
      if (!me || !group) return;
      setMarksLoading(true);
      const { data } = await supabase
        .from("teacher_follow_up")
        .select("student_id, item_key, slot_no, mark")
        .eq("teacher_id", me.id).eq("class_id", group.class_id).eq("subject", group.subject)
        .eq("academic_year", year).eq("term", term).eq("period", period)
        .like("item_key", "r2_%");
      const next = {};
      (data ?? []).forEach((r) => {
        if (r.mark === null || r.mark === undefined) return;
        next[markKey(r.student_id, r.item_key.slice(3), r.slot_no)] = String(Number(r.mark));
      });
      setMarks(next);
      setMarksLoading(false);
    })();
  }, [me, group, year, term, period]);

  const markValue = (studentId, ik, sn) => marks[markKey(studentId, ik, sn)] ?? "";

  /* ---------- اعتماد التوزيع ---------- */
  const draftSum = sumW(draft);
  const saveWeights = async () => {
    if (!me || !group || draftSum !== TASKS_TOTAL) return;
    const w = Object.fromEntries(BOX_ITEMS.map((it) => [it.key, Number(draft[it.key]) || 0]));
    setWSaving(true);
    if (wMissing) {
      try { localStorage.setItem(lsKey(me.id, group.subject, year, term), JSON.stringify(w)); } catch { /* تجاهل */ }
    } else {
      const { error } = await supabase.from("teacher_follow_up_weights").upsert(
        { teacher_id: me.id, subject: group.subject, academic_year: year, term, weights: w, updated_at: new Date().toISOString() },
        { onConflict: "teacher_id,subject,academic_year,term" });
      if (error) { setWSaving(false); window.alert(`تعذّر حفظ التوزيع: ${error.message}`); return; }
    }
    setWSaving(false);
    setWeights(w);
    setEditingW(false);
  };

  const setDraftItem = (k, v) => {
    const n = v === "" ? "" : String(Math.max(0, Math.min(TASKS_TOTAL, Math.round(Number(v) || 0))));
    setDraft((d) => ({ ...d, [k]: n }));
  };

  /* ---------- حفظ خانة أو درجة ---------- */
  const flash = (studentId, state, msg) => {
    setSaveState((p) => ({ ...p, [studentId]: state }));
    if (msg) setErrorMsg((p) => ({ ...p, [studentId]: msg }));
    if (state === "saved") {
      setTimeout(() => setSaveState((p) => (p[studentId] === "saved" ? { ...p, [studentId]: null } : p)), 1500);
    }
  };

  const base = () => ({
    teacher_id: me.id, class_id: group.class_id, subject: group.subject,
    academic_year: year, term, period,
  });

  const saveMark = async (studentId, ik, sn, rawValue) => {
    if (!me || !group) return;
    const value = String(rawValue).trim();
    flash(studentId, "saving");
    try {
      if (value === "") {
        const { error } = await supabase.from("teacher_follow_up").delete()
          .eq("teacher_id", me.id).eq("class_id", group.class_id).eq("subject", group.subject)
          .eq("academic_year", year).eq("term", term).eq("period", period)
          .eq("student_id", studentId).eq("item_key", dbKey(ik)).eq("slot_no", sn);
        if (error) throw error;
      } else {
        const num = Number(value);
        if (Number.isNaN(num)) throw new Error("قيمة غير صالحة");
        const { error } = await supabase.from("teacher_follow_up").upsert(
          { ...base(), student_id: studentId, item_key: dbKey(ik), slot_no: sn, mark: num },
          { onConflict: "teacher_id,class_id,subject,academic_year,term,period,student_id,item_key,slot_no" });
        if (error) throw error;
      }
      flash(studentId, "saved");
    } catch (e) {
      console.error("saveMark failed:", e);
      flash(studentId, "error", e?.message || String(e));
    }
  };

  const setLocal = (studentId, ik, sn, value) =>
    setMarks((p) => ({ ...p, [markKey(studentId, ik, sn)]: value }));

  // فارغة ← ✓ ← ✗ ← فارغة
  const cycleBox = (studentId, ik, sn) => {
    const cur = markValue(studentId, ik, sn);
    const next = cur === "" ? "1" : cur === "1" ? "0" : "";
    setLocal(studentId, ik, sn, next);
    saveMark(studentId, ik, sn, next);
  };

  // صح للجميع في خانة: لمن خانته فارغة فقط، في طلب واحد
  const checkColumn = async (sn) => {
    if (!group || !activeItem) return;
    const targets = group.students.filter((s) => markValue(s.id, activeItem.key, sn) === "");
    if (!targets.length) return;
    targets.forEach((s) => setLocal(s.id, activeItem.key, sn, "1"));
    const { error } = await supabase.from("teacher_follow_up").upsert(
      targets.map((s) => ({ ...base(), student_id: s.id, item_key: dbKey(activeItem.key), slot_no: sn, mark: 1 })),
      { onConflict: "teacher_id,class_id,subject,academic_year,term,period,student_id,item_key,slot_no" });
    if (error) {
      targets.forEach((s) => { setLocal(s.id, activeItem.key, sn, ""); flash(s.id, "error", error.message); });
    }
  };

  // درجة الطالب في بند خانات: عدد علامات الصح داخل عدد خانات البند الحالي
  const boxScore = (studentId, it) => {
    let ok = 0, bad = 0;
    for (let sn = 1; sn <= it.slots; sn++) {
      const v = markValue(studentId, it.key, sn);
      if (v === "1") ok++; else if (v === "0") bad++;
    }
    return { ok, bad, empty: it.slots - ok - bad };
  };

  const logos = () => ({
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  });

  /* ---------- تصدير وطباعة ---------- */
  const printGroup = async () => {
    if (!me || !group || !weights) return;
    setBusy(true);
    const { data } = await supabase
      .from("teacher_follow_up")
      .select("student_id, item_key, slot_no, mark")
      .eq("teacher_id", me.id).eq("class_id", group.class_id).eq("subject", group.subject)
      .eq("academic_year", year).eq("term", term).eq("period", period)
      .like("item_key", "r2_%");
    const saved = {};
    (data ?? []).forEach((r) => { saved[`${r.student_id}::${r.item_key.slice(3)}::${r.slot_no}`] = r.mark; });

    const boxItems = items.filter((it) => it.type === "box");
    const boxCols = boxItems.reduce((a, it) => a + it.slots, 0);

    const row1 = [
      { text: "م", rowspan: 3 },
      { text: "اسم الطالب", rowspan: 3 },
      { text: `المهام الأدائية والمشاركة والتفاعل (${TASKS_TOTAL})`, colspan: boxCols + 1 },
      { text: "تقويم تحريري وتطبيقات عملية", colspan: SCORE_ITEMS.length },
      { text: "المجموع النهائي", rowspan: 3, cls: "total-h" },
    ];
    const row2 = [
      ...boxItems.map((it) => ({ text: `${it.label} (${it.slots})`, colspan: it.slots })),
      { text: "المجموع", rowspan: 2, cls: "total-h" },
      ...SCORE_ITEMS.map((it) => ({ text: it.label, rowspan: 2 })),
    ];
    const row3 = boxItems.flatMap((it) =>
      Array.from({ length: it.slots }, (_, i) => ({ text: String(i + 1), cls: "slot" })));

    const boxW = (52 / Math.max(boxCols, 1)).toFixed(2);
    const colWidths = ["3%", "18%", ...Array.from({ length: boxCols }, () => `${boxW}%`), "5%", "7%", "7%", "8%"];

    const rows = group.students.map((s, i) => {
      let tasks = 0, anyTask = false;
      const cells = boxItems.flatMap((it) =>
        Array.from({ length: it.slots }, (_, si) => {
          const v = saved[`${s.id}::${it.key}::${si + 1}`];
          if (v === undefined || v === null) return { text: "", cls: "blank slot" };
          anyTask = true;
          if (Number(v) > 0) { tasks += 1; return { text: "✓", cls: "slot st-present" }; }
          return { text: "✗", cls: "slot st-absent" };
        }));
      let scores = 0, anyScore = false;
      const scoreCells = SCORE_ITEMS.map((it) => {
        const v = saved[`${s.id}::${it.key}::1`];
        if (v === undefined || v === null) return { text: "", cls: "blank" };
        anyScore = true; scores += Number(v) || 0;
        return { text: String(Number(v)) };
      });
      const any = anyTask || anyScore;
      return [
        i + 1,
        { text: s.full_name ?? "", cls: "name" },
        ...cells,
        { text: anyTask ? String(tasks) : "", cls: anyTask ? "total" : "blank total" },
        ...scoreCells,
        { text: any ? String(Math.round((tasks + scores) * 100) / 100) : "", cls: any ? "total" : "blank total" },
      ];
    });

    printReport({
      title: "سجل المتابعة الإلكتروني 2",
      landscape: true,
      sections: [{
        title: `سجل متابعة مادة ${group.subject} — ${period}`,
        subtitle: `${GRADE_NAMES[group.grade] ?? ""} · فصل ${group.class_no} · ${countAr(group.students.length, "student")} · ✓ تُحتسب درجة، ✗ لا تُحتسب`,
        headerRows: [row1, row2, row3],
        tableClass: "follow",
        colWidths,
        rows,
      }],
      cover: {
        title: "سجل المتابعة الإلكتروني",
        rows: [
          ["المعلم", me?.full_name ?? ""],
          ["المادة", group.subject],
          ["الفصل", `${GRADE_NAMES[group.grade] ?? ""} · فصل ${group.class_no}`],
          ["الفترة", period],
          ["توزيع الدرجات", boxItems.map((it) => `${it.label} ${it.slots}`).join(" · ")],
        ],
        year: `العام الدراسي ${yearLabel} — الفصل الدراسي ${TERM_LABEL[term] ?? term}`,
      },
      signatures: [
        { title: "معلم المادة", name: me?.full_name ?? "" },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
      ...logos(),
    });
    setBusy(false);
  };

  /* ---------- العرض ---------- */
  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-5 w-56 rounded bg-line" />
        <div className="h-28 rounded-card border border-line bg-white/60" />
        <div className="h-64 rounded-card border border-line bg-white/60" />
      </div>
    );
  }
  if (!me) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">الحساب غير مرتبط بسجل معلم</p>
        <p className="mt-1.5 text-sm text-muted">راجع إدارة المدرسة.</p>
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا توجد إسنادات</p>
        <p className="mt-1.5 text-sm text-muted">لم تُسند إليك مواد أو فصول في هذا الفصل الدراسي.</p>
      </div>
    );
  }

  const sumTone = draftSum === TASKS_TOTAL ? "text-mint-deep" : draftSum > TASKS_TOTAL ? "text-danger" : "text-warning";
  const barTone = draftSum === TASKS_TOTAL ? "bg-mint-deep" : draftSum > TASKS_TOTAL ? "bg-danger" : "bg-warning";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">سجل المتابعة الإلكتروني 2</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          وزّع درجات المهام الأدائية والمشاركة والتفاعل على بنودها، فتظهر أمام كل طالب خانات بعدد درجات البند:
          ضغطة واحدة <b className="text-mint-deep">✓</b> تُحتسب درجة، وضغطتان <b className="text-danger">✗</b>، والثالثة تمسح الخانة.
          يُحفظ كل شيء تلقائيًا، وهو مستقل عن السجل الأول.
        </p>
      </div>

      {/* المادة والفصل والفترة */}
      <section className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">المادة والفصل</label>
            <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className="field">
              {groups.map((g) => (
                <option key={g.key} value={g.key}>{g.subject} — {GRADE_NAMES[g.grade] ?? ""} فصل {g.class_no}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">الفترة</label>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={"flex-1 rounded-sm2 border px-3 py-2 text-sm font-medium " +
                    (period === p ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-paper text-ink hover:bg-canvas")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* شريط توزيع الدرجات */}
      {group && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-mint-tint/50 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">توزيع درجات المهام الأدائية والمشاركة والتفاعل — {group.subject}</h2>
            <span className="rounded-pill border border-warning/40 bg-warning-light px-3 py-1 text-xs font-bold text-warning">
              ⚠ مجموع درجات المهام الأدائية والتفاعل = <span className="num">{TASKS_TOTAL}</span> درجة
            </span>
          </div>

          {!editingW && weights ? (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              {BOX_ITEMS.map((it) => (
                <span key={it.key} className="rounded-pill border border-line bg-paper px-3 py-1.5 text-sm text-ink">
                  {it.label} <b className="num text-mint-deep">{Number(weights[it.key]) || 0}</b>
                </span>
              ))}
              <span className="text-sm font-bold text-mint-deep">= <span className="num">{TASKS_TOTAL}</span></span>
              <button onClick={() => setEditingW(true)} className="mr-auto text-xs font-semibold text-mint-deep hover:underline">
                تعديل التوزيع
              </button>
            </div>
          ) : (
            <div className="space-y-3 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {BOX_ITEMS.map((it) => (
                  <div key={it.key}>
                    <label className="label">{it.label}</label>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setDraftItem(it.key, (Number(draft[it.key]) || 0) - 1)}
                        className="h-10 w-10 shrink-0 rounded-sm2 border border-line text-lg font-bold text-ink hover:bg-canvas">−</button>
                      <input type="number" inputMode="numeric" min={0} max={TASKS_TOTAL} placeholder="0"
                        value={draft[it.key]} onChange={(e) => setDraftItem(it.key, e.target.value)}
                        className="num field h-10 min-w-0 flex-1 py-0 text-center text-base font-bold" />
                      <button type="button" onClick={() => setDraftItem(it.key, (Number(draft[it.key]) || 0) + 1)}
                        className="h-10 w-10 shrink-0 rounded-sm2 border border-line text-lg font-bold text-ink hover:bg-canvas">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-bold ${sumTone}`}>
                    المجموع <span className="num">{draftSum}</span> من <span className="num">{TASKS_TOTAL}</span>
                    {draftSum < TASKS_TOTAL && <> — باقٍ <span className="num">{TASKS_TOTAL - draftSum}</span></>}
                    {draftSum > TASKS_TOTAL && <> — زائد <span className="num">{draftSum - TASKS_TOTAL}</span></>}
                  </span>
                  {weights && (
                    <button onClick={() => { setEditingW(false); setDraft(Object.fromEntries(BOX_ITEMS.map((it) => [it.key, String(weights[it.key] ?? 0)]))); }}
                      className="text-xs text-muted hover:underline">إلغاء</button>
                  )}
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                  <div className={`h-full rounded-full transition-all ${barTone}`}
                       style={{ width: `${Math.min(100, (draftSum / TASKS_TOTAL) * 100)}%` }} />
                </div>
              </div>
              <button onClick={saveWeights} disabled={draftSum !== TASKS_TOTAL || wSaving}
                      className="btn-primary w-full disabled:opacity-40 sm:w-auto">
                اعتماد التوزيع
              </button>
              <p className="text-[11px] leading-relaxed text-muted">
                يسري التوزيع على كل فصولك في هذه المادة وعلى الفترتين. إن خفّضت درجة بند بعد الرصد تُخفى الخانات الزائدة ولا تُحذف.
              </p>
              {wMissing && (
                <p className="rounded-sm2 bg-warning-light px-3 py-2 text-[11px] text-warning">
                  يُحفظ التوزيع على هذا الجهاز مؤقتًا حتى يُنفَّذ ملف supabase/follow_up_v2.sql في قاعدة البيانات.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {group && weights && !editingW && activeItem && (
        <>
          {/* البند */}
          <section className="card space-y-2 p-4">
            <h2 className="text-sm font-semibold text-ink">البند الذي تعمل عليه الآن</h2>
            <div className="flex flex-wrap gap-2">
              {items.map((it) => (
                <button key={it.key} onClick={() => setItemKey(it.key)}
                  className={"rounded-full border px-4 py-2 text-sm font-medium transition " +
                    (activeItem.key === it.key ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-ink hover:bg-canvas")}>
                  {it.label}{it.type === "box" && <span className="num mr-1 opacity-80">({it.slots})</span>}
                </button>
              ))}
            </div>
          </section>

          {/* قائمة التأشير */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {activeItem.label}{activeItem.type === "box" && <> — <span className="num">{activeItem.slots}</span> درجة</>}
              </h2>
              <span className="text-xs text-muted">{group.subject} · {GRADE_NAMES[group.grade] ?? ""} فصل {group.class_no}</span>
            </div>

            {activeItem.type === "box" && (
              <div className="space-y-2 border-b border-line bg-canvas/60 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5"><Box state="1" small /> ضغطة: صح تُحتسب درجة</span>
                  <span className="flex items-center gap-1.5"><Box state="0" small /> ضغطتان: خطأ</span>
                  <span className="flex items-center gap-1.5"><Box state="" small /> ثلاث: تُمسح</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="ml-1 text-[11px] text-muted">صح للجميع في الخانة:</span>
                  {Array.from({ length: activeItem.slots }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => checkColumn(n)} title={`✓ للخانة ${n} لكل من خانته فارغة`}
                      className="num h-6 min-w-6 rounded border border-line bg-paper px-1 text-[11px] font-semibold text-mint-deep hover:bg-mint-tint">
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {marksLoading ? (
              <div className="animate-pulse divide-y divide-line">
                {group.students.map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-3 w-4 rounded bg-line" /><div className="h-3.5 flex-1 rounded bg-line" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {group.students.map((s, idx) => {
                  const st = saveState[s.id];
                  const sc = activeItem.type === "box" ? boxScore(s.id, activeItem) : null;
                  return (
                    <div key={s.id} className="px-4 py-2.5 hover:bg-canvas/60">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0 sm:pt-1">
                          <span className="num w-6 shrink-0 text-xs text-muted">{idx + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.full_name}</span>
                          {sc && (
                            <span className={`num shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold ${
                              sc.ok === activeItem.slots ? "bg-mint-tint text-mint-deep" : "bg-canvas text-muted"}`}>
                              {sc.ok}/{activeItem.slots}
                            </span>
                          )}
                        </div>

                        {activeItem.type === "box" ? (
                          <div className="flex flex-1 flex-wrap gap-1">
                            {Array.from({ length: activeItem.slots }, (_, i) => i + 1).map((sn) => (
                              <button key={sn} type="button" onClick={() => cycleBox(s.id, activeItem.key, sn)}
                                aria-label={`الخانة ${sn}`}
                                className={sn % 5 === 0 && sn < activeItem.slots ? "ml-2" : ""}>
                                <Box state={markValue(s.id, activeItem.key, sn)} n={sn} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input type="number" inputMode="decimal"
                            value={markValue(s.id, activeItem.key, 1)}
                            onChange={(e) => setLocal(s.id, activeItem.key, 1, e.target.value)}
                            onBlur={(e) => saveMark(s.id, activeItem.key, 1, e.target.value)}
                            className="num w-24 rounded-sm2 border border-line bg-paper px-2 py-1.5 text-center text-sm font-semibold text-ink focus:border-mint-deep focus:outline-none" />
                        )}

                        <span className="w-16 shrink-0 text-[11px] sm:pt-1.5">
                          {st === "saving" && <span className="text-muted">جارٍ الحفظ…</span>}
                          {st === "saved" && <span className="text-mint-deep">تم الحفظ</span>}
                          {st === "error" && <span className="text-danger">تعذّر الحفظ</span>}
                        </span>
                      </div>
                      {st === "error" && errorMsg[s.id] && (
                        <p className="mt-1 mr-8 text-[11px] leading-relaxed text-danger">{errorMsg[s.id]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* التصدير */}
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink">تصدير</h2>
            <button onClick={printGroup} disabled={busy} className="btn-primary w-full disabled:opacity-40 sm:w-auto">
              تصدير وطباعة هذا السجل
            </button>
            <p className="text-xs leading-relaxed text-muted">
              يصدّر السجل بخانات كل بند وعلامات الصح والخطأ ومجموع المهام من <span className="num">{TASKS_TOTAL}</span>،
              مع درجتي النظري والعملي، لهذه المادة والفصل والفترة الحالية.
            </p>
          </section>
        </>
      )}

      {group && (!weights || editingW) && (
        <div className="card px-6 py-10 text-center">
          <p className="font-semibold text-ink">وزّع الدرجات أولًا</p>
          <p className="mt-1.5 text-sm text-muted">
            اعتمد توزيع الـ<span className="num">{TASKS_TOTAL}</span> درجة على البنود في الشريط أعلاه، فتظهر خانات الطلاب.
          </p>
        </div>
      )}
    </div>
  );
}

/* خانة واحدة: فارغة، أو ✓ أخضر، أو ✗ أحمر */
function Box({ state, n, small = false }) {
  const size = small ? "h-5 w-5 text-[11px]" : "h-8 w-8 text-base";
  if (state === "1") {
    return <span className={`grid ${size} place-items-center rounded-md border-2 border-[#3E8E5E] bg-[#DDF3E6] font-bold text-[#1F6B45]`}>✓</span>;
  }
  if (state === "0") {
    return <span className={`grid ${size} place-items-center rounded-md border-2 border-[#E08A80] bg-[#FCE4E1] font-bold text-[#B02A2A]`}>✗</span>;
  }
  return (
    <span className={`grid ${size} place-items-center rounded-md border-2 border-line bg-paper text-[10px] text-faint`}>
      {n ?? ""}
    </span>
  );
}
