import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { printReport, PRINCIPAL_NAME, ACADEMIC_DEPUTY_NAME } from "../../lib/exportUtils";
import { configFor, isKnownSubject, buildGradeHeader, gradeBlankCount } from "../../lib/gradeSheets";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const TERM_LABEL = { 1: "الأول", 2: "الثاني" };

/* سجل المتابعة — الأقسام وبنودها
   slots: عدد أعمدة المتابعة تحت البند (متابعة في أوقات متعددة) */
const FOLLOW_SLOTS = 5;

const FOLLOW_SECTIONS = [
  {
    label: "المهام الأدائية والمشاركة والتفاعل",
    items: [
      { key: "homework",      label: "الواجبات",        slots: FOLLOW_SLOTS },
      { key: "participation", label: "المشاركة",        slots: FOLLOW_SLOTS },
      { key: "classwork",     label: "التطبيقات الصفية", slots: FOLLOW_SLOTS },
    ],
  },
  {
    label: "تقويم تحريري وتطبيقات عملية",
    items: [
      { key: "written",   label: "نظري", slots: 1 },
      { key: "practical", label: "عملي", slots: 1 },
    ],
  },
];

const PERIODS = ["الفترة الأولى", "الفترة الثانية"];

// مفتاح موحّد لتخزين/استرجاع علامة واحدة من سجل المتابعة الإلكتروني
const markKey = (classId, subject, period, studentId, itemKey, slotNo) =>
  `${classId}::${subject}::${period}::${studentId}::${itemKey}::${slotNo}`;

const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

export default function TeacherRecords() {
  const { session } = useSession();
  const [me, setMe] = useState(null);
  const [groups, setGroups] = useState(null); // [{ key, subject, class_id, class_no, grade, students }]
  const [year, setYear] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [term, setTerm] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());

  /* ---------- سجل المتابعة الإلكتروني ---------- */
  const [editorGroupKey, setEditorGroupKey] = useState("");
  const [editorPeriod, setEditorPeriod] = useState(PERIODS[0]);
  const [marks, setMarks] = useState({}); // markKey(...) -> نص القيمة
  const [marksLoading, setMarksLoading] = useState(false);
  const [saveState, setSaveState] = useState(""); // "" | "جارٍ الحفظ…" | "تم الحفظ"

  /* ---------- تحميل الإسنادات وطلابها ---------- */
  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;

      const { data: st } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
      setYearLabel(m.active_year_label ?? y);
      const t = Number(m.active_term ?? 1);
      setYear(y);
      setTerm(t);

      const { data: t0 } = await supabase
        .from("teachers").select("id, full_name, specialization")
        .eq("user_id", uid).maybeSingle();
      setMe(t0 ?? null);
      if (!t0) { setGroups([]); setLoading(false); return; }

      const { data: sch } = await supabase
        .from("schedule")
        .select("class_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t0.id)
        .eq("academic_year", y)
        .eq("term", t);

      // تجميع فريد: فصل + مادة
      const map = new Map();
      (sch ?? []).forEach((r) => {
        const subject = r.subjects?.name ?? "—";
        const key = `${r.class_id}::${subject}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            subject,
            class_id: r.class_id,
            class_no: r.classes?.class_no ?? 0,
            grade: r.classes?.grade ?? 0,
            students: [],
          });
        }
      });

      const list = [...map.values()];
      const classIds = [...new Set(list.map((g) => g.class_id))];

      // طلاب كل الفصول دفعة واحدة
      if (classIds.length) {
        const { data: enr } = await supabase
          .from("student_enrollment")
          .select("class_id, students(id, full_name, national_id)")
          .in("class_id", classIds)
          .eq("status", "active");

        const byClass = {};
        (enr ?? []).forEach((e) => {
          if (!e.students) return;
          (byClass[e.class_id] ??= []).push(e.students);
        });
        Object.values(byClass).forEach((arr) =>
          arr.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"))
        );
        list.forEach((g) => { g.students = byClass[g.class_id] ?? []; });
      }

      list.sort(
        (a, b) =>
          a.subject.localeCompare(b.subject, "ar") || a.class_no - b.class_no
      );

      setGroups(list);
      setSelected(new Set(list.map((g) => g.key)));
      const first = list.find((g) => g.students.length);
      if (first) setEditorGroupKey(first.key);
      setLoading(false);
    })();
  }, [session]);

  const chosen = useMemo(
    () => (groups ?? []).filter((g) => selected.has(g.key) && g.students.length),
    [groups, selected]
  );

  const toggle = (key) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const editorGroup = useMemo(
    () => (groups ?? []).find((g) => g.key === editorGroupKey) ?? null,
    [groups, editorGroupKey]
  );

  /* ---------- تحميل علامات سجل المتابعة الإلكتروني للفصل/المادة/الفترة المختارة ---------- */
  useEffect(() => {
    (async () => {
      if (!me || !editorGroup || !year) { setMarks({}); return; }
      setMarksLoading(true);
      const { data } = await supabase
        .from("teacher_follow_up")
        .select("student_id, item_key, slot_no, mark")
        .eq("teacher_id", me.id)
        .eq("class_id", editorGroup.class_id)
        .eq("subject", editorGroup.subject)
        .eq("academic_year", year)
        .eq("term", term)
        .eq("period", editorPeriod);

      const m = {};
      (data ?? []).forEach((r) => {
        m[markKey(editorGroup.class_id, editorGroup.subject, editorPeriod, r.student_id, r.item_key, r.slot_no)] =
          r.mark ?? "";
      });
      setMarks(m);
      setMarksLoading(false);
    })();
  }, [me, editorGroup, editorPeriod, year, term]);

  // حفظ فوري لخانة واحدة عند مغادرتها (onBlur) — يحدّث الصف أو يحذفه إن أُفرغ
  const saveMark = async (studentId, itemKey, slotNo, rawValue) => {
    if (!me || !editorGroup) return;
    const value = String(rawValue ?? "").trim();
    const mark = value === "" ? null : Number(value);
    if (value !== "" && Number.isNaN(mark)) return;

    setSaveState("جارٍ الحفظ…");
    if (mark === null) {
      await supabase
        .from("teacher_follow_up")
        .delete()
        .eq("teacher_id", me.id)
        .eq("class_id", editorGroup.class_id)
        .eq("subject", editorGroup.subject)
        .eq("academic_year", year)
        .eq("term", term)
        .eq("period", editorPeriod)
        .eq("student_id", studentId)
        .eq("item_key", itemKey)
        .eq("slot_no", slotNo);
    } else {
      await supabase.from("teacher_follow_up").upsert(
        {
          teacher_id: me.id,
          class_id: editorGroup.class_id,
          subject: editorGroup.subject,
          academic_year: year,
          term,
          period: editorPeriod,
          student_id: studentId,
          item_key: itemKey,
          slot_no: slotNo,
          mark,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "teacher_id,class_id,subject,academic_year,term,period,student_id,item_key,slot_no" }
      );
    }
    setSaveState("تم الحفظ");
  };

  const markValue = (studentId, itemKey, slotNo) =>
    editorGroup
      ? marks[markKey(editorGroup.class_id, editorGroup.subject, editorPeriod, studentId, itemKey, slotNo)] ?? ""
      : "";

  const setMarkLocal = (studentId, itemKey, slotNo, value) => {
    if (!editorGroup) return;
    const k = markKey(editorGroup.class_id, editorGroup.subject, editorPeriod, studentId, itemKey, slotNo);
    setMarks((prev) => ({ ...prev, [k]: value }));
  };

  const logos = () => ({
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  });

  const coverBase = (extra = []) => ({
    rows: [
      ["المعلم", me?.full_name ?? ""],
      ...(me?.specialization ? [["التخصص", me.specialization]] : []),
      ["عدد الفصول", String(chosen.length)],
      ...extra,
    ],
    groups: chosen.map((g) => ({
      subject: g.subject,
      grade: GRADE_NAMES[g.grade] ?? g.grade,
      class_no: g.class_no,
    })),
    year: `العام الدراسي ${yearLabel} — الفصل الدراسي ${TERM_LABEL[term] ?? term}`,
  });

  /* ---------- سجل رصد الدرجات: ملف واحد لكل المواد والفصول ---------- */
  const printGrades = () => {
    if (!chosen.length) return;
    setBusy(true);

    const sections = chosen.map((g) => {
      const cfg = configFor(g.subject, g.grade);
      const { headerRows } = buildGradeHeader(cfg);
      const blanks = gradeBlankCount(cfg);

      // م · هوية · اسم عريض · باقي الأعمدة بالتساوي
      const rest = blanks;
      const colWidths = [
        "3.5%", "24%",
        ...Array.from({ length: rest }, () => `${(72.5 / rest).toFixed(2)}%`),
      ];

      return {
        colWidths,
        title: `كشف رصد درجات مادة ${g.subject}`,
        subtitle: `${GRADE_NAMES[g.grade] ?? ""} · فصل ${g.class_no} · ${g.students.length} طالبًا`,
        headerRows,
        tableClass: "compact",
        rows: g.students.map((s, i) => [
          i + 1,
          { text: s.full_name ?? "", cls: "name" },
          ...Array.from({ length: blanks }, () => ({ text: "", cls: "blank" })),
        ]),
      };
    });

    printReport({
      title: "كشف رصد الدرجات",
      landscape: true,
      sections,
      cover: {
        title: "كشف رصد الدرجات",
        groupsTitle: "المواد والفصول المشمولة",
        ...coverBase(),
      },
      signatures: [
        { title: "معلم المادة", name: me?.full_name ?? "" },
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      ...logos(),
    });

    setBusy(false);
  };

  /* ---------- سجل المتابعة: ملف واحد، قسم لكل فصل × فترة ---------- */
  const printFollowUp = () => {
    if (!chosen.length) return;
    setBusy(true);

    const secWidth = (sec) => sec.items.reduce((n, it) => n + it.slots, 0);
    const totalCols = FOLLOW_SECTIONS.reduce((n, sec) => n + secWidth(sec), 0);

    // 1) أسماء الأقسام
    const row1 = [
      { text: "م", rowspan: 5 },
      { text: "اسم الطالب", rowspan: 5 },
      ...FOLLOW_SECTIONS.map((sec) => ({ text: sec.label, colspan: secWidth(sec) })),
      { text: "المجموع النهائي", rowspan: 5, cls: "total-h" },
    ];

    // 2) خانة الدرجة الكلية لكل قسم
    const row2 = FOLLOW_SECTIONS.map((sec) => ({
      text: "الدرجة", colspan: secWidth(sec), cls: "score",
    }));

    // 3) أسماء البنود
    const row3 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.map((it) => ({ text: it.label, colspan: it.slots }))
    );

    // 4) خانة درجة كل بند
    const row4 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.map((it) => ({
        text: "الدرجة", colspan: it.slots, cls: "score",
      }))
    );

    // 5) أرقام المتابعات تحت البنود متعددة الأعمدة
    const row5 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.flatMap((it) =>
        it.slots > 1
          ? Array.from({ length: it.slots }, (_, i) => ({ text: String(i + 1), cls: "slot" }))
          : [{ text: "—", cls: "slot" }]
      )
    );

    // أعمدة المتابعة ضيقة (علامة بسيطة)، والاسم عريض
    const slotCount = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.filter((it) => it.slots > 1).map((it) => it.slots)
    ).reduce((a, b) => a + b, 0);
    const singleCount = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.filter((it) => it.slots === 1)
    ).length;

    const colWidths = [
      "3%",   // م
      "20%",  // الاسم — عرض يكفي لمعظم الأسماء الرباعية دون انقطاع
      ...FOLLOW_SECTIONS.flatMap((sec) =>
        sec.items.flatMap((it) =>
          Array.from({ length: it.slots }, () =>
            it.slots > 1 ? `${(53 / slotCount).toFixed(2)}%` : `${(18 / singleCount).toFixed(2)}%`
          )
        )
      ),
      "6%",   // المجموع النهائي
    ];

    const sections = [];
    ["الفترة الأولى", "الفترة الثانية"].forEach((period) => {
      chosen.forEach((g) => {
        sections.push({
          title: `سجل متابعة مادة ${g.subject} — ${period}`,
          subtitle: `${GRADE_NAMES[g.grade] ?? ""} · فصل ${g.class_no} · ${g.students.length} طالبًا`,
          headerRows: [row1, row2, row3, row4, row5],
          tableClass: "follow",
          colWidths,
          rows: g.students.map((s, i) => [
            i + 1,
            { text: s.full_name ?? "", cls: "name" },
            ...FOLLOW_SECTIONS.flatMap((sec) =>
              sec.items.flatMap((it) =>
                Array.from({ length: it.slots }, () => ({
                  text: "", cls: it.slots > 1 ? "blank slot" : "blank",
                }))
              )
            ),
            { text: "", cls: "blank total" },
          ]),
        });
      });
    });

    printReport({
      title: "سجل المتابعة",
      landscape: true,
      sections,
      cover: {
        title: "سجل المتابعة",
        groupsTitle: "المواد والفصول المشمولة",
        ...coverBase([["الفترات", "سجل مستقل لكل فترة"]]),
      },
      note: "تُكتب الدرجة الكلية لكل قسم وبند في خانات «الدرجة»، والأعمدة المرقّمة لمتابعات متعددة خلال الفترة.",
      signatures: [
        { title: "معلم المادة", name: me?.full_name ?? "" },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
      ...logos(),
    });

    setBusy(false);
  };

  /* ---------- طباعة سجل المتابعة للفصل/الفترة قيد التعبئة حاليًا فقط ---------- */
  const printEditorFollowUp = () => {
    if (!editorGroup) return;
    const g = editorGroup;

    const secWidth = (sec) => sec.items.reduce((n, it) => n + it.slots, 0);
    const row1 = [
      { text: "م", rowspan: 5 },
      { text: "اسم الطالب", rowspan: 5 },
      ...FOLLOW_SECTIONS.map((sec) => ({ text: sec.label, colspan: secWidth(sec) })),
      { text: "المجموع النهائي", rowspan: 5, cls: "total-h" },
    ];
    const row2 = FOLLOW_SECTIONS.map((sec) => ({ text: "الدرجة", colspan: secWidth(sec), cls: "score" }));
    const row3 = FOLLOW_SECTIONS.flatMap((sec) => sec.items.map((it) => ({ text: it.label, colspan: it.slots })));
    const row4 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.map((it) => ({ text: "الدرجة", colspan: it.slots, cls: "score" }))
    );
    const row5 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.flatMap((it) =>
        it.slots > 1
          ? Array.from({ length: it.slots }, (_, i) => ({ text: String(i + 1), cls: "slot" }))
          : [{ text: "—", cls: "slot" }]
      )
    );

    const slotCount = FOLLOW_SECTIONS.flatMap((sec) => sec.items.filter((it) => it.slots > 1).map((it) => it.slots)).reduce((a, b) => a + b, 0);
    const singleCount = FOLLOW_SECTIONS.flatMap((sec) => sec.items.filter((it) => it.slots === 1)).length;
    const colWidths = [
      "3%", "20%",
      ...FOLLOW_SECTIONS.flatMap((sec) =>
        sec.items.flatMap((it) =>
          Array.from({ length: it.slots }, () =>
            it.slots > 1 ? `${(53 / slotCount).toFixed(2)}%` : `${(18 / singleCount).toFixed(2)}%`
          )
        )
      ),
      "6%",
    ];

    printReport({
      title: "سجل المتابعة",
      landscape: true,
      logoUrl: logos().logoUrl,
      moeLogoUrl: logos().moeLogoUrl,
      sections: [
        {
          title: `سجل متابعة مادة ${g.subject} — ${editorPeriod}`,
          subtitle: `${GRADE_NAMES[g.grade] ?? ""} · فصل ${g.class_no} · ${g.students.length} طالبًا`,
          headerRows: [row1, row2, row3, row4, row5],
          tableClass: "follow",
          colWidths,
          rows: g.students.map((s, i) => [
            i + 1,
            { text: s.full_name ?? "", cls: "name" },
            ...FOLLOW_SECTIONS.flatMap((sec) =>
              sec.items.flatMap((it) =>
                Array.from({ length: it.slots }, (_, slotIdx) => {
                  const val = markValue(s.id, it.key, slotIdx + 1);
                  return { text: val, cls: `${val ? "" : "blank"} ${it.slots > 1 ? "slot" : ""}`.trim() };
                })
              )
            ),
            (() => {
              const val = markValue(s.id, "total", 1);
              return { text: val, cls: `${val ? "" : "blank"} total`.trim() };
            })(),
          ]),
        },
      ],
      note: "سجل متابعة إلكتروني — يعكس آخر ما تم إدخاله وحفظه في الموقع.",
      signatures: [
        { title: "معلم المادة", name: me?.full_name ?? "" },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
    });
  };

  /* ---------- العرض ---------- */

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;
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
        <p className="mt-1.5 text-sm text-muted">
          لم تُسند إليك مواد أو فصول في هذا الفصل الدراسي.
        </p>
      </div>
    );
  }

  const totalStudents = chosen.reduce((n, g) => n + g.students.length, 0);
  const unknown = chosen.filter((g) => !isKnownSubject(g.subject, g.grade));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">السجلات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          كشف رصد الدرجات وسجل المتابعة — ملف واحد يشمل جميع موادك وفصولك،
          بغلاف واحد وصفحة لكل فصل.
        </p>
      </div>

      {/* ملخص */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fig value={chosen.length} label="فصل مشمول" />
        <Fig value={totalStudents} label="إجمالي الطلاب" />
        <Fig value={new Set(chosen.map((g) => g.subject)).size} label="مادة" />
      </section>

      {/* الاختيار */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">المواد والفصول</h2>
          <div className="flex gap-3 text-xs font-medium">
            <button onClick={() => setSelected(new Set(groups.map((g) => g.key)))}
                    className="text-mint-deep hover:underline">تحديد الكل</button>
            <button onClick={() => setSelected(new Set())}
                    className="text-muted hover:underline">إلغاء الكل</button>
          </div>
        </div>

        <div className="divide-y divide-line">
          {groups.map((g) => {
            const on = selected.has(g.key);
            return (
              <label key={g.key}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-canvas">
                <input type="checkbox" checked={on} onChange={() => toggle(g.key)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {g.subject}
                  </span>
                  <span className="block text-xs text-muted">
                    {GRADE_NAMES[g.grade] ?? ""} · فصل{" "}
                    <span className="num">{g.class_no}</span>
                  </span>
                </span>
                <span className="num chip shrink-0 bg-mint-tint text-mint-deep">
                  {g.students.length} طالبًا
                </span>
                {!isKnownSubject(g.subject, g.grade) && (
                  <span className="chip shrink-0 bg-warning-light text-warning">
                    توزيع افتراضي
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      {unknown.length > 0 && (
        <p className="rounded-card bg-warning-light px-4 py-3 text-xs leading-relaxed text-warning">
          توزيع درجات هذه المواد غير مُعرّف وسيُستخدم التوزيع الافتراضي:{" "}
          {unknown.map((g) => g.subject).join("، ")}. راجع الدعم الفني لإضافتها.
        </p>
      )}

      {/* سجل المتابعة الإلكتروني */}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">سجل المتابعة الإلكتروني</h2>
            <p className="mt-0.5 text-xs text-muted">
              نفس نموذج السجل الورقي، لكن تُدخل الدرجات هنا وتُحفظ تلقائيًا — ويمكنك
              تصديرها وطباعتها في أي وقت.
            </p>
          </div>
          {saveState && <span className="shrink-0 text-xs text-mint-deep">{saveState}</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="field w-auto flex-1 min-w-[220px]"
            value={editorGroupKey}
            onChange={(e) => setEditorGroupKey(e.target.value)}
          >
            {(groups ?? []).filter((g) => g.students.length).map((g) => (
              <option key={g.key} value={g.key}>
                {g.subject} — {GRADE_NAMES[g.grade] ?? ""} فصل {g.class_no}
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-pill border border-line">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setEditorPeriod(p)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  editorPeriod === p ? "bg-mint-deep text-white" : "bg-white text-muted hover:bg-canvas"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={printEditorFollowUp}
            disabled={!editorGroup}
            className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40"
          >
            تصدير وطباعة هذا السجل
          </button>
        </div>

        {marksLoading && <p className="text-xs text-muted">جارٍ تحميل السجل…</p>}

        {!marksLoading && editorGroup && (
          <div className="overflow-x-auto rounded-sm2 border border-line">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="bg-mint-tint text-mint-deep">
                  <th rowSpan={2} className="border border-line px-2 py-1.5 w-8">م</th>
                  <th rowSpan={2} className="border border-line px-2 py-1.5 text-right min-w-[140px]">اسم الطالب</th>
                  {FOLLOW_SECTIONS.map((sec) => (
                    <th key={sec.label} colSpan={sec.items.reduce((n, it) => n + it.slots, 0)}
                        className="border border-line px-2 py-1.5">
                      {sec.label}
                    </th>
                  ))}
                  <th rowSpan={2} className="border border-line px-2 py-1.5 w-16">المجموع النهائي</th>
                </tr>
                <tr className="bg-mint-tint/60 text-mint-deep">
                  {FOLLOW_SECTIONS.flatMap((sec) =>
                    sec.items.flatMap((it) =>
                      Array.from({ length: it.slots }, (_, i) => (
                        <th key={`${it.key}-${i}`} className="border border-line px-1 py-1 font-normal">
                          {it.label}{it.slots > 1 ? ` ${i + 1}` : ""}
                        </th>
                      ))
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {editorGroup.students.map((s, i) => (
                  <tr key={s.id} className={i % 2 ? "bg-gray-tint/40" : ""}>
                    <td className="num border border-line px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-line px-2 py-1 text-right">{s.full_name}</td>
                    {FOLLOW_SECTIONS.flatMap((sec) =>
                      sec.items.flatMap((it) =>
                        Array.from({ length: it.slots }, (_, slotIdx) => {
                          const slotNo = slotIdx + 1;
                          const k = `${s.id}-${it.key}-${slotNo}`;
                          return (
                            <td key={k} className="border border-line p-0">
                              <input
                                type="number"
                                inputMode="decimal"
                                className="num w-full border-0 bg-transparent px-1 py-1 text-center outline-none focus:bg-mint-tint/50"
                                value={markValue(s.id, it.key, slotNo)}
                                onChange={(e) => setMarkLocal(s.id, it.key, slotNo, e.target.value)}
                                onBlur={(e) => saveMark(s.id, it.key, slotNo, e.target.value)}
                              />
                            </td>
                          );
                        })
                      )
                    )}
                    <td className="border border-line p-0">
                      <input
                        type="number"
                        inputMode="decimal"
                        className="num w-full border-0 bg-mint-tint/30 px-1 py-1 text-center font-bold outline-none focus:bg-mint-tint/60"
                        value={markValue(s.id, "total", 1)}
                        onChange={(e) => setMarkLocal(s.id, "total", 1, e.target.value)}
                        onBlur={(e) => saveMark(s.id, "total", 1, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* الطباعة */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-ink">الطباعة</h2>

        <div className="flex flex-wrap gap-2">
          <button onClick={printGrades} disabled={busy || !chosen.length}
                  className="btn-primary disabled:opacity-40">
            كشف رصد الدرجات
          </button>
          <button onClick={printFollowUp} disabled={busy || !chosen.length}
                  className="rounded-sm2 border border-line bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
            سجل المتابعة
          </button>
        </div>

        <div className="flex gap-2.5 rounded-card border border-[#F5D98C] bg-[#FFF8E6] px-3.5 py-3">
          <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-warning"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 16.5h.01" />
            <path d="M10.3 3.9 2.7 17.3a1.8 1.8 0 0 0 1.56 2.7h15.48a1.8 1.8 0 0 0 1.56-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
          </svg>
          <p className="text-xs leading-relaxed text-[#8A6416]">
            <span className="font-bold">مهم قبل الطباعة:</span> اختر اتجاه الصفحة{" "}
            <span className="font-bold">أفقي (Landscape)</span> من نافذة الطباعة
            حتى يظهر الجدول كاملاً بشكل سليم دون اقتصاص.
          </p>
        </div>

        <div className="rounded-sm2 bg-gray-tint px-3 py-2.5 text-xs leading-relaxed text-muted">
          يُفتح التقرير في نافذة الطباعة مباشرة. ولطباعة فصل معيّن فقط، حدّده
          أعلاه قبل الضغط، أو اختر نطاق الصفحات من نافذة الطباعة.
          <br />
          فعّل خيار «الرسومات الخلفية» لتظهر ألوان الجدول، وأطفئ «الرؤوس والتذييلات»
          لإخفاء عنوان الصفحة أسفل الورقة.
        </div>
      </section>
    </div>
  );
}

function Fig({ value, label }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
      <p className="num text-2xl font-bold leading-none text-mint-deep">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
}
