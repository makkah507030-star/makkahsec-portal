// src/components/GuardianMobileCard.jsx
// بطاقة تأكيد رقم جوال ولي الأمر (supabase/guardian_mobile.sql): يسأل ولي الأمر مرة كل فصل دراسي هل رقمه المسجل
// صحيح ومتاح على واتساب، فيؤكده أو يعدّله. تختفي البطاقة بعد الرد، ولا يظهر شيء قبل تشغيل الملف.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/friendlyError.js";

import { normMobile as norm, isMobile } from "../lib/mobile.js";

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
      if (!isMobile(a)) { setErr("الرقم غير صحيح، تأكد أنه رقم جوال سعودي مثل 0551234567."); return; }
      if (norm(a) !== norm(b)) { setErr("الرقمان غير متطابقين، اكتبه مرة أخرى."); return; }
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("gm_confirm", { p_mobile: mobile == null ? null : norm(mobile) });
    setBusy(false);
    if (error) { setErr(friendlyError(error.message)); return; }
    setDone(mobile == null ? "شكرًا لك، تم تأكيد رقم جوالك، وعليه تصلك رسائل المدرسة." : `شكرًا لك، تم تحديث رقم جوالك إلى ${data}، وعليه تصلك رسائل المدرسة.`);
  };

  return (
    <section className="card space-y-3 border-2 border-absent bg-absent/5 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-absent">
          <span className="rounded-full bg-absent px-2 py-0.5 text-[11px] text-white">مهم</span>
          تأكيد رقم جوالك لرسائل المدرسة
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {st.mobile ? <>رقم جوالك المسجل لدى المدرسة: <b dir="ltr" className="num text-ink">{norm(st.mobile)}</b>. هل هو رقمك الحالي المتاح على واتساب؟</>
            : "لا يوجد رقم جوال مسجل لك لدى المدرسة، فنأمل إضافته."}
          {" "}عليه نبلغك بغياب ابنك والتنبيهات المهمة.
        </p>
      </div>
      {!edit ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-absent px-5 py-2 text-sm font-semibold text-white hover:bg-absent/90 disabled:opacity-60" disabled={busy} onClick={() => save(null)}>نعم، رقمي صحيح</button>
          <button type="button" className="btn-ghost px-5 py-2 text-sm" disabled={busy} onClick={() => setEdit(true)}>تعديل الرقم</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className="field" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={a} onChange={(e) => setA(e.target.value)} />
          <p className="text-xs text-muted">اكتب الرقم بأي صيغة، مثل 0551234567 أو ‎+966 55 123 4567‎، وبالأرقام العربية أو الإنجليزية، وتحفظه البوابة بالصيغة الصحيحة.</p>
          <input className="field" dir="ltr" inputMode="tel" placeholder="أعد كتابة الرقم للتأكد" value={b} onChange={(e) => setB(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-xl bg-absent px-5 py-2 text-sm font-semibold text-white hover:bg-absent/90 disabled:opacity-60" disabled={busy} onClick={() => save(a)}>حفظ الرقم الجديد</button>
            <button type="button" className="btn-ghost px-5 py-2 text-sm" disabled={busy} onClick={() => { setEdit(false); setErr(""); }} hidden={!st.mobile}>إلغاء</button>
          </div>
        </div>
      )}
      {err && <p className="text-sm text-absent">{err}</p>}
    </section>
  );
}
