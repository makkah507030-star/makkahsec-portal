// src/components/TeacherTodayCard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { todayDow, todayISO, GRADE_NAMES } from "../lib/schoolTime";
import { loadPeriodTimes, byPeriodNo, currentPeriodNo, periodStarted, fmtRange } from "../lib/periodTimes";

/* =====================================================================
   «يومي» — بطاقة المعلم الأولى في الصفحة الرئيسية بعد فصل التحضير عنها:
   الحصة الجارية وزر «تحضير الآن» يفتحها مباشرة، ثم حصص اليوم بحالتها
   (مُحضَّرة / لم تُحضَّر / لم تبدأ). تتحدّث كل دقيقة.
   ===================================================================== */

export default function TeacherTodayCard() {
  const { session } = useSession();
  const uid = session?.user?.id;
  const [periods, setPeriods] = useState(null);
  const [done, setDone] = useState(new Set());
  const [pt, setPt] = useState([]);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (async () => {
      const dow = todayDow();
      const [{ rows }, { data: st }, { data: t0 }] = await Promise.all([
        loadPeriodTimes(),
        supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]),
        supabase.from("teachers").select("id").eq("user_id", uid).maybeSingle(),
      ]);
      if (!alive) return;
      setPt(rows);
      if (!t0 || !dow) { setPeriods([]); return; }
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const { data } = await supabase.from("schedule")
        .select("id, period_no, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t0.id).eq("academic_year", m.active_year ?? "")
        .eq("term", Number(m.active_term ?? 1)).eq("day_of_week", dow).order("period_no");
      const list = data ?? [];
      let doneSet = new Set();
      if (list.length) {
        const { data: d } = await supabase.from("class_attendance").select("schedule_id")
          .eq("attend_date", todayISO()).in("schedule_id", list.map((p) => p.id));
        doneSet = new Set((d ?? []).map((r) => r.schedule_id));
      }
      if (!alive) return;
      setPeriods(list);
      setDone(doneSet);
    })();
    return () => { alive = false; };
  }, [uid]);

  if (periods === null) return null;

  if (!periods.length) {
    return (
      <section className="rounded-card border border-line bg-white px-4 py-4">
        <p className="text-sm font-bold text-ink">يومي</p>
        <p className="mt-1 text-sm text-muted">لا حصص لك اليوم.</p>
      </section>
    );
  }

  const ptMap = byPeriodNo(pt);
  const nowNo = currentPeriodNo(pt, clock);
  const cur = periods.find((p) => p.period_no === nowNo);
  const started = (p) => periodStarted(ptMap[p.period_no], clock);
  const pending = periods.filter((p) => started(p) && !done.has(p.id));
  const next = periods.find((p) => !started(p));
  const clsName = (p) => `${GRADE_NAMES[p.classes?.grade] ?? ""} — فصل ${p.classes?.class_no ?? ""}`;
  const go = (p) => `/attendance?s=${p.id}`;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-white">
      {/* الحصة الجارية */}
      {cur ? (
        <div className={`flex flex-wrap items-center gap-3 px-4 py-4 ${done.has(cur.id) ? "bg-mint-tint" : "bg-warning/10"}`}>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-bold ${done.has(cur.id) ? "text-mint-deep" : "text-warning"}`}>
              الآن · الحصة <span className="num">{cur.period_no}</span>
              {ptMap[cur.period_no] && <> · <span dir="rtl" className="inline-block font-medium">{fmtRange(ptMap[cur.period_no])}</span></>}
            </p>
            <p className="mt-1 truncate text-base font-bold text-ink">{cur.subjects?.name ?? "—"}</p>
            <p className="truncate text-sm text-muted">{clsName(cur)}</p>
          </div>
          {done.has(cur.id) ? (
            <Link to={go(cur)} className="shrink-0 rounded-pill border border-mint-deep px-4 py-2 text-sm font-semibold text-mint-deep hover:bg-white">
              ✓ مُحضَّرة · تعديل
            </Link>
          ) : (
            <Link to={go(cur)} className="btn-primary shrink-0 px-6 py-2.5 text-base">
              تحضير الآن
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">يومي</p>
            <p className="mt-0.5 text-sm text-muted">
              {next
                ? <>حصتك القادمة: الحصة <span className="num">{next.period_no}</span> — {next.subjects?.name ?? ""} · {clsName(next)}</>
                : "انتهت حصصك لهذا اليوم."}
            </p>
          </div>
          <Link to="/attendance" className="shrink-0 rounded-pill border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas">
            صفحة التحضير
          </Link>
        </div>
      )}

      {/* تنبيه بالحصص الفائتة التي لم تُحضَّر */}
      {pending.filter((p) => p.id !== cur?.id).length > 0 && (
        <p className="border-t border-line bg-absent/5 px-4 py-2 text-xs font-semibold text-absent">
          لم يُرصد تحضير: {pending.filter((p) => p.id !== cur?.id).map((p, i) => (
            <span key={p.id}>{i > 0 && "، "}<Link to={go(p)} className="underline">الحصة <span className="num">{p.period_no}</span></Link></span>
          ))}
        </p>
      )}

      {/* حصص اليوم */}
      <ol className="flex gap-1.5 overflow-x-auto border-t border-line px-4 py-3">
        {periods.map((p) => {
          const st = done.has(p.id) ? "done" : started(p) ? "late" : "soon";
          const tone = {
            done: "border-[#CCF2DB] bg-mint-tint text-mint-deep",
            late: "border-absent/30 bg-absent/5 text-absent",
            soon: "border-line bg-white text-muted",
          }[st];
          const Tag = st === "soon" ? "div" : Link;
          return (
            <li key={p.id} className="shrink-0">
              <Tag {...(st === "soon" ? {} : { to: go(p) })}
                   title={`${p.subjects?.name ?? ""} · ${clsName(p)}`}
                   className={`block min-w-[4.5rem] rounded-sm2 border px-2.5 py-1.5 text-center ${tone} ${p.id === cur?.id ? "ring-2 ring-offset-1 ring-current" : ""}`}>
                <span className="block text-[11px] font-bold">الحصة <span className="num">{p.period_no}</span></span>
                <span className="num block text-[11px]">{p.classes?.class_no ?? ""}</span>
                <span className="block text-[10px]">{st === "done" ? "✓ مُحضَّرة" : st === "late" ? "لم تُحضَّر" : "لم تبدأ"}</span>
              </Tag>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
