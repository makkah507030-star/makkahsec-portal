// المتابعة: بصم ولم يحضر، والمفقودون خلال اليوم، ومن حضر بلا بصمة
import { useMemo, useState } from "react";
import { todayISO } from "../../lib/schoolTime";
import { fmtDate, fmtTime12 } from "../../lib/dates";
import { printReport, exportStyledExcel } from "../../lib/exportUtils";
import { MissingTab } from "../admin/AttendanceOverview.jsx";
import {
  SIGNS, logos, Pill, DateInput, ExportBar, GradePills, Note, Loading, Empty, useDay,
  useFingerprint, FingerprintLockedNote,
} from "./shared.jsx";

export default function FollowUp() {
  const [mode, setMode] = useState("conflict");
  const fp = useFingerprint();
  if (fp == null) return <Loading />;
  // البصمة مقفلة: المتابعة من تحضير الحصص فقط (المفقودون)
  if (!fp) return (
    <div className="space-y-4">
      <FingerprintLockedNote />
      <MissingTab />
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Pill on={mode === "conflict"} onClick={() => setMode("conflict")}>بصم ولم يحضر</Pill>
        <Pill on={mode === "missing"} onClick={() => setMode("missing")}>المفقودون خلال اليوم</Pill>
        <Pill on={mode === "nopunch"} onClick={() => setMode("nopunch")}>حضر بلا بصمة</Pill>
      </div>
      {mode === "missing" ? <MissingTab /> : <DayList mode={mode} />}
    </div>
  );
}

const MODES = {
  conflict: {
    title: "طلاب بصموا صباحًا ولم يحضروا الحصص",
    note: "دخلوا المدرسة ولم يدخلوا الفصل — يُحسبون غائبين رسميًا ويجب تحديد أماكنهم ومتابعتهم فورًا.",
    pick: (r) => r.official === "absent" && r.punched,
    empty: "لا حالات — كل من بصم حضر حصصه.",
    file: "بصم-ولم-يحضر",
  },
  nopunch: {
    title: "طلاب حضروا الحصص ولم يبصموا",
    note: "حاضرون رسميًا من تحضير المعلمين، لكن بلا بصمة صباحية — للتنبيه على البصمة أو فحص ربط الطالب بالجهاز.",
    pick: (r) => r.official === "present" && !r.punched,
    empty: "لا حالات.",
    file: "حضر-بلا-بصمة",
  },
};

function DayList({ mode }) {
  const cfg = MODES[mode];
  const [date, setDate] = useState(todayISO());
  const [grade, setGrade] = useState(0);
  const { live, error } = useDay(date);

  const list = useMemo(() => (live?.rows ?? [])
    .filter(cfg.pick)
    .filter((r) => !grade || r.grade === grade)
    .sort((a, b) => a.grade - b.grade || a.class_no - b.class_no || a.full_name.localeCompare(b.full_name, "ar")),
  [live, grade, cfg]);

  const headers = mode === "conflict"
    ? ["م", "اسم الطالب", "الصف", "الفصل", "وقت البصمة"]
    : ["م", "اسم الطالب", "الصف", "الفصل"];
  const table = () => list.map((r, i) => mode === "conflict"
    ? [i + 1, r.full_name, r.grade, r.class_no, fmtTime12(r.punch)]
    : [i + 1, r.full_name, r.grade, r.class_no]);

  return (
    <div className="space-y-4">
      <DateInput value={date} onChange={setDate} />
      <Note tone={mode === "conflict" ? "warn" : "mint"}>{cfg.note}</Note>
      <GradePills grade={grade} setGrade={setGrade} />
      <ExportBar disabled={!list.length}
        onPrint={() => printReport({ title: cfg.title, subtitle: fmtDate(date), headers, rows: table(), ...logos(), signatures: SIGNS })}
        onExcel={() => exportStyledExcel({ title: cfg.title, subtitle: fmtDate(date), headers, rows: table(), fileName: `${cfg.file}-${date}`, sheetName: "المتابعة", signatures: SIGNS })} />
      {error && <Empty>تعذّر التحميل: {error}</Empty>}
      {!live && !error ? <Loading /> : live && list.length === 0 ? (
        <Empty tone="good">{cfg.empty}</Empty>
      ) : live && (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((r) => (
            <div key={r.student_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                <p className="text-xs text-muted">
                  صف <span className="num">{r.grade}</span> · فصل <span className="num">{r.class_no}</span>
                  {r.punched && <> · بصم <span className="num">{fmtTime12(r.punch)}</span></>}
                </p>
              </div>
              {mode === "conflict" && <span className="chip shrink-0 bg-warning-light text-warning">للمتابعة</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
