// src/pages/StudentNotes.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import StudentPicker, { studentClassLabel } from "../components/StudentPicker.jsx";
import PresetChips from "../components/PresetChips.jsx";
import { NoteChip } from "../components/StudentNoteChips.jsx";
import { NOTE_KINDS, isExpired, writableKinds } from "../lib/studentNotes.js";
import { fmtDate } from "../lib/dates";
import { useNotice } from "../lib/useNotice.js";
import Loader from "../components/Loader.jsx";

/* =====================================================================
   ملاحظات الطلاب — يكتبها كل موجه في نوعه: الموجه الصحي للصحية،
   والموجهون الطلابيون للسلوكية والنفسية، ومعهم المدير ووكيل شؤون الطلاب
   والدعم الفني. تظهر لمعلمي الطالب شارةً تحت اسمه في كشف التحضير.
   ===================================================================== */

const EMPTY = { student: null, kind: "", body: "", confidential: false, guardian_informed: false, review_until: "" };

export default function StudentNotes() {
  const { adminRoles, profile, session } = useSession();
  const kinds = useMemo(() => writableKinds(adminRoles), [adminRoles]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [list, setList] = useState(null);
  const [classes, setClasses] = useState({});    // student_id -> صفّه وفصله
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [missing, setMissing] = useState(false);
  const myName = profile?.full_name ?? "";

  const load = async () => {
    const { data, error } = await supabase.from("student_notes")
      .select("*, students(full_name)").order("updated_at", { ascending: false });
    if (error) { setMissing(true); setList([]); return; }
    const mine = (data ?? []).filter((n) => kinds.includes(n.kind));
    setList(mine);
    const ids = [...new Set(mine.map((n) => n.student_id))];
    if (ids.length) {
      const { data: st } = await supabase.from("v_active_students")
        .select("student_id, grade, class_no").in("student_id", ids);
      setClasses(Object.fromEntries((st ?? []).map((s) => [s.student_id, s])));
    }
  };

  useEffect(() => { if (kinds.length) load(); }, [kinds.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (kinds.length === 1) setForm((f) => ({ ...f, kind: f.kind || kinds[0] })); }, [kinds]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => { setForm({ ...EMPTY, kind: kinds.length === 1 ? kinds[0] : "" }); setEditing(null); };

  const save = async () => {
    if (!form.student || !form.kind || !form.body.trim()) return;
    setBusy(true);
    const row = {
      kind: form.kind, body: form.body.trim(), confidential: form.confidential,
      guardian_informed: form.guardian_informed, review_until: form.review_until || null,
    };
    const { error } = editing
      ? await supabase.from("student_notes")
          .update({ ...row, updated_by_name: myName, updated_at: new Date().toISOString() }).eq("id", editing)
      : await supabase.from("student_notes")
          .insert({ ...row, student_id: form.student.student_id, created_by: session?.user?.id, created_by_name: myName,
                    updated_by_name: myName });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: editing ? "حُدّثت الملاحظة." : "أُضيفت الملاحظة، وتظهر لمعلمي الطالب في كشف التحضير." });
    reset();
    load();
  };

  const edit = (n) => {
    setEditing(n.id);
    setForm({
      student: { student_id: n.student_id, full_name: n.students?.full_name ?? "", ...classes[n.student_id] },
      kind: n.kind, body: n.body, confidential: n.confidential, guardian_informed: n.guardian_informed,
      review_until: n.review_until ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggle = async (n) => {
    const { error } = await supabase.from("student_notes")
      .update({ is_active: !n.is_active, updated_by_name: myName, updated_at: new Date().toISOString() }).eq("id", n.id);
    if (error) setMsg({ ok: false, text: error.message }); else load();
  };

  const remove = async (n) => {
    if (!window.confirm(`حذف ملاحظة ${n.students?.full_name ?? "الطالب"} نهائيًا؟ يمكنك إيقافها بدل حذفها.`)) return;
    const { error } = await supabase.from("student_notes").delete().eq("id", n.id);
    if (error) setMsg({ ok: false, text: error.message }); else load();
  };

  if (!kinds.length) {
    return (
      <div className="card p-6 text-sm text-muted">
        هذه الصفحة للموجه الصحي والموجهين الطلابيين ووكيل شؤون الطلاب والمدير.
      </div>
    );
  }

  const shown = (list ?? []).filter((n) =>
    (filter === "all" || n.kind === filter) &&
    (!q.trim() || (n.students?.full_name ?? "").includes(q.trim())));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">ملاحظات الطلاب</h1>
        <p className="mt-0.5 text-sm text-muted">
          ملاحظات صحية وسلوكية ونفسية تظهر لمعلمي الطالب شارةً تحت اسمه في كشف التحضير.
          اكتب ما يفعله المعلم، لا التشخيص وحده.
        </p>
      </div>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>
      )}
      {missing && (
        <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">
          نفّذ ملف supabase/student_notes.sql في قاعدة البيانات مرة واحدة لتفعيل الملاحظات.
        </p>
      )}

      {/* الإضافة والتعديل */}
      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">{editing ? "تعديل ملاحظة" : "ملاحظة جديدة"}</h2>

        <div>
          <label className="text-xs text-muted">الطالب</label>
          <div className="mt-1">
            {editing
              ? <p className="text-sm font-semibold text-ink">{form.student?.full_name}
                  <span className="mr-2 text-xs font-normal text-muted">{studentClassLabel(form.student)}</span></p>
              : <StudentPicker value={form.student} onChange={(s) => set("student", s)} />}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted">نوع الملاحظة</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {kinds.map((k) => (
              <button key={k} type="button" onClick={() => set("kind", k)}
                className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  form.kind === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                {NOTE_KINDS[k].label}
              </button>
            ))}
          </div>
        </div>

        {form.kind && (
          <div>
            <label className="text-xs text-muted">الملاحظة وما يفعله المعلم</label>
            <PresetChips items={NOTE_KINDS[form.kind].presets} value={form.body} onChange={(v) => set("body", v)} />
            <textarea rows={4} className="field mt-1.5 w-full leading-relaxed" value={form.body}
                      placeholder="مثال: لديه ربو، ويُسمح له بالخروج فورًا عند ضيق التنفس."
                      onChange={(e) => set("body", e.target.value)} />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">تُراجع في (اختياري)</label>
            <input type="date" className="field num mt-1 w-full" value={form.review_until}
                   onChange={(e) => set("review_until", e.target.value)} />
            <p className="mt-1 text-[11px] text-faint">تختفي عن المعلمين بعد هذا التاريخ ما لم تُجدَّد.</p>
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={form.guardian_informed}
                     onChange={(e) => set("guardian_informed", e.target.checked)} />
              <span>أُبلغ ولي الأمر أو وافق</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={form.confidential}
                     onChange={(e) => set("confidential", e.target.checked)} />
              <span>سرية — لا تظهر للمعلمين
                <span className="block text-[11px] text-faint">تبقى عند كاتبيها والإدارة فقط.</span></span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy || !form.student || !form.kind || !form.body.trim()} onClick={save}>
            {editing ? "حفظ التعديل" : "إضافة الملاحظة"}
          </button>
          {editing && (
            <button className="rounded-sm2 border border-line px-4 py-2 text-sm text-muted hover:bg-canvas" onClick={reset}>
              إلغاء
            </button>
          )}
        </div>
      </section>

      {/* القائمة */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {["all", ...kinds].map((k) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className={`rounded-pill px-3 py-1 text-xs font-medium ${
                filter === k ? "bg-mint-deep text-white" : "border border-line text-muted hover:bg-canvas"}`}>
              {k === "all" ? "الكل" : NOTE_KINDS[k].label}
            </button>
          ))}
          <input className="field mr-auto w-44 py-1.5 text-sm" placeholder="بحث باسم الطالب" value={q}
                 onChange={(e) => setQ(e.target.value)} />
        </div>

        {list == null ? <div className="p-6"><Loader /></div> : (
          <div className="divide-y divide-line">
            {shown.length === 0 && <p className="px-4 py-6 text-sm text-muted">لا ملاحظات.</p>}
            {shown.map((n) => {
              const expired = isExpired(n);
              return (
                <div key={n.id} className={`px-4 py-3 ${!n.is_active || expired ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-ink">{n.students?.full_name}</p>
                    <span className="text-xs text-muted">{studentClassLabel(classes[n.student_id])}</span>
                    <NoteChip kind={n.kind} />
                    {n.confidential && <span className="chip bg-ink/10 text-ink">سرية</span>}
                    {!n.is_active && <span className="chip bg-canvas text-muted">موقوفة</span>}
                    {expired && <span className="chip bg-warning-light text-warning">انتهت مراجعتها</span>}
                    {n.guardian_informed && <span className="chip bg-present/10 text-present">أُبلغ ولي الأمر</span>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{n.body}</p>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-faint">
                      {n.updated_by_name || n.created_by_name || "—"} · {fmtDate(n.updated_at)}
                      {n.review_until && <> · تُراجع في <span className="num">{n.review_until}</span></>}
                    </p>
                    <div className="flex gap-3 text-xs font-semibold">
                      <button type="button" className="text-mint-deep hover:underline" onClick={() => edit(n)}>تعديل</button>
                      <button type="button" className="text-muted hover:underline" onClick={() => toggle(n)}>
                        {n.is_active ? "إيقاف" : "تفعيل"}
                      </button>
                      <button type="button" className="text-absent hover:underline" onClick={() => remove(n)}>حذف</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
