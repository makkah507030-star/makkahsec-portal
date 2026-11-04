// src/components/GuardianMobileCard.jsx
// بطاقة تأكيد رقم جوال ولي الأمر (supabase/guardian_mobile.sql): يسأل ولي الأمر مرة كل فصل دراسي هل رقمه المسجل
// صحيح ومتاح على واتساب، فيؤكده أو يعدّله. تختفي البطاقة بعد الرد، ولا يظهر شيء قبل تشغيل الملف.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/friendlyError.js";

const norm = (v) => { const d = String(v ?? "").replace(/\D/g, ""); return /^9665\d{8}$/.test(d) ? `0${d.slice(3)}` : /^5\d{8}$/.test(d) ? `0${d}` : d; };

export default function GuardianMobileCard() {
  const [st, setSt] = useState(null);
  const [edit, setEdit] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let live = true;
    supabase.rpc("gm_my_status").then(({ data, error }) => { if (live && !error) { setSt(data?.[0] ?? null); setEdit(!data?.[0]?.mobile); } });
    return () => { live = false; };
  }, []);

  if (done) return <p className="card px-4 py-3 text-sm font-semibold text-present">{done}</p>;
  if (!st?.needs) return null;

  const save = async (mobile) => {
    setErr("");
    if (mobile != null) {
      if (!/^05\d{8}$/.test(norm(a))) { setErr("اكتب الرقم بصيغة 05xxxxxxxx (عشرة أرقام)."); return; }
      if (norm(a) !== norm(b)) { setErr("الرقمان غير متطابقين، اكتبه مرة أخرى."); return; }
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("gm_confirm", { p_mobile: mobile });
    setBusy(false);
    if (error) { setErr(friendlyError(error.message)); return; }
    setDone(mobile == null ? "شكرًا لك، تم تأكيد رقم جوالك، وعليه تصلك رسائل المدرسة." : `شكرًا لك، تم تحديث رقم جوالك إلى ${data}، وعليه تصلك رسائل المدرسة.`);
  };

  return (
    <section className="card space-y-3 border-2 border-late/40 p-4">
      <div>
        <p className="text-sm font-bold text-ink">تأكيد رقم جوالك لرسائل المدرسة</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {st.mobile ? <>رقم جوالك المسجل لدى المدرسة: <b dir="ltr" className="num text-ink">{norm(st.mobile)}</b>. هل هو رقمك الحالي المتاح على واتساب؟</>
            : "لا يوجد رقم جوال مسجل لك لدى المدرسة، فنأمل إضافته."}
          {" "}عليه نبلغك بغياب ابنك والتنبيهات المهمة.
        </p>
      </div>
      {!edit ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary px-5 py-2 text-sm" disabled={busy} onClick={() => save(null)}>نعم، رقمي صحيح</button>
          <button type="button" className="btn-ghost px-5 py-2 text-sm" disabled={busy} onClick={() => setEdit(true)}>تعديل الرقم</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className="field" dir="ltr" inputMode="numeric" placeholder="05xxxxxxxx" value={a} onChange={(e) => setA(e.target.value)} />
          <input className="field" dir="ltr" inputMode="numeric" placeholder="أعد كتابة الرقم للتأكد" value={b} onChange={(e) => setB(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary px-5 py-2 text-sm" disabled={busy} onClick={() => save(a)}>حفظ الرقم الجديد</button>
            <button type="button" className="btn-ghost px-5 py-2 text-sm" disabled={busy} onClick={() => { setEdit(false); setErr(""); }} hidden={!st.mobile}>إلغاء</button>
          </div>
        </div>
      )}
      {err && <p className="text-sm text-absent">{err}</p>}
    </section>
  );
}
