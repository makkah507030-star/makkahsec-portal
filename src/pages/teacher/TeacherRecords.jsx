import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { printReport, PRINCIPAL_NAME, ACADEMIC_DEPUTY_NAME } from "../../lib/exportUtils";
import { configFor, isKnownSubject, buildGradeHeader, gradeBlankCount } from "../../lib/gradeSheets";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

/* سجل المتابعة — الأقسام وبنودها
   slots: عدد أعمدة المتابعة تحت البند (متابعة في أوقات متعددة) */
const FOLLOW_SLOTS = 5;

const FOLLOW_SECTIONS = [
  {
    label: "المهام الأدائية والمشاركة والتفاعل",
    items: [
      { label: "الواجبات", slots: FOLLOW_SLOTS },
      { label: "المشاركة", slots: FOLLOW_SLOTS },
      { label: "التطبيقات الصفية", slots: FOLLOW_SLOTS },
    ],
  },
  {
    label: "تقويم تحريري وتطبيقات عملية",
    items: [
      { label: "نظري", slots: 1 },
      { label: "عملي", slots: 1 },
    ],
  },
];

export default function TeacherRecords() {
  const { session } = useSession();
  const [me, setMe] = useState(null);
  const [groups, setGroups] = useState(null); // [{ key, subject, class_id, class_no, grade, students }]
  const [year, setYear] = useState("");
  const [term, setTerm] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());

  /* ---------- تحميل الإسنادات وطلابها ---------- */
  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;

      const { data: st } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
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

  const logos = () => ({
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  });

  const coverBase = (extra = []) => ({
    rows: [
      ["المعلم", me?.full_name ?? ""],
      ...(me?.specialization ? [["التخصص", me.specialization]] : []),
      ["عدد الفصول", String(chosen.length)],
      ["إجمالي الطلاب", String(chosen.reduce((n, g) => n + g.students.length, 0))],
      ...extra,
    ],
    groups: chosen.map((g) => ({
      subject: g.subject,
      grade: GRADE_NAMES[g.grade] ?? g.grade,
      class_no: g.class_no,
      count: g.students.length,
    })),
    year: `العام الدراسي ${year} — الفصل الدراسي ${term}`,
  });

  /* ---------- سجل رصد الدرجات: ملف واحد لكل المواد والفصول ---------- */
  const printGrades = () => {
    if (!chosen.length) return;
    setBusy(true);

    const sections = chosen.map((g) => {
      const cfg = configFor(g.subject);
      const { headerRows } = buildGradeHeader(cfg);
      const blanks = gradeBlankCount(cfg);

      return {
        title: `كشف رصد درجات مادة ${g.subject}`,
        subtitle: `${GRADE_NAMES[g.grade] ?? ""} · فصل ${g.class_no} · ${g.students.length} طالبًا`,
        headerRows,
        tableClass: "compact",
        rows: g.students.map((s, i) => [
          i + 1,
          s.national_id ?? "",
          { text: s.full_name ?? "", cls: "name" },
          ...Array.from({ length: blanks }, () => ({ text: "", cls: "blank" })),
        ]),
      };
    });

    printReport({
      title: "كشف رصد الدرجات",
      sections,
      cover: {
        title: "كشف رصد الدرجات",
        subtitle: me?.full_name ?? "",
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
      text: "", colspan: secWidth(sec), cls: "score",
    }));

    // 3) أسماء البنود
    const row3 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.map((it) => ({ text: it.label, colspan: it.slots }))
    );

    // 4) خانة درجة كل بند
    const row4 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.map((it) => ({ text: "", colspan: it.slots, cls: "score" }))
    );

    // 5) أرقام المتابعات تحت البنود متعددة الأعمدة
    const row5 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.flatMap((it) =>
        it.slots > 1
          ? Array.from({ length: it.slots }, (_, i) => ({ text: String(i + 1), cls: "slot" }))
          : [{ text: "—", cls: "slot" }]
      )
    );

    const sections = [];
    ["الفترة الأولى", "الفترة الثانية"].forEach((period) => {
      chosen.forEach((g) => {
        sections.push({
          title: `سجل متابعة مادة ${g.subject} — ${period}`,
          subtitle: `${GRADE_NAMES[g.grade] ?? ""} · فصل ${g.class_no} · ${g.students.length} طالبًا`,
          headerRows: [row1, row2, row3, row4, row5],
          tableClass: "follow",
          rows: g.students.map((s, i) => [
            i + 1,
            { text: s.full_name ?? "", cls: "name" },
            ...Array.from({ length: totalCols }, () => ({ text: "", cls: "blank" })),
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
        subtitle: me?.full_name ?? "",
        groupsTitle: "المواد والفصول المشمولة",
        ...coverBase([["الفترات", "سجل مستقل لكل فترة"]]),
      },
      note: "تُكتب الدرجة الكلية لكل قسم وبند في الخانات البيضاء، والأرقام أسفلها لمتابعات متعددة خلال الفترة.",
      signatures: [
        { title: "معلم المادة", name: me?.full_name ?? "" },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      ...logos(),
    });

    setBusy(false);
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
  const unknown = chosen.filter((g) => !isKnownSubject(g.subject));

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
                {!isKnownSubject(g.subject) && (
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
