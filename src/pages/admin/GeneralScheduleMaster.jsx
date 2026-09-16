import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtGreg } from "../../lib/dates";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { buildMasterPrintSections } from "../../lib/scheduleGrid";
import MasterGrid from "../../components/MasterGrid.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export default function GeneralScheduleMaster() {
  const [rows, setRows] = useState(null);
  const [year, setYear] = useState("");
  const [term, setTerm] = useState(1);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
      const yearLabel = m.active_year_label ?? y;
      const t = Number(m.active_term ?? 1);
      setYear(y); setTerm(t);

      const { data } = await supabase
        .from("schedule")
        .select("id, class_id, day_of_week, period_no, start_time, end_time, classes(id, class_no, grade), subjects(name), teachers(full_name)")
        .eq("academic_year", y).eq("term", t);
      setRows(data ?? []);
    })();
  }, []);

  const { entities, rowsByEntity } = useMemo(() => {
    if (!rows) return { entities: [], rowsByEntity: new Map() };
    const map = new Map();
    const byClass = new Map();
    rows.forEach((r) => {
      const cid = r.class_id;
      if (!cid) return;
      if (!map.has(cid)) map.set(cid, `فصل ${r.classes?.class_no ?? ""}`);
      if (!byClass.has(cid)) byClass.set(cid, []);
      byClass.get(cid).push(r);
    });
    const ents = [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ar", { numeric: true }));
    return { entities: ents, rowsByEntity: byClass };
  }, [rows]);

  const cellShort = (r) => `${(r.subjects?.name ?? "").slice(0, 6)}`;
  const cellText = (r) => `${r.subjects?.name ?? ""} — ${r.teachers?.full_name ?? ""}`;

  const printIt = () => {
    const sections = buildMasterPrintSections(entities, rowsByEntity, cellText, "الفصل");
    printReport({
      title: "الجدول العام — جدول الفصول",
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
          <h1 className="text-lg font-bold text-ink">الجدول العام</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            جدول جميع الفصول وحصصها في مكان واحد، حسب اليوم.
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
          <MasterGrid entities={entities} rowsByEntity={rowsByEntity} cell={cellShort} entityHeader="الفصل" />
        </section>
      )}
    </div>
  );
}
