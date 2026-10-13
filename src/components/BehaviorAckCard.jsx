// src/components/BehaviorAckCard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";

/* =====================================================================
   ملاحظات سلوكية تنتظر إقرار الطالب — الخطوة الثانية من تدرج المعلم قبل
   الإحالة (تدوين المخالفة)، يقرّ بها الطالب إلكترونيًا بدل التوقيع الورقي.
   (supabase/behavior_steps_ack.sql) لا يظهر إن لم يكن له ما ينتظر إقراره.
   ===================================================================== */
export default function BehaviorAckCard() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = () => supabase.rpc("my_pending_records").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);

  const ack = async (id) => {
    setBusy(id);
    await supabase.rpc("ack_student_record", { p_action: id });
    setBusy(null);
    load();
  };

  if (!rows.length) return null;
  return (
    <section className="card space-y-2 border-warning/30 p-4">
      <p className="text-sm font-bold text-ink">ملاحظات سلوكية تنتظر إقرارك</p>
      <p className="text-xs leading-relaxed text-muted">
        دوّن معلمك الملاحظة التالية. اقرأها ثم أقرّ بالاطلاع — إقرارك بديل توقيعك على ورقة التدوين.
      </p>
      {rows.map((r) => (
        <div key={r.id} className="rounded-sm2 border border-line bg-canvas/60 p-3">
          <p className="text-sm text-ink">{r.violation_text}</p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {r.teacher_name} · <span className="num">{fmtDate(r.action_date + "T12:00:00")}</span>
          </p>
          <button className="btn-primary mt-2 px-4 py-1.5 text-sm" disabled={busy === r.id} onClick={() => ack(r.id)}>
            {busy === r.id ? "جارٍ الحفظ…" : "اطّلعت وأقرّ بذلك"}
          </button>
        </div>
      ))}
    </section>
  );
}
