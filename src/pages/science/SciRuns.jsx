// src/pages/science/SciRuns.jsx
// سجل تنفيذ التجارب العملية (و.م.ع.ن-08-04): لكل فصل تجارب مقرره، ويسجّل المعلم تاريخ التنفيذ ومكانه
// (المختبر أو افتراضيًا) أو سبب عدم التنفيذ، ويعتمده المحضر. ويُطبع بالنموذج الرسمي لكل فصل.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { todayISO } from "../../lib/schoolTime";
import Loader from "../../components/Loader.jsx";
import { OUTCOME, REASON, coursesOf, setupMsg } from "../../lib/sciLab.js";

const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[13px] font-semibold ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`;
const TONE = { lab: "bg-present/10 text-present", virtual: "bg-excused/10 text-excused", not_done: "bg-danger-light text-danger" };

export default function SciRuns({ lab, exps, classes, myTeacher, isManager, onPrint }) {
  const courses = coursesOf(exps);
  const [course, setCourse] = useState(courses[0] ?? "");
  const grade = exps.find((e) => e.course === course)?.grade;
  // فصول المقرر: بصفه، وللمعلم فصوله وحده
  const cls = useMemo(() => {
    const m = new Map();
    classes.filter((c) => c.grade === grade && (isManager || c.teacher_id === myTeacher)).forEach((c) => m.set(c.class_id, c));
    return [...m.values()];
  }, [classes, grade, isManager, myTeacher]);
  const [classId, setClassId] = useState("");
  useEffect(() => { setClassId((v) => (cls.some((c) => c.class_id === v) ? v : cls[0]?.class_id ?? "")); }, [cls]);
  const [runs, setRuns] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const list = exps.filter((e) => e.course === course && e.is_active);

  const load = useCallback(async () => {
    if (!classId) { setRuns([]); return; }
    setRuns(null);
    const { data, error } = await supabase.from("sci_runs").select("*, teachers(full_name), classes(class_no, grade)")
      .eq("class_id", classId).in("experiment_id", exps.filter((e) => e.course === course).map((e) => e.id));
    if (error) setMsg({ ok: false, text: setupMsg(error) });
    setRuns(data ?? []);
  }, [classId, course, exps, setMsg]);
  useEffect(() => { load(); }, [load]);
  const byExp = useMemo(() => Object.fromEntries((runs ?? []).map((r) => [r.experiment_id, r])), [runs]);
  const klass = cls.find((c) => c.class_id === classId);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("sci_runs").upsert({ academic_year: "", experiment_id: form.e.id, class_id: classId,
      teacher_id: form.r?.teacher_id ?? klass?.teacher_id ?? myTeacher, run_date: form.date, outcome: form.outcome,
      reason: form.outcome === "not_done" ? form.reason : null, reason_note: form.note.trim() || null },
      { onConflict: "academic_year,experiment_id,class_id" });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: setupMsg(error) }); return; }
    setForm(null); load();
  };
  const confirm = async (r, on) => {
    const { error } = await supabase.from("sci_runs").update({ confirmed_at: on ? new Date().toISOString() : null }).eq("id", r.id);
    if (error) setMsg({ ok: false, text: setupMsg(error) }); else load();
  };
  const remove = async (r) => {
    const { error } = await supabase.from("sci_runs").delete().eq("id", r.id);
    if (error) setMsg({ ok: false, text: setupMsg(error) }); else load();
  };

  const done = (runs ?? []).filter((r) => r.outcome !== "not_done").length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">{courses.map((c) => <button key={c} className={pill(c === course)} onClick={() => setCourse(c)}>{c}</button>)}</div>
      {cls.length === 0 ? <p className="card px-4 py-6 text-sm text-muted">لا فصول لهذا المقرر في الجدول الدراسي{isManager ? "" : " باسمك"}.</p> : (
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {cls.map((c) => <option key={c.class_id} value={c.class_id}>فصل {c.class_no} · {c.teacher_name}</option>)}
          </select>
          {runs && <span className="text-xs text-muted">نُفّذ <b className="num text-ink">{done}</b> من <span className="num">{list.length}</span> تجربة</span>}
          {isManager && <button className="btn-primary ms-auto px-4 py-1.5 text-sm" disabled={!runs} onClick={() => onPrint(course, klass)}>طباعة السجل</button>}
        </div>
      )}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-danger-light text-danger"}`}>{msg.text}</p>}
      {classId && (runs === null ? <Loader /> : (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {list.map((e) => {
            const r = byExp[e.id];
            const canEdit = isManager || klass?.teacher_id === myTeacher;
            return (
              <div key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num w-6 text-center text-xs font-bold text-mint-deep">{e.no}</span>
                  <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{e.title}</p>
                  {r ? <span className={`chip ${TONE[r.outcome]}`}>{OUTCOME[r.outcome]}</span> : <span className="chip bg-canvas text-faint">لم تُسجّل</span>}
                  {r?.confirmed_at && <span className="chip bg-mint-tint text-mint-deep">✓ اعتمدها المحضر</span>}
                </div>
                {r && (
                  <p className="mt-1 pe-8 text-xs text-muted">
                    <span className="num">{fmtDate(r.run_date + "T12:00:00")}</span> · {r.teachers?.full_name}
                    {r.outcome === "not_done" && <> · {REASON[r.reason]}</>}{r.reason_note && <> · {r.reason_note}</>}
                  </p>
                )}
                {form?.e.id === e.id ? (
                  <div className="mt-2 space-y-2 rounded-sm2 bg-canvas p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(OUTCOME).map(([k, t]) => <button key={k} type="button" className={pill(form.outcome === k)} onClick={() => setForm({ ...form, outcome: k })}>{t}</button>)}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input type="date" className="field num" value={form.date} max={todayISO()} onChange={(x) => setForm({ ...form, date: x.target.value })} />
                      {form.outcome === "not_done" && (
                        <select className="field" value={form.reason} onChange={(x) => setForm({ ...form, reason: x.target.value })}>
                          {Object.entries(REASON).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                        </select>
                      )}
                    </div>
                    <input className="field w-full" placeholder="ملاحظة (اختيارية)" maxLength={200} value={form.note} onChange={(x) => setForm({ ...form, note: x.target.value })} />
                    <div className="flex gap-2">
                      <button className="btn-primary" disabled={busy || !form.date} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
                      <button className="btn-ghost" onClick={() => setForm(null)}>إلغاء</button>
                    </div>
                  </div>
                ) : canEdit && (
                  <div className="mt-1.5 flex flex-wrap gap-3 pe-8 text-xs">
                    <button className="font-semibold text-mint-deep" onClick={() => setForm({ e, r, outcome: r?.outcome ?? "lab", reason: r?.reason ?? "materials", note: r?.reason_note ?? "", date: r?.run_date ?? todayISO() })}>
                      {r ? "تعديل" : "تسجيل التنفيذ"}</button>
                    {r && isManager && <button className="font-semibold text-mint-deep" onClick={() => confirm(r, !r.confirmed_at)}>{r.confirmed_at ? "إلغاء الاعتماد" : "اعتماد"}</button>}
                    {r && <button className="text-danger" onClick={() => remove(r)}>حذف</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
