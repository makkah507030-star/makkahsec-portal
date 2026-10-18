// src/pages/lab/LabBooking.jsx
// جدول الحجز الأسبوعي: الأيام × الحصص. قاعدة البيانات تمنع اجتماع حجزين على
// الحصة نفسها (قيد فريد)، فلو ضغط معلمان معًا نجح أحدهما وأُخبر الآخر.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import { DAY_NAMES, PERIODS_PER_DAY, todayISO, holidayOn } from "../../lib/schoolTime";
import { loadPeriodTimes, fmtTime, toMinutes, nowMinutes } from "../../lib/periodTimes";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { addDays, weekStart, shortDate, classText } from "../../lib/lab.js";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const DAYS = [1, 2, 3, 4, 5];
const MAX_PERIODS = Math.max(...Object.values(PERIODS_PER_DAY));
const REPEAT = [
  { n: 1, label: "هذه الحصة فقط" },
  { n: 4, label: "أسبوعيًا لمدة 4 أسابيع" },
  { n: 8, label: "أسبوعيًا لمدة 8 أسابيع" },
  { n: 12, label: "أسبوعيًا لمدة 12 أسبوعًا" },
];

export default function LabBooking({ lab, canBook, isManager }) {
  const { session } = useSession();
  const today = todayISO();
  const [week, setWeek] = useState(() => weekStart(today));
  const [rows, setRows] = useState(null);
  const [times, setTimes] = useState({});
  const [labName, setLabName] = useState("معمل الحاسب الآلي");
  const [mySchedule, setMySchedule] = useState([]);
  const [sheet, setSheet] = useState(null);   // { date, period, booking? }
  // الجوال: يوم واحد في كل مرة (اليوم الحالي أو الأحد)
  const [day, setDay] = useState(() => { const d = new Date().getDay() + 1; return d >= 1 && d <= 5 ? d : 1; });
  const [msg, setMsg] = useNotice(null);

  const dateOf = (dow) => addDays(week, dow - 1);

  const load = useCallback(async () => {
    setRows(null);
    const { data, error } = await supabase.rpc("lab_week", { p_lab: lab, p_from: week, p_to: addDays(week, 4) });
    if (error) setMsg({ ok: false, text: "تعذّر تحميل الحجوزات: " + error.message });
    setRows(data ?? []);
  }, [lab, week, setMsg]);

  useEffect(() => { load(); }, [load]);

  // توقيت الحصص واسم المعمل وجدول المعلم (لاقتراح الفصل) — مرة واحدة
  useEffect(() => {
    loadPeriodTimes().then(({ rows: r }) => {
      const m = {};
      r.filter((x) => x.kind === "period" && x.period_no != null).forEach((x) => { m[x.period_no] = x; });
      setTimes(m);
    });
    supabase.from("labs").select("name").eq("id", lab).maybeSingle()
      .then(({ data }) => data?.name && setLabName(data.name));
    if (!canBook || !session?.user?.id) return;
    (async () => {
      const { data: st } = await supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const { data: t0 } = await supabase.from("teachers").select("id").eq("user_id", session.user.id).maybeSingle();
      if (!t0) return;
      const { data } = await supabase.from("schedule")
        .select("class_id, day_of_week, period_no, classes(class_no, grade)")
        .eq("teacher_id", t0.id).eq("academic_year", m.active_year ?? "").eq("term", Number(m.active_term ?? 1));
      setMySchedule(data ?? []);
    })();
  }, [lab, canBook, session]);

  const idx = useMemo(() => {
    const m = {};
    (rows ?? []).forEach((r) => { m[`${r.booking_date}|${r.period_no}`] = r; });
    return m;
  }, [rows]);

  // فصول المعلم من جدوله، بلا تكرار، مرتبة برقم الفصل
  const myClasses = useMemo(() => {
    const m = new Map();
    mySchedule.forEach((s) => s.classes && m.set(s.class_id, { id: s.class_id, ...s.classes }));
    return [...m.values()].sort((a, b) => a.class_no - b.class_no);
  }, [mySchedule]);

  const isPast = (date, period) => {
    if (date < today) return true;
    if (date > today) return false;
    const end = toMinutes(times[period]?.end_time);
    return end != null && end < nowMinutes();
  };

  const totalSlots = DAYS.reduce((n, d) => n + (holidayOn(dateOf(d)) ? 0 : PERIODS_PER_DAY[d]), 0);

  const printWeek = () => {
    const periods = Array.from({ length: MAX_PERIODS }, (_, i) => i + 1);
    printReport({
      title: `جدول حجز ${labName}`,
      subtitle: `الأسبوع من ${shortDate(week)} إلى ${shortDate(addDays(week, 4))}`,
      headers: ["اليوم", ...periods.map(String)],
      rows: DAYS.map((d) => {
        const date = dateOf(d);
        const off = holidayOn(date);
        return [`${DAY_NAMES[d]} ${shortDate(date)}`, ...periods.map((p) => {
          if (off) return p === 1 ? off.name : "";
          if (p > PERIODS_PER_DAY[d]) return "";
          const b = idx[`${date}|${p}`];
          return b ? [b.teacher_name, classText(b)].filter(Boolean).join(" — ") : "—";
        })];
      }),
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

  return (
    <div className="space-y-4">
      {/* التنقل بين الأسابيع */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3 print:hidden">
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn-ghost px-3 py-2" onClick={() => setWeek(addDays(week, -7))} aria-label="الأسبوع السابق">→</button>
          <div className="min-w-[9.5rem] text-center">
            <p className="text-sm font-semibold text-ink">
              <span className="num">{shortDate(week)}</span> – <span className="num">{shortDate(addDays(week, 4))}</span>
            </p>
            <p className="text-[11px] text-muted">
              {rows ? <>محجوز <span className="num">{rows.length}</span> من <span className="num">{totalSlots}</span> حصة</> : "…"}
            </p>
          </div>
          <button type="button" className="btn-ghost px-3 py-2" onClick={() => setWeek(addDays(week, 7))} aria-label="الأسبوع التالي">←</button>
          {week !== weekStart(today) && (
            <button type="button" className="ms-1 text-xs font-semibold text-mint-deep" onClick={() => setWeek(weekStart(today))}>هذا الأسبوع</button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Legend />
          <button type="button" className="btn-ghost py-2" onClick={printWeek} disabled={!rows}>طباعة الأسبوع</button>
        </div>
      </div>

      {/* الجوال: اختيار اليوم */}
      <div className="grid grid-cols-5 gap-1 md:hidden print:hidden">
        {DAYS.map((d) => (
          <button key={d} type="button" onClick={() => setDay(d)}
                  className={`rounded-sm2 px-1 py-1.5 text-center text-xs transition-colors ${
                    day === d ? "bg-mint-deep font-semibold text-white" : "bg-paper text-muted"}`}>
            {DAY_NAMES[d]}
            <span className="num block text-[10px] opacity-80">{shortDate(dateOf(d))}</span>
          </button>
        ))}
      </div>

      {rows === null ? <Loader /> : (
        <div className="grid gap-3 md:grid-cols-5">
          {DAYS.map((d) => {
            const date = dateOf(d);
            const off = holidayOn(date);
            return (
              <div key={d} className={`card overflow-hidden ${d === day ? "" : "hidden md:block"} ${date === today ? "ring-2 ring-mint-deep/40" : ""}`}>
                <div className="flex items-baseline justify-between border-b border-line/60 bg-canvas px-3 py-2">
                  <p className="text-sm font-bold text-ink">{DAY_NAMES[d]}</p>
                  <p className="num text-xs text-muted">{shortDate(date)}</p>
                </div>
                {off ? (
                  <p className="px-3 py-6 text-center text-xs text-muted">{off.name}</p>
                ) : (
                  <ul className="space-y-1.5 p-2">
                    {Array.from({ length: PERIODS_PER_DAY[d] }, (_, i) => i + 1).map((p) => (
                      <Slot key={p} period={p} time={times[p]} booking={idx[`${date}|${p}`]}
                            past={isPast(date, p)} canBook={canBook} isManager={isManager}
                            onOpen={(booking) => setSheet({ date, period: p, dow: d, booking })} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {msg && !msg.ok && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{msg.text}</p>}

      {sheet && (
        <BookingSheet sheet={sheet} lab={lab} labName={labName} myClasses={myClasses} mySchedule={mySchedule}
                      canCancel={sheet.booking && (sheet.booking.mine || isManager)}
                      onClose={() => setSheet(null)}
                      onDone={(text) => { setSheet(null); setMsg({ ok: true, text }); load(); }}
                      onError={(text) => { setMsg({ ok: false, text }); load(); }} />
      )}
    </div>
  );
}

function Legend() {
  const item = (cls, label) => (
    <span className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${cls}`} />{label}</span>
  );
  return (
    <div className="hidden items-center gap-3 text-[11px] text-muted sm:flex">
      {item("border border-dashed border-mint-deep", "متاح")}
      {item("bg-mint-deep", "حجزك")}
      {item("bg-faint", "محجوز")}
    </div>
  );
}

function Slot({ period, time, booking, past, canBook, isManager, onOpen }) {
  const head = (
    <span className="flex w-9 shrink-0 flex-col items-center">
      <span className="num text-sm font-bold">{period}</span>
      {time && <span className="num text-[9px] opacity-70">{fmtTime(time.start_time).replace(/ [صم]$/, "")}</span>}
    </span>
  );
  const base = "flex w-full items-center gap-2 rounded-sm2 px-2 py-1.5 text-start text-xs transition-colors";

  if (booking) {
    const clickable = booking.mine || isManager;
    const tone = booking.mine ? "bg-mint-deep text-white" : "bg-canvas text-ink";
    return (
      <li>
        <button type="button" disabled={!clickable} onClick={() => onOpen(booking)}
                className={`${base} ${tone} ${past ? "opacity-60" : ""} ${clickable ? "hover:opacity-90" : "cursor-default"}`}>
          {head}
          <span className="min-w-0">
            <span className="block truncate font-semibold">{booking.mine ? "حجزك" : booking.teacher_name}</span>
            <span className={`block truncate text-[11px] ${booking.mine ? "text-white/80" : "text-muted"}`}>
              {[classText(booking), booking.lesson].filter(Boolean).join(" · ") || "—"}
            </span>
          </span>
        </button>
      </li>
    );
  }
  if (past || !canBook) {
    return (
      <li className={`${base} ${past ? "text-faint" : "text-muted"}`}>
        {head}<span>{past ? "—" : "متاح"}</span>
      </li>
    );
  }
  return (
    <li>
      <button type="button" onClick={() => onOpen(null)}
              className={`${base} border border-dashed border-mint-deep/50 text-mint-deep hover:bg-mint-tint`}>
        {head}<span className="font-semibold">متاح — احجز</span>
      </button>
    </li>
  );
}

function BookingSheet({ sheet, lab, labName, myClasses, mySchedule, canCancel, onClose, onDone, onError }) {
  const { date, period, dow, booking } = sheet;
  // الفصل المقترح: من يدرّسه المعلم في هذا اليوم والحصة حسب جدوله
  const suggested = mySchedule.find((s) => s.day_of_week === dow && s.period_no === period)?.class_id;
  const [classId, setClassId] = useState(suggested ?? myClasses[0]?.id ?? "");
  const [lesson, setLesson] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);

  const when = `${DAY_NAMES[dow]} ${shortDate(date)} · الحصة ${period}`;
  const list = (ds) => ds.map(shortDate).join("، ");

  const book = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("lab_book", {
      p_lab: lab, p_date: date, p_period: period,
      p_class: classId || null, p_lesson: lesson, p_weeks: weeks,
    });
    setBusy(false);
    if (error) { onClose(); onError("تعذّر الحجز: " + error.message); return; }
    const { booked = [], taken = [], off = [] } = data ?? {};
    if (!booked.length) {
      onClose();
      onError(taken.length ? "سبقك معلم آخر إلى هذه الحصة — اختر حصة أخرى." : "لم يُحجز شيء.");
      return;
    }
    const parts = [booked.length === 1 ? `تم الحجز: ${when}` : `حُجزت ${booked.length} حصص أسبوعيًا`];
    if (taken.length) parts.push(`محجوزة لغيرك: ${list(taken)}`);
    if (off.length) parts.push(`إجازة: ${list(off)}`);
    onDone(parts.join(" · "));
  };

  const cancel = async (series) => {
    const ok = await confirmDanger({
      title: series ? "إلغاء هذا الحجز وما بعده من السلسلة؟" : "إلغاء هذا الحجز؟",
      impact: [when, booking.teacher_name],
      level: "medium",
      confirmLabel: "إلغاء الحجز",
    });
    if (!ok) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("lab_cancel", { p_id: booking.id, p_series: series });
    setBusy(false);
    if (error) { onClose(); onError("تعذّر الإلغاء: " + error.message); return; }
    onDone(data > 1 ? `أُلغيت ${data} حصص` : "أُلغي الحجز");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4 print:hidden" dir="rtl"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-card bg-paper p-4 shadow-xl sm:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-ink">{booking ? "تفاصيل الحجز" : "حجز المعمل"}</p>
            <p className="text-xs text-muted">{labName} · {when}</p>
          </div>
          <button type="button" className="text-sm text-muted" onClick={onClose}>إغلاق</button>
        </div>

        {booking ? (
          <div className="space-y-3">
            <dl className="space-y-1.5 rounded-sm2 bg-canvas p-3 text-sm">
              <Row k="المعلم" v={booking.teacher_name} />
              <Row k="الفصل" v={classText(booking) || "—"} />
              <Row k="الدرس" v={booking.lesson || "—"} />
              {booking.series_id && <Row k="التكرار" v="حجز أسبوعي متكرر" />}
            </dl>
            {canCancel && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost flex-1 text-absent" disabled={busy} onClick={() => cancel(false)}>إلغاء هذه الحصة</button>
                {booking.series_id && (
                  <button type="button" className="btn-ghost flex-1 text-absent" disabled={busy} onClick={() => cancel(true)}>إلغاء ما بعدها من السلسلة</button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="lab-class">الفصل</label>
              <select id="lab-class" className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">— بدون فصل محدد —</option>
                {myClasses.map((c) => <option key={c.id} value={c.id}>{classText(c)}{c.id === suggested ? " (في جدولك الآن)" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="lab-lesson">عنوان الدرس (اختياري)</label>
              <input id="lab-lesson" className="field" value={lesson} maxLength={120}
                     placeholder="مثال: إنشاء جدول في قاعدة بيانات" onChange={(e) => setLesson(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="lab-repeat">التكرار</label>
              <select id="lab-repeat" className="field" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {REPEAT.map((r) => <option key={r.n} value={r.n}>{r.label}</option>)}
              </select>
              {weeks > 1 && (
                <p className="mt-1 text-[11px] text-muted">الحصص المحجوزة لغيرك أو الواقعة في إجازة تُتخطّى تلقائيًا.</p>
              )}
            </div>
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={book}>
              {busy ? "جارٍ الحجز…" : "تأكيد الحجز"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>
);
