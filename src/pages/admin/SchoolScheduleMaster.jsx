import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtGreg } from "../../lib/dates";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { buildMasterPrintSections } from "../../lib/scheduleGrid";
import MasterGrid from "../../components/MasterGrid.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export default function SchoolScheduleMaster() {
  const [rows, setRows] = useState(null);
  const [year, setYear] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [term, setTerm] = useState(1);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
      setYearLabel(m.active_year_label ?? y);
      const t = Number(m.active_term ?? 1);
      setYear(y); setTerm(t);

      const { data } = await supabase
        .from("schedule")
        .select("id, teacher_id, day_of_week, period_no, start_time, end_time, classes(class_no, grade), subjects(name), teachers(id, full_name)")
        .eq("academic_year", y).eq("term", t);
      setRows(data ?? []);
    })();
  }, []);

  const { entities, rowsByEntity } = useMemo(() => {
    if (!rows) return { entities: [], rowsByEntity: new Map() };
    const map = new Map();
    const byTeacher = new Map();
    rows.forEach((r) => {
      const tid = r.teacher_id;
      if (!tid) return;
      if (!map.has(tid)) map.set(tid, r.teachers?.full_name ?? "—");
      if (!byTeacher.has(tid)) byTeacher.set(tid, []);
      byTeacher.get(tid).push(r);
    });
    const ents = [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ar"));
    return { entities: ents, rowsByEntity: byTeacher };
  }, [rows]);

  const cellShort = (r) => `${r.classes?.class_no ?? ""}·${(r.subjects?.name ?? "").slice(0, 6)}`;
  const cellText = (r) => `فصل ${r.classes?.class_no ?? ""} — ${r.subjects?.name ?? ""}`;

  const printIt = () => {
    const sections = buildMasterPrintSections(entities, rowsByEntity, cellText, "المعلم");
    printReport({
      title: "الجدول المدرسي — جدول المعلمين العام",
      subtitle: `${yearLabel} · الفصل الدراسي ${term} · ${fmtGreg(new Date())}`,
      sections,
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

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">الجدول المدرسي</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            جدول جميع المعلمين وحصصهم في مكان واحد، حسب اليوم.
          </p>
        </div>
        <button onClick={printIt} disabled={!entities.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          طباعة الجدول الكامل — PDF
        </button>
      </div>

      {entities.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا بيانات جدول</p>
          <p className="mt-1.5 text-sm text-muted">تأكد من استيراد الجدول للفصل الدراسي الحالي.</p>
        </div>
      ) : (
        <section className="card p-4">
          <MasterGrid entities={entities} rowsByEntity={rowsByEntity} cell={cellShort} entityHeader="المعلم" />
        </section>
      )}
    </div>
  );
}
