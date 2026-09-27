// عناصر مشتركة لمركز تقارير شؤون الطلاب
import { useCallback, useEffect, useState } from "react";
import { STUDENT_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { loadDay, loadApproval, loadFingerprintEnabled } from "../../lib/officialAttendance";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export const SIGNS = [
  { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
  { title: "مدير المدرسة", name: PRINCIPAL_NAME },
];

export const logos = () => ({
  logoUrl: new URL(logoIcon, window.location.origin).href,
  moeLogoUrl: new URL(moeLogo, window.location.origin).href,
});

export function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}

export function Fig({ value, label, tone, hint }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
      <p className={`num text-2xl font-bold leading-none ${tone ?? "text-ink"}`}>{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

export function DateInput({ label = "التاريخ", value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
             className="rounded-sm2 border border-line px-3 py-2 text-sm text-ink" />
    </label>
  );
}

export function ExportBar({ disabled, onExcel, onPrint, printLabel = "طباعة / PDF", excelLabel = "تصدير Excel" }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onPrint} disabled={disabled}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
        {printLabel}
      </button>
      <button onClick={onExcel} disabled={disabled}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
        {excelLabel}
      </button>
    </div>
  );
}

export function GradePills({ grade, setGrade }) {
  const names = { 1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي" };
  return (
    <div className="flex flex-wrap gap-1.5">
      <Pill on={!grade} onClick={() => setGrade(0)}>كل الصفوف</Pill>
      {[1, 2, 3].map((g) => (
        <Pill key={g} on={grade === g} onClick={() => setGrade(g)}>{names[g]}</Pill>
      ))}
    </div>
  );
}

export function Note({ children, tone = "mint" }) {
  const cls = tone === "warn"
    ? "border-[#F0E3C4] bg-warning-light text-warning"
    : "border-[#CCF2DB] bg-mint-tint text-mint-deep";
  return <p className={`rounded-card border px-4 py-3 text-sm leading-relaxed ${cls}`}>{children}</p>;
}

export function Loading() {
  return <p className="py-6 text-center text-sm text-muted">جارٍ التحميل…</p>;
}

export function Empty({ children, tone = "gray" }) {
  return (
    <p className={`rounded-card px-4 py-6 text-center text-sm ${
      tone === "good" ? "bg-present/10 text-present" : "bg-gray-tint text-muted"}`}>
      {children}
    </p>
  );
}

/** تنبيه عند عدم تنفيذ ملف SQL الخاص بالمركز بعد */
export function SetupNotice() {
  return (
    <Note tone="warn">
      جداول الاعتماد والإنذارات غير منشأة بعد في قاعدة البيانات. نفّذ الملف
      <span className="num mx-1 font-semibold">supabase/student_affairs.sql</span>
      مرة واحدة من Supabase ← SQL Editor. التقارير المباشرة تعمل الآن، والاعتماد
      والإحصاء التراكمي والإنذارات تعمل بعد التنفيذ.
    </Note>
  );
}

/**
 * بيانات يوم واحد: الحساب المباشر من السجلات + الاعتماد المحفوظ (إن وُجد).
 */
export function useDay(date) {
  const [live, setLive] = useState(null);
  const [approval, setApproval] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLive(null); setApproval(null); setError(null);
    Promise.all([loadDay(date), loadApproval(date)])
      .then(([d, a]) => { if (alive) { setLive(d); setApproval(a); } })
      .catch((e) => { console.error("useDay:", e); if (alive) setError(e.message ?? String(e)); });
    return () => { alive = false; };
  }, [date, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { live, approval, error, reload };
}

export const pctText = (v) => (v == null ? "—" : `${Math.round(Number(v) * 10) / 10}%`);

export const WEEKDAY = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const weekdayOf = (date) => WEEKDAY[new Date(`${date}T12:00:00`).getDay()];

/** «3 أيام» / «15 يومًا» / «يوم واحد» */
export const daysWord = (n) =>
  n === 1 ? "يوم واحد" : n === 2 ? "يومان" : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يومًا`;

/** حالة قفل البصمة: null أثناء التحميل، true مفعّلة، false مقفلة (مرحلة تجربة) */
export function useFingerprint() {
  const [enabled, setEnabled] = useState(null);
  useEffect(() => {
    let alive = true;
    loadFingerprintEnabled().then((v) => { if (alive) setEnabled(v); }).catch(() => setEnabled(false));
    return () => { alive = false; };
  }, []);
  return enabled;
}

export function FingerprintLockedNote() {
  return (
    <Note tone="warn">
      البصمة مقفلة — أجهزة البصمة في مرحلة التجربة، فلا تُحتسب البصمات في التأخر ولا في المتابعة.
      يفتحها المسؤول من زر «البصمة» أعلى الصفحة عند اعتمادها رسميًا.
    </Note>
  );
}
