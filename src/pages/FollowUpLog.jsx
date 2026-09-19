import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { printReport, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const TERM_LABEL = { 1: "الأول", 2: "الثاني" };
const PERIODS = ["الفترة الأولى", "الفترة الثانية"];

/* نفس بنود سجل المتابعة الورقي — بمفتاح لكل بند لاستخدامه في قاعدة البيانات */
const FOLLOW_SLOTS = 5;
const FOLLOW_SECTIONS = [
  {
    label: "المهام الأدائية والمشاركة والتفاعل",
    items: [
      { key: "homework", label: "الواجبات", slots: FOLLOW_SLOTS },
      { key: "participation", label: "المشاركة", slots: FOLLOW_SLOTS },
      { key: "classwork", label: "التطبيقات الصفية", slots: FOLLOW_SLOTS },
    ],
  },
  {
    label: "تقويم تحريري وتطبيقات عملية",
    items: [
      { key: "written", label: "نظري", slots: 1 },
      { key: "practical", label: "عملي", slots: 1 },
    ],
  },
];
const ALL_ITEMS = FOLLOW_SECTIONS.flatMap((s) => s.items);
const ITEM_BY_KEY = Object.fromEntries(ALL_ITEMS.map((it) => [it.key, it]));

const markKey = (classId, subject, period, studentId, itemKey, slotNo) =>
  `${classId}::${subject}::${period}::${studentId}::${itemKey}::${slotNo}`;

export default function FollowUpLog() {
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
  const [itemKey, setItemKey] = useState("participation");
  const [slotNo, setSlotNo] = useState(1);
  const [showFull, setShowFull] = useState(false);

  const [marks, setMarks] = useState({}); // markKey -> value string
  const [marksLoading, setMarksLoading] = useState(false);
  const [saveState, setSaveState] = useState({}); // studentId -> "saving" | "saved" | "error"
  const [errorMsg, setErrorMsg] = useState({}); // studentId -> last error message

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
        (a, b) => a.subject.localeCompare(b.subject, "ar") || a.class_no - b.class_no
      );

      setGroups(list);
      if (list.length) setGroupKey(list[0].key);
      setLoading(false);
    })();
  }, [session]);

  const group = useMemo(
    () => (groups ?? []).find((g) => g.key === groupKey) ?? null,
    [groups, groupKey]
  );

  /* ---------- تحميل الدرجات المحفوظة لهذا الفصل×المادة×الفترة ---------- */
  useEffect(() => {
    (async () => {
      if (!me || !group) return;
      setMarksLoading(true);

      const { data } = await supabase
        .from("teacher_follow_up")
        .select("student_id, item_key, slot_no, mark")
        .eq("teacher_id", me.id)
        .eq("class_id", group.class_id)
        .eq("subject", group.subject)
        .eq("academic_year", year)
        .eq("term", term)
        .eq("period", period);

      const next = {};
      (data ?? []).forEach((r) => {
        if (r.mark === null || r.mark === undefined) return;
        next[markKey(group.class_id, group.subject, period, r.student_id, r.item_key, r.slot_no)] =
          String(r.mark);
      });
      setMarks(next);
      setMarksLoading(false);
    })();
  }, [me, group, year, term, period]);

  const markValue = (studentId, ik, sn) =>
    group ? marks[markKey(group.class_id, group.subject, period, studentId, ik, sn)] ?? "" : "";

  /* ---------- الانتقال التلقائي لمتابعة البند التالي غير المكتملة ----------
     عند فتح بند متعدد المتابعات (كالمشاركة)، بدل البدء دائمًا من متابعة 1،
     يقترح النظام أول متابعة لم تكتمل بعد لكل طلاب الفصل، حتى لا يبحث المعلم
     يدويًا عن آخر درجة رصدها في حصة سابقة. */
  const autoSlotKeyRef = useRef("");
  useEffect(() => {
    if (!group || marksLoading) return;
    const it = ITEM_BY_KEY[itemKey];
    if (!it) return;

    const navKey = `${group.key}::${period}::${itemKey}`;
    if (autoSlotKeyRef.current === navKey) return;
    autoSlotKeyRef.current = navKey;

    if (it.slots <= 1) { setSlotNo(1); return; }

    let suggested = 1;
    for (let sn = 1; sn <= it.slots; sn++) {
      const complete = group.students.every((s) => markValue(s.id, itemKey, sn) !== "");
      if (!complete) { suggested = sn; break; }
      suggested = it.slots; // كل المتابعات مكتملة — يبقى عند الأخيرة
    }
    setSlotNo(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, period, itemKey, marksLoading, marks]);

  const setMarkLocal = (studentId, ik, sn, value) => {
    if (!group) return;
    setMarks((prev) => ({
      ...prev,
      [markKey(group.class_id, group.subject, period, studentId, ik, sn)]: value,
    }));
  };

  const saveMark = async (studentId, ik, sn, rawValue) => {
    if (!me || !group) return;
    const value = rawValue.trim();
    setSaveState((prev) => ({ ...prev, [studentId]: "saving" }));
    try {
      if (value === "") {
        const { error } = await supabase
          .from("teacher_follow_up")
          .delete()
          .eq("teacher_id", me.id)
          .eq("class_id", group.class_id)
          .eq("subject", group.subject)
          .eq("academic_year", year)
          .eq("term", term)
          .eq("period", period)
          .eq("student_id", studentId)
          .eq("item_key", ik)
          .eq("slot_no", sn);
        if (error) throw error;
      } else {
        const num = Number(value);
        if (Number.isNaN(num)) throw new Error("قيمة غير صالحة");
        const { error } = await supabase.from("teacher_follow_up").upsert(
          {
            teacher_id: me.id,
            class_id: group.class_id,
            subject: group.subject,
            academic_year: year,
            term,
            period,
            student_id: studentId,
            item_key: ik,
            slot_no: sn,
            mark: num,
          },
          { onConflict: "teacher_id,class_id,subject,academic_year,term,period,student_id,item_key,slot_no" }
        );
        if (error) throw error;
      }
      setSaveState((prev) => ({ ...prev, [studentId]: "saved" }));
      setTimeout(() => {
        setSaveState((prev) => (prev[studentId] === "saved" ? { ...prev, [studentId]: null } : prev));
      }, 1500);
    } catch (e) {
      console.error("saveMark failed:", e);
      setErrorMsg((prev) => ({ ...prev, [studentId]: e?.message || String(e) }));
      setSaveState((prev) => ({ ...prev, [studentId]: "error" }));
    }
  };

  const activeItem = ITEM_BY_KEY[itemKey];

  const toggleMark = (studentId, ik, sn, checked) => {
    const value = checked ? "1" : "";
    setMarkLocal(studentId, ik, sn, value);
    saveMark(studentId, ik, sn, value);
  };

  const logos = () => ({
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  });

  /* ---------- تصدير وطباعة سجل هذا الفصل × الفترة الحالية ---------- */
  const printGroupFollowUp = async () => {
    if (!me || !group) return;
    setBusy(true);

    const { data } = await supabase
      .from("teacher_follow_up")
      .select("student_id, item_key, slot_no, mark")
      .eq("teacher_id", me.id)
      .eq("class_id", group.class_id)
      .eq("subject", group.subject)
      .eq("academic_year", year)
      .eq("term", term)
      .eq("period", period);

    const saved = {};
    (data ?? []).forEach((r) => {
      saved[`${r.student_id}::${r.item_key}::${r.slot_no}`] = r.mark;
    });

    const secWidth = (sec) => sec.items.reduce((n, it) => n + it.slots, 0);

    const row1 = [
      { text: "م", rowspan: 5 },
      { text: "اسم الطالب", rowspan: 5 },
      ...FOLLOW_SECTIONS.map((sec) => ({ text: sec.label, colspan: secWidth(sec) })),
      { text: "المجموع النهائي", rowspan: 5, cls: "total-h" },
    ];
    const row2 = FOLLOW_SECTIONS.map((sec) => ({
      text: "الدرجة", colspan: secWidth(sec), cls: "score",
    }));
    const row3 = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.map((it) => ({ text: it.label, colspan: it.slots }))
    );
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

    const slotCount = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.filter((it) => it.slots > 1).map((it) => it.slots)
    ).reduce((a, b) => a + b, 0);
    const singleCount = FOLLOW_SECTIONS.flatMap((sec) =>
      sec.items.filter((it) => it.slots === 1)
    ).length;

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

    const rows = group.students.map((s, i) => {
      let total = 0;
      let any = false;
      const cells = FOLLOW_SECTIONS.flatMap((sec) =>
        sec.items.flatMap((it) =>
          Array.from({ length: it.slots }, (_, si) => {
            const v = saved[`${s.id}::${it.key}::${si + 1}`];
            const done = v !== undefined && v !== null && Number(v) > 0;
            if (done) { total += 1; any = true; }
            return {
              text: done ? "✓" : "",
              cls: done ? (it.slots > 1 ? "slot" : "") : (it.slots > 1 ? "blank slot" : "blank"),
            };
          })
        )
      );
      return [
        i + 1,
        { text: s.full_name ?? "", cls: "name" },
        ...cells,
        { text: any ? String(total) : "", cls: any ? "total" : "blank total" },
      ];
    });

    printReport({
      title: "سجل المتابعة الإلكتروني",
      landscape: true,
      sections: [
        {
          title: `سجل متابعة مادة ${group.subject} — ${period}`,
          subtitle: `${GRADE_NAMES[group.grade] ?? ""} · فصل ${group.class_no} · ${group.students.length} طالبًا`,
          headerRows: [row1, row2, row3, row4, row5],
          tableClass: "follow",
          colWidths,
          rows,
        },
      ],
      cover: {
        title: "سجل المتابعة الإلكتروني",
        groupsTitle: "الفصل والمادة",
        rows: [
          ["المعلم", me?.full_name ?? ""],
          ["المادة", group.subject],
          ["الفصل", `${GRADE_NAMES[group.grade] ?? ""} · فصل ${group.class_no}`],
          ["الفترة", period],
        ],
        groups: [{ subject: group.subject, grade: GRADE_NAMES[group.grade] ?? group.grade, class_no: group.class_no }],
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
        <p className="mt-1.5 text-sm text-muted">لم تُسند إليك مواد أو فصول في هذا الفصل الدراسي.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">سجل المتابعة الإلكتروني</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          حدّد البند الذي تعمل عليه الآن فقط — مثل المشاركة أثناء الحصة —
          بتأشير الطلاب من القائمة، وارجع لبقية البنود لاحقًا. يُحفظ كل شيء تلقائيًا.
        </p>
      </div>

      <div className="flex gap-2.5 rounded-card border border-line bg-mint-tint/50 px-3.5 py-3">
        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-mint-deep"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 16.5h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        <p className="text-xs leading-relaxed text-mint-deep">
          هذا السجل الإلكتروني مستقل تمامًا عن سجل المتابعة الورقي الموجود في قسم
          «السجلات» — تعبئة أحدهما لا تؤثر على الآخر، ويمكنك استخدام أيهما تفضّل.
        </p>
      </div>

      {/* اختيار الفصل والفترة */}
      <section className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">المادة والفصل</label>
            <select
              value={groupKey}
              onChange={(e) => setGroupKey(e.target.value)}
              className="input"
            >
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.subject} — {GRADE_NAMES[g.grade] ?? ""} فصل {g.class_no}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">الفترة</label>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={
                    "flex-1 rounded-sm2 border px-3 py-2 text-sm font-medium " +
                    (period === p
                      ? "border-mint-deep bg-mint-tint text-mint-deep"
                      : "border-line bg-paper text-ink hover:bg-canvas")
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {group && (
        <>
          {/* اختيار البند النشط */}
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink">البند الذي تعمل عليه الآن</h2>
            <div className="flex flex-wrap gap-2">
              {ALL_ITEMS.map((it) => (
                <button
                  key={it.key}
                  onClick={() => setItemKey(it.key)}
                  className={
                    "rounded-full border px-4 py-2 text-sm font-medium transition " +
                    (itemKey === it.key
                      ? "border-mint-deep bg-mint-deep text-white"
                      : "border-line bg-paper text-ink hover:bg-canvas")
                  }
                >
                  {it.label}
                </button>
              ))}
            </div>

            {activeItem?.slots > 1 && (
              <div>
                <p className="mb-1.5 text-xs text-muted">
                  رقم المتابعة تحت هذا البند
                  <span className="mr-1.5 text-mint-deep">— اقتُرحت المتابعة {slotNo} تلقائيًا كمتابعة تالية غير مكتملة</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: activeItem.slots }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setSlotNo(n)}
                      className={
                        "num flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold " +
                        (slotNo === n
                          ? "border-mint-deep bg-mint-tint text-mint-deep"
                          : "border-line bg-paper text-ink hover:bg-canvas")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* الإدخال المركّز — قائمة تأشير (شيك ليست) */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {activeItem?.label}
                {activeItem?.slots > 1 ? ` — متابعة ${slotNo}` : ""}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  {group.subject} · {GRADE_NAMES[group.grade] ?? ""} فصل {group.class_no}
                </span>
                <button
                  onClick={() => {
                    const allChecked = group.students.every(
                      (s) => markValue(s.id, itemKey, slotNo) !== ""
                    );
                    group.students.forEach((s) =>
                      toggleMark(s.id, itemKey, slotNo, !allChecked)
                    );
                  }}
                  className="text-xs font-medium text-mint-deep hover:underline"
                >
                  تأشير/إلغاء الكل
                </button>
              </div>
            </div>

            {marksLoading ? (
              <p className="px-4 py-8 text-center text-sm text-muted">جارٍ التحميل…</p>
            ) : (
              <div className="divide-y divide-line">
                {group.students.map((s, idx) => {
                  const st = saveState[s.id];
                  const checked = markValue(s.id, itemKey, slotNo) !== "";
                  return (
                    <div key={s.id} className="px-4 py-2.5 hover:bg-canvas">
                      <label className="flex cursor-pointer items-center gap-3">
                        <span className="num w-6 shrink-0 text-xs text-muted">{idx + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {s.full_name}
                        </span>
                        <span className="w-16 shrink-0 text-[11px]">
                          {st === "saving" && <span className="text-muted">جارٍ الحفظ…</span>}
                          {st === "saved" && <span className="text-mint-deep">تم الحفظ</span>}
                          {st === "error" && <span className="text-danger">تعذّر الحفظ</span>}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleMark(s.id, itemKey, slotNo, e.target.checked)}
                          className="h-6 w-6 shrink-0 accent-mint-deep"
                        />
                      </label>
                      {st === "error" && errorMsg[s.id] && (
                        <p className="mt-1 mr-9 text-[11px] leading-relaxed text-danger">
                          {errorMsg[s.id]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* الجدول الكامل + التصدير */}
          <section className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">مراجعة وتصدير</h2>
              <button
                onClick={() => setShowFull((v) => !v)}
                className="text-xs font-medium text-mint-deep hover:underline"
              >
                {showFull ? "إخفاء الجدول الكامل" : "عرض الجدول الكامل"}
              </button>
            </div>

            {showFull && !marksLoading && (
              <div className="overflow-x-auto rounded-sm2 border border-line">
                <table className="w-full min-w-[720px] text-center text-xs">
                  <thead>
                    <tr className="bg-canvas text-muted">
                      <th className="border-b border-line px-2 py-2">الطالب</th>
                      {ALL_ITEMS.flatMap((it) =>
                        Array.from({ length: it.slots }, (_, i) => (
                          <th key={`${it.key}-${i + 1}`} className="border-b border-line px-2 py-2 whitespace-nowrap">
                            {it.label}{it.slots > 1 ? ` ${i + 1}` : ""}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {group.students.map((s) => (
                      <tr key={s.id} className="border-b border-line last:border-0">
                        <td className="px-2 py-1.5 text-right font-medium text-ink">{s.full_name}</td>
                        {ALL_ITEMS.flatMap((it) =>
                          Array.from({ length: it.slots }, (_, i) => (
                            <td key={`${it.key}-${i + 1}`} className="px-2 py-1.5 text-muted">
                              {markValue(s.id, it.key, i + 1) ? "✓" : "—"}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={printGroupFollowUp}
              disabled={busy}
              className="btn-primary w-full disabled:opacity-40 sm:w-auto"
            >
              تصدير وطباعة هذا السجل
            </button>
            <p className="text-xs leading-relaxed text-muted">
              يصدّر السجل بنفس شكل النسخة الورقية، مملوءًا بالدرجات المحفوظة لهذه المادة
              والفصل والفترة الحالية فقط.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
