// غياب الحصص: تقارير تحضير المعلمين (الموجودة سابقًا) في مكان واحد
import { useState } from "react";
import {
  DailyReport, StudentReport, PeriodReport, AbsenceDaysReport, TeacherSheetsReport,
} from "../Reports.jsx";
import PeriodAttendance from "../admin/PeriodAttendance.jsx";
import { Pill } from "./shared.jsx";

const VIEWS = [
  { key: "daily", label: "غياب الحصص اليومي" },
  { key: "student", label: "تقرير طالب" },
  { key: "period", label: "تقرير فترة" },
  { key: "days", label: "أيام الغياب من الحصص" },
  { key: "sheets", label: "كشوف تحضير المعلمين" },
  { key: "marking", label: "متابعة التحضير اليوم" },
];

export default function PeriodReports() {
  const [view, setView] = useState("daily");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Pill key={v.key} on={view === v.key} onClick={() => setView(v.key)}>{v.label}</Pill>
        ))}
      </div>
      {view === "daily" && <DailyReport scopeIds={null} />}
      {view === "student" && <StudentReport scopeIds={null} />}
      {view === "period" && <PeriodReport scopeIds={null} />}
      {view === "days" && <AbsenceDaysReport scopeIds={null} />}
      {view === "sheets" && <TeacherSheetsReport />}
      {view === "marking" && <PeriodAttendance />}
    </div>
  );
}
