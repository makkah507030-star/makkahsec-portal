// src/components/AbsenceExcuse.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtHijri, fmtGreg, fmtDateTime } from "../lib/dates";
import { ADMIN_ROLE_LABEL } from "../lib/session.jsx";

/* =====================================================================
   أعذار الغياب (supabase/absence_excuses_1..2.sql): يرفعها الطالب أو ولي أمره من
   «سجل الغياب والتأخر»، ويقرر فيها وكيل شؤون الطلاب، فيصير الغياب «غائب بعذر» عند القبول.
   ===================================================================== */

export const EXCUSE_BUCKET = "absence-excuses";
export const EXCUSE_KIND = { medical: "عذر مرضي", other: "ظرف آخر" };

/* الأعذار المقبولة رسميًا وإثبات كل منها — دليل قواعد السلوك والمواظبة 1447هـ (public/docs/behavior)
   (absence_excuses_3.sql: case_key). other: ظرف آخر يقدّره الوكيل. */
export const EXCUSE_GUIDE_IMG = "/docs/behavior/excuses-accepted.jpg";
export const EXCUSE_CASES = [
  { k: "c1", n: 1, t: "الإجازة المرضية", proof: "تقرير إجازة مرضية من منصة صحتي", kind: "medical" },
  { k: "c2", n: 2, t: "مراجعة المستشفيات والمراكز الصحية", proof: "إشعار مراجعة من منصة صحتي", kind: "medical" },
  { k: "c3", n: 3, t: "حدوث الكوارث مثل الحريق وغيره", proof: "مشهد من الدفاع المدني", kind: "other" },
  { k: "c4", n: 4, t: "وفاة أحد الأقارب إلى الدرجة الثالثة", proof: "شهادة الوفاة", kind: "other" },
  { k: "c5", n: 5, t: "مرافقة صحية لأحد الأقارب من الدرجة الأولى", proof: "إشعار مرافقة", kind: "other" },
  { k: "c6", n: 6, t: "مرافقة صحية لأحد الأقارب إلى الدرجة الثالثة", proof: "إشعار مرافقة", kind: "other", note: "لإدارة المدرسة تقدير العذر وقبوله أو رفضه" },
  { k: "c7", n: 7, t: "مراجعة الجهات الرسمية", proof: "إشعار مراجعة", kind: "other" },
  { k: "c8", n: 8, t: "مرافقة الأقارب من الدرجة الأولى للجهات الرسمية", proof: "إشعار مراجعة", kind: "other" },
  { k: "c9", n: 9, t: "المشاركة في المسابقات المحلية والدولية", proof: "مشهد المشاركة", kind: "other" },
  { k: "c10", n: 10, t: "ظروف صحية أخرى (الظروف الصحية والنفسية والأمراض المزمنة)", proof: "تقرير طبي", kind: "medical", note: "تقيّم إدارة المدرسة الحالة وتدرس قبول العذر" },
  { k: "c11", n: 11, t: "ما تقرره الأنظمة واللوائح فيما يتعلق بحماية الطفل", proof: null, kind: "other" },
];
export const caseOf = (k) => EXCUSE_CASES.find((c) => c.k === k) ?? null;

/* بطاقات رد جاهزة للوكيل والمساعدين الإداريين؛ {proof} يُستبدل بإثبات الحالة */
export const REPLY_CARDS = {
  accept: [
    "قُبل العذر لاستيفائه الإثبات المطلوب.",
    "قُبل العذر، مع الحرص على انتظام الطالب وتعويض ما فاته من دروس.",
    "قُبل العذر تقديرًا لظرف الطالب، ونتمنى له دوام الصحة.",
  ],
  reject: [
    "لم يُرفق الإثبات المطلوب ({proof})، نرجو إرفاقه وإعادة التقديم.",
    "المرفق لا يثبت الحالة، والمطلوب: {proof}.",
    "تاريخ الإثبات لا يطابق أيام الغياب المذكورة.",
    "المرفق غير واضح، نرجو إعادة رفعه بصورة أوضح.",
    "الحالة ليست من الأعذار المقبولة في دليل قواعد السلوك والمواظبة.",
    "مضت مدة طويلة على الغياب، ويُراجَع وكيل شؤون الطلاب.",
  ],
};
export const fillReply = (t, c) => t.replace("{proof}", c?.proof ?? "الإثبات الرسمي");

/* صورة الجدول من الدليل، تُفتح وتُغلق */
export function ExcuseGuide({ open: initial = false }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="rounded-sm2 border border-line bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-semibold text-mint-deep">
        <span className="flex-1">الأعذار المقبولة وإثباتها — من دليل قواعد السلوك والمواظبة</span>
        <span>{open ? "إخفاء ▲" : "عرض ▼"}</span>
      </button>
      {open && (
        <a href={EXCUSE_GUIDE_IMG} target="_blank" rel="noopener noreferrer" className="block border-t border-line p-2">
          <img src={EXCUSE_GUIDE_IMG} alt="جدول الأعذار المقبولة وإثباتها من دليل قواعد السلوك والمواظبة" className="mx-auto w-full max-w-[640px]" loading="lazy" />
        </a>
      )}
    </div>
  );
}
export const EXCUSE_STATUS = {
  pending:  { t: "العذر قيد المراجعة", short: "قيد المراجعة", c: "bg-warning/10 text-warning" },
  accepted: { t: "قُبل العذر",         short: "مقبول",        c: "bg-excused/10 text-excused" },
  rejected: { t: "لم يُقبل العذر",     short: "غير مقبول",    c: "bg-absent/10 text-absent" },
};
const dayName = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("ar-SA", { weekday: "long" });
export const dayLabel = (d) => `${dayName(d)} ${fmtHijri(d)}`;
// متخذ القرار باسمه وصفته: «فلان (المساعد الإداري 1)»
export const deciderText = (e) => [e.decided_by_name, e.decided_by_role && `(${ADMIN_ROLE_LABEL[e.decided_by_role] ?? e.decided_by_role})`]
  .filter(Boolean).join(" ");

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
  const [caseKey, setCaseKey] = useState(null);      // من EXCUSE_CASES وحدها (الأعذار الرسمية)
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
    const c = caseOf(caseKey);
    const row = { student_id: studentId, dates: [...picked].sort(), kind: c?.kind ?? "other",
      reason: [c ? `${c.n}. ${c.t}` : "ظرف آخر", reason.trim()].filter(Boolean).join(" — "),
      file_path, file_name: file?.name ?? null, case_key: caseKey };
    let { error } = await supabase.from("absence_excuses").insert(row);
    // قبل تشغيل absence_excuses_3.sql: بلا عمود الحالة (والحالة في نص السبب)
    if (error && /case_key/.test(error.message)) ({ error } = await supabase.from("absence_excuses").insert({ ...row, case_key: undefined }));
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  };

  return (
    <div className="space-y-2.5 border-b border-line bg-mint-tint/40 px-4 py-3">
      <p className="text-sm font-semibold text-ink">تقديم عذر غياب لشؤون الطلاب</p>
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
      <div>
        <p className="mb-1 text-xs text-muted">حالة العذر (من الأعذار المقبولة رسميًا) — مع إحضار ما يثبتها</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {EXCUSE_CASES.map((c) => {
            const on = caseKey === c.k;
            return (
              <button key={c.k} type="button" onClick={() => setCaseKey(c.k)}
                      className={`rounded-sm2 border px-3 py-2 text-start transition ${on ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white hover:border-mint-light"}`}>
                <span className={`block text-[12.5px] font-semibold ${on ? "text-white" : "text-ink"}`}>{c.n ? <span className="num">{c.n}. </span> : null}{c.t}</span>
                {c.proof && <span className={`block text-[11px] ${on ? "text-white/85" : "text-muted"}`}>الإثبات: {c.proof}</span>}
                {c.note && <span className={`block text-[10.5px] ${on ? "text-white/75" : "text-faint"}`}>{c.note}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <ExcuseGuide />
      <textarea className="field w-full" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="تفاصيل مختصرة (اختياري)، مثل: اسم المستشفى أو صلة القرابة" />
      <label className="block text-xs text-muted">المرفق (صورة أو PDF){caseOf(caseKey)?.proof ? ` — ${caseOf(caseKey).proof}` : ""}
        <input type="file" accept="image/*,application/pdf" className="mt-1 block text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {err && <p className="text-xs text-absent">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !picked.size || !caseKey || (!file && caseOf(caseKey)?.proof)} onClick={send}>
          {busy ? "جارٍ الإرسال…" : "إرسال العذر"}
        </button>
        <button className="btn-ghost" onClick={onCancel}>إلغاء</button>
      </div>
      <p className="text-[11px] text-faint">عند قبول العذر يصير غياب هذه الأيام «غائب بعذر»، ويصلك إشعار بالقرار.</p>
    </div>
  );
}

/* بطاقات اختيار حالة العذر من الأعذار الرسمية */
export function CasePicker({ value, onChange }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {EXCUSE_CASES.map((c) => {
        const on = value === c.k;
        return (
          <button key={c.k} type="button" onClick={() => onChange(c.k)}
                  className={`rounded-sm2 border px-3 py-2 text-start transition ${on ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white hover:border-mint-light"}`}>
            <span className={`block text-[12.5px] font-semibold ${on ? "text-white" : "text-ink"}`}><span className="num">{c.n}. </span>{c.t}</span>
            {c.proof && <span className={`block text-[11px] ${on ? "text-white/85" : "text-muted"}`}>الإثبات: {c.proof}</span>}
          </button>
        );
      })}
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
                <span className="text-faint"> · {caseOf(e.case_key) ? caseOf(e.case_key).t : EXCUSE_KIND[e.kind] ?? ""}</span>
              </span>
              <span className={`chip ${st.c}`}>{st.t}</span>
              {e.decision_note && <span className="w-full text-muted">الملاحظة: {e.decision_note}</span>}
              {e.decided_at && (
                <span className="w-full text-[10.5px] text-faint">
                  {deciderText(e) && <>القرار: {deciderText(e)} · </>}<span className="num">{fmtDateTime(e.decided_at)}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
