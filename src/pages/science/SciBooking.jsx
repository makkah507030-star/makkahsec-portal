// src/pages/science/SciBooking.jsx
// حجز مختبر العلوم: الأسبوع أيامًا × حصصًا. يحجز معلم المادة حصته لفصل من فصوله وتجربة من الخطة،
// ويرى المحضر أدوات كل تجربة محجوزة فيجهّزها ويعلّم الحجز «جاهز» أو «ينقصه شيء». وبعد الحصة يسجّل
// المعلم تنفيذ التجربة من الحجز نفسه في سجل التنفيذ.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import Loader from "../../components/Loader.jsx";
import { DAY_NAMES, PERIODS_PER_DAY, todayISO, holidayOn } from "../../lib/schoolTime";
import { addDays, weekStart, shortDate } from "../../lib/lab.js";
import { PREP, OUTCOME, REASON, KIND, setupMsg } from "../../lib/sciLab.js";

const DAYS = [1, 2, 3, 4, 5];
const PREP_TONE = { pending: "bg-warning-light text-warning", ready: "bg-present/10 text-present", issue: "bg-danger-light text-danger" };

export default function SciBooking({ lab, exps, classes, myTeacher, isManager, canBook }) {
  const today = todayISO();
  const [week, setWeek] = useState(() => weekStart(today));
  const [rows, setRows] = useState(null);
  const [sheet, setSheet] = useState(null);   // { date, period, booking? }
  const [day, setDay] = useState(() => { const d = new Date().getDay() + 1; return d >= 1 && d <= 5 ? d : 1; });
  const [msg, setMsg] = useNotice(null);
  const dateOf = (d) => addDays(week, d - 1);

  const load = useCallback(async () => {
    setRows(null);
    const { data, error } = await supabase.from("sci_bookings")
      .select("*, teachers(full_name), classes(class_no, grade)").eq("lab", lab)
      .gte("booking_date", week).lte("booking_date", addDays(week, 4));
    if (error) setMsg({ ok: false, text: setupMsg(error) });
    setRows(data ?? []);
  }, [lab, week, setMsg]);
  useEffect(() => { load(); }, [load]);

  const idx = useMemo(() => Object.fromEntries((rows ?? []).map((r) => [`${r.booking_date}|${r.period_no}`, r])), [rows]);
  const expById = useMemo(() => Object.fromEntries(exps.map((e) => [e.id, e])), [exps]);
  const myClasses = useMemo(() => classes.filter((c) => isManager || c.teacher_id === myTeacher), [classes, isManager, myTeacher]);

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn-ghost px-3 py-2" onClick={() => setWeek(addDays(week, -7))} aria-label="الأسبوع السابق">→</button>
          <div className="min-w-[9rem] text-center">
            <p className="text-sm font-semibold text-ink"><span className="num">{shortDate(week)}</span> – <span className="num">{shortDate(addDays(week, 4))}</span></p>
            <p className="text-[11px] text-muted">{rows ? <>محجوز <span className="num">{rows.length}</span> حصة</> : "…"}</p>
          </div>
          <button type="button" className="btn-ghost px-3 py-2" onClick={() => setWeek(addDays(week, 7))} aria-label="الأسبوع التالي">←</button>
          {week !== weekStart(today) && <button type="button" className="ms-1 text-xs font-semibold text-mint-deep" onClick={() => setWeek(weekStart(today))}>هذا الأسبوع</button>}
        </div>
        {isManager && rows?.length > 0 && (
          <p className="text-xs text-muted">بانتظار التجهيز: <b className="num text-warning">{rows.filter((r) => r.prep === "pending" && r.booking_date >= today).length}</b></p>
        )}
      </div>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-danger-light text-danger"}`}>{msg.text}</p>}

      <div className="grid grid-cols-5 gap-1 md:hidden">
        {DAYS.map((d) => (
          <button key={d} type="button" onClick={() => setDay(d)}
                  className={`rounded-sm2 px-1 py-1.5 text-center text-xs ${day === d ? "bg-mint-deep font-semibold text-white" : "bg-paper text-muted"}`}>
            {DAY_NAMES[d]}<span className="num block text-[10px] opacity-80">{shortDate(dateOf(d))}</span>
          </button>
        ))}
      </div>

      {rows === null ? <Loader /> : (
        <div className="grid gap-3 md:grid-cols-5">
          {DAYS.map((d) => {
            const date = dateOf(d), off = holidayOn(date);
            return (
              <div key={d} className={`card overflow-hidden ${d === day ? "" : "hidden md:block"} ${date === today ? "ring-2 ring-mint-deep/40" : ""}`}>
                <div className="flex items-baseline justify-between border-b border-line/60 bg-canvas px-3 py-2">
                  <p className="text-sm font-bold text-ink">{DAY_NAMES[d]}</p><p className="num text-xs text-muted">{shortDate(date)}</p>
                </div>
                {off ? <p className="px-3 py-6 text-center text-xs text-muted">{off.name}</p> : (
                  <ul className="space-y-1.5 p-2">
                    {Array.from({ length: PERIODS_PER_DAY[d] }, (_, i) => i + 1).map((p) => {
                      const b = idx[`${date}|${p}`], past = date < today, e = b && expById[b.experiment_id];
                      const mine = b && b.teacher_id === myTeacher;
                      if (b) return (
                        <li key={p}>
                          <button type="button" onClick={() => setSheet({ date, period: p, dow: d, booking: b })}
                                  className={`flex w-full items-start gap-2 rounded-sm2 px-2 py-1.5 text-start text-xs ${mine ? "bg-mint-deep text-white" : "bg-canvas text-ink"} ${past ? "opacity-70" : ""}`}>
                            <span className="num w-5 shrink-0 pt-0.5 text-center text-sm font-bold">{p}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{mine ? "حجزك" : b.teachers?.full_name}</span>
                              <span className={`block truncate text-[11px] ${mine ? "text-white/80" : "text-muted"}`}>{[b.classes && `فصل ${b.classes.class_no}`, e?.title].filter(Boolean).join(" · ")}</span>
                              <span className={`mt-0.5 inline-block rounded-pill px-1.5 text-[10px] ${PREP_TONE[b.prep]}`}>{PREP[b.prep]}</span>
                            </span>
                          </button>
                        </li>
                      );
                      if (past || !canBook) return <li key={p} className="flex items-center gap-2 px-2 py-1.5 text-xs text-faint"><span className="num w-5 text-center font-bold">{p}</span>{past ? "—" : "متاح"}</li>;
                      return (
                        <li key={p}>
                          <button type="button" onClick={() => setSheet({ date, period: p, dow: d })}
                                  className="flex w-full items-center gap-2 rounded-sm2 border border-dashed border-mint-deep/50 px-2 py-1.5 text-xs text-mint-deep hover:bg-mint-tint">
                            <span className="num w-5 text-center text-sm font-bold">{p}</span><span className="font-semibold">متاح — احجز</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sheet && <Sheet sheet={sheet} lab={lab} exps={exps} expById={expById} classes={myClasses} myTeacher={myTeacher} isManager={isManager}
                       onClose={() => setSheet(null)} onDone={(text) => { setSheet(null); setMsg({ ok: true, text }); load(); }}
                       onError={(text) => setMsg({ ok: false, text })} />}
    </div>
  );
}

function Sheet({ sheet, lab, exps, expById, classes, myTeacher, isManager, onClose, onDone, onError }) {
  const { date, period, dow, booking } = sheet;
  const today = todayISO();
  const [classId, setClassId] = useState(booking?.class_id ?? classes[0]?.class_id ?? "");
  const grade = classes.find((c) => c.class_id === classId)?.grade;
  const options = exps.filter((e) => e.is_active && (!grade || e.grade === grade));
  const [expId, setExpId] = useState(booking?.experiment_id ?? "");
  const [note, setNote] = useState(booking?.note ?? "");
  const [prepNote, setPrepNote] = useState(booking?.prep_note ?? "");
  const [run, setRun] = useState({ outcome: "lab", reason: "materials", reason_note: "" });
  const [busy, setBusy] = useState(false);
  const e = expById[booking?.experiment_id ?? expId];
  const mine = booking && booking.teacher_id === myTeacher;
  const teacherOf = (cid) => classes.find((c) => c.class_id === cid)?.teacher_id ?? myTeacher;

  const act = async (fn, ok) => { setBusy(true); const { error } = await fn(); setBusy(false); if (error) onError(setupMsg(error)); else onDone(ok); };
  const book = () => act(() => supabase.from("sci_bookings").insert({ lab, booking_date: date, period_no: period, teacher_id: teacherOf(classId),
    class_id: classId || null, experiment_id: expId || null, note: note.trim() || null }), "حُجزت الحصة، وسيجهّز المحضر التجربة.");
  const setPrep = (prep) => act(() => supabase.from("sci_bookings").update({ prep, prep_note: prepNote.trim() || null }).eq("id", booking.id),
    prep === "ready" ? "علّمت الحجز «جاهز»." : "سُجّلت ملاحظة التجهيز.");
  const cancel = () => act(() => supabase.from("sci_bookings").delete().eq("id", booking.id), "أُلغي الحجز.");
  const record = () => act(() => supabase.from("sci_runs").upsert({ academic_year: "", experiment_id: booking.experiment_id, class_id: booking.class_id,
    teacher_id: booking.teacher_id, run_date: date, outcome: run.outcome, reason: run.outcome === "not_done" ? run.reason : null,
    reason_note: run.reason_note.trim() || null }, { onConflict: "academic_year,experiment_id,class_id" }), "سُجّل تنفيذ التجربة في سجل التنفيذ.");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-4" onClick={(x) => x.stopPropagation()}>
        <p className="text-sm font-bold text-ink">{DAY_NAMES[dow]} <span className="num">{shortDate(date)}</span> · الحصة <span className="num">{period}</span></p>
        {booking ? (
          <div className="space-y-1 text-sm">
            <p><span className="text-muted">المعلم:</span> {booking.teachers?.full_name}{booking.classes && <> · فصل <span className="num">{booking.classes.class_no}</span></>}</p>
            {e && <p><span className="text-muted">التجربة:</span> <b>{e.title}</b> <span className="text-xs text-muted">({e.course} · {KIND[e.kind]} · ص <span className="num">{e.page}</span>)</span></p>}
            {booking.note && <p className="text-xs text-muted">ملاحظة المعلم: {booking.note}</p>}
            <p className="text-xs"><span className="text-muted">التجهيز:</span> {PREP[booking.prep]}{booking.prep_note && ` — ${booking.prep_note}`}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs text-muted">الفصل
              <select className="field mt-1 w-full" value={classId} onChange={(x) => { setClassId(x.target.value); setExpId(""); }}>
                {classes.length === 0 && <option value="">لا فصول لك في هذه المادة بجدولك</option>}
                {classes.map((c) => <option key={c.class_id + c.teacher_id} value={c.class_id}>فصل {c.class_no} · {c.subject}{isManager ? ` · ${c.teacher_name}` : ""}</option>)}
              </select>
            </label>
            <label className="block text-xs text-muted">التجربة من الخطة الفصلية
              <select className="field mt-1 w-full" value={expId} onChange={(x) => setExpId(Number(x.target.value) || "")}>
                <option value="">— اختر التجربة —</option>
                {options.map((x) => <option key={x.id} value={x.id}>{x.course} · {x.no}. {x.title}</option>)}
              </select>
            </label>
            <input className="field w-full" placeholder="ملاحظة للمحضر (اختيارية)" maxLength={200} value={note} onChange={(x) => setNote(x.target.value)} />
          </div>
        )}
        {e?.tools && <div className="rounded-sm2 bg-canvas px-3 py-2 text-xs leading-relaxed text-ink"><b className="text-mint-deep">أدوات التجربة:</b> {e.tools}</div>}

        {booking && isManager && booking.booking_date >= today && (
          <div className="space-y-2 border-t border-line pt-3">
            <input className="field w-full" placeholder="ملاحظة التجهيز (ما ينقص مثلًا)" maxLength={200} value={prepNote} onChange={(x) => setPrepNote(x.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => setPrep("ready")}>جاهز</button>
              <button className="btn-ghost" disabled={busy || !prepNote.trim()} onClick={() => setPrep("issue")}>ينقصه شيء</button>
            </div>
          </div>
        )}
        {booking && (mine || isManager) && booking.booking_date <= today && booking.experiment_id && booking.class_id && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs font-semibold text-ink">تسجيل التنفيذ في سجل التنفيذ</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(OUTCOME).map(([k, t]) => (
                <button key={k} type="button" onClick={() => setRun({ ...run, outcome: k })}
                        className={`rounded-pill px-3 py-1 text-xs font-semibold ${run.outcome === k ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`}>{t}</button>
              ))}
            </div>
            {run.outcome === "not_done" && (
              <select className="field w-full" value={run.reason} onChange={(x) => setRun({ ...run, reason: x.target.value })}>
                {Object.entries(REASON).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            )}
            <input className="field w-full" placeholder="ملاحظة (اختيارية)" maxLength={200} value={run.reason_note} onChange={(x) => setRun({ ...run, reason_note: x.target.value })} />
            <button className="btn-primary" disabled={busy} onClick={record}>حفظ في سجل التنفيذ</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {!booking && <button className="btn-primary" disabled={busy || !classId || !expId} onClick={book}>{busy ? "جارٍ الحجز…" : "احجز"}</button>}
          {booking && (mine || isManager) && booking.booking_date >= today && <button className="btn-ghost text-danger" disabled={busy} onClick={cancel}>إلغاء الحجز</button>}
          <button className="btn-ghost" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
