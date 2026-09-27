// مركز تقارير شؤون الطلاب — كل تقارير الحضور والغياب في مكان واحد،
// مرتّبة حسب تسلسل اليوم الدراسي.
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Loading } from "./shared.jsx";

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">تقارير شؤون الطلاب</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          التأخر الصباحي بعد الاصطفاف بخمس دقائق · الغياب الرسمي بعد الحصة الثانية ·
          المتابعة خلال اليوم · النسبة المكتملة للإحصاء.
        </p>
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

      <Suspense fallback={<Loading />}>
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
