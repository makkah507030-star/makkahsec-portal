// src/components/AbsenceExcuse.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtHijri, fmtGreg, fmtDateTime } from "../lib/dates";

/* =====================================================================
   أعذار الغياب (supabase/absence_excuses_1..2.sql): يرفعها الطالب أو ولي أمره من
   «سجل الغياب والتأخر»، ويقرر فيها وكيل شؤون الطلاب، فيصير الغياب «غائب بعذر» عند القبول.
   ===================================================================== */

export const EXCUSE_BUCKET = "absence-excuses";
export const EXCUSE_KIND = { medical: "عذر مرضي", other: "ظرف آخر" };
export const EXCUSE_STATUS = {
  pending:  { t: "العذر قيد المراجعة", short: "قيد المراجعة", c: "bg-warning/10 text-warning" },
  accepted: { t: "قُبل العذر",         short: "مقبول",        c: "bg-excused/10 text-excused" },
  rejected: { t: "لم يُقبل العذر",     short: "غير مقبول",    c: "bg-absent/10 text-absent" },
};
const dayName = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("ar-SA", { weekday: "long" });
export const dayLabel = (d) => `${dayName(d)} ${fmtHijri(d)}`;

/* أعذار الطالب، وخريطة اليوم ← آخر عذر له؛ null قبل تشغيل ملف SQL */
export function useExcuses(studentId) {
  const [list, setList] = useState(null);
  const load = () => supabase.from("absence_excuses").select("*").eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .then(({ data, error }) => setList(error ? null : data ?? []));
  useEffect(() => { if (studentId) load(); }, [studentId]);   // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = {};
  [...(list ?? [])].reverse().forEach((e) => (e.dates ?? []).forEach((d) => { byDay[d] = e; }));
  return { list, byDay, reload: load };
}

export async function openExcuseFile(path) {
  const { data, error } = await supabase.storage.from(EXCUSE_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("تعذّر فتح المرفق.");
  window.open(data.signedUrl, "_blank", "noopener");
}

/* نموذج رفع العذر: الأيام (من أيام الغياب بلا عذر)، والنوع، والسبب، والمرفق */
export function ExcuseForm({ studentId, days, initial, onDone, onCancel }) {
  const [picked, setPicked] = useState(() => new Set(initial ? [initial] : []));
  const [kind, setKind] = useState("medical");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (d) => setPicked((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`;

  const send = async () => {
    setBusy(true); setErr("");
    let file_path = null;
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      file_path = `${studentId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(EXCUSE_BUCKET).upload(file_path, file, { contentType: file.type });
      if (error) { setBusy(false); setErr(`تعذّر رفع المرفق: ${error.message}`); return; }
    }
    const { error } = await supabase.from("absence_excuses").insert({
      student_id: studentId, dates: [...picked].sort(), kind, reason: reason.trim() || null,
      file_path, file_name: file?.name ?? null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  };

  return (
    <div className="space-y-2.5 border-b border-line bg-mint-tint/40 px-4 py-3">
      <p className="text-sm font-semibold text-ink">تقديم عذر غياب لوكيل شؤون الطلاب</p>
      <div>
        <p className="mb-1 text-xs text-muted">أيام الغياب</p>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => (
            <button key={d} type="button" className={pill(picked.has(d))} onClick={() => toggle(d)}>
              {dayName(d)} <span className="num">{fmtGreg(d)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(EXCUSE_KIND).map(([k, t]) => (
          <button key={k} type="button" className={pill(kind === k)} onClick={() => setKind(k)}>{t}</button>
        ))}
      </div>
      <textarea className="field w-full" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={kind === "medical" ? "مثل: مراجعة مستشفى، وأرفق التقرير الطبي" : "اكتب سبب الغياب باختصار"} />
      <label className="block text-xs text-muted">المرفق (صورة أو PDF){kind === "medical" ? " — التقرير الطبي" : ""}
        <input type="file" accept="image/*,application/pdf" className="mt-1 block text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {err && <p className="text-xs text-absent">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !picked.size || (!reason.trim() && !file)} onClick={send}>
          {busy ? "جارٍ الإرسال…" : "إرسال العذر"}
        </button>
        <button className="btn-ghost" onClick={onCancel}>إلغاء</button>
      </div>
      <p className="text-[11px] text-faint">عند قبول الوكيل يصير غياب هذه الأيام «غائب بعذر»، ويصلك إشعار بالقرار.</p>
    </div>
  );
}

/* أعذاري: ما رُفع وحالته وملاحظة الوكيل */
export function ExcuseList({ list }) {
  if (!list?.length) return null;
  return (
    <div className="border-t border-line px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-ink">أعذار الغياب المرفوعة</p>
      <ul className="space-y-1.5">
        {list.map((e) => {
          const st = EXCUSE_STATUS[e.status] ?? EXCUSE_STATUS.pending;
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-sm2 border border-line px-3 py-2 text-xs">
              <span className="min-w-0 flex-1 text-ink">
                {(e.dates ?? []).map(dayLabel).join("، ")}
                <span className="text-faint"> · {EXCUSE_KIND[e.kind] ?? ""}</span>
              </span>
              <span className={`chip ${st.c}`}>{st.t}</span>
              {e.decision_note && <span className="w-full text-muted">ملاحظة الوكيل: {e.decision_note}</span>}
              {e.decided_at && <span className="num w-full text-[10.5px] text-faint">{fmtDateTime(e.decided_at)}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
