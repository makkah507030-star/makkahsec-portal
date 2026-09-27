// مركز تقارير شؤون الطلاب — كل تقارير الحضور والغياب في مكان واحد،
// مرتّبة حسب تسلسل اليوم الدراسي.
import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loading } from "./shared.jsx";
import { loadFingerprintEnabled, setFingerprintEnabled } from "../../lib/officialAttendance";

const TodayBoard = lazy(() => import("./TodayBoard.jsx"));
const MorningLate = lazy(() => import("./MorningLate.jsx"));
const OfficialAbsence = lazy(() => import("./OfficialAbsence.jsx"));
const FollowUp = lazy(() => import("./FollowUp.jsx"));
const PeriodReports = lazy(() => import("./PeriodReports.jsx"));
const Statistics = lazy(() => import("./Statistics.jsx"));
const Warnings = lazy(() => import("./Warnings.jsx"));
const StudentFile = lazy(() => import("./StudentFile.jsx"));
const Devices = lazy(() =>
  import("../admin/AttendanceOverview.jsx").then((m) => ({ default: m.DevicesTab })));

const GROUPS = [
  { title: "اليوم", tabs: [{ key: "today", label: "لوحة اليوم" }] },
  {
    title: "الحضور اليومي",
    tabs: [
      { key: "late", label: "التأخر الصباحي" },
      { key: "official", label: "الغياب الرسمي" },
      { key: "follow", label: "المتابعة" },
      { key: "periods", label: "غياب الحصص" },
    ],
  },
  {
    title: "التراكمي والإجراءات",
    tabs: [
      { key: "stats", label: "الإحصاء والنسب" },
      { key: "warnings", label: "الإنذارات والمحاضر" },
      { key: "student", label: "ملف الطالب" },
    ],
  },
  { title: "الأجهزة", tabs: [{ key: "devices", label: "أجهزة البصمة" }] },
];

const KEYS = new Set(GROUPS.flatMap((g) => g.tabs.map((t) => t.key)));

export default function StudentAffairs() {
  const [params, setParams] = useSearchParams();
  const tab = KEYS.has(params.get("tab")) ? params.get("tab") : "today";
  const go = (key) => setParams({ tab: key });
  const [fp, setFp] = useState(null);
  useEffect(() => { loadFingerprintEnabled().then(setFp).catch(() => setFp(false)); }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold text-ink">تقارير شؤون الطلاب</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          التأخر الصباحي بعد الاصطفاف بخمس دقائق · الغياب الرسمي بعد الحصة الثانية ·
          المتابعة خلال اليوم · النسبة المكتملة للإحصاء.
        </p>
      </div>
      {fp != null && <FingerprintSwitch enabled={fp} onChange={setFp} />}
      </div>

      <div className="space-y-3">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-[11px] font-semibold text-faint">{g.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.tabs.map((t) => (
                <button key={t.key} onClick={() => go(t.key)}
                  className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.key ? "bg-mint-deep text-white"
                                  : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Suspense key={String(fp)} fallback={<Loading />}>
        {tab === "today" && <TodayBoard go={go} />}
        {tab === "late" && <MorningLate />}
        {tab === "official" && <OfficialAbsence />}
        {tab === "follow" && <FollowUp />}
        {tab === "periods" && <PeriodReports />}
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
