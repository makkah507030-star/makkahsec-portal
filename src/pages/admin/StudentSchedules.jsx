import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { buildWeeklyPrintTable } from "../../lib/scheduleGrid";
import WeeklyGrid from "../../components/WeeklyGrid.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export default function StudentSchedules() {
  const [classList, setClassList] = useState(null);
  const [grade, setGrade] = useState(1);
  const [cls, setCls] = useState(null);
  const [rows, setRows] = useState(null);
  const [year, setYear] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [term, setTerm] = useState(1);
  const [busyAll, setBusyAll] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      setYear(m.active_year ?? "");
      setYearLabel(m.active_year_label ?? m.active_year ?? "");
      setTerm(Number(m.active_term ?? 1));

      const { data } = await supabase
        .from("classes").select("id, class_no, grade")
        .eq("academic_year", m.active_year ?? "")
        .order("class_no");
      setClassList(data ?? []);
    })();
  }, []);

  const pick = async (c) => {
    setCls(c);
    setRows(null);
    const { data } = await supabase
      .from("schedule")
      .select("id, day_of_week, period_no, start_time, end_time, subjects(name), teachers(full_name)")
      .eq("class_id", c.id).eq("academic_year", year).eq("term", term);
    setRows(data ?? []);
  };

  const cell = (r) => (
    <div>
      <p className="text-xs font-bold text-ink">{r.subjects?.name}</p>
      <p className="text-[11px] text-muted">{r.teachers?.full_name}</p>
    </div>
  );
  const cellText = (r) => `${r.subjects?.name ?? ""} — ${r.teachers?.full_name ?? ""}`;

  const printIt = () => {
    const { headers, rows: body } = buildWeeklyPrintTable(rows, cellText);
    printReport({
      title: `جدول الفصل — ${GRADE_NAMES[cls.grade] ?? ""} · فصل ${cls.class_no}`,
      subtitle: `${yearLabel} · الفصل الدراسي ${term}`,
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
    if (!classList?.length) return;
    setBusyAll(true);
    try {
      const { data: all } = await supabase
        .from("schedule")
        .select("id, class_id, day_of_week, period_no, start_time, end_time, subjects(name), teachers(full_name)")
        .eq("academic_year", year).eq("term", term);

      const byClass = new Map();
      (all ?? []).forEach((r) => {
        if (!r.class_id) return;
        if (!byClass.has(r.class_id)) byClass.set(r.class_id, []);
        byClass.get(r.class_id).push(r);
      });

      const sorted = [...classList].sort((a, b) => a.class_no - b.class_no);
      const sections = sorted
        .filter((c) => (byClass.get(c.id) ?? []).length > 0)
        .map((c) => {
          const { headers, rows: body } = buildWeeklyPrintTable(byClass.get(c.id), cellText);
          return {
            title: `جدول الفصل — ${GRADE_NAMES[c.grade] ?? ""} · فصل ${c.class_no}`,
            subtitle: `${yearLabel} · الفصل الدراسي ${term}`,
            headers, rows: body,
          };
        });

      printReport({
        title: "جداول الطلاب — الكل",
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

  const filtered = (classList ?? []).filter((c) => c.grade === grade);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">جداول الطلاب</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            اختر الصف والفصل لعرض جدوله الأسبوعي، أو اطبع جداول كل الفصول دفعة واحدة.
          </p>
        </div>
        <button onClick={printAll} disabled={busyAll || !classList?.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          {busyAll ? "جارٍ التجهيز…" : "طباعة الكل — PDF"}
        </button>
      </div>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((g) => (
            <button key={g} onClick={() => { setGrade(g); setCls(null); }}
              className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                grade === g ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {GRADE_NAMES[g]}
            </button>
          ))}
        </div>

        {!classList ? (
          <p className="text-sm text-muted">جارٍ التحميل…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => pick(c)}
                className={`num rounded-sm2 border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  cls?.id === c.id ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-ink hover:bg-canvas"}`}>
                فصل {c.class_no}
              </button>
            ))}
          </div>
        )}
      </section>

      {cls && (
        <section className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">
              {GRADE_NAMES[cls.grade]} · فصل <span className="num">{cls.class_no}</span>
            </h2>
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
        </section>
      )}
    </div>
  );
}
