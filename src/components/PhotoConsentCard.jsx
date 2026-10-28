// src/components/PhotoConsentCard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";

/* =====================================================================
   موافقة التصوير السنوية في حساب ولي الأمر (supabase/media_2.sql): يسأل مرة في العام
   عن تصوير ابنه في فعاليات المدرسة لمعرضها الداخلي، ويبقى الردّ قابلًا للتغيير.
   لا يظهر شيء قبل تشغيل الملف.
   ===================================================================== */

export default function PhotoConsentCard({ studentId, name }) {
  const [st, setSt] = useState(undefined);      // undefined تحميل، null لا ردّ، أو الصف
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!studentId) return undefined;
    let live = true;
    setSt(undefined); setEdit(false); setErr("");
    (async () => {
      const { data: yr, error } = await supabase.rpc("media_year");
      if (error) { if (live) setSt(false); return; }          // الملف لم يُشغَّل
      const { data } = await supabase.from("media_consents").select("allowed, updated_at")
        .eq("student_id", studentId).eq("academic_year", yr).maybeSingle();
      if (live) setSt(data ?? null);
    })();
    return () => { live = false; };
  }, [studentId]);

  if (st === undefined || st === false) return null;
  const save = async (allowed) => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("media_consent_set", { p_student: studentId, p_allowed: allowed });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSt({ allowed, updated_at: new Date().toISOString() }); setEdit(false);
  };
  const first = (name ?? "").split(" ")[0] || "ابنك";

  if (st && !edit) {
    return (
      <section className="card flex items-center gap-3 px-4 py-3 text-sm">
        <span className={`chip shrink-0 ${st.allowed ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {st.allowed ? "موافق على التصوير" : "لا يُصوَّر"}
        </span>
        <p className="min-w-0 flex-1 truncate text-muted" title={fmtDate(st.updated_at)}>تصوير {first} لهذا العام</p>
        <button className="shrink-0 text-xs font-semibold text-mint-deep underline" onClick={() => setEdit(true)}>تغيير</button>
      </section>
    );
  }
  return (
    <section className="card space-y-3 border-2 border-late/40 p-4">
      <div>
        <p className="font-semibold text-ink">موافقة التصوير لهذا العام</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          هل توافق على ظهور {first} في صور فعاليات المدرسة ومقاطعها؟ يصوّرها فريق المدرسة بأجهزتها،
          وتُنشر في «معرض المدرسة» داخل حسابات البوابة فقط، ولا تُنشر في وسائل التواصل. ويمكنك تغيير ردّك متى شئت.
        </p>
      </div>
      {err && <p className="text-sm text-absent">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => save(true)}>أوافق</button>
        <button className="rounded-pill border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas" disabled={busy}
                onClick={() => save(false)}>لا أوافق</button>
        {st && <button className="text-xs text-muted underline" onClick={() => setEdit(false)}>إلغاء</button>}
      </div>
    </section>
  );
}
