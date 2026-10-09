import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtHijri, fmtGreg } from "../lib/dates";
import { todayISO } from "../lib/schoolTime";
import { loadRangeStart } from "../lib/officialAttendance";
import Loader from "./Loader.jsx";

/* =====================================================================
   سجل الحضور للطالب وولي أمره (supabase/student_attendance_log.sql):
   إحصائيات الفصل الدراسي، ثم جدول واحد لكل يوم: الغياب الرسمي، والتأخر
   الصباحي (حين تُفتح البصمة)، والحصص التي غاب عنها أو تأخر أو استأذن.
   الأرقام من السجل كاملًا منذ بداية الفصل، لا من آخر السجلات.
   ===================================================================== */

const OFFICIAL = {
  absent:  { t: "غائب",          c: "bg-absent/10 text-absent" },
  excused: { t: "غائب بعذر",     c: "bg-excused/10 text-excused" },
  pending: { t: "لم يُحضَّر",     c: "bg-canvas text-muted" },
  present: { t: "حاضر",          c: "bg-present/10 text-present" },
};
const PERIOD = {
  absent:  { t: "غائب",   c: "bg-absent/10 text-absent" },
  late:    { t: "متأخر",  c: "bg-late/10 text-late" },
  excused: { t: "مستأذن", c: "bg-excused/10 text-excused" },
};
const dayName = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("ar-SA", { weekday: "long" });

export default function AttendanceLog({ studentId, fp }) {
  const [rows, setRows] = useState(null);
  const [from, setFrom] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!studentId) return;
    let live = true;
    setRows(null); setErr("");
    loadRangeStart(todayISO()).then((start) => {
      if (!live) return;
      setFrom(start);
      supabase.rpc("student_attendance_log", { p_student: studentId, p_from: start }).then(({ data, error }) => {
        if (!live) return;
        if (error) setErr(/student_attendance_log|schema cache/i.test(error.message)
          ? "لم يُفعَّل سجل الحضور الجديد بعد في قاعدة البيانات." : error.message);
        setRows(data ?? []);
      });
    });
    return () => { live = false; };
  }, [studentId]);

  // التأخر الصباحي يظهر حين تُفتح البصمة، ومن تاريخ فتحها فقط
  const showMorning = !!fp?.on;
  const morningOk = (d) => showMorning && (!fp.since || d >= fp.since);

  const stats = useMemo(() => {
    const s = { official: 0, excused: 0, periods: 0, late: 0, permits: 0, morning: 0 };
    (rows ?? []).forEach((r) => {
      if (r.official === "absent") s.official += 1;
      if (r.official === "excused") s.excused += 1;
      if (morningOk(r.attend_date) && r.late_minutes > 0) s.morning += 1;
      (r.periods ?? []).forEach((p) => {
        if (p.status === "absent") s.periods += 1;
        else if (p.status === "late") s.late += 1;
        else if (p.status === "excused") s.permits += 1;
      });
    });
    return s;
  }, [rows, fp]);

  const cards = [
    { k: "official", t: "أيام الغياب الرسمي", c: "text-absent" },
    { k: "excused",  t: "أيام الغياب بعذر",   c: "text-excused" },
    { k: "periods",  t: "حصص غاب عنها",      c: "text-absent" },
    { k: "late",     t: "حصص تأخر عنها",      c: "text-late" },
    ...(showMorning ? [{ k: "morning", t: "أيام التأخر الصباحي", c: "text-late" }] : []),
  ];

  return (
    <section className="space-y-3">
      <div className={`grid gap-3 ${showMorning ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
        {cards.map((x) => (
          <div key={x.k} className="rounded-card border border-line bg-white px-3 py-3.5 text-center">
            <p className={`num text-2xl font-bold leading-none ${rows ? x.c : "text-faint"}`}>{rows ? stats[x.k] : "…"}</p>
            <p className="mt-1.5 text-xs text-muted">{x.t}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">سجل الغياب والتأخر</h2>
          {from && <p className="num text-[11px] text-faint">منذ {fmtHijri(from)} — الفصل الدراسي الحالي</p>}
        </div>
        {err && <p className="px-4 py-3 text-sm text-absent">{err}</p>}
        {!rows ? <div className="p-4"><Loader compact /></div> : rows.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">السجل نظيف — لا غياب ولا تأخر في هذا الفصل.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-canvas text-xs text-muted">
                  <th className="px-4 py-2 text-right font-semibold">اليوم</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">الغياب الرسمي</th>
                  {showMorning && <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">التأخر الصباحي</th>}
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">الحصص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const off = r.approved ? OFFICIAL[r.official] : null;
                  return (
                    <tr key={r.attend_date} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <p className="font-medium text-ink">{dayName(r.attend_date)}</p>
                        <p className="num text-[11px] text-faint">{fmtHijri(r.attend_date)} · {fmtGreg(r.attend_date)}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        {off ? <span className={`chip whitespace-nowrap ${off.c}`}>{off.t}</span>
                          : <span className="text-xs text-faint">لم يُعتمد بعد</span>}
                      </td>
                      {showMorning && (
                        <td className="px-3 py-2.5">
                          {morningOk(r.attend_date) && r.late_minutes > 0
                            ? <span className="chip gap-1 whitespace-nowrap bg-late/10 text-late">متأخر <span className="num">{r.late_minutes}</span> د</span>
                            : <span className="text-xs text-faint">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        {(r.periods ?? []).length === 0 ? <span className="text-xs text-faint">—</span> : (
                          <div className="flex flex-wrap gap-1">
                            {r.periods.map((p, i) => (
                              <span key={i} className={`chip gap-1 whitespace-nowrap ${PERIOD[p.status]?.c ?? ""}`}>
                                <span className="num font-semibold">ح{p.p}</span> {PERIOD[p.status]?.t}
                                {p.subject && <span className="opacity-75">· {p.subject}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line bg-canvas/60 px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
          <b className="text-ink">الغياب الرسمي</b> يُحسب فيه الطالب غائبًا يومًا كاملًا، ويُرصد في نظام نور.{" "}
          <b className="text-ink">غياب الحصص</b> يُعدّ بالحصة: كل حصة سُجّل فيها غائبًا، ومنها حصص أيام الغياب الرسمي.
          {showMorning && <> <b className="text-ink">التأخر الصباحي</b> من البصمة بعد بداية الاصطفاف بخمس دقائق.</>}
        </p>
      </div>
    </section>
  );
}
