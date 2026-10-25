// src/pages/achievement/MyQiyas.jsx
/* =====================================================================
   نتائج قياس للطالب (/my-qiyas) — supabase/qiyas_results.sql و _2.
   النتيجة خاصة بالطالب ولا تصل المدرسة من قياس، فيُدخلها هنا بصورة إثباتها (صورة الشاشة
   أو شهادة النتيجة)، فتتحقق منها لجنة التحصيل. ولولي الأمر عرض نتائج أبنائه.
   ===================================================================== */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";

const TESTS = [
  { k: "qudrat", t: "القدرات العامة" },
  { k: "tahsili", t: "التحصيلي" },
  { k: "step", t: "STEP" },
];
const STATUS = {
  pending: { t: "بانتظار التحقق", c: "bg-warning/10 text-warning" },
  verified: { t: "معتمدة", c: "bg-present/10 text-present" },
  rejected: { t: "لم تُعتمد", c: "bg-absent/10 text-absent" },
};

export default function MyQiyas() {
  const { profile, effectiveRole } = useSession();
  const isStudent = effectiveRole === "student";
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState(null);       // { test, attempt, score, taken_on, file }
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("qiyas_results")
      .select("id, test, attempt, score, taken_on, status, source, reject_reason, students(full_name)").order("created_at", { ascending: false });
    if (error) { setErr(/qiyas_results/.test(error.message) ? "الخدمة غير مفعّلة بعد." : error.message); setRows([]); return; }
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const score = Number(form.score);
    if (!(score >= 0 && score <= 100) || form.score === "") { setMsg({ ok: false, text: "اكتب الدرجة من 0 إلى 100." }); return; }
    if (!form.file && !form.id) { setMsg({ ok: false, text: "أرفق صورة النتيجة من حسابك في قياس لتتحقق منها اللجنة." }); return; }
    setBusy(true); setMsg(null);
    let path = null;
    if (form.file) {
      const ext = (form.file.name.split(".").pop() || "jpg").toLowerCase();
      path = `${profile.id}/${form.test}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("qiyas-proofs").upload(path, form.file, { contentType: form.file.type });
      if (error) { setBusy(false); setMsg({ ok: false, text: "تعذّر رفع الصورة: " + error.message }); return; }
    }
    const { error } = await supabase.rpc("qiyas_submit", { p_test: form.test, p_attempt: form.attempt, p_score: score,
      p_taken_on: form.taken_on || null, p_proof: path });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setForm(null); setMsg({ ok: true, text: "أُرسلت نتيجتك، وتظهر معتمدة بعد تحقق لجنة التحصيل." }); load();
  };

  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">نتائج قياس</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {isStudent
            ? "نتائجك في القدرات والتحصيلي واختبار STEP: تسجّلها المدرسة رسميًا متى وصلها تقرير المركز، ولك اختياريًا إدخالها الآن مع صورة النتيجة من حسابك في قياس لتتحقق منها لجنة التحصيل وتدعمك مبكرًا."
            : "نتائج أبنائك في اختبارات قياس كما أدخلوها، وحالة تحقق لجنة التحصيل منها."}
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {isStudent && !form && !err && (
        <button onClick={() => setForm({ test: "qudrat", attempt: "المحاولة الأولى", score: "", taken_on: "", file: null })}
                className="rounded-pill bg-mint-deep px-4 py-2 text-sm font-semibold text-white">+ إدخال نتيجتي (اختياري)</button>
      )}
      {form && (
        <section className="card space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            {TESTS.map((t) => (
              <button key={t.k} onClick={() => setForm({ ...form, test: t.k })}
                      className={`rounded-card border px-2 py-2.5 text-sm font-semibold ${form.test === t.k ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-ink"}`}>{t.t}</button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[11.5px] text-muted">الدرجة (من 100)<input className="field num mt-1 w-full" dir="ltr" inputMode="decimal" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></label>
            <label className="text-[11.5px] text-muted">المحاولة<input className="field mt-1 w-full" value={form.attempt} onChange={(e) => setForm({ ...form, attempt: e.target.value })} /></label>
            <label className="text-[11.5px] text-muted">تاريخ الاختبار (اختياري)<input type="date" className="field mt-1 w-full" value={form.taken_on} onChange={(e) => setForm({ ...form, taken_on: e.target.value })} /></label>
          </div>
          <label className="block text-[11.5px] text-muted">صورة النتيجة من حسابك في قياس (صورة أو PDF، حتى 5 ميجابايت)
            <input type="file" accept="image/*,application/pdf" className="mt-1 block text-sm" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
          </label>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="rounded-pill bg-mint-deep px-4 py-2 text-xs font-semibold text-white">{busy ? "…" : "إرسال للتحقق"}</button>
            <button onClick={() => setForm(null)} className="rounded-pill border border-line bg-white px-4 py-2 text-xs text-muted">إلغاء</button>
          </div>
        </section>
      )}

      {rows.length === 0 && !err && <p className="card px-4 py-8 text-center text-sm text-muted">لا نتائج بعد.</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="num text-2xl font-bold text-ink">{r.score}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{TESTS.find((t) => t.k === r.test)?.t} · {r.attempt}</span>
              <span className="block text-[11.5px] text-muted">
                {!isStudent && r.students?.full_name && <>{r.students.full_name} · </>}
                {r.taken_on && <span className="num">{fmtDate(r.taken_on)}</span>}
                {r.status === "rejected" && r.reject_reason && <> · السبب: {r.reject_reason}</>}
              </span>
            </span>
            <span className={`chip text-[11px] font-semibold ${STATUS[r.status].c}`}>{r.source === "official" ? "رسمية من تقرير المركز" : STATUS[r.status].t}</span>
            {isStudent && r.status === "rejected" && r.source === "student" && (
              <button onClick={() => setForm({ id: r.id, test: r.test, attempt: r.attempt, score: String(r.score), taken_on: r.taken_on ?? "", file: null })}
                      className="text-xs font-semibold text-mint-deep">تصحيح</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
