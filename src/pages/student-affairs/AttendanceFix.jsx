// src/pages/student-affairs/AttendanceFix.jsx
// =====================================================================
//  مركز تصحيح الحضور — المكان الرسمي الوحيد لتعديل حضور طالب في يوم:
//  حالة كل حصة، والتأخر الصباحي، والحالة الرسمية (غائب بعذر).
//  • لمن يملك صلاحية «تصحيح الحضور» (attendance_fix)، والسبب إلزامي في كل تعديل.
//  • كل تعديل يُسجَّل باسم من عدّله ووقته (attendance_corrections)، ولا يصل
//    ولي الأمر أي إشعار بسببه (supabase/attendance_fix_*.sql).
//  • بعد كل حفظ يُعاد احتساب اليوم المعتمد (الغياب الرسمي والتأخر والنسبة المكتملة)،
//    فينعكس على كل التقارير والإنذارات والإحصاء.
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { todayISO, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtTime12, fmtDateTime } from "../../lib/dates";
import { loadPeriodTimes } from "../../lib/periodTimes";
import {
  dayStartMinutes, morningLate, officialStatus, loadActiveTerm, dowOf, recomputeDay,
  isMissingTable, OFFICIAL_LABEL,
} from "../../lib/officialAttendance";
import { DateInput, Note, Loading, Empty, weekdayOf } from "./shared.jsx";

const P_STATUS = {
  present: { t: "حاضر", c: "text-present" },
  absent:  { t: "غائب", c: "text-absent" },
  late:    { t: "متأخر", c: "text-late" },
  excused: { t: "مستأذن", c: "text-excused" },
};
const KIND = { period: "حصة", late: "التأخر الصباحي", official: "الحالة الرسمية" };
const VALUE = {
  present: "حاضر", absent: "غائب", late: "متأخر", excused: "بعذر / مستأذن", auto: "تلقائي",
  waive: "إلغاء التأخر",
};
const valueText = (v) => {
  if (v == null || v === "") return "لم يُرصد";
  const [k, m] = String(v).split(":");
  return k === "late" && m ? `متأخر ${m} د` : VALUE[k] ?? v;
};

/* البحث عن طالب بالاسم أو رقم الهوية */
function StudentSearch({ onPick }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setHits(null); return; }
    const h = setTimeout(async () => {
      const col = /^\d+$/.test(t) ? "national_id" : "full_name";
      const { data } = await supabase.from("students").select("id, full_name, national_id")
        .eq("is_active", true).ilike(col, `%${t}%`).limit(12);
      setHits(data ?? []);
    }, 300);
    return () => clearTimeout(h);
  }, [q]);
  return (
    <div className="relative min-w-[16rem] flex-1">
      <input className="field w-full" value={q} onChange={(e) => setQ(e.target.value)}
             placeholder="اسم الطالب أو رقم هويته…" />
      {hits && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-sm2 border border-line bg-paper shadow-card">
          {hits.length === 0 && <p className="px-3 py-2 text-sm text-faint">لا نتائج</p>}
          {hits.map((s) => (
            <button key={s.id} className="block w-full px-3 py-2 text-right text-sm hover:bg-canvas"
                    onClick={() => { onPick(s.id); setQ(""); setHits(null); }}>
              {s.full_name} <span className="num text-xs text-faint">{s.national_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AttendanceFix() {
  const [params, setParams] = useSearchParams();
  const date = params.get("date") || todayISO();
  const sid = params.get("sid") || "";
  const setQ = (patch) => setParams((p) => {
    const n = new URLSearchParams(p);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    return n;
  });

  const [d, setD] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lateMode, setLateMode] = useState("auto");
  const [lateMin, setLateMin] = useState("");

  const load = useCallback(async () => {
    if (!sid) { setD(null); return; }
    setD({ loading: true });
    const { year, term } = await loadActiveTerm();
    const dow = dowOf(date);
    const [{ data: st }, { data: enr }, { data: att }, { data: punch }, lateRes, { data: day },
           { data: mark }, logRes, { rows: ptimes }] = await Promise.all([
      supabase.from("students").select("id, full_name, national_id").eq("id", sid).maybeSingle(),
      supabase.from("student_enrollment").select("class_id, classes(class_no, grade)")
        .eq("student_id", sid).eq("status", "active").maybeSingle(),
      supabase.from("class_attendance").select("schedule_id, status, updated_at")
        .eq("student_id", sid).eq("attend_date", date),
      supabase.from("daily_attendance").select("punch_time").eq("student_id", sid).eq("attend_date", date)
        .order("punch_time").limit(1).maybeSingle(),
      supabase.from("attendance_late_overrides").select("mode, minutes, reason, by_name")
        .eq("student_id", sid).eq("attend_date", date).maybeSingle(),
      supabase.from("official_attendance_days").select("attend_date").eq("attend_date", date).maybeSingle(),
      supabase.from("official_day_marks").select("status, manual, note, edited_by_name")
        .eq("student_id", sid).eq("attend_date", date).maybeSingle(),
      supabase.from("attendance_corrections").select("*").eq("student_id", sid)
        .order("at", { ascending: false }).limit(40),
      loadPeriodTimes(),
    ]);
    const { data: sched } = enr?.class_id && dow
      ? await supabase.from("schedule").select("id, period_no, subjects(name), teachers(full_name)")
          .eq("class_id", enr.class_id).eq("day_of_week", dow).eq("academic_year", year).eq("term", term)
          .order("period_no")
      : { data: [] };
    const byId = new Map((att ?? []).map((r) => [r.schedule_id, r]));
    setD({
      student: st, cls: enr?.classes ?? null, dow,
      periods: (sched ?? []).map((s) => ({ ...s, status: byId.get(s.id)?.status ?? null })),
      punch: punch?.punch_time ?? null, dayStart: dayStartMinutes(ptimes),
      lateFix: lateRes.data ?? null, approved: !!day, mark: mark ?? null,
      log: logRes.data ?? [], setup: !!(lateRes.error && isMissingTable(lateRes.error)),
    });
    setLateMode(lateRes.data?.mode ?? "auto");
    setLateMin(lateRes.data?.minutes ? String(lateRes.data.minutes) : "");
  }, [sid, date]);

  useEffect(() => { setMsg(null); load(); }, [load]);

  // حفظ تعديل ثم إعادة احتساب اليوم المعتمد
  const run = async (fn, done) => {
    if (!reason.trim()) { setMsg({ ok: false, t: "اكتب سبب التعديل أولًا." }); return; }
    setBusy(true); setMsg(null);
    try {
      const { error } = await fn();
      if (error) throw error;
      const re = await recomputeDay(date);
      setMsg({ ok: true, t: `${done}${re ? " · أُعيد احتساب اليوم في كل التقارير." : " · اليوم غير معتمد بعد، فيُحتسب عند اعتماده."}` });
      setReason("");
      await load();
    } catch (e) {
      setMsg({ ok: false, t: `تعذّر الحفظ: ${e.message ?? e}` });
    } finally { setBusy(false); }
  };

  const fixPeriod = (p, status) => run(
    () => supabase.rpc("att_fix_period", { p_date: date, p_student: sid, p_schedule: p.id, p_status: status, p_reason: reason }),
    `سُجّلت الحصة ${p.period_no} «${P_STATUS[status].t}»`);
  const fixLate = () => run(
    () => supabase.rpc("att_fix_late", { p_date: date, p_student: sid, p_mode: lateMode,
      p_minutes: lateMode === "late" ? Number(lateMin) || 1 : null, p_reason: reason }),
    "حُفظ التأخر الصباحي");
  const fixOfficial = (status) => run(
    () => supabase.rpc("att_fix_official", { p_date: date, p_student: sid, p_status: status, p_reason: reason }),
    status === "excused" ? "سُجّل غائبًا بعذر" : "أُعيدت الحالة الرسمية إلى المحسوب من الحصص");

  // الحالة الرسمية كما تُحسب الآن من الحصتين الأولى والثانية
  const computed = useMemo(() => {
    if (!d?.periods) return null;
    const periods = Object.fromEntries(d.periods.filter((p) => p.status).map((p) => [p.period_no, p.status]));
    const nos = d.periods.map((p) => p.period_no);
    const inWin = [1, 2].filter((n) => nos.includes(n));
    return officialStatus({ periods, required: inWin.length ? inWin : nos.length ? [Math.min(...nos)] : [1, 2] });
  }, [d]);
  const autoLate = d && !d.loading ? morningLate(d.punch, d.dayStart) : null;
  const officialNow = d?.mark?.manual ? d.mark.status : computed;

  return (
    <div className="space-y-4">
      <Note>
        المكان الرسمي لتعديل حضور طالب بعد انتهاء اليوم: غياب الحصص، والتأخر الصباحي، والغياب الرسمي.
        السبب إلزامي، ويُحفظ كل تعديل باسمك ووقته، ولا يصل ولي الأمر إشعار بسببه، ويُعاد احتساب اليوم
        المعتمد فورًا في كل التقارير والإنذارات والإحصاء.
      </Note>

      <div className="flex flex-wrap items-end gap-3">
        <DateInput value={date} onChange={(v) => setQ({ date: v })} />
        <StudentSearch onPick={(id) => setQ({ sid: id })} />
      </div>

      {!sid && <Empty>اختر طالبًا لعرض يومه وتعديله.</Empty>}
      {d?.loading && <Loading />}
      {d && !d.loading && (
        <div className="space-y-4">
          {d.setup && <Note tone="warn">نفّذ supabase/attendance_fix_1.sql ثم attendance_fix_2.sql في Supabase أولًا.</Note>}
          <div className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
            <p className="text-base font-bold text-ink">{d.student?.full_name}</p>
            <span className="text-sm text-muted">{d.cls ? `${GRADE_NAMES[d.cls.grade] ?? ""} · فصل ${d.cls.class_no}` : "بلا فصل"}</span>
            <span className="text-sm text-muted">{weekdayOf(date)} {date}</span>
            <span className={`chip ${d.approved ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
              {d.approved ? "اليوم معتمد" : "اليوم غير معتمد بعد"}
            </span>
          </div>

          <label className="block">
            <span className="label">سبب التعديل (إلزامي)</span>
            <input className="field w-full" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)}
                   placeholder="مثل: خطأ في رصد المعلم، تقرير طبي، عطل جهاز البصمة…" />
          </label>
          {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-danger-light text-danger"}`}>{msg.t}</p>}

          {/* التأخر الصباحي */}
          <section className="card space-y-3 p-4">
            <p className="font-semibold text-ink">التأخر الصباحي</p>
            <p className="text-sm text-muted">
              البصمة: {d.punch ? <span className="num text-ink">{fmtTime12(d.punch)}</span> : "لم يبصم"}
              {" · "}المحسوب منها: {autoLate?.isLate ? `متأخر ${autoLate.minutes} د` : "غير متأخر"}
              {d.lateFix && <> · <span className="text-mint-deep">مصحَّح: {valueText(d.lateFix.mode === "late" ? `late:${d.lateFix.minutes}` : "waive")} ({d.lateFix.by_name})</span></>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="field w-auto" value={lateMode} onChange={(e) => setLateMode(e.target.value)}>
                <option value="auto">حسب البصمة (تلقائي)</option>
                <option value="waive">إلغاء التأخر</option>
                <option value="late">تسجيل تأخر</option>
              </select>
              {lateMode === "late" && (
                <input className="field num w-24" inputMode="numeric" value={lateMin} placeholder="دقائق"
                       onChange={(e) => setLateMin(e.target.value.replace(/\D/g, ""))} />
              )}
              <button className="btn-primary" disabled={busy} onClick={fixLate}>حفظ</button>
            </div>
          </section>

          {/* الحصص */}
          <section className="card space-y-2 p-4">
            <p className="font-semibold text-ink">حصص اليوم</p>
            {!d.dow && <p className="text-sm text-faint">لا دوام في هذا اليوم.</p>}
            {d.dow > 0 && d.periods.length === 0 && <p className="text-sm text-faint">لا حصص مجدولة لفصل الطالب في هذا اليوم.</p>}
            {d.periods.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-sm2 bg-canvas px-3 py-2 text-sm">
                <span className="num w-16 font-semibold text-ink">الحصة {p.period_no}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{p.subjects?.name ?? ""} · {p.teachers?.full_name ?? ""}</span>
                <span className={`w-16 font-semibold ${p.status ? P_STATUS[p.status].c : "text-faint"}`}>
                  {p.status ? P_STATUS[p.status].t : "لم تُرصد"}
                </span>
                <div className="flex gap-1">
                  {Object.entries(P_STATUS).filter(([k]) => k !== p.status).map(([k, v]) => (
                    <button key={k} disabled={busy} onClick={() => fixPeriod(p, k)}
                            className="rounded-pill border border-line bg-paper px-2.5 py-1 text-xs hover:bg-mint-tint">
                      {v.t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* الحالة الرسمية */}
          <section className="card space-y-2 p-4">
            <p className="font-semibold text-ink">الحالة الرسمية لليوم</p>
            <p className="text-sm text-muted">
              الحالية: <span className="font-semibold text-ink">{OFFICIAL_LABEL[officialNow] ?? "—"}</span>
              {d.mark?.manual
                ? <> · تصحيح يدوي ({d.mark.edited_by_name ?? ""}{d.mark.note ? ` · ${d.mark.note}` : ""})</>
                : " · محسوبة من الحصتين الأولى والثانية"}
            </p>
            {d.approved ? (
              <div className="flex flex-wrap gap-2">
                {(officialNow === "absent" || officialNow === "pending") && <button className="btn-primary" disabled={busy} onClick={() => fixOfficial("excused")}>غائب بعذر</button>}
                {d.mark?.manual && <button className="btn-ghost" disabled={busy} onClick={() => fixOfficial("auto")}>إلغاء التصحيح اليدوي</button>}
              </div>
            ) : <p className="text-xs text-faint">يُصحَّح بعد اعتماد اليوم. وتعديل الحصص أعلاه يُحتسب عند الاعتماد.</p>}
          </section>

          {/* سجل التعديلات */}
          <section className="card space-y-2 p-4">
            <p className="font-semibold text-ink">سجل تعديلات الطالب</p>
            {d.log.length === 0 ? <p className="text-sm text-faint">لا تعديلات.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead><tr className="text-right text-xs text-faint">
                    <th className="py-1">اليوم</th><th>البند</th><th>من</th><th>إلى</th><th>السبب</th><th>بواسطة</th>
                  </tr></thead>
                  <tbody>
                    {d.log.map((r) => (
                      <tr key={r.id} className="border-t border-line/60">
                        <td className="num py-1.5">{r.attend_date}</td>
                        <td>{KIND[r.kind]}{r.period_no ? ` ${r.period_no}` : ""}</td>
                        <td>{valueText(r.old_value)}</td>
                        <td className="font-semibold">{valueText(r.new_value)}</td>
                        <td className="text-muted">{r.reason}</td>
                        <td className="text-muted">{r.by_name} <span className="num text-[11px] text-faint">{fmtDateTime(r.at)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
