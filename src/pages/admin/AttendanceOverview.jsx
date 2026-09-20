import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES, todayISO } from "../../lib/schoolTime";
import { loadPeriodTimes, lateInfo } from "../../lib/periodTimes";
import { fmtGreg, fmtTime12, fmtDateTime } from "../../lib/dates";
import { printReport, exportStyledExcel, STUDENT_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import ColorLegend from "../../components/ColorLegend.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const TABS = [
  { key: "official", label: "الحضور والغياب الرسمي" },
  { key: "missing",  label: "الطلاب المفقودون" },
  { key: "late",     label: "التأخر الصباحي" },
  { key: "devices",  label: "أجهزة البصمة" },
];

export default function AttendanceOverview() {
  const [tab, setTab] = useState("official");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">الحضور والغياب</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          الحالة الرسمية معتمدة على الحصتين الأوليين فقط، والتأخر الصباحي من بيانات البصمة.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "official" && <OfficialTab />}
      {tab === "missing" && <MissingTab />}
      {tab === "late" && <LateTab />}
      {tab === "devices" && <DevicesTab />}
    </div>
  );
}

/* ==================== الحضور والغياب الرسمي ==================== */

function OfficialTab() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [grade, setGrade] = useState(0);
  const [view, setView] = useState("all"); // all | absent | pending

  useEffect(() => {
    (async () => {
      setRows(null);
      const { data, error } = await supabase.rpc("official_daily_status", { p_date: date });
      if (error) { console.error(error); setRows([]); return; }
      setRows(data ?? []);
    })();
  }, [date]);

  const filtered = useMemo(() => {
    let list = rows ?? [];
    if (grade) list = list.filter((r) => r.grade === grade);
    if (view !== "all") list = list.filter((r) => r.official === view);
    return list.sort((a, b) => a.class_no - b.class_no || a.full_name.localeCompare(b.full_name, "ar"));
  }, [rows, grade, view]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, pending: 0 };
    (rows ?? []).forEach((r) => { c[r.official] = (c[r.official] ?? 0) + 1; });
    return c;
  }, [rows]);

  const total = counts.present + counts.absent + counts.pending;
  const resolved = counts.present + counts.absent;
  const attendancePct = resolved ? Math.round((counts.present / resolved) * 100) : null;
  const ready = counts.pending === 0 && total > 0;

  const statusLabel = { present: "حاضر", absent: "غائب", pending: "لم يتم تحضيره" };

  // تقرير رسمي للجهات الرقابية: الغائبون فقط، بلا حالات معلّقة
  const headers = ["م", "اسم الطالب", "الفصل"];
  const table = () => filtered
    .filter((r) => r.official === "absent")
    .map((r, i) => [i + 1, r.full_name, r.class_no]);

  const printIt = () => printReport({
    title: "كشف الطلاب الغائبين رسميًا",
    subtitle: `${fmtGreg(date)} · معتمد على غياب الحصتين الأولى والثانية معًا`,
    headers, rows: table(),
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    signatures: [
      { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
      { title: "مدير المدرسة", name: PRINCIPAL_NAME },
    ],
  });

  const excelIt = () => exportStyledExcel({
    title: "كشف الطلاب الغائبين رسميًا",
    subtitle: `${fmtGreg(date)} · معتمد على غياب الحصتين الأولى والثانية معًا`,
    headers, rows: table(),
    fileName: `الغياب-الرسمي-${date}`,
    sheetName: "الغياب",
    signatures: [
      { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
      { title: "مدير المدرسة", name: PRINCIPAL_NAME },
    ],
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      {/* الملخص */}
      {rows && total > 0 && (
        <section className="card p-4">
          {!ready ? (
            <div className="flex items-center gap-3 rounded-sm2 bg-warning-light px-4 py-3">
              <span className="chip bg-white text-warning">لم يتم تحضيره</span>
              <p className="text-sm text-warning">
                لم تكتمل بعد <span className="num">{counts.pending}</span> حالة —
                الحصة الأولى أو الثانية لم تُحضَّر لبعض الطلاب.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-sm2 bg-present/10 px-3 py-3 text-center">
                <p className="num text-2xl font-bold leading-none text-present">{counts.present}</p>
                <p className="mt-1.5 text-xs text-muted">حاضر رسميًا</p>
              </div>
              <div className="rounded-sm2 bg-absent/10 px-3 py-3 text-center">
                <p className="num text-2xl font-bold leading-none text-absent">{counts.absent}</p>
                <p className="mt-1.5 text-xs text-muted">غائب رسميًا</p>
              </div>
              <div className="rounded-sm2 bg-mint-tint px-3 py-3 text-center">
                <p className="num text-2xl font-bold leading-none text-mint-deep">
                  {attendancePct}%
                </p>
                <p className="mt-1.5 text-xs text-muted">نسبة الحضور</p>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Pill on={!grade} onClick={() => setGrade(0)}>كل الصفوف</Pill>
        {[1, 2, 3].map((g) => (
          <Pill key={g} on={grade === g} onClick={() => setGrade(g)}>{GRADE_NAMES[g]}</Pill>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill on={view === "all"} onClick={() => setView("all")}>الكل <span className="num">({total})</span></Pill>
        <Pill on={view === "absent"} onClick={() => setView("absent")}>غائب <span className="num">({counts.absent})</span></Pill>
        <Pill on={view === "pending"} onClick={() => setView("pending")}>لم يتم تحضيره <span className="num">({counts.pending})</span></Pill>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={printIt} disabled={!table().length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          كشف الغائبين — PDF
        </button>
        <button onClick={excelIt} disabled={!table().length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          كشف الغائبين — Excel
        </button>
      </div>
      <p className="text-xs text-faint">
        الكشف يشمل الغائبين رسميًا فقط، وتُستبعد منه الحالات غير المحسومة —
        جاهز للاستخدام الفوري عند طلب الجهات الرقابية.
      </p>

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}
      {rows && filtered.length === 0 && (
        <p className="rounded-card bg-gray-tint px-4 py-6 text-center text-sm text-muted">
          لا نتائج مطابقة.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {filtered.slice(0, 300).map((r) => (
            <div key={r.student_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                <p className="text-xs text-muted">فصل <span className="num">{r.class_no}</span></p>
              </div>
              <span className={`chip shrink-0 ${
                r.official === "present" ? "bg-present/10 text-present"
                : r.official === "absent" ? "bg-absent/10 text-absent"
                : "bg-warning-light text-warning"}`}>
                {statusLabel[r.official]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== الطلاب المفقودون ==================== */

function MissingTab() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [timeline, setTimeline] = useState(null);

  useEffect(() => {
    (async () => {
      setRows(null);
      const { data, error } = await supabase.rpc("missing_students", { p_date: date });
      if (error) { console.error(error); setRows([]); return; }
      setRows(data ?? []);
    })();
  }, [date]);

  const toggle = async (studentId) => {
    if (openId === studentId) { setOpenId(null); return; }
    setOpenId(studentId);
    setTimeline(null);
    const { data, error } = await supabase.rpc("student_day_timeline", {
      p_date: date, p_student_id: studentId,
    });
    if (error) { console.error(error); setTimeline([]); return; }
    setTimeline(data ?? []);
  };

  const headers = ["م", "اسم الطالب", "الفصل", "آخر حضور", "حصة الفقدان", "المادة"];
  const table = () => (rows ?? []).map((r, i) => [
    i + 1, r.full_name, r.class_no, r.last_seen_period, r.missing_period, r.subject ?? "",
  ]);

  const printIt = () => printReport({
    title: "تقرير الطلاب المفقودين خلال اليوم",
    subtitle: fmtGreg(date),
    headers, rows: table(),
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    signatures: [
      { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
      { title: "مدير المدرسة", name: PRINCIPAL_NAME },
    ],
  });

  const excelIt = () => exportStyledExcel({
    title: "تقرير الطلاب المفقودين خلال اليوم",
    subtitle: fmtGreg(date),
    headers, rows: table(),
    fileName: `الطلاب-المفقودون-${date}`,
    sheetName: "المفقودون",
    signatures: [
      { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
      { title: "مدير المدرسة", name: PRINCIPAL_NAME },
    ],
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      <p className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        طالب ظهر حضوره مبكرًا (الحصة الأولى أو الثانية) ثم ظهر غيابه في حصة لاحقة
        حُضِّرت فعليًا — دليل مؤكد على مغادرته أو اختفائه، لا افتراضي.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={printIt} disabled={!rows?.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          طباعة / PDF
        </button>
        <button onClick={excelIt} disabled={!rows?.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          تصدير Excel
        </button>
      </div>

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}
      {rows && rows.length === 0 && (
        <p className="rounded-card bg-present/10 px-4 py-6 text-center text-sm text-present">
          لا حالات فقدان في هذا اليوم.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => {
            const open = openId === r.student_id;
            return (
              <div key={r.student_id}>
                <button onClick={() => toggle(r.student_id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-canvas">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      فصل <span className="num">{r.class_no}</span> · آخر حضور الحصة{" "}
                      <span className="num">{r.last_seen_period}</span> · فُقد في الحصة{" "}
                      <span className="num font-semibold text-absent">{r.missing_period}</span>
                    </p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none"
                       className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {open && (
                  <div className="border-t border-line bg-gray-tint px-4 py-3">
                    {!timeline ? (
                      <p className="text-xs text-muted">جارٍ التحميل…</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {timeline.map((p) => {
                          const isMissing = p.period_no === r.missing_period;
                          const tone =
                            p.status === "absent" ? "border-absent/40 bg-absent/10 text-absent"
                            : p.status === "late" ? "border-late/40 bg-late/10 text-late"
                            : p.status === "excused" ? "border-excused/40 bg-excused/10 text-excused"
                            : "border-present/40 bg-present/10 text-present";
                          return (
                            <span key={p.period_no}
                              className={`rounded-sm2 border px-2.5 py-1.5 text-xs ${tone} ${isMissing ? "ring-2 ring-absent" : ""}`}>
                              <span className="num font-semibold">ح{p.period_no}</span>
                              <span className="mx-1 text-faint">·</span>
                              {p.subject ?? "—"}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==================== التأخر الصباحي ==================== */

function LateTab() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [grade, setGrade] = useState(0);

  useEffect(() => {
    (async () => {
      setRows(null);

      const [{ rows: ptimes }, students, punches, official] = await Promise.all([
        loadPeriodTimes(),
        supabase.from("v_active_students").select("student_id, full_name, class_no, grade"),
        supabase.from("daily_attendance").select("student_id, punch_time").eq("attend_date", date),
        supabase.rpc("official_daily_status", { p_date: date }),
      ]);

      const officialMap = Object.fromEntries(
        (official.data ?? []).map((r) => [r.student_id, r.official])
      );
      const punchMap = Object.fromEntries(
        (punches.data ?? []).map((p) => [p.student_id, p.punch_time])
      );

      const list = (students.data ?? []).map((s) => {
        const punch = punchMap[s.student_id];
        const li = punch ? lateInfo(ptimes, punch) : null;
        return {
          ...s,
          punch,
          isLate: li?.isLate ?? false,
          lateMinutes: li?.minutes ?? 0,
          official: officialMap[s.student_id] ?? "pending",
        };
      });

      setRows(list);
    })();
  }, [date]);

  const filtered = useMemo(() => {
    let list = rows ?? [];
    if (grade) list = list.filter((r) => r.grade === grade);
    return list;
  }, [rows, grade]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const punched = filtered.filter((r) => r.punch).length;
    const late = filtered.filter((r) => r.isLate).length;
    const absent = filtered.filter((r) => r.official === "absent").length;
    const present = filtered.filter((r) => r.official === "present").length;
    return { total, punched, late, absent, present };
  }, [filtered]);

  const lateList = useMemo(
    () => filtered.filter((r) => r.isLate).sort((a, b) => b.lateMinutes - a.lateMinutes),
    [filtered]
  );

  const headers = ["م", "اسم الطالب", "الفصل", "وقت البصمة", "دقائق التأخر"];
  const table = () => lateList.map((r, i) => [
    i + 1, r.full_name, r.class_no, fmtTime12(r.punch), r.lateMinutes,
  ]);

  const printIt = () => printReport({
    title: "تقرير التأخر الصباحي",
    subtitle: fmtGreg(date),
    headers, rows: table(),
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    signatures: [
      { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
      { title: "مدير المدرسة", name: PRINCIPAL_NAME },
    ],
  });

  const excelIt = () => exportStyledExcel({
    title: "تقرير التأخر الصباحي",
    subtitle: fmtGreg(date),
    headers, rows: table(),
    fileName: `التأخر-الصباحي-${date}`,
    sheetName: "التأخر",
    signatures: [
      { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
      { title: "مدير المدرسة", name: PRINCIPAL_NAME },
    ],
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">التاريخ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      {rows && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fig value={`${stats.total ? Math.round((stats.present / stats.total) * 100) : 0}%`}
               label="نسبة الحضور" tone="text-present" />
          <Fig value={`${stats.total ? Math.round((stats.absent / stats.total) * 100) : 0}%`}
               label="نسبة الغياب" tone="text-absent" />
          <Fig value={`${stats.punched ? Math.round((stats.late / stats.punched) * 100) : 0}%`}
               label="نسبة التأخر" tone="text-late" />
          <Fig value={stats.late} label="عدد المتأخرين" tone="text-late" />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Pill on={!grade} onClick={() => setGrade(0)}>كل الصفوف</Pill>
        {[1, 2, 3].map((g) => (
          <Pill key={g} on={grade === g} onClick={() => setGrade(g)}>{GRADE_NAMES[g]}</Pill>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={printIt} disabled={!lateList.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          طباعة / PDF
        </button>
        <button onClick={excelIt} disabled={!lateList.length}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          تصدير Excel
        </button>
      </div>

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}
      {rows && lateList.length === 0 && (
        <p className="rounded-card bg-present/10 px-4 py-6 text-center text-sm text-present">
          لا حالات تأخر مسجّلة في هذا اليوم.
        </p>
      )}

      {lateList.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {lateList.map((r) => (
            <div key={r.student_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                <p className="text-xs text-muted">
                  فصل <span className="num">{r.class_no}</span> · بصم{" "}
                  <span className="num">{fmtTime12(r.punch)}</span>
                </p>
              </div>
              <span className="num chip shrink-0 bg-late/10 text-late">
                {r.lateMinutes} د
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== أجهزة البصمة ==================== */

function DevicesTab() {
  const [devices, setDevices] = useState(null);
  const [noDevice, setNoDevice] = useState(0);

  useEffect(() => {
    (async () => {
      const [dv, nd] = await Promise.all([
        supabase.from("devices").select("serial_no, label, last_seen"),
        supabase.from("v_students_without_device").select("id", { count: "exact", head: true }),
      ]);
      setDevices(dv.data ?? []);
      setNoDevice(nd.count ?? 0);
    })();
  }, []);

  if (!devices) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">أجهزة البصمة</h2>
          {noDevice > 0 && (
            <span className="chip bg-late/10 text-late">
              <span className="num">{noDevice}</span>&nbsp;طالبًا بلا ربط
            </span>
          )}
        </div>
        {devices.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">لم تُسجَّل أجهزة بعد.</p>
        ) : (
          devices.map((v) => (
            <div key={v.serial_no}
                 className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.label ?? v.serial_no}</p>
                <p className="num truncate text-right text-xs text-faint">{v.serial_no}</p>
              </div>
              <span className={`chip shrink-0 ${v.last_seen ? "bg-present/10 text-present" : "bg-warning-light text-warning"}`}>
                {v.last_seen ? fmtDateTime(v.last_seen) : "لم يتصل بعد"}
              </span>
            </div>
          ))
        )}
      </section>

      <ColorLegend
        groups={[
          {
            title: "أجهزة البصمة",
            items: [
              { chip: "bg-present/10 text-present", sample: "متصل", label: "الجهاز يعمل ويرسل البيانات" },
              { chip: "bg-warning-light text-warning", sample: "لم يتصل", label: "لم يصل منه أي اتصال بعد" },
              { chip: "bg-late/10 text-late", sample: "بلا ربط", label: "طلاب بلا رقم في جهاز البصمة" },
            ],
          },
        ]}
      />
    </div>
  );
}

/* ==================== عناصر مشتركة ==================== */

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}

function Fig({ value, label, tone }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
      <p className={`num text-2xl font-bold leading-none ${tone ?? "text-ink"}`}>{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
}
