// src/components/LabRulesCard.jsx
// بطاقة صفحة الطالب: قواعد السلامة في معمل الحاسب الآلي تنتظر إقراره (مرة كل
// فصل دراسي). لا تظهر إلا لمن وُزّع على جهاز أو حُجز المعمل لفصله.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function LabRulesCard() {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc("lab_rules_mine").then(({ data }) => setR(data?.[0] ?? null), () => {});
  }, []);

  if (done) {
    return <p className="card px-4 py-3 text-sm text-present">شكرًا لك — سُجّل إقرارك بقواعد السلامة في معمل الحاسب الآلي.</p>;
  }
  if (!r?.required || r.acked_at) return null;

  const ack = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("lab_rules_ack");
    setBusy(false);
    if (!error) setDone(true);
  };

  return (
    <section className="card space-y-3 border-warning/30 p-4">
      <div>
        <p className="text-sm font-bold text-ink">قواعد السلامة في معمل الحاسب الآلي</p>
        <p className="text-xs text-muted">اقرأ القواعد، ثم أقرّ بالتزامك بها.</p>
      </div>
      <ol className="space-y-1.5">
        {(r.items ?? []).map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
            <span className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-tint text-[10px] font-bold text-mint-deep">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
      <button type="button" className="btn-primary w-full sm:w-auto" disabled={busy} onClick={ack}>
        {busy ? "جارٍ الحفظ…" : "قرأت القواعد وأتعهد بالالتزام بها"}
      </button>
    </section>
  );
}
