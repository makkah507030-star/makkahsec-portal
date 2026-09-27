// الإحصاء والنسب: من الأيام المعتمدة — النسبة الرسمية والمكتملة، حسب اليوم والصف
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtGreg } from "../../lib/dates";
import { printReport, exportStyledExcel } from "../../lib/exportUtils";
import {
  loadRangeStart, loadReportsStart, loadDay, approveDay, saveFinal, schoolDaysBetween, isMissingTable,
} from "../../lib/officialAttendance";
import {
  SIGNS, logos, Pill, Fig, DateInput, ExportBar, Note, Loading, Empty, SetupNotice,
  pctText, weekdayOf, WEEKDAY, daysWord, useFingerprint,
} from "./shared.jsx";

// يوم ناقص: أكثر من خُمس الطلاب لم يُحضَّروا في الحصتين الأولى والثانية
const PARTIAL_AT = 0.2;
const isPartial = (d) => d.total > 0 && d.pending / d.total > PARTIAL_AT;

const pct = (present, total, pending = 0) =>
  total - pending > 0 ? Math.round((present * 10000) / (total - pending)) / 100 : null;

export default function Statistics() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(todayISO());
  const [days, setDays] = useState(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState("days");
  const [tick, setTick] = useState(0);
  const [skipPartial, setSkipPartial] = useState(true);
  const [officialStart, setOfficialStart] = useState(null);
  useEffect(() => { loadReportsStart().then(setOfficialStart); }, []);
  const fp = useFingerprint();

  useEffect(() => {
    loadRangeStart(todayISO()).then((d) => setFrom(d ?? todayISO().slice(0, 8) + "01"));
  }, []);

  useEffect(() => {
    if (!from) return;
    (async () => {
      setDays(null);
      const { data, error } = await supabase.from("official_attendance_days")
        .select("*").gte("attend_date", from).lte("attend_date", to)
        .order("attend_date", { ascending: true });
      if (error) { setMissing(isMissingTable(error)); setDays([]); return; }
      setDays(data ?? []);
    })();
  }, [from, to, tick]);

  const partialCount = (days ?? []).filter(isPartial).length;
  const used = useMemo(
    () => (days ?? []).filter((d) => !(skipPartial && isPartial(d))),
    [days, skipPartial]
  );

  const totals = useMemo(() => {
    const t = { total: 0, present: 0, absent: 0, excused: 0, pending: 0, fTotal: 0, fPresent: 0, fPending: 0, late: 0 };
    used.forEach((d) => {
      t.total += d.total; t.present += d.present; t.absent += d.absent;
      t.excused += d.excused; t.pending += d.pending; t.late += d.late_count ?? 0;
      if (d.final_present != null) {
        t.fTotal += d.total; t.fPresent += d.final_present; t.fPending += d.final_pending ?? 0;
      }
    });
    return { ...t, pct: pct(t.present, t.total, t.pending), fPct: pct(t.fPresent, t.fTotal, t.fPending) };
  }, [used]);

  const byWeekday = useMemo(() => {
    const m = {};
    used.forEach((d) => {
      const w = new Date(`${d.attend_date}T12:00:00`).getDay();
      const e = (m[w] ??= { n: 0, total: 0, present: 0, pending: 0, absent: 0 });
      e.n++; e.total += d.total; e.present += d.present; e.pending += d.pending; e.absent += d.absent;
    });
    return [0, 1, 2, 3, 4].filter((w) => m[w]).map((w) => ({ w, ...m[w], pct: pct(m[w].present, m[w].total, m[w].pending) }));
  }, [used]);

  const byGrade = useMemo(() => {
    const m = {};
    used.forEach((d) => Object.entries(d.by_grade ?? {}).forEach(([g, v]) => {
      const e = (m[g] ??= { total: 0, present: 0, absent: 0, excused: 0, pending: 0 });
      e.total += v.total ?? 0; e.present += v.present ?? 0; e.absent += v.absent ?? 0;
      e.excused += v.excused ?? 0; e.pending += v.pending ?? 0;
    }));
    return Object.entries(m).sort().map(([g, v]) => ({ g, ...v, pct: pct(v.present, v.total, v.pending) }));
  }, [used]);

  const range = () => `${fmtGreg(from + "T00:00:00")} — ${fmtGreg(to + "T00:00:00")}`;
  const report = () => {
    if (view === "weekday") return {
      title: "نسبة الحضور حسب أيام الأسبوع",
      headers: ["اليوم", "عدد الأيام", "متوسط الغياب اليومي", "نسبة الحضور الرسمية"],
      rows: byWeekday.map((r) => [WEEKDAY[r.w], r.n, Math.round(r.absent / r.n), pctText(r.pct)]),
    };
    if (view === "grade") return {
      title: "نسبة الحضور حسب الصفوف",
      headers: ["الصف", "حالات الغياب", "بعذر", "نسبة الحضور الرسمية"],
      rows: byGrade.map((r) => [GRADE_NAMES[r.g] ?? r.g, r.absent, r.excused, pctText(r.pct)]),
    };
    return {
      title: "سجل نسب الحضور والغياب اليومية",
      headers: ["م", "التاريخ", "اليوم", "غائب رسميًا", "بعذر", "متأخر صباحًا", "النسبة الرسمية", "النسبة المكتملة"],
      rows: [
        ...(days ?? []).map((d, i) => [
          i + 1, fmtGreg(d.attend_date + "T00:00:00"), weekdayOf(d.attend_date), d.absent, d.excused,
          fp ? d.late_count ?? "—" : "—", pctText(d.official_pct), d.final_pct != null ? pctText(d.final_pct) : "—",
        ]),
        ["", "الإجمالي", "", totals.absent, totals.excused, totals.late, pctText(totals.pct), pctText(totals.fPct)],
      ],
    };
  };

  if (!from) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateInput label="من" value={from} onChange={setFrom} />
        <DateInput label="إلى" value={to} onChange={setTo} />
      </div>

      {missing && <SetupNotice />}

      {days && days.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fig value={pctText(totals.pct)} label="النسبة الرسمية للفترة" tone="text-mint-deep" />
          <Fig value={pctText(totals.fPct)} label="النسبة المكتملة للفترة" tone="text-present" />
          <Fig value={used.length} label="يوم في الإجمالي"
               hint={partialCount ? `${partialCount} ناقص${skipPartial ? " (مستبعد)" : ""}` : undefined} />
          <Fig value={totals.absent.toLocaleString("ar")} label="حالات غياب رسمي" tone="text-absent" />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Pill on={view === "days"} onClick={() => setView("days")}>حسب اليوم</Pill>
        <Pill on={view === "weekday"} onClick={() => setView("weekday")}>حسب أيام الأسبوع</Pill>
        <Pill on={view === "grade"} onClick={() => setView("grade")}>حسب الصف</Pill>
      </div>

      {partialCount > 0 && (
        <Note tone="warn">
          <span className="num">{partialCount}</span> يومًا بيانات تحضيرها ناقصة: أكثر من خُمس الطلاب لم يُحضَّروا في
          الحصتين الأولى والثانية، فنسبتها الرسمية محسوبة على عدد قليل من الطلاب ولا تمثّل اليوم.
          <label className="mt-2 flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={skipPartial} onChange={(e) => setSkipPartial(e.target.checked)} />
            استبعاد الأيام الناقصة من الإجمالي والمقارنات
          </label>
        </Note>
      )}

      <ExportBar disabled={!days?.length}
        onPrint={() => { const r = report(); printReport({ ...r, subtitle: range(), ...logos(), signatures: SIGNS }); }}
        onExcel={() => { const r = report(); exportStyledExcel({ ...r, subtitle: range(), fileName: `${r.title}-${from}_${to}`, sheetName: "الإحصاء", signatures: SIGNS }); }} />

      {!days ? <Loading /> : days.length === 0 ? (
        <Empty>
          {officialStart && todayISO() < officialStart
            ? <>يبدأ العمل الرسمي من {fmtGreg(officialStart + "T00:00:00")} — تظهر الإحصاءات بعد اعتماد أول يوم (آليًا بعد نهاية الحصة الثانية).</>
            : "لا أيام معتمدة في هذه الفترة. اليوم الجاري يُعتمد آليًا بعد نهاية الحصة الثانية."}
        </Empty>
      ) : view === "days" ? (
        <div className="card divide-y divide-line overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-gray-tint px-4 py-2 text-[11px] font-semibold text-muted">
            <span>اليوم</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="w-10 text-center">غائب</span>
              <span className="w-14 text-left">الرسمية</span>
              <span className="w-14 text-left">المكتملة</span>
            </div>
          </div>
          {days.map((d) => (
            <div key={d.attend_date} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${isPartial(d) ? "bg-warning-light/40" : ""}`}>
              <div className="min-w-0">
                <p className="num text-sm font-medium text-ink">{fmtGreg(d.attend_date + "T00:00:00")}</p>
                <p className="text-xs text-muted">
                  {weekdayOf(d.attend_date)}{d.retroactive ? " · بأثر رجعي" : ""}
                  {fp && d.late_count != null && <> · تأخر صباحي <span className="num">{d.late_count}</span></>}
                </p>
                <p className="text-[11px] text-faint">
                  طلاب <span className="num">{d.total}</span> · حاضر <span className="num">{d.present}</span>
                  {d.excused > 0 && <> · بعذر <span className="num">{d.excused}</span></>}
                  {d.pending > 0 && (
                    <span className={isPartial(d) ? "font-semibold text-warning" : ""}>
                      {" "}· لم يُحضَّر <span className="num">{d.pending}</span>{isPartial(d) ? " — بيانات ناقصة" : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="num chip w-10 justify-center bg-absent/10 text-absent">{d.absent}</span>
                <span className="num w-14 text-left text-sm font-bold text-mint-deep">{pctText(d.official_pct)}</span>
                <span className="num w-14 text-left text-xs text-present">{d.final_pct != null ? pctText(d.final_pct) : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {(view === "weekday"
            ? byWeekday.map((r) => ({
                k: r.w, name: WEEKDAY[r.w], pct: r.pct,
                sub: <>{daysWord(r.n)} · متوسط الغياب اليومي <span className="num">{Math.round(r.absent / r.n)}</span></>,
              }))
            : byGrade.map((r) => ({
                k: r.g, name: GRADE_NAMES[r.g] ?? r.g, pct: r.pct,
                sub: <>غياب <span className="num">{r.absent}</span> · بعذر <span className="num">{r.excused}</span></>,
              })))
            .map((r) => (
              <div key={r.k} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{r.name}</p>
                  <p className="text-xs text-muted">{r.sub}</p>
                </div>
                <div className="flex w-40 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-gray-tint">
                    <div className="h-full rounded-pill bg-mint-deep" style={{ width: `${r.pct ?? 0}%` }} />
                  </div>
                  <span className="num w-12 text-left text-sm font-bold text-mint-deep">{pctText(r.pct)}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {!missing && <Backfill from={from} to={to} approved={days} onDone={() => setTick((t) => t + 1)} />}
    </div>
  );
}

/**
 * اعتماد الأيام السابقة بأثر رجعي من السجلات المحفوظة (تحضير الحصص والبصمة).
 * لا يمسّ الأيام المعتمدة مسبقًا، ولا يغيّر أي سجل أصلي.
 */
function Backfill({ from, to, approved, onDone }) {
  const [state, setState] = useState(null); // { done, total, saved, skipped, error }
  const [officialStart, setOfficialStart] = useState(null);   // بداية العمل الرسمي — ما قبلها تجربة لا يُعاد
  useEffect(() => { loadReportsStart().then(setOfficialStart); }, []);

  const pendingDays = useMemo(() => {
    const have = new Set((approved ?? []).map((d) => d.attend_date));
    const today = todayISO();
    if (!officialStart) return [];
    const begin = from > officialStart ? from : officialStart;
    return schoolDaysBetween(begin, to < today ? to : today).filter((d) => !have.has(d) && d < today);
  }, [from, to, approved, officialStart]);

  // أيام معتمدة ناقصة التحضير — تُعاد بعد أن يستكمل المعلمون الرصد
  const partialDays = useMemo(
    () => (approved ?? []).filter((d) => officialStart && d.attend_date >= officialStart && isPartial(d)).map((d) => d.attend_date),
    [approved, officialStart]
  );

  const start = (list, question) => async () => {
    if (!window.confirm(question)) return;
    const st = { done: 0, total: list.length, saved: 0, skipped: 0, error: null };
    setState({ ...st });
    for (const date of list) {
      try {
        const day = await loadDay(date);
        if (day.hasData) {
          await approveDay(date, day.rows, { retroactive: true });
          await saveFinal(date, day.rows);
          st.saved++;
        } else {
          st.skipped++;   // إجازة أو يوم بلا تحضير
        }
      } catch (e) {
        st.error = `${date}: ${e.message ?? e}`;
        setState({ ...st });
        break;
      }
      st.done++;
      setState({ ...st });
    }
    onDone();
  };

  if (!approved || !officialStart) return null;
  const since = fmtGreg(officialStart + "T00:00:00");

  // لا شيء يحتاج إجراء: سطر واحد فقط
  if (!state && pendingDays.length === 0 && partialDays.length === 0) {
    return (
      <p className="text-center text-xs text-faint">
        {todayISO() < officialStart
          ? <>يبدأ الاعتماد الآلي اليومي من {since}.</>
          : <>الاعتماد آلي يوميًا منذ {since} — لا أيام تحتاج اعتمادًا أو إعادة احتساب.</>}
      </p>
    );
  }

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">أيام تحتاج اعتمادًا أو إعادة احتساب</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          الاعتماد آلي يوميًا منذ {since} (ما قبله مرحلة تجربة لا يُحتسب). هنا فقط ما فاته
          الاعتماد الآلي، أو ما اعتُمد ناقص التحضير ثم استكمل المعلمون رصده. تبقى تصحيحات
          الوكيل اليدوية، والأيام بلا تحضير (الإجازات) تُتخطّى.
        </p>
      </div>
      {state ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-pill bg-gray-tint">
            <div className="h-full bg-mint-deep transition-all" style={{ width: `${(state.done / Math.max(state.total, 1)) * 100}%` }} />
          </div>
          <p className="text-xs text-muted">
            <span className="num">{state.done}</span> من <span className="num">{state.total}</span> ·
            اعتُمد <span className="num">{state.saved}</span> · تُخطّي <span className="num">{state.skipped}</span>
          </p>
          {state.error && <p className="text-sm text-absent">توقّف عند {state.error}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {pendingDays.length > 0 && (
            <button onClick={start(pendingDays,
                `سيُحسب ${pendingDays.length} يومًا فاته الاعتماد من السجلات المحفوظة. السجلات الأصلية لا تتغير. متابعة؟`)}
              className="rounded-sm2 bg-mint-deep px-4 py-2 text-sm font-semibold text-white">
              اعتماد <span className="num">{pendingDays.length}</span> يومًا فاته الاعتماد
            </button>
          )}
          {partialDays.length > 0 && (
            <button onClick={start(partialDays,
                `سيُعاد احتساب ${partialDays.length} يومًا ناقص التحضير من السجلات الحالية. تصحيحات الوكيل اليدوية تبقى كما هي. متابعة؟`)}
              className="rounded-sm2 border border-warning px-4 py-2 text-sm font-semibold text-warning hover:bg-warning-light">
              إعادة احتساب <span className="num">{partialDays.length}</span> يومًا ناقصًا بعد استكمال الرصد
            </button>
          )}
        </div>
      )}
    </section>
  );
}
