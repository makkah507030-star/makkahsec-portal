import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { buildWeeklyPrintTable } from "../../lib/scheduleGrid";
import WeeklyGrid from "../../components/WeeklyGrid.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export default function MySchedule() {
  const { session } = useSession();
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [year, setYear] = useState("");
  const [term, setTerm] = useState(1);

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;

      const { data: st } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
      const yearLabel = m.active_year_label ?? y;
      const t = Number(m.active_term ?? 1);
      setYear(y); setTerm(t);

      const { data: t0 } = await supabase
        .from("teachers").select("id, full_name, specialization")
        .eq("user_id", uid).maybeSingle();
      setMe(t0 ?? null);
      if (!t0) { setRows([]); return; }

      const { data } = await supabase
        .from("schedule")
        .select("id, day_of_week, period_no, start_time, end_time, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t0.id).eq("academic_year", y).eq("term", t);
      setRows(data ?? []);
    })();
  }, [session]);

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
      title: `جدولي الأسبوعي — ${me?.full_name ?? ""}`,
      subtitle: `${me?.specialization ?? ""} · ${yearLabel} · الفصل الدراسي ${term}`,
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

  if (rows === null) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  if (!me) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">الحساب غير مرتبط بسجل معلم</p>
        <p className="mt-1.5 text-sm text-muted">راجع إدارة المدرسة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">جدولي</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            جدولك الأسبوعي الكامل للفصل الدراسي الحالي.
          </p>
        </div>
        <button onClick={printIt} disabled={!rows.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          طباعة الجدول — PDF
        </button>
      </div>

      <section className="card p-4">
        <WeeklyGrid rows={rows} cell={cell} />
      </section>
    </div>
  );
}
