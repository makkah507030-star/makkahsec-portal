// src/components/StudyWeekCard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { todayISO } from "../lib/schoolTime";
import { fmtGreg, fmtHijri } from "../lib/dates";
import { weekWord } from "../lib/dfile.js";

/* =====================================================================
   بطاقة «الأسبوع الدراسي» في الصفحة العامة ورئيسية كل حساب:
   رقم الأسبوع من آخر «بداية فصل» في التقويم الدراسي، وتاريخا بدايته
   (الأحد) ونهايته (الخميس) بالهجري والميلادي، ومن كم أسبوعًا إن وُجدت
   «نهاية فصل». الأسبوع الذي تغطيه إجازة كاملة لا يُعدّ، ويظهر مكانه اسمها
   (بالطريقة نفسها في dfile_week لملف المعلم الرقمي).
   وتحته ما يقع في الأسبوع من التقويم: إجازة يوم أو أكثر، وحدث (مثل يوم
   التأسيس)، واختبارات، وبداية فصل أو نهايته، بأيامها.
   التقويم يقرؤه الجميع (calendar_public_read)، فتعمل للزائر قبل الدخول.
   ===================================================================== */

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(`${s}T12:00:00Z`).getTime() + n * DAY);
const sundayOf = (s) => addDays(s, -new Date(`${s}T12:00:00Z`).getUTCDay());

let cache = null;   // يُحسب مرة لكل تحميل للبوابة

export async function loadStudyWeek(today = todayISO()) {
  if (cache?.today === today) return cache.value;
  const { data } = await supabase.from("academic_calendar")
    .select("title, kind, start_date, end_date").eq("is_active", true);
  const rows = data ?? [];
  const start = rows.filter((r) => r.kind === "term_start" && r.start_date <= today)
    .map((r) => r.start_date).sort().pop();
  let value = null;
  if (start) {
    const end = rows.filter((r) => r.kind === "term_end" && r.start_date >= start).map((r) => r.start_date).sort()[0] ?? null;
    if (!end || today <= end) {
      const holidays = rows.filter((r) => r.kind === "holiday");
      // إجازة تغطي الأسبوع الدراسي كله (الأحد إلى الخميس)
      const offWeek = (sun) => holidays.find((h) => h.start_date <= sun && (h.end_date ?? h.start_date) >= addDays(sun, 4));
      const cur = sundayOf(today);
      let n = 0, total = 0;
      for (let sun = sundayOf(start); sun <= (end ?? cur); sun = addDays(sun, 7)) {
        if (offWeek(sun)) continue;
        if (sun <= cur) n += 1;
        total += 1;
      }
      const off = offWeek(cur);
      const to = addDays(cur, 4);
      // ما يقع في أيام الأسبوع (الأحد إلى الخميس)، عدا الإجازة التي تغطيه كله
      const events = rows
        .filter((r) => r !== off && r.start_date <= to && (r.end_date ?? r.start_date) >= cur)
        .map((r) => ({ title: r.title, kind: r.kind,
                       from: r.start_date < cur ? cur : r.start_date,
                       to: (r.end_date ?? r.start_date) > to ? to : (r.end_date ?? r.start_date) }))
        .sort((a, b) => a.from.localeCompare(b.from));
      value = { n, from: cur, to, total: end ? total : null, holiday: off?.title ?? null, events };
    }
  }
  cache = { today, value };
  return value;
}

const KIND = {
  holiday: { t: "إجازة", c: "bg-absent/10 text-absent" },
  event: { t: "مناسبة", c: "bg-excused/10 text-excused" },
  exam: { t: "اختبارات", c: "bg-late/10 text-late" },
  term_start: { t: "بداية الفصل", c: "bg-present/10 text-present" },
  term_end: { t: "نهاية الفصل", c: "bg-present/10 text-present" },
};
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dayOf = (s) => DAYS[new Date(`${s}T12:00:00Z`).getUTCDay()];

export default function StudyWeekCard({ className = "" }) {
  const [w, setW] = useState(undefined);
  const [open, setOpen] = useState(false);   // أحداث الأسبوع مطوية حتى الضغط على البطاقة
  useEffect(() => { loadStudyWeek().then(setW).catch(() => setW(null)); }, []);
  if (!w || !w.n) return null;

  const pct = w.total ? Math.min(100, Math.round((w.n / w.total) * 100)) : null;
  const evN = w.events?.length ?? 0;
  const toggle = () => evN && setOpen((x) => !x);
  return (
    <section className={`card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 ${evN ? "cursor-pointer" : ""} ${className}`}
             onClick={toggle} role={evN ? "button" : undefined} aria-expanded={evN ? open : undefined} tabIndex={evN ? 0 : undefined}
             onKeyDown={(e) => { if (evN && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } }}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-card bg-mint-tint text-mint-deep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4" /><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2" />
          </svg>
        </div>
        <div>
          <p className="text-xs text-muted">{w.holiday ? "إجازة" : "نحن الآن في"}</p>
          <p className="text-lg font-bold leading-tight text-ink">
            {w.holiday ?? <>الأسبوع الدراسي <span className="text-mint-deep">{weekWord(w.n)}</span></>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-sm2 bg-canvas px-2.5 py-1.5">
          <span className="block text-[10.5px] text-faint">من الأحد</span>
          <span className="num font-semibold text-ink">{fmtHijri(w.from)}</span>
          <span className="num block text-[11px] text-muted">{fmtGreg(w.from)}</span>
        </span>
        <span className="rounded-sm2 bg-canvas px-2.5 py-1.5">
          <span className="block text-[10.5px] text-faint">إلى الخميس</span>
          <span className="num font-semibold text-ink">{fmtHijri(w.to)}</span>
          <span className="num block text-[11px] text-muted">{fmtGreg(w.to)}</span>
        </span>
      </div>

      {pct != null && !w.holiday && (
        <div className="min-w-[10rem] flex-1">
          <div className="flex justify-between text-[11px] text-muted">
            <span>من أسابيع الفصل الدراسي</span>
            <span className="font-semibold text-mint-deep"><span className="num">{w.n}</span> من <span className="num">{w.total}</span></span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-mint-deep" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {evN > 0 && (
        <span className={`chip gap-1 ${open ? "bg-mint-deep text-white" : "bg-mint-tint text-mint-deep"}`}>
          أحداث الأسبوع <span className="num">({evN})</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
               className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </span>
      )}
      {open && evN > 0 && (
        <ul className="basis-full space-y-1.5 border-t border-line pt-3">
          {w.events.map((e) => {
            const k = KIND[e.kind] ?? KIND.event;
            return (
              <li key={`${e.kind}${e.title}${e.from}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`chip ${k.c}`}>{k.t}</span>
                <span className="font-semibold text-ink">{e.title}</span>
                <span className="text-xs text-muted">
                  {e.from === e.to ? <>{dayOf(e.from)} <span className="num">{fmtHijri(e.from)}</span></>
                    : <>من {dayOf(e.from)} <span className="num">{fmtHijri(e.from)}</span> إلى {dayOf(e.to)} <span className="num">{fmtHijri(e.to)}</span></>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
