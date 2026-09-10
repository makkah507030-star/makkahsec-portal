import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import {
  IMPORT_TYPES,
  readSheet,
  validateRows,
} from "../../lib/importer";

const BATCH = 400;

export default function Import() {
  const { session } = useSession();
  const [type, setType] = useState("classes");
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState("pick");   // pick | preview | running | done
  const [report, setReport] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [year, setYear] = useState(null);

  const def = IMPORT_TYPES[type];

  // السنة الدراسية تُقرأ من الإعدادات، لا من الملف
  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "active_year")
      .maybeSingle()
      .then(({ data }) => setYear(data?.value ?? null));
  }, []);

  /* ---------------- المرحلة 1: القراءة والمقارنة ---------------- */
  const analyze = async () => {
    setError("");
    if (!file) return;
    if (!year) {
      setError("لم تُضبط السنة الدراسية النشطة في الإعدادات.");
      return;
    }
    try {
      const { rows, sheetName } = await readSheet(file, def.required);
      const { valid, rejected } = validateRows(type, rows);

      const compare = await compareWithDb(type, valid, year);

      setReport({
        sheetName,
        total: rows.length,
        valid,
        rejected,
        ...compare,
      });
      setStage("preview");
    } catch (e) {
      setError(e.message ?? String(e));
    }
  };

  /* ---------------- المرحلة 2: التنفيذ ---------------- */
  const run = async () => {
    setStage("running");
    setProgress(0);
    setError("");

    // سجل الاستيراد يبدأ بحالة "جارٍ"
    const { data: log } = await supabase
      .from("import_logs")
      .insert({
        import_type: type,
        file_name: file?.name ?? null,
        performed_by: session?.user?.id ?? null,
        status: "running",
        academic_year: year,
      })
      .select("id")
      .maybeSingle();

    try {
      await writeRows(type, report.valid, year, (p) => setProgress(p));

      await supabase
        .from("import_logs")
        .update({
          status: "completed",
          rows_inserted: report.newCount,
          rows_updated: report.updateCount,
          rows_rejected: report.rejected.length,
          rows_missing: report.missingCount,
          finished_at: new Date().toISOString(),
        })
        .eq("id", log?.id);

      setStage("done");
    } catch (e) {
      await supabase
        .from("import_logs")
        .update({
          status: "failed",
          error_detail: String(e.message ?? e).slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("id", log?.id);

      setError(String(e.message ?? e));
      setStage("preview");
    }
  };

  const reset = () => {
    setFile(null);
    setReport(null);
    setStage("pick");
    setProgress(0);
    setError("");
  };

  /* ---------------- الواجهة ---------------- */
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">الاستيراد</h1>
        <p className="mt-1 text-sm text-muted">
          الملف يُقرأ داخل متصفحك ولا يُرفع لأي خادم. تُرسل السجلات النظيفة فقط بعد مراجعتك.
        </p>
        <p className="mt-2 text-sm">
          السنة الدراسية:{" "}
          <span className="num font-semibold text-brand">{year ?? "…"}</span>
          <span className="text-muted"> — تُؤخذ من إعدادات النظام، لا من الملف.</span>
        </p>
      </div>

      {/* اختيار النوع والملف */}
      {stage === "pick" && (
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">نوع البيانات</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(IMPORT_TYPES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={
                    type === k
                      ? "rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white"
                      : "rounded-lg border border-line px-3.5 py-2 text-sm font-medium hover:bg-canvas"
                  }
                >
                  {v.label}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-muted">
              الأعمدة المطلوبة:{" "}
              <span className="num">{def.required.join(" · ")}</span>
            </p>
          </div>

          <div>
            <label className="label" htmlFor="f">الملف</label>
            <input
              id="f"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="field file:ml-3 file:rounded-md file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand"
            />
          </div>

          <button className="btn-primary" onClick={analyze} disabled={!file}>
            فحص الملف
          </button>
        </div>
      )}

      {error && (
        <div className="card border-absent/30 bg-absent/5 p-4">
          <p className="text-sm leading-relaxed text-absent">{error}</p>
        </div>
      )}

      {/* المعاينة */}
      {stage === "preview" && report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="جديد" value={report.newCount} tone="present" />
            <Stat label="تحديث" value={report.updateCount} tone="excused" />
            <Stat label="مرفوض" value={report.rejected.length} tone="absent" />
            <Stat label="مفقود" value={report.missingCount} tone="late" />
          </div>

          {report.missingCount > 0 && (
            <div className="card border-late/30 bg-late/5 p-4">
              <p className="text-sm font-semibold text-late">
                {report.missingCount} سجلًا في قاعدة البيانات غير موجود في الملف
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                لن يُحذف أي منها. راجعها يدويًا بعد الاستيراد وعطّل ما يلزم — قد يكونون
                طلابًا نُقلوا، وقد يكون الملف ناقصًا.
              </p>
            </div>
          )}

          {report.rejected.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-semibold">
                  الصفوف المرفوضة ({report.rejected.length})
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  لن تُستورد. صحّحها في الملف وأعد الرفع.
                </p>
              </div>
              <div className="max-h-64 overflow-auto">
                {report.rejected.slice(0, 100).map((r, i) => (
                  <div key={i} className="border-b border-line px-4 py-2.5 last:border-0">
                    <p className="text-xs text-muted">
                      الصف <span className="num">{r.__row}</span>
                    </p>
                    <p className="text-sm">{r.__errors.join(" — ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={run}
              disabled={report.valid.length === 0}
            >
              تنفيذ الاستيراد ({report.valid.length} سجل)
            </button>
            <button className="btn-ghost" onClick={reset}>
              إلغاء
            </button>
          </div>
        </>
      )}

      {/* التنفيذ */}
      {stage === "running" && (
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium">جارٍ الاستيراد…</p>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 num text-xs text-muted">{progress}%</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            لا تغلق الصفحة. لو انقطع الاتصال، أعد الاستيراد — التكرار آمن.
          </p>
        </div>
      )}

      {/* اكتمل */}
      {stage === "done" && (
        <div className="card border-present/30 bg-present/5 p-5">
          <p className="font-semibold text-present">اكتمل الاستيراد</p>
          <p className="mt-1 text-sm text-muted">
            أُضيف <span className="num">{report.newCount}</span> وحُدّث{" "}
            <span className="num">{report.updateCount}</span>.
          </p>
          <button className="btn-ghost mt-4" onClick={reset}>
            استيراد ملف آخر
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    present: "text-present",
    absent: "text-absent",
    late: "text-late",
    excused: "text-excused",
  };
  return (
    <div className="card p-4">
      <p className={`num text-2xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

/* ================================================================== */
/* المقارنة مع قاعدة البيانات                                          */
/* ================================================================== */

async function compareWithDb(type, valid, year) {
  if (type === "classes") {
    const { data } = await supabase
      .from("classes")
      .select("class_no")
      .eq("academic_year", year);
    const existing = new Set((data ?? []).map((r) => r.class_no));
    const incoming = new Set(valid.map((r) => r.class_no));
    return {
      newCount: valid.filter((r) => !existing.has(r.class_no)).length,
      updateCount: valid.filter((r) => existing.has(r.class_no)).length,
      missingCount: [...existing].filter((c) => !incoming.has(c)).length,
    };
  }

  const table = type === "teachers" ? "teachers" : "students";
  const { data } = await supabase.from(table).select("national_id");
  const existing = new Set((data ?? []).map((r) => r.national_id));
  const incoming = new Set(valid.map((r) => r.national_id));

  return {
    newCount: valid.filter((r) => !existing.has(r.national_id)).length,
    updateCount: valid.filter((r) => existing.has(r.national_id)).length,
    missingCount: [...existing].filter((n) => !incoming.has(n)).length,
  };
}

/* ================================================================== */
/* الكتابة                                                             */
/* ================================================================== */

async function writeRows(type, rows, year, onProgress) {
  if (type === "classes") {
    await upsertBatched(
      "classes",
      rows.map(({ __row, ...r }) => ({ ...r, academic_year: year })),
      "class_no,academic_year",
      onProgress
    );
    return;
  }

  if (type === "teachers") {
    await upsertBatched(
      "teachers",
      rows.map(({ __row, ...r }) => r),
      "national_id",
      onProgress
    );
    return;
  }

  // الطلاب: أربع خطوات مترابطة
  // 1) الطلاب
  const students = rows.map((r) => ({
    national_id: r.national_id,
    identity_type: r.identity_type,
    full_name: r.full_name,
    birth_date: r.birth_date,
    nationality: r.nationality,
  }));
  await upsertBatched("students", students, "national_id", (p) => onProgress(Math.round(p * 0.4)));

  // 2) أولياء الأمور (المكرر يُدمج بهويته)
  const gMap = new Map();
  rows.forEach((r) =>
    gMap.set(r.guardian_id, {
      national_id: r.guardian_id,
      full_name: r.guardian_name,
      mobile: r.guardian_mobile,
    })
  );
  await upsertBatched("guardians", [...gMap.values()], "national_id",
    (p) => onProgress(40 + Math.round(p * 0.2)));

  // 3) جلب المعرّفات
  const [{ data: sRows }, { data: gRows }, { data: cRows }] = await Promise.all([
    supabase.from("students").select("id, national_id"),
    supabase.from("guardians").select("id, national_id"),
    supabase.from("classes").select("id, class_no").eq("academic_year", year),
  ]);

  const sId = new Map((sRows ?? []).map((r) => [r.national_id, r.id]));
  const gId = new Map((gRows ?? []).map((r) => [r.national_id, r.id]));
  const cId = new Map((cRows ?? []).map((r) => [r.class_no, r.id]));

  const missingClasses = [...new Set(rows.map((r) => r.class_no))]
    .filter((n) => !cId.has(n));
  if (missingClasses.length) {
    throw new Error(
      `الفصول التالية غير موجودة للعام ${year}: ${missingClasses.join("، ")}. ` +
        `استورد ملف الفصول أولًا.`
    );
  }

  // 4) الربط والتسجيل
  const links = rows.map((r) => ({
    guardian_id: gId.get(r.guardian_id),
    student_id: sId.get(r.national_id),
    relation: r.relation,
  })).filter((r) => r.guardian_id && r.student_id);

  await upsertBatched("guardian_student", links, "guardian_id,student_id",
    (p) => onProgress(60 + Math.round(p * 0.2)));

  const enroll = rows.map((r) => ({
    student_id: sId.get(r.national_id),
    class_id: cId.get(r.class_no),
    academic_year: year,
    status: r.status,
  })).filter((r) => r.student_id && r.class_id);

  await upsertBatched("student_enrollment", enroll, "student_id,academic_year",
    (p) => onProgress(80 + Math.round(p * 0.2)));
}

async function upsertBatched(table, rows, onConflict, onProgress) {
  if (!rows.length) {
    onProgress?.(100);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    onProgress?.(Math.round(((i + chunk.length) / rows.length) * 100));
  }
}
