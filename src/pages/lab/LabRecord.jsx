// src/pages/lab/LabRecord.jsx
// سجل التطبيقات العملية: سجل خاص بمعلمي الحاسب لكل فصل في الفصل الدراسي الحالي.
// كل عمود «عمل» تُنقل درجاته من حصة معمل (نسبة اختبار الدرس × الدرجة العظمى)، أو يُضاف
// يدويًا، وكل خانة تُعدَّل وتبقى بعد التحديث من المعمل (computer_lab_9/10.sql).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { printReport } from "../../lib/exportUtils";
import { classText, isoOf, shortDate } from "../../lib/lab.js";
import Loader from "../../components/Loader.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const num = (v) => Number(v).toLocaleString("en", { maximumFractionDigits: 1 });
const dateOf = (d) => shortDate(String(d).slice(0, 10));

export default function LabRecord({ lab, canEdit }) {
  const [classes, setClasses] = useState(null);
  const [classId, setClassId] = useState("");
  const [rec, setRec] = useState(null);
  const [form, setForm] = useState(null);      // { kind: "session"|"manual"|"edit", ... }
  const [busy, setBusy] = useState(false);
  const [, setMsg] = useNotice(null);

  useEffect(() => { supabase.rpc("lab_classes", { p_lab: lab }).then(({ data }) => setClasses(data ?? [])); }, [lab]);

  const load = useCallback(async () => {
    if (!classId) { setRec(null); return; }
    const { data, error } = await supabase.rpc("lab_record", { p_lab: lab, p_class: classId });
    if (error) setMsg({ ok: false, text: "تعذّر تحميل السجل: " + error.message });
    setRec(data ?? { works: [], students: [], marks: [], sessions: [] });
  }, [lab, classId, setMsg]);
  useEffect(() => { setRec(null); load(); }, [load]);

  const marks = useMemo(() => {
    const m = {};
    (rec?.marks ?? []).forEach((x) => { m[`${x.w}:${x.s}`] = x; });
    return m;
  }, [rec]);
  const cls = classes?.find((c) => c.class_id === classId);
  const works = rec?.works ?? [];
  const maxSum = works.reduce((a, w) => a + Number(w.max), 0);
  const total = (sid) => works.reduce((a, w) => a + Number(marks[`${w.id}:${sid}`]?.m ?? 0), 0);

  const call = async (fn, args, ok) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return false; }
    if (ok) setMsg({ ok: true, text: ok });
    setForm(null); load();
    return true;
  };

  const saveMark = async (w, sid, raw) => {
    const v = String(raw).trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace("٫", ".");
    const cur = marks[`${w.id}:${sid}`]?.m;
    if ((v === "" && cur == null) || (v !== "" && Number(v) === Number(cur))) return;
    if (v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > Number(w.max))) {
      setMsg({ ok: false, text: `اكتب درجة من 0 إلى ${num(w.max)}` }); load(); return;
    }
    const { error } = await supabase.rpc("lab_mark_set", { p_work: w.id, p_student: sid, p_mark: v === "" ? null : Number(v) });
    if (error) setMsg({ ok: false, text: "تعذّر الحفظ: " + error.message });
    load();
  };

  const remove = async (w) => {
    const ok = await confirmDanger({ title: `حذف «${w.title}» من السجل؟`, impact: ["تُحذف درجات الطلاب في هذا العمل", "تبقى نتائج الحصة في المعمل، ويمكن نقلها من جديد"], level: "medium", confirmLabel: "حذف" });
    if (ok) call("lab_work_delete", { p_work: w.id }, "حُذف العمل");
  };

  const print = () => printReport({
    title: `سجل التطبيقات العملية — ${classText(cls)}`,
    subtitle: `معمل الحاسب الآلي · ${works.length} أعمال · المجموع من ${num(maxSum)}`,
    headers: ["م", "الطالب", ...works.map((w) => `${w.title} (${num(w.max)})`), `المجموع (${num(maxSum)})`],
    rows: rec.students.map((s, i) => [i + 1, s.name, ...works.map((w) => { const x = marks[`${w.id}:${s.id}`]; return x ? num(x.m) : "—"; }), num(total(s.id))]),
    landscape: works.length > 5,
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    signatures: [{ title: "معلم المادة", name: "" }],
  });

  if (classes === null) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="rec-class">الفصل</label>
          <select id="rec-class" className="field" value={classId} onChange={(e) => { setForm(null); setClassId(e.target.value); }}>
            <option value="">— اختر الفصل —</option>
            {classes.map((c) => <option key={c.class_id} value={c.class_id}>{classText(c)} · {c.students} طالبًا</option>)}
          </select>
        </div>
        {rec && (
          <div className="flex flex-wrap gap-2">
            {canEdit && <button type="button" className="btn-primary py-2" disabled={!rec.sessions.length}
                                title={rec.sessions.length ? "" : "لا توجد حصص معمل لهذا الفصل لم تُنقل"}
                                onClick={() => setForm({ kind: "session", session: rec.sessions[0].id, title: rec.sessions[0].title, max: "10" })}>
              نقل حصة معمل{rec.sessions.length ? ` (${rec.sessions.length})` : ""}
            </button>}
            {canEdit && <button type="button" className="btn-ghost py-2" onClick={() => setForm({ kind: "manual", title: "", max: "10", date: isoOf(new Date()) })}>عمل يدوي</button>}
            {works.length > 0 && <button type="button" className="btn-ghost py-2" onClick={print}>طباعة</button>}
          </div>
        )}
      </div>

      {form && <WorkForm form={form} setForm={setForm} sessions={rec?.sessions ?? []} busy={busy}
        onSubmit={() => {
          const max = Number(form.max);
          if (!(max > 0) || max > 100) { setMsg({ ok: false, text: "الدرجة العظمى من 0.5 إلى 100" }); return; }
          if (form.kind === "session") call("lab_work_from_session", { p_session: form.session, p_title: form.title, p_max: max }, "نُقلت درجات الحصة إلى السجل");
          else if (form.kind === "manual") form.title.trim() && call("lab_work_add", { p_lab: lab, p_class: classId, p_title: form.title, p_max: max, p_date: form.date }, "أُضيف العمل");
          else form.title.trim() && call("lab_work_update", { p_work: form.id, p_title: form.title, p_max: max }, "حُفظ التعديل");
        }} />}

      {!classId ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">
          اختر الفصل لعرض سجل التطبيقات العملية. تُنقل إليه درجات حصص المعمل، ويمكن إضافة أعمال يدوية وتعديل أي درجة.
        </div>
      ) : !rec ? <Loader /> : !works.length ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">
          لا أعمال في سجل {classText(cls)} لهذا الفصل الدراسي بعد.{rec.sessions.length > 0 && " ابدأ بنقل حصة معمل."}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-mint-tint text-mint-deep">
                <th className="sticky right-0 z-10 min-w-[9rem] border border-line bg-mint-tint px-2 py-2 text-start font-bold">الطالب</th>
                {works.map((w) => (
                  <th key={w.id} className="min-w-[5.5rem] border border-line px-1.5 py-1.5 align-top font-semibold">
                    <p className="leading-snug text-ink">{w.title}</p>
                    <p className="mt-0.5 text-[10px] font-normal text-muted">
                      <bdi className="num">{dateOf(w.date)}</bdi> · من <bdi className="num">{num(w.max)}</bdi>{!w.session && " · يدوي"}
                    </p>
                    {canEdit && (
                      <div className="mt-1 flex justify-center gap-2 text-[10px] font-normal">
                        {w.session && <button type="button" className="text-mint-deep underline" disabled={busy}
                                              onClick={() => call("lab_work_from_session", { p_session: w.session }, "حُدّث من نتائج المعمل")}>تحديث</button>}
                        <button type="button" className="text-muted underline" onClick={() => setForm({ kind: "edit", id: w.id, title: w.title, max: String(Number(w.max)) })}>تعديل</button>
                        <button type="button" className="text-muted underline" onClick={() => remove(w)}>حذف</button>
                      </div>
                    )}
                  </th>
                ))}
                <th className="min-w-[4.5rem] border border-line px-2 py-1.5 font-bold">المجموع<p className="num text-[10px] font-normal text-muted">من {num(maxSum)}</p></th>
              </tr>
            </thead>
            <tbody>
              {rec.students.map((s) => (
                <tr key={s.id} className="even:bg-canvas/50">
                  <td className="sticky right-0 border border-line bg-paper px-2 py-1 text-ink">{s.name}</td>
                  {works.map((w) => {
                    const x = marks[`${w.id}:${s.id}`];
                    return (
                      <td key={w.id} className={`border border-line p-0 text-center ${x?.manual ? "bg-warning-light/50" : ""}`}>
                        {canEdit ? (
                          <input key={`${x?.m ?? ""}`} dir="ltr" inputMode="decimal" defaultValue={x ? num(x.m) : ""}
                                 className="num w-full bg-transparent px-1 py-1.5 text-center outline-none focus:bg-mint-tint"
                                 onBlur={(e) => saveMark(w, s.id, e.target.value)}
                                 onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                        ) : <span className="num">{x ? num(x.m) : "—"}</span>}
                      </td>
                    );
                  })}
                  <td className="num border border-line px-2 py-1 text-center font-bold text-ink">{num(total(s.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-muted">الخانة المظللة عُدّلت يدويًا، ولا يغيّرها «تحديث» من المعمل. الخانة الفارغة: لم يُنفّذ.</p>
        </div>
      )}
    </div>
  );
}

function WorkForm({ form, setForm, sessions, busy, onSubmit }) {
  const set = (patch) => setForm({ ...form, ...patch });
  return (
    <div className="card space-y-3 p-4">
      <p className="text-base font-bold text-ink">{form.kind === "session" ? "نقل حصة معمل إلى السجل" : form.kind === "manual" ? "عمل يدوي" : "تعديل العمل"}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {form.kind === "session" && (
          <div className="sm:col-span-3">
            <label className="label" htmlFor="wf-s">الحصة</label>
            <select id="wf-s" className="field" value={form.session}
                    onChange={(e) => { const s = sessions.find((x) => x.id === e.target.value); set({ session: s.id, title: s.title }); }}>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.title} · {dateOf(s.at)} · رُصد {s.scanned}</option>)}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="wf-t">اسم العمل</label>
          <input id="wf-t" className="field" value={form.title} placeholder="مثل: تطبيق تمثيل البيانات" onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="wf-m">الدرجة العظمى</label>
          <input id="wf-m" dir="ltr" inputMode="decimal" className="field num text-center" value={form.max} onChange={(e) => set({ max: e.target.value })} />
        </div>
        {form.kind === "manual" && (
          <div>
            <label className="label" htmlFor="wf-d">التاريخ</label>
            <input id="wf-d" type="date" className="field" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
        )}
      </div>
      {form.kind === "session" && <p className="text-xs text-muted">درجة الطالب = نسبة اختبار الدرس × الدرجة العظمى، مقرّبة لأقرب نصف درجة. ومن يُرصد لاحقًا يُضاف بزر «تحديث» في رأس العمود.</p>}
      {form.kind === "edit" && <p className="text-xs text-muted">تغيير الدرجة العظمى يعيد حساب درجات الطلاب بالنسبة نفسها.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost py-2" onClick={() => setForm(null)}>إلغاء</button>
        <button type="button" className="btn-primary py-2" disabled={busy || !String(form.title).trim()} onClick={onSubmit}>
          {busy ? "جارٍ الحفظ…" : form.kind === "session" ? "نقل" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
