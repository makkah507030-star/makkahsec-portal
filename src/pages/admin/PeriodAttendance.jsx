import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO, todayLabel, todayDow } from "../../lib/schoolTime";
import { printReport, exportStyledExcel, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export default function PeriodAttendance() {
  const [d, setD] = useState(null);
  const [openDone, setOpenDone] = useState(null);
  const [openLeft, setOpenLeft] = useState(null);
  const dow = todayDow();
  const date = todayISO();

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const year = m.active_year ?? "";
      const term = Number(m.active_term ?? 1);

      const [todaySched, todayMarked] = await Promise.all([
        dow
          ? supabase.from("schedule")
              .select("id, period_no, classes(class_no, grade), teachers(full_name), subjects(name)")
              .eq("academic_year", year).eq("term", term).eq("day_of_week", dow)
          : Promise.resolve({ data: [] }),
        supabase.from("class_attendance").select("schedule_id").eq("attend_date", date),
      ]);

      const doneSet = new Set((todayMarked.data ?? []).map((r) => r.schedule_id));
      const sched = (todaySched.data ?? []).sort((a, b) => a.period_no - b.period_no);
      const done = sched.filter((s) => doneSet.has(s.id));
      const left = sched.filter((s) => !doneSet.has(s.id));

      setD({ sched, done, left });
    })();
  }, [dow, date]);

  if (!d) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">تحضير الحصص اليومية</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {todayLabel()} · <span className="num">{d.done.length}</span> من{" "}
          <span className="num">{d.sched.length}</span> حصة حُضِّرت
        </p>
      </div>

      {d.sched.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا حصص اليوم</p>
          <p className="mt-1.5 text-sm text-muted">الأسبوع الدراسي من الأحد إلى الخميس.</p>
        </div>
      ) : (
        <>
          <ReportButtons d={d} />
          <PeriodGroup title="حُضِّرت" tone="present" kindLabel="حضّروا" rows={d.done} open={openDone} setOpen={setOpenDone} />
          <PeriodGroup title="لم تُحضَّر" tone="warning" kindLabel="لم يحضّروا" rows={d.left} open={openLeft} setOpen={setOpenLeft} />
        </>
      )}
    </div>
  );
}

/* ==================== مجموعة حصص (حُضِّرت / لم تُحضَّر) ==================== */

function PeriodGroup({ title, tone, kindLabel, rows, open, setOpen }) {
  const byPeriod = useMemo(() => {
    const m = {};
    rows.forEach((s) => { (m[s.period_no] ??= []).push(s); });
    return m;
  }, [rows]);

  const periods = Object.keys(byPeriod).map(Number).sort((a, b) => a - b);

  // طباعة معلمي حصة واحدة فقط — لسرعة المتابعة (من حضّر / من لم يحضّر
  // في هذه الحصة بالذات)، بدل التقرير الكامل لكل اليوم.
  const printPeriod = (n, list) => {
    const rowsOf = list
      .slice()
      .sort((a, b) => (a.classes?.class_no ?? 0) - (b.classes?.class_no ?? 0))
      .map((s, i) => [
        i + 1,
        s.classes?.class_no ?? "",
        s.subjects?.name ?? "",
        s.teachers?.full_name ?? "—",
      ]);

    printReport({
      title: `المعلمون الذين ${kindLabel} — الحصة ${n}`,
      subtitle: todayLabel(),
      sections: [
        {
          title: `المعلمون الذين ${kindLabel} — الحصة ${n}`,
          subtitle: `${list.length} معلم`,
          headers: ["م", "الفصل", "المادة", "المعلم"],
          rows: rowsOf,
          tableClass: tone === "warning" ? "danger" : "success",
        },
      ],
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
    });
  };

  const toneClasses = {
    present: { badge: "bg-present", box: "border-present/30 bg-present/10 text-present" },
    warning: { badge: "bg-absent", box: "border-line bg-white text-ink hover:border-absent/30 hover:bg-absent/5" },
  }[tone];

  return (
    <section className="card overflow-hidden">
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
        tone === "warning" ? "border-absent/30 bg-absent/5" : "border-present/30 bg-present/5"}`}>
        <h2 className={`text-sm font-semibold ${tone === "warning" ? "text-absent" : "text-present"}`}>
          حصص {title}
        </h2>
        <span className={`num chip ${
          tone === "warning" ? "bg-absent/15 text-absent" : "bg-present/15 text-present"}`}>
          {rows.length}
        </span>
      </div>

      {periods.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">لا شيء هنا.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 px-4 py-4">
            {periods.map((n) => {
              const list = byPeriod[n];
              const isOpen = open === n;
              return (
                <button key={n} onClick={() => setOpen(isOpen ? null : n)}
                  className={`relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-card border transition-colors ${
                    isOpen ? "border-mint-deep bg-mint-tint text-mint-deep" : toneClasses.box}`}>
                  <span className="num text-lg font-bold leading-none">{n}</span>
                  <span className="mt-0.5 text-[10px] leading-none text-muted">الحصة</span>
                  <span className={`num absolute -top-1.5 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${toneClasses.badge}`}>
                    {list.length}
                  </span>
                </button>
              );
            })}
          </div>

          {open != null && byPeriod[open] && (
            <div className="border-t border-line">
              <div className="flex items-center justify-between gap-3 bg-gray-tint px-4 py-2">
                <p className="text-xs font-medium text-muted">
                  الحصة <span className="num">{open}</span> ·{" "}
                  <span className="num">{byPeriod[open].length}</span> فصل
                </p>
                <button
                  onClick={() => printPeriod(open, byPeriod[open])}
                  className={`shrink-0 rounded-sm2 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 ${
                    tone === "warning" ? "bg-absent" : "bg-present"}`}>
                  طباعة PDF
                </button>
              </div>
              <div className="max-h-64 overflow-auto">
                {byPeriod[open].map((s) => (
                  <div key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                    <span className="num w-10 shrink-0 rounded-md bg-mint-tint py-1 text-center text-xs font-bold text-mint-deep">
                      {s.classes?.class_no}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{s.teachers?.full_name ?? "—"}</p>
                      <p className="truncate text-xs text-muted">{s.subjects?.name ?? "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ==================== أزرار التقارير ==================== */

function ReportButtons({ d }) {
  const rowsOf = (list) =>
    list
      .slice()
      .sort((a, b) => a.period_no - b.period_no || (a.classes?.class_no ?? 0) - (b.classes?.class_no ?? 0))
      .map((s, i) => [
        i + 1, s.period_no, s.classes?.class_no ?? "", s.subjects?.name ?? "", s.teachers?.full_name ?? "",
      ]);

  const headers = ["م", "الحصة", "الفصل", "المادة", "المعلم"];

  const printIt = () => {
    printReport({
      title: "تقرير تحضير الحصص اليومية",
      subtitle: todayLabel(),
      sections: [
        { title: "الحصص التي حُضِّرت", subtitle: `${d.done.length} حصة`, headers, rows: rowsOf(d.done), tableClass: "success" },
        { title: "الحصص التي لم تُحضَّر", subtitle: `${d.left.length} حصة`, headers, rows: rowsOf(d.left), tableClass: "danger" },
      ],
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
    });
  };

  const excelIt = () => {
    const combined = [
      ...rowsOf(d.done).map((r) => [...r, "حُضِّرت"]),
      ...rowsOf(d.left).map((r, i) => [i + 1 + d.done.length, ...r.slice(1), "لم تُحضَّر"]),
    ];
    exportStyledExcel({
      title: "تقرير تحضير الحصص اليومية",
      subtitle: todayLabel(),
      headers: [...headers, "الحالة"],
      rows: combined,
      fileName: `تحضير-الحصص-${todayISO()}`,
      sheetName: "التحضير",
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={printIt} disabled={!d.sched.length}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
        تقرير كامل — PDF
      </button>
      <button onClick={excelIt} disabled={!d.sched.length}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
        تقرير كامل — Excel
      </button>
    </div>
  );
}
