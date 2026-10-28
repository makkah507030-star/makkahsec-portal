// src/components/StaffCallsCard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";

/* =====================================================================
   فرص القيادة في رئيسية المعلم والإداري (supabase/nominations_7.sql): إعلانات الترشيحات التي
   تطلب معلمًا لقيادة الفريق، فيترشّح بنبذة عن خبرته أو ينسحب، ويرى القرار حين يصدر.
   لا يظهر شيء إن لم يكن هناك إعلان مفتوح أو لم يُشغَّل الملف.
   ===================================================================== */

const STAGE = {
  applied:   { t: "ترشّحت", c: "bg-mint-tint text-mint-deep" },
  accepted:  { t: "اختِرت", c: "bg-present/10 text-present" },
  rejected:  { t: "لم تُختر هذه المرة", c: "bg-canvas text-muted" },
  withdrawn: { t: "انسحبت", c: "bg-canvas text-muted" },
};

export default function StaffCallsCard() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);        // الإعلان المفتوح نموذجه
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => supabase.rpc("nom_staff_calls").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  if (!rows.length) return null;

  const send = async (c, text) => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("nom_staff_apply", { p_call: c.id, p_note: text });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(null); setNote(""); load();
  };

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">فرص القيادة</h2>
      {rows.map((c) => {
        const st = STAGE[c.stage];
        const canApply = !c.stage || c.stage === "withdrawn";
        return (
          <div key={c.id} className="space-y-2 border-b border-line px-4 py-3 last:border-0">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{c.staff_lead}</p>
                <p className="text-xs text-muted">{c.title} · {c.owner_name} · حتى <span className="num">{fmtDate(c.closes_on + "T12:00:00")}</span></p>
              </div>
              {st && <span className={`chip shrink-0 ${st.c}`}>{st.t}</span>}
            </div>
            {c.body && <p className="text-sm leading-relaxed text-muted">{c.body}</p>}
            {open === c.id ? (
              <div className="space-y-2">
                <textarea className="field min-h-[80px] w-full" value={note} maxLength={600} onChange={(e) => setNote(e.target.value)}
                          placeholder="نبذة عن خبرتك في المجال وما تقترحه للفريق" />
                {err && <p className="text-sm text-absent">{err}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy || !note.trim()} onClick={() => send(c, note)}>إرسال الترشّح</button>
                  <button className="text-sm text-muted underline" onClick={() => { setOpen(null); setErr(""); }}>إلغاء</button>
                </div>
              </div>
            ) : canApply ? (
              <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => { setOpen(c.id); setNote(""); }}>أترشّح</button>
            ) : c.stage === "applied" && (
              <button className="text-xs text-muted underline" disabled={busy} onClick={() => send(c, null)}>سحب الترشّح</button>
            )}
          </div>
        );
      })}
    </section>
  );
}
