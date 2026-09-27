// التأخر الصباحي: من البصمة، بعد بداية الاصطفاف + 5 دقائق
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { fmtGreg, fmtTime12 } from "../../lib/dates";
import { printReport, exportStyledExcel } from "../../lib/exportUtils";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { lateDeadlineLabel, LATE_GRACE_MINUTES, loadRangeStart, isMissingTable } from "../../lib/officialAttendance";
import {
  SIGNS, logos, Pill, Fig, DateInput, ExportBar, GradePills, Note, Loading, Empty, SetupNotice, useDay, daysWord,
  useFingerprint, FingerprintLockedNote,
} from "./shared.jsx";

export default function MorningLate() {
  const [mode, setMode] = useState("day");
  const fp = useFingerprint();
  if (fp == null) return <Loading />;
  if (!fp) return <FingerprintLockedNote />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Pill on={mode === "day"} onClick={() => setMode("day")}>تأخر اليوم</Pill>
        <Pill on={mode === "range"} onClick={() => setMode("range")}>تكرار التأخر (تراكمي)</Pill>
      </div>
      {mode === "day" ? <DayLate /> : <RangeLate />}
    </div>
  );
}

function DayLate() {
  const [date, setDate] = useState(todayISO());
  const [grade, setGrade] = useState(0);
  const { live, error } = useDay(date);

  const list = useMemo(() => {
    let l = live?.rows ?? [];
    if (grade) l = l.filter((r) => r.grade === grade);
    return l;
  }, [live, grade]);

  const stats = useMemo(() => {
    const punched = list.filter((r) => r.punched).length;
    const late = list.filter((r) => r.isLate).length;
    return { total: list.length, punched, late, noPunch: list.length - punched };
  }, [list]);

  const lateList = useMemo(
    () => list.filter((r) => r.isLate).sort((a, b) => b.lateMinutes - a.lateMinutes),
    [list]
  );

  const deadline = lateDeadlineLabel(live?.dayStart);
  const headers = ["م", "اسم الطالب", "الصف", "الفصل", "وقت البصمة", "دقائق التأخر"];
  const table = () => lateList.map((r, i) => [
    i + 1, r.full_name, r.grade, r.class_no, fmtTime12(r.punch), r.lateMinutes,
  ]);
  const subtitle = () => `${fmtGreg(date)} · يُحتسب التأخر بعد ${deadline}`;

  return (
    <div className="space-y-4">
      <DateInput value={date} onChange={setDate} />
      <Note>
        يبدأ احتساب التأخر الصباحي بعد مرور {LATE_GRACE_MINUTES} دقائق من بداية
        الاصطفاف الصباحي{deadline ? ` (بعد ${deadline})` : ""}، وتُحسب الدقائق بعد انتهاء المهلة.
      </Note>
      {error && <Empty>تعذّر التحميل: {error}</Empty>}
      {!live && !error && <Loading />}
      {live && live.dayStart == null && (
        <Note tone="warn">لم يُعثر على وقت الاصطفاف ولا الحصة الأولى في جدول التوقيت المفعّل — لا يمكن احتساب التأخر.</Note>
      )}
      {live && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fig value={stats.punched} label="بصموا" tone="text-present" />
            <Fig value={stats.late} label="متأخرون صباحًا" tone="text-late" />
            <Fig value={`${stats.punched ? Math.round((stats.late / stats.punched) * 100) : 0}%`}
                 label="نسبة التأخر من الحاضرين" tone="text-late" />
            <Fig value={stats.noPunch} label="لم يبصموا" tone="text-muted"
                 hint="ليست نسبة غياب — الغياب الرسمي من الحصتين" />
          </div>
          <GradePills grade={grade} setGrade={setGrade} />
          <ExportBar disabled={!lateList.length}
            onPrint={() => printReport({ title: "تقرير التأخر الصباحي", subtitle: subtitle(), headers, rows: table(), ...logos(), signatures: SIGNS })}
            onExcel={() => exportStyledExcel({ title: "تقرير التأخر الصباحي", subtitle: subtitle(), headers, rows: table(), fileName: `التأخر-الصباحي-${date}`, sheetName: "التأخر", signatures: SIGNS })} />
          {lateList.length === 0 ? (
            <Empty tone="good">لا حالات تأخر صباحي في هذا اليوم.</Empty>
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {lateList.map((r) => (
                <div key={r.student_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                    <p className="text-xs text-muted">
                      صف <span className="num">{r.grade}</span> · فصل <span className="num">{r.class_no}</span> · بصم{" "}
                      <span className="num">{fmtTime12(r.punch)}</span>
                    </p>
                  </div>
                  <span className="chip shrink-0 bg-late/10 text-late"><span className="num">{r.lateMinutes}</span> د</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** تكرار التأخر لكل طالب — من الأيام المعتمدة */
function RangeLate() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(todayISO());
  const [grade, setGrade] = useState(0);
  const [min, setMin] = useState(3);
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    loadRangeStart(todayISO()).then((d) => setFrom(d ?? todayISO().slice(0, 8) + "01"));
  }, []);

  useEffect(() => {
    if (!from) return;
    (async () => {
      setRows(null);
      try {
        const data = await fetchAllPaged(() =>
          supabase.from("official_day_marks")
            .select("student_id, attend_date, full_name, grade, class_no, late_minutes")
            .gte("attend_date", from).lte("attend_date", to).gt("late_minutes", 0)
            .order("attend_date", { ascending: true }).order("student_id", { ascending: true }));
        setRows(data);
      } catch (e) {
        if (isMissingTable(e)) setMissing(true);
        console.error("RangeLate:", e); setRows([]);
      }
    })();
  }, [from, to]);

  const students = useMemo(() => {
    const by = new Map();
    (rows ?? []).forEach((r) => {
      const s = by.get(r.student_id) ?? { ...r, days: 0, minutes: 0, dates: [] };
      s.days += 1; s.minutes += r.late_minutes; s.dates.push(r.attend_date);
      by.set(r.student_id, s);
    });
    let list = [...by.values()];
    if (grade) list = list.filter((s) => s.grade === grade);
    return list.filter((s) => s.days >= min)
      .sort((a, b) => b.days - a.days || b.minutes - a.minutes);
  }, [rows, grade, min]);

  const headers = ["م", "اسم الطالب", "الصف", "الفصل", "أيام التأخر", "مجموع الدقائق", "آخر تأخر"];
  const table = () => students.map((s, i) => [
    i + 1, s.full_name, s.grade, s.class_no, s.days, s.minutes, fmtGreg(s.dates[s.dates.length - 1] + "T00:00:00"),
  ]);
  const subtitle = () => `${fmtGreg(from + "T00:00:00")} — ${fmtGreg(to + "T00:00:00")} · ${min} أيام فأكثر`;

  if (!from) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateInput label="من" value={from} onChange={setFrom} />
        <DateInput label="إلى" value={to} onChange={setTo} />
        <label className="flex items-center gap-2 text-sm text-muted">
          تكرر
          <select value={min} onChange={(e) => setMin(Number(e.target.value))}
            className="rounded-sm2 border border-line px-2 py-2 text-sm">
            {[1, 2, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
          أيام
        </label>
      </div>
      <Note>يُبنى من الأيام المعتمدة. الأيام السابقة تُضاف من «الإحصاء والنسب ← اعتماد الأيام السابقة».</Note>
      {missing && <SetupNotice />}
      <GradePills grade={grade} setGrade={setGrade} />
      <ExportBar disabled={!students.length}
        onPrint={() => printReport({ title: "تكرار التأخر الصباحي", subtitle: subtitle(), headers, rows: table(), ...logos(), signatures: SIGNS })}
        onExcel={() => exportStyledExcel({ title: "تكرار التأخر الصباحي", subtitle: subtitle(), headers, rows: table(), fileName: `تكرار-التأخر-${from}_${to}`, sheetName: "التأخر", signatures: SIGNS })} />
      {!rows ? <Loading /> : students.length === 0 ? (
        <Empty>لا طلاب مطابقون.</Empty>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {students.map((s) => (
            <div key={s.student_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{s.full_name}</p>
                <p className="text-xs text-muted">
                  صف <span className="num">{s.grade}</span> · فصل <span className="num">{s.class_no}</span> · مجموع{" "}
                  <span className="num">{s.minutes}</span> دقيقة
                </p>
              </div>
              <span className="chip shrink-0 bg-late/10 text-late">{daysWord(s.days)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
