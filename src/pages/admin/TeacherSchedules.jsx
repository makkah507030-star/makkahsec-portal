import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { buildWeeklyPrintTable } from "../../lib/scheduleGrid";
import WeeklyGrid from "../../components/WeeklyGrid.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export default function TeacherSchedules() {
  const [q, setQ] = useState("");
  const [teachers, setTeachers] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [rows, setRows] = useState(null);
  const [year, setYear] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [term, setTerm] = useState(1);
  const [busyAll, setBusyAll] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase
        .from("settings").select("key, value")
        .in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      setYear(m.active_year ?? "");
      setYearLabel(m.active_year_label ?? m.active_year ?? "");
      setTerm(Number(m.active_term ?? 1));

      const { data } = await supabase
        .from("teachers").select("id, full_name, specialization")
        .order("full_name");
      setTeachers(data ?? []);

      // اختيار أول معلم تلقائيًا حتى تظهر الشاشة معبّأة من أول لحظة
      if (data?.length) pick(data[0], m);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term_ = q.trim();
    if (!term_) return teachers ?? [];
    return (teachers ?? []).filter((t) => t.full_name.includes(term_));
  }, [teachers, q]);

  const pick = async (t, settingsOverride) => {
    setTeacher(t);
    setRows(null);
    const m = settingsOverride;
    const y = m ? (m.active_year ?? "") : year;
    const tm = m ? Number(m.active_term ?? 1) : term;
    const { data } = await supabase
      .from("schedule")
      .select("id, day_of_week, period_no, start_time, end_time, classes(class_no, grade), subjects(name)")
      .eq("teacher_id", t.id).eq("academic_year", y).eq("term", tm);
    setRows(data ?? []);
  };

  const cell = (r) => (
    <div>
      <p className="num text-xs font-bold text-ink">فصل {r.classes?.class_no}</p>
      <p className="text-[11px] text-muted">{r.subjects?.name}</p>
    </div>
  );
  const cellText = (r) => `فصل ${r.classes?.class_no ?? ""} — ${r.subjects?.name ?? ""}`;

  const printIt = () => {
    const { headers, rows: body } = buildWeeklyPrintTable(rows, cellText);
    printReport({
      title: `جدول المعلم — ${teacher.full_name}`,
      subtitle: `${teacher.specialization ?? ""} · ${yearLabel} · الفصل الدراسي ${term}`,
      headers, rows: body,
      landscape: true,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
    });
  };

  const printAll = async () => {
    if (!teachers?.length) return;
    setBusyAll(true);
    try {
      const { data: all } = await supabase
        .from("schedule")
        .select("id, teacher_id, day_of_week, period_no, start_time, end_time, classes(class_no, grade), subjects(name)")
        .eq("academic_year", year).eq("term", term);

      const byTeacher = new Map();
      (all ?? []).forEach((r) => {
        if (!r.teacher_id) return;
        if (!byTeacher.has(r.teacher_id)) byTeacher.set(r.teacher_id, []);
        byTeacher.get(r.teacher_id).push(r);
      });

      const sections = teachers
        .filter((t) => (byTeacher.get(t.id) ?? []).length > 0)
        .map((t) => {
          const { headers, rows: body } = buildWeeklyPrintTable(byTeacher.get(t.id), cellText);
          return {
            title: `جدول المعلم — ${t.full_name}`,
            subtitle: `${t.specialization ?? ""} · ${yearLabel} · الفصل الدراسي ${term}`,
            headers, rows: body,
          };
        });

      printReport({
        title: "جداول المعلمين — الكل",
        landscape: true,
        sections,
        logoUrl: new URL(logoIcon, window.location.origin).href,
        moeLogoUrl: new URL(moeLogo, window.location.origin).href,
        signatures: [
          { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
          { title: "مدير المدرسة", name: PRINCIPAL_NAME },
        ],
        hideSignatureLine: true,
      });
    } finally {
      setBusyAll(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">جداول المعلمين</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            اختر معلمًا من القائمة لعرض جدوله الأسبوعي، أو اطبع جداول الجميع دفعة واحدة.
          </p>
        </div>
        <button onClick={printAll} disabled={busyAll || !teachers?.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          {busyAll ? "جارٍ التجهيز…" : "طباعة الكل — PDF"}
        </button>
      </div>

      {/* عمودان جنبًا إلى جنب: القائمة ثابتة، والجدول يظهر بجانبها دون الحاجة للتمرير */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
        <section className="card overflow-hidden lg:sticky lg:top-20">
          <div className="border-b border-line p-3">
            <input className="field" value={q}
                   onChange={(e) => setQ(e.target.value)}
                   placeholder="فلترة بالاسم" />
          </div>

          {!teachers ? (
            <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">لا نتائج مطابقة.</p>
          ) : (
            <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
              {filtered.map((t) => (
                <button key={t.id} onClick={() => pick(t)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-right transition-colors ${
                    teacher?.id === t.id ? "bg-mint-tint" : "hover:bg-canvas"}`}>
                  <span className="min-w-0 truncate text-sm text-ink">{t.full_name}</span>
                  {teacher?.id === t.id && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint-deep" />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card min-h-[20rem] space-y-3 p-4">
          {!teacher ? (
            <p className="py-10 text-center text-sm text-muted">اختر معلمًا من القائمة.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">{teacher.full_name}</h2>
                  <p className="text-xs text-muted">{teacher.specialization}</p>
                </div>
                <button onClick={printIt} disabled={!rows?.length}
                  className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
                  طباعة الجدول — PDF
                </button>
              </div>

              {!rows ? (
                <p className="text-sm text-muted">جارٍ التحميل…</p>
              ) : (
                <WeeklyGrid rows={rows} cell={cell} />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
