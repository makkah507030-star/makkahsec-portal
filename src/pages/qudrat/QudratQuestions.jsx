// src/pages/qudrat/QudratQuestions.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import Loader from "../../components/Loader.jsx";
import { SECS, SKILLS } from "../../qudrat-content/index.js";

/* =====================================================================
   أسئلة المعلمين في مركز التدريب (القدرات): المعلم يضيف أسئلة بصيغة البنك
   (نص وأربعة خيارات وتلميح وطريقة حل، وقيمتا المقارنة أو نص قطعة إن لزم)،
   فتظهر للطلاب في التدريب مع الأسئلة الرسمية. يعدّل أسئلته ويخفيها،
   والمدير ووكيل الشؤون التعليمية والدعم الفني يديرون الكل (qudrat_1.sql).
   ===================================================================== */

const LETTERS = ["أ", "ب", "ج", "د"];
const EMPTY = { sec: "quant", skill: "arith", q: "", o: ["", "", "", ""], a: 0, hint: "", method: "", cmp: ["", ""], passage: "", published: true };

export default function QudratQuestions() {
  const { session, effectiveRole, adminRoles } = useSession();
  const uid = session?.user?.id;
  const manager = effectiveRole === "admin" && ["principal", "deputy_academic", "tech_support"].some((r) => adminRoles.includes(r));
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [form, setForm] = useState(null);   // null = القائمة
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("qudrat_questions").select("*").order("created_at", { ascending: false });
    if (error) setErr(/qudrat_questions/.test(error.message) ? "المركز غير مفعّل بعد: يلزم تشغيل ملف supabase/qudrat_1.sql." : error.message);
    setRows(data ?? []);
    const ids = [...new Set((data ?? []).map((r) => r.created_by).filter(Boolean))];
    if (ids.length) {
      const { data: ts } = await supabase.from("teachers").select("user_id, full_name").in("user_id", ids);
      setNames(Object.fromEntries((ts ?? []).map((t) => [t.user_id, t.full_name])));
    }
  };
  useEffect(() => { load(); }, []);

  if (rows === null) return <Loader />;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isCmp = form?.skill === "compare";

  const save = async () => {
    setErr("");
    if (!form.q.trim()) return setErr("اكتب نص السؤال.");
    if (isCmp ? form.cmp.some((x) => !x.trim()) : form.o.some((x) => !x.trim())) return setErr(isCmp ? "اكتب القيمتين." : "اكتب الخيارات الأربعة.");
    setBusy(true);
    const row = {
      sec: SKILLS[form.skill].sec, skill: form.skill, q: form.q.trim(), a: form.a,
      o: isCmp ? ["1", "2", "3", "4"] : form.o.map((x) => x.trim()),   // خيارات المقارنة ثابتة في العرض
      cmp: isCmp ? form.cmp.map((x) => x.trim()) : null,
      hint: form.hint.trim() || null, method: form.method.trim() || null,
      passage: form.passage.trim() || null, published: form.published, updated_at: new Date().toISOString(),
    };
    const { error } = form.id ? await supabase.from("qudrat_questions").update(row).eq("id", form.id)
      : await supabase.from("qudrat_questions").insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
    setForm(null); load();
  };
  const remove = async () => {
    if (!window.confirm("حذف السؤال نهائيًا؟")) return;
    const { error } = await supabase.from("qudrat_questions").delete().eq("id", form.id);
    if (error) return setErr(error.message);
    setForm(null); load();
  };

  if (form) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <button className="text-sm font-semibold text-muted hover:text-ink" onClick={() => { setForm(null); setErr(""); }}>رجوع إلى الأسئلة</button>
        <section className="card space-y-3 px-4 py-4">
          <h1 className="font-bold text-ink">{form.id ? "تعديل سؤال" : "سؤال جديد"}</h1>
          <label className="block text-sm">
            <span className="text-muted">المهارة</span>
            <select className="field mt-1" value={form.skill} onChange={(e) => set("skill", e.target.value)}>
              {Object.entries(SECS).map(([s, S]) => (
                <optgroup key={s} label={`القسم ${S.t}`}>
                  {Object.entries(SKILLS).filter(([, k]) => k.sec === s).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {form.skill === "reading" || form.skill === "stats" ? (
            <label className="block text-sm">
              <span className="text-muted">{form.skill === "reading" ? "نص القطعة" : "المعطيات المشتركة (اختياري)"}</span>
              <textarea className="field mt-1 min-h-[7rem]" value={form.passage} onChange={(e) => set("passage", e.target.value)}
                        placeholder="كل فقرة في سطر. ضع الكلمة المميزة بين نجمتين مزدوجتين: **كلمة**" />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-muted">نص السؤال</span>
            <textarea className="field mt-1 min-h-[4.5rem]" value={form.q} onChange={(e) => set("q", e.target.value)} />
          </label>
          {isCmp ? (
            <div className="grid grid-cols-2 gap-2">
              {["القيمة الأولى", "القيمة الثانية"].map((t, k) => (
                <label key={t} className="block text-sm"><span className="text-muted">{t}</span>
                  <input className="field mt-1" value={form.cmp[k]} onChange={(e) => set("cmp", form.cmp.map((x, j) => (j === k ? e.target.value : x)))} /></label>
              ))}
              <label className="col-span-2 block text-sm"><span className="text-muted">الإجابة الصحيحة</span>
                <select className="field mt-1" value={form.a} onChange={(e) => set("a", Number(e.target.value))}>
                  {["القيمة الأولى أكبر", "القيمة الثانية أكبر", "متساويتان", "المعطيات غير كافية"].map((t, k) => <option key={t} value={k}>{t}</option>)}
                </select></label>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted">الخيارات — اضغط الحرف لتحديد الإجابة الصحيحة</p>
              {form.o.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <button type="button" onClick={() => set("a", k)}
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold ${form.a === k ? "bg-present text-white" : "bg-canvas text-ink"}`}>{LETTERS[k]}</button>
                  <input className="field" value={o} onChange={(e) => set("o", form.o.map((x, j) => (j === k ? e.target.value : x)))} />
                </div>
              ))}
            </div>
          )}
          <label className="block text-sm"><span className="text-muted">تلميح قبل الحل (لا يكشف الإجابة)</span>
            <input className="field mt-1" value={form.hint} onChange={(e) => set("hint", e.target.value)} /></label>
          <label className="block text-sm"><span className="text-muted">طريقة الحل</span>
            <textarea className="field mt-1 min-h-[4.5rem]" value={form.method} onChange={(e) => set("method", e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} /> يظهر للطلاب
          </label>
          {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? "جاري الحفظ…" : "حفظ"}</button>
            {form.id && <button className="btn-ghost text-absent" onClick={remove}>حذف</button>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link to="/qudrat" className="text-xs font-semibold text-mint-deep">مركز التدريب</Link>
          <h1 className="text-lg font-bold text-ink">أسئلة المعلمين</h1>
          <p className="mt-1 text-sm text-muted">أضف أسئلة على مهارات القدرات لتظهر لطلاب المدرسة في التدريب مع الأسئلة الرسمية.</p>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}>سؤال جديد</button>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {!rows.length ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">لا أسئلة بعد. ابدأ بإضافة سؤال.</p>
      ) : (
        <div className="card divide-y divide-line/60">
          {rows.map((r) => (
            <button key={r.id} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-right hover:bg-canvas"
                    disabled={r.created_by !== uid && !manager}
                    onClick={() => setForm({ ...EMPTY, ...r, hint: r.hint ?? "", method: r.method ?? "", passage: r.passage ?? "", cmp: r.cmp ?? ["", ""] })}>
              <span className={`chip ${SECS[r.sec]?.bg} ${SECS[r.sec]?.c}`}>{SKILLS[r.skill]?.t ?? r.skill}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.q}</span>
              {!r.published && <span className="chip bg-canvas text-muted">مخفي</span>}
              <span className="text-xs text-faint">{names[r.created_by] ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
