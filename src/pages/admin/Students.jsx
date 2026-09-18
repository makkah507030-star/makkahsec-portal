import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { exportStyledExcel, printReport, STUDENT_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const TRACK_LABEL = {
  common_year: "السنة المشتركة",
  general_track: "المسار العام",
};
const trackName = (t) => TRACK_LABEL[t] ?? t ?? "";

export default function Students() {
  const [rows, setRows] = useState(null);
  const [guardians, setGuardians] = useState(new Map());
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState(0);
  const [cls, setCls] = useState(0);
  const [track, setTrack] = useState("");
  const [onlyNoGuardian, setOnlyNoGuardian] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("v_active_students").select("*").order("class_no");
      setRows(data ?? []);
      const { data: gs } = await supabase.from("guardian_student")
        .select("student_id, guardians(full_name, mobile)");
      setGuardians(new Map((gs ?? []).map((r) => [r.student_id, r.guardians])));
    })();
  }, []);

  const classList = useMemo(() => {
    const src = track ? (rows ?? []).filter((r) => r.track === track) : (rows ?? []);
    return [...new Set(src.map((r) => r.class_no))].sort((a, b) => a - b);
  }, [rows, track]);

  const trackList = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.track).filter(Boolean))],
    [rows]
  );

  // الصفوف المتاحة ضمن المسار المختار
  const gradeList = useMemo(() => {
    const src = track ? (rows ?? []).filter((r) => r.track === track) : (rows ?? []);
    return [...new Set(src.map((r) => r.grade))].sort((a, b) => a - b);
  }, [rows, track]);

  // عدد الطلاب بلا ولي أمر (يُستخدم لإظهار الفلتر عند الحاجة فقط)
  const noGuardianCount = useMemo(
    () => (rows ?? []).filter((r) => !guardians.get(r.student_id)).length,
    [rows, guardians]
  );

  const filtered = useMemo(() => {
    const term = q.trim();
    return (rows ?? []).filter((r) =>
      (!grade || r.grade === grade) &&
      (!cls || r.class_no === cls) &&
      (!track || r.track === track) &&
      (!onlyNoGuardian || !guardians.get(r.student_id)) &&
      (!term || r.full_name?.includes(term) || r.national_id?.includes(term))
    );
  }, [rows, q, grade, cls, track, onlyNoGuardian, guardians]);

  // وصف الفلاتر المطبّقة (يظهر في رأس التقرير المطبوع)
  const filterLabel = useMemo(() => {
    const parts = [];
    if (track) parts.push(trackName(track));
    if (grade) parts.push(GRADE_NAMES[grade]);
    if (cls) parts.push(`فصل ${cls}`);
    if (onlyNoGuardian) parts.push("بلا ولي أمر");
    if (q.trim()) parts.push(`بحث: ${q.trim()}`);
    return parts.join(" · ") || "كل الطلاب";
  }, [track, grade, cls, onlyNoGuardian, q]);

  const resetFilters = () => {
    setQ(""); setGrade(0); setCls(0); setTrack(""); setOnlyNoGuardian(false);
  };

  // عدد الطلاب لكل صف (ضمن المسار المختار إن وجد)
  const countByGrade = useMemo(() => {
    const src = track ? (rows ?? []).filter((r) => r.track === track) : (rows ?? []);
    const m = new Map();
    src.forEach((r) => m.set(r.grade, (m.get(r.grade) ?? 0) + 1));
    return m;
  }, [rows, track]);

  // عدد الطلاب لكل فصل ضمن الصف المختار
  const countByClass = useMemo(() => {
    const src = (rows ?? []).filter((r) => r.grade === grade && (!track || r.track === track));
    const m = new Map();
    src.forEach((r) => m.set(r.class_no, (m.get(r.class_no) ?? 0) + 1));
    return m;
  }, [rows, grade, track]);

  // نتصفح بالبطاقات (صف ثم فصل) ما لم يكن فيه بحث نصي فعّال
  const searching = q.trim().length > 0;
  const browsingGrades = !searching && !grade;
  const browsingClasses = !searching && grade > 0 && !cls;

  const excelHeaders = ["م", "رقم الهوية", "اسم الطالب", "الصف", "الفصل", "المسار", "ولي الأمر", "جوال ولي الأمر"];

  const excelRows = () =>
    filtered.map((r, i) => {
      const g = guardians.get(r.student_id);
      return [
        i + 1,
        r.national_id ?? "",
        r.full_name ?? "",
        GRADE_NAMES[r.grade] ?? r.grade,
        r.class_no ?? "",
        trackName(r.track),
        g?.full_name ?? "",
        g?.mobile ?? "",
      ];
    });

  const handleExcel = () =>
    exportStyledExcel({
      title: "قائمة الطلاب",
      subtitle: filterLabel,
      headers: excelHeaders,
      rows: excelRows(),
      fileName: "قائمة-الطلاب",
      sheetName: "الطلاب",
      signatures: [
        { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });

  const handlePrint = () => {
    printReport({
      title: "قائمة الطلاب",
      subtitle: filterLabel,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      secondSignature: { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
      headers: ["م", "رقم الهوية", "اسم الطالب", "الصف", "الفصل", "ولي الأمر", "الجوال"],
      rows: filtered.map((r, i) => {
        const g = guardians.get(r.student_id);
        return [
          i + 1,
          r.national_id ?? "",
          r.full_name ?? "",
          GRADE_NAMES[r.grade] ?? r.grade,
          r.class_no ?? "",
          g?.full_name ?? "",
          g?.mobile ?? "",
        ];
      }),
    });
  };

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  const hasFilters = q || grade || cls || track || onlyNoGuardian;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold">الطلاب</h1>
        <p className="text-sm text-muted">
          <span className="num font-semibold text-ink">{filtered.length}</span> من{" "}
          <span className="num">{rows.length}</span>
        </p>
      </header>

      <input className="field" placeholder="بحث بالاسم أو رقم الهوية"
             value={q} onChange={(e) => setQ(e.target.value)} />

      {trackList.length > 1 && (browsingGrades || browsingClasses) && (
        <div className="flex flex-wrap gap-1.5">
          <Pill on={!track} onClick={() => { setTrack(""); setGrade(0); setCls(0); }}>كل المسارات</Pill>
          {trackList.map((t) => (
            <Pill key={t} on={track === t} onClick={() => { setTrack(t); setGrade(0); setCls(0); }}>{trackName(t)}</Pill>
          ))}
        </div>
      )}

      {/* مسار التصفح: كل الطلاب ‹ الصف ‹ الفصل */}
      {!browsingGrades && (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <button onClick={() => { setGrade(0); setCls(0); }} className="font-medium text-mint-deep hover:underline">
            كل الصفوف
          </button>
          {grade > 0 && (
            <>
              <span>‹</span>
              <button onClick={() => setCls(0)}
                className={browsingClasses ? "font-semibold text-ink" : "font-medium text-mint-deep hover:underline"}>
                {GRADE_NAMES[grade]}
              </button>
            </>
          )}
          {cls > 0 && (
            <>
              <span>‹</span>
              <span className="num font-semibold text-ink">فصل {cls}</span>
            </>
          )}
          {searching && <span className="text-faint">— نتائج بحث في كل الطلاب</span>}
        </nav>
      )}

      {/* الخطوة 1: اختيار الصف */}
      {browsingGrades && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {gradeList.map((g) => (
            <button key={g} onClick={() => { setGrade(g); setCls(0); }}
              className="card flex items-center justify-between px-4 py-4 text-right hover:bg-canvas">
              <span className="font-semibold text-ink">{GRADE_NAMES[g]}</span>
              <span className="num rounded-pill bg-mint-tint px-2.5 py-1 text-xs font-bold text-mint-deep">
                {countByGrade.get(g) ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* الخطوة 2: اختيار الفصل */}
      {browsingClasses && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {classList.filter((c) => Math.floor(c / 100) === grade).map((c) => (
            <button key={c} onClick={() => setCls(c)}
              className="card flex flex-col items-center gap-1 px-3 py-4 hover:bg-canvas">
              <span className="num text-lg font-bold text-ink">{c}</span>
              <span className="num text-xs text-muted">{countByClass.get(c) ?? 0} طالب</span>
            </button>
          ))}
        </div>
      )}

      {/* الخطوة 3: قائمة الطلاب — بعد اختيار فصل، أو أثناء البحث */}
      {(cls > 0 || searching) && (
        <>
          {/* فلاتر إضافية */}
          <div className="flex flex-wrap items-center gap-1.5">
            {noGuardianCount > 0 && (
              <Pill on={onlyNoGuardian} onClick={() => setOnlyNoGuardian((v) => !v)}>
                بلا ولي أمر <span className="num">({noGuardianCount})</span>
              </Pill>
            )}
            {hasFilters && (
              <button onClick={resetFilters}
                className="shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium text-absent hover:bg-absent/5">
                مسح الفلاتر
              </button>
            )}
          </div>

          {/* أزرار التصدير */}
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExcel} disabled={!filtered.length}
              className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
              تصدير Excel
            </button>
            <button onClick={handlePrint} disabled={!filtered.length}
              className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
              طباعة / PDF
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              <p className="font-semibold">لا نتائج</p>
              <p className="mt-1 text-sm text-muted">جرّب اسمًا آخر أو غيّر الفلتر.</p>
            </div>
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {filtered.slice(0, 300).map((r) => {
                const g = guardians.get(r.student_id);
                return (
                  <div key={r.student_id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.full_name}</p>
                      <p className="num mt-0.5 text-right text-xs text-faint">{r.national_id}</p>
                      {g ? (
                        <p className="mt-1 truncate text-xs text-muted">
                          {g.full_name} · <span className="num">{g.mobile}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-late">بلا ولي أمر مسجّل</p>
                      )}
                    </div>
                    <span className="num shrink-0 rounded-md bg-mint-tint px-2 py-1 text-xs font-bold text-mint-deep">
                      {r.class_no}
                    </span>
                  </div>
                );
              })}
              {filtered.length > 300 && (
                <p className="px-4 py-3 text-center text-xs text-muted">
                  يُعرض أول 300 — التصدير والطباعة يشملان كل النتائج (
                  <span className="num">{filtered.length}</span>).
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}
