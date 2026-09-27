// لوحة اليوم: مراحل اليوم الدراسي وحالة كل تقرير
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO, todayOff } from "../../lib/schoolTime";
import { loadPeriodTimes, toMinutes, fmtTime } from "../../lib/periodTimes";
import { fmtDateTime } from "../../lib/dates";
import { summarize, lateDeadlineLabel, LATE_GRACE_MINUTES, riyadhMinutes } from "../../lib/officialAttendance";
import { Fig, Loading, Empty, Note, SetupNotice, useDay, pctText } from "./shared.jsx";

export default function TodayBoard({ go }) {
  const off = todayOff();
  const date = todayISO();
  const { live, approval, error } = useDay(date);
  const [pt, setPt] = useState(null);
  const [missingCount, setMissingCount] = useState(null);
  const [now, setNow] = useState(() => riyadhMinutes(new Date()));

  useEffect(() => {
    loadPeriodTimes().then(({ rows }) => setPt(rows));
    supabase.rpc("missing_students", { p_date: date })
      .then(({ data }) => setMissingCount((data ?? []).length));
    const t = setInterval(() => setNow(riyadhMinutes(new Date())), 60000);
    return () => clearInterval(t);
  }, [date]);

  const times = useMemo(() => {
    const periods = (pt ?? []).filter((r) => r.kind === "period" && r.period_no != null)
      .sort((a, b) => a.period_no - b.period_no);
    const p2 = periods.find((r) => r.period_no === 2);
    const last = periods[periods.length - 1];
    return {
      p2End: p2 ? toMinutes(p2.end_time) : null,
      p2Label: p2 ? fmtTime(p2.end_time) : "",
      lastEnd: last ? toMinutes(last.end_time) : null,
      lastLabel: last ? fmtTime(last.end_time) : "",
    };
  }, [pt]);

  if (off) {
    return (
      <div className="space-y-4">
        <Empty>{off.title} — {off.body}</Empty>
        <Note>التقارير السابقة متاحة من التبويبات أعلاه.</Note>
      </div>
    );
  }
  if (error) return <Empty>تعذّر التحميل: {error}</Empty>;
  if (!live || !pt) return <Loading />;

  const day = approval?.day;
  const off_ = summarize(live.rows);
  const fin = summarize(live.rows, "final");
  const lateCount = live.rows.filter((r) => r.isLate).length;
  const punched = live.rows.filter((r) => r.punched).length;
  const conflicts = live.rows.filter((r) => r.official === "absent" && r.punched).length;
  const lateStart = live.dayStart != null ? live.dayStart + LATE_GRACE_MINUTES : null;

  const stages = [
    {
      key: "late", tab: "late", n: 1,
      title: "التأخر الصباحي",
      when: `بعد ${lateDeadlineLabel(live.dayStart)} (الاصطفاف + ${LATE_GRACE_MINUTES} دقائق)`,
      state: lateStart != null && now >= lateStart ? "ready" : "wait",
      body: <>بصم <b className="num">{punched}</b> · متأخر <b className="num text-late">{lateCount}</b></>,
    },
    {
      key: "official", tab: "official", n: 2,
      title: "الغياب الرسمي ونسبة الحضور الرسمية",
      when: `بعد نهاية الحصة الثانية ${times.p2Label}`,
      state: day ? "done" : off_.pending === 0 && live.hasData ? "action" : times.p2End != null && now >= times.p2End ? "action" : "wait",
      body: day
        ? <>معتمد · النسبة <b className="num">{pctText(day.official_pct)}</b> · غائب <b className="num text-absent">{day.absent}</b>
            <span className="block text-[11px] text-faint">{day.approved_by_name} · {fmtDateTime(day.approved_at)}</span></>
        : <>مبدئيًا <b className="num">{pctText(off_.pct)}</b> · غائب <b className="num text-absent">{off_.absent}</b>
            {off_.pending > 0 && <> · لم يُحضَّر <b className="num text-warning">{off_.pending}</b></>}</>,
    },
    {
      key: "follow", tab: "follow", n: 3,
      title: "المتابعة خلال اليوم",
      when: "مستمر",
      state: conflicts + (missingCount ?? 0) > 0 ? "alert" : "ready",
      body: <>بصم ولم يحضر <b className="num text-warning">{conflicts}</b> · مفقود <b className="num text-absent">{missingCount ?? "…"}</b></>,
    },
    {
      key: "final", tab: "official", n: 4,
      title: "النسبة المكتملة للإحصاء",
      when: `بعد نهاية الدوام ${times.lastLabel}`,
      state: day?.final_at ? "done" : times.lastEnd != null && now >= times.lastEnd && day ? "action" : "wait",
      body: day?.final_at
        ? <>محفوظة <b className="num">{pctText(day.final_pct)}</b></>
        : <>الآن <b className="num">{pctText(fin.pct)}</b></>,
    },
  ];

  const STATE = {
    wait:   { chip: "bg-gray-tint text-muted", label: "لم يحن وقته" },
    ready:  { chip: "bg-present/10 text-present", label: "جاهز" },
    action: { chip: "bg-mint-deep text-white", label: "مطلوب إجراء" },
    alert:  { chip: "bg-warning-light text-warning", label: "للمتابعة" },
    done:   { chip: "bg-present/10 text-present", label: "✓ تم" },
  };

  return (
    <div className="space-y-4">
      {approval?.missingTables && <SetupNotice />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fig value={pctText(day ? day.official_pct : off_.pct)} label={day ? "نسبة الحضور الرسمية" : "نسبة الحضور (مبدئية)"} tone="text-mint-deep" />
        <Fig value={day ? day.absent : off_.absent} label="غائب رسميًا" tone="text-absent" />
        <Fig value={lateCount} label="تأخر صباحي" tone="text-late" />
        <Fig value={conflicts} label="بصم ولم يحضر" tone="text-warning" />
      </div>

      <ol className="space-y-2">
        {stages.map((s) => (
          <li key={s.key}>
            <button onClick={() => go(s.tab)}
              className="card flex w-full items-start gap-3 p-4 text-right transition-colors hover:bg-canvas">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint-tint text-sm font-bold text-mint-deep">
                {s.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{s.title}</p>
                  <span className={`chip ${STATE[s.state].chip}`}>{STATE[s.state].label}</span>
                </div>
                <p className="mt-0.5 text-xs text-faint">{s.when}</p>
                <p className="mt-1.5 text-sm text-muted">{s.body}</p>
              </div>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
