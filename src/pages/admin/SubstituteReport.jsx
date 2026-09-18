import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES, todayISO } from "../../lib/schoolTime";
import { printReport, exportStyledExcel, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

// بداية الشهر الحالي — نطاق افتراضي معقول للتقرير
function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function SubstituteReport() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [teachers, setTeachers] = useState(new Map()); // id -> full_name

  const load = async () => {
    setRows(null);
    const [{ data: sp }, { data: t }] = await Promise.all([
      supabase
        .from("substitute_periods")
        .select("id, attend_date, period_no, class_id, cover_teacher_id, absent_teacher_id, classes(class_no, grade), schedule:schedule_id(subjects(name))")
        .gte("attend_date", from)
        .lte("attend_date", to)
        .order("attend_date", { ascending: false })
        .order("period_no"),
      supabase.from("teachers").select("id, full_name"),
    ]);
    setTeachers(new Map((t ?? []).map((r) => [r.id, r.full_name])));
    setRows(sp ?? []);
  };

  useEffect(() => {
    load();
  }, [from, to]);

  const stats = useMemo(() => {
    const m = new Map(); // teacher_id -> count
    (rows ?? []).forEach((r) => m.set(r.cover_teacher_id, (m.get(r.cover_teacher_id) ?? 0) + 1));
    return [...m.entries()]
      .map(([id, count]) => ({ id, name: teachers.get(id) ?? "—", count }))
      .sort((a, b) => b.count - a.count);
  }, [rows, teachers]);

  const listRows = useMemo(
    () =>
      (rows ?? []).map((r, i) => [
        i + 1,
        r.attend_date,
        r.period_no,
        r.classes?.class_no ?? "",
        r.classes?.grade ? GRADE_NAMES[r.classes.grade] : "",
        r.schedule?.subjects?.name ?? "",
        teachers.get(r.cover_teacher_id) ?? "—",
        teachers.get(r.absent_teacher_id) ?? "—",
      ]),
    [rows, teachers]
  );

  const headers = ["م", "التاريخ", "الحصة", "الفصل", "الصف", "المادة", "المعلم البديل", "بدل معلم"];
  const statsHeaders = ["م", "المعلم", "عدد حصص الانتظار"];
  const statsRows = stats.map((s, i) => [i + 1, s.name, s.count]);

  const handlePrint = () => {
    printReport({
      title: "تقرير حصص الانتظار",
      subtitle: `من ${from} إلى ${to}`,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      sections: [
        { title: "إحصائية حصص الانتظار لكل معلم", subtitle: `${stats.length} معلم`, headers: statsHeaders, rows: statsRows },
        { title: "سجل حصص الانتظار", subtitle: `${rows?.length ?? 0} حصة`, headers, rows: listRows },
      ],
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });
  };

  const handleExcel = () => {
    exportStyledExcel({
      title: "تقرير حصص الانتظار",
      subtitle: `من ${from} إلى ${to}`,
      headers,
      rows: listRows,
      fileName: "تقرير-حصص-الانتظار",
      sheetName: "السجل",
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });
    exportStyledExcel({
      title: "إحصائية حصص الانتظار لكل معلم",
      subtitle: `من ${from} إلى ${to}`,
      headers: statsHeaders,
      rows: statsRows,
      fileName: "إحصائية-حصص-الانتظار",
      sheetName: "الإحصائية",
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">تقرير حصص الانتظار</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          سجل حصص التغطية التي دخلها المعلمون بديلًا عن معلمين غائبين، مع إحصائية إجمالي
          الحصص لكل معلم.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted">من تاريخ</label>
          <input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted">إلى تاريخ</label>
          <input type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={handlePrint} disabled={!rows?.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          طباعة / PDF
        </button>
        <button onClick={handleExcel} disabled={!rows?.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          تصدير Excel
        </button>
      </div>

      {rows === null ? (
        <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>
      ) : rows.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="font-semibold">لا حصص انتظار في هذه الفترة</p>
        </div>
      ) : (
        <>
          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              إحصائية لكل معلم
            </h2>
            <div className="divide-y divide-line">
              {stats.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                  <span className="num chip bg-mint-tint text-mint-deep">{s.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card divide-y divide-line overflow-hidden">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    فصل <span className="num">{r.classes?.class_no}</span>
                    {r.classes?.grade ? ` · ${GRADE_NAMES[r.classes.grade]}` : ""} ·{" "}
                    {r.schedule?.subjects?.name ?? "بلا مادة"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    <span className="num">{r.attend_date}</span> · الحصة{" "}
                    <span className="num">{r.period_no}</span> · بديل عن{" "}
                    {teachers.get(r.absent_teacher_id) ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-mint-deep">
                  {teachers.get(r.cover_teacher_id) ?? "—"}
                </span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
