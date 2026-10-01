// مركز تقارير شؤون الطلاب — كل تقارير الحضور والغياب في مكان واحد،
// مرتّبة حسب تسلسل اليوم الدراسي.
import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import { Loading } from "./shared.jsx";
import { loadFingerprintEnabled, setFingerprintEnabled } from "../../lib/officialAttendance";

const TodayBoard = lazy(() => import("./TodayBoard.jsx"));
const MorningLate = lazy(() => import("./MorningLate.jsx"));
const OfficialAbsence = lazy(() => import("./OfficialAbsence.jsx"));
const FollowUp = lazy(() => import("./FollowUp.jsx"));
const PeriodReports = lazy(() => import("./PeriodReports.jsx"));
const DetailedReports = lazy(() => import("./DetailedReports.jsx"));
const Statistics = lazy(() => import("./Statistics.jsx"));
const Warnings = lazy(() => import("./Warnings.jsx"));
const StudentFile = lazy(() => import("./StudentFile.jsx"));
const Devices = lazy(() =>
  import("../admin/AttendanceOverview.jsx").then((m) => ({ default: m.DevicesTab })));

/* الأقسام ومن يراها: all لكل من له صلاحية التقارير،
   warnings لوكيل شؤون الطلاب مع المدير والدعم الفني، super للمدير والدعم الفني فقط.
   ويمكن لتبويب أن يحدّد access خاصًّا به يتقدّم على قسمه. */
const GROUPS = [
  { title: "اليوم", hint: "حالة اليوم الدراسي مرحلة بمرحلة", access: "all",
    tabs: [{ key: "today", label: "لوحة اليوم" }] },
  { title: "الحضور اليومي", hint: "التأخر والغياب والمتابعة، وتقارير مفصلة بالفصل والحصة والطالب", access: "all",
    tabs: [
      { key: "late", label: "التأخر الصباحي" },
      { key: "official", label: "الغياب الرسمي" },
      { key: "follow", label: "المتابعة" },
      { key: "periods", label: "غياب الحصص" },
      { key: "detailed", label: "تقارير مفصلة" },
    ] },
  { title: "الإنذارات", hint: "إنذارات الغياب ومحاضرها والتحويل لدراسة الحالة", access: "warnings",
    tabs: [{ key: "warnings", label: "الإنذارات والمحاضر" }] },
  { title: "التراكمي", hint: "النسب على الفصل وملف كل طالب", access: "super",
    note: "للمدير والدعم الفني · ملف الطالب لوكيل شؤون الطلاب أيضًا",
    tabs: [
      { key: "stats", label: "الإحصاء والنسب" },
      // ملف الطالب وفيه «تعديل حضور الحصص» — لوكيل شؤون الطلاب أيضًا
      { key: "student", label: "ملف الطالب", access: "warnings" },
    ] },
  { title: "الأجهزة", hint: "حالة أجهزة البصمة وتغطيتها", access: "super",
    tabs: [{ key: "devices", label: "أجهزة البصمة" }] },
];

const ACCESS_NOTE = { warnings: "للوكيل والمدير والدعم الفني", super: "للمدير والدعم الفني" };

export default function StudentAffairs() {
  const { isSuper, adminRoles } = useSession();
  const isDeputy = (adminRoles ?? []).includes("deputy_students");
  const allowed = (access) =>
    access === "all" || isSuper || (access === "warnings" && isDeputy);
  const groups = GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => allowed(t.access ?? g.access)) }))
    .filter((g) => g.tabs.length > 0);
  const keys = new Set(groups.flatMap((g) => g.tabs.map((t) => t.key)));
  const [params, setParams] = useSearchParams();
  const tab = keys.has(params.get("tab")) ? params.get("tab") : "today";
  const go = (key) => setParams({ tab: key });
  const [fp, setFp] = useState(null);
  useEffect(() => { loadFingerprintEnabled().then(setFp).catch(() => setFp(false)); }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold text-ink">تقارير شؤون الطلاب</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          التأخر الصباحي بعد الاصطفاف بخمس دقائق · الغياب الرسمي المعتمد يوميًا ·
          المتابعة خلال اليوم · النسبة المكتملة للإحصاء.
        </p>
      </div>
      {fp != null && <FingerprintSwitch enabled={fp} onChange={setFp} />}
      </div>

      <nav className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const active = g.tabs.some((t) => t.key === tab);
          return (
            <section key={g.title}
              className={`rounded-card border p-3 transition-colors ${
                active ? "border-mint-deep/40 bg-mint-tint/40" : "border-line bg-paper"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-bold ${active ? "text-mint-deep" : "text-ink"}`}>{g.title}</p>
                {(g.note ?? ACCESS_NOTE[g.access]) && (
                  <span className="shrink-0 rounded-pill bg-canvas px-2 py-0.5 text-[10.5px] text-faint">
                    {g.note ?? ACCESS_NOTE[g.access]}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{g.hint}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {g.tabs.map((t) => (
                  <button key={t.key} onClick={() => go(t.key)}
                    className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      tab === t.key ? "bg-mint-deep text-white"
                                    : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </nav>

      <Suspense key={String(fp)} fallback={<Loading />}>
        {tab === "today" && <TodayBoard go={go} />}
        {tab === "late" && <MorningLate />}
        {tab === "official" && <OfficialAbsence />}
        {tab === "follow" && <FollowUp />}
        {tab === "periods" && <PeriodReports />}
        {tab === "detailed" && <DetailedReports />}
        {tab === "stats" && <Statistics />}
        {tab === "warnings" && <Warnings />}
        {tab === "student" && <StudentFile />}
        {tab === "devices" && <Devices />}
      </Suspense>
    </div>
  );
}

/** زر قفل البصمة / فتحها — يُحفظ في الإعدادات ويسري على الاعتماد اليدوي والآلي */
function FingerprintSwitch({ enabled, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const toggle = async () => {
    const next = !enabled;
    const q = next
      ? "فتح البصمة: تُحتسب البصمات من الآن في التأخر الصباحي والمتابعة والاعتماد (اليدوي والآلي). متابعة؟"
      : "إقفال البصمة: تُتجاهل البصمات في كل الحسابات وتُخفى أجزاؤها (مرحلة تجربة). متابعة؟";
    if (!window.confirm(q)) return;
    setBusy(true); setErr(null);
    try { await setFingerprintEnabled(next); onChange(next); }
    catch (e) { setErr(e.message ?? String(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="text-left">
      <button onClick={toggle} disabled={busy}
        className={`flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          enabled ? "border-present/40 bg-present/10 text-present hover:bg-present/15"
                  : "border-warning/40 bg-warning-light text-warning hover:bg-warning-light/70"}`}>
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {enabled
            ? <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>
            : <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>}
        </svg>
        {enabled ? "البصمة مفعّلة" : "البصمة مقفلة (تجربة)"}
      </button>
      {err && <p className="mt-1 text-xs text-absent">تعذّر الحفظ: {err}</p>}
    </div>
  );
}
