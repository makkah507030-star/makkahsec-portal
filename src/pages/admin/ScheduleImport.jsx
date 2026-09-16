import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { readSmartSchedule, normalizeArabic, stripGradeSuffix } from "../../lib/importer";

const BATCH = 400;

/**
 * استيراد الجدول الذكي — منقول من شاشة الاستيراد العامة إلى
 * قسم الشؤون التعليمية، لارتباطه المباشر بالجداول لا ببيانات نور.
 *
 * نفس منطق المطابقة والكتابة المستخدم سابقًا، بلا تعديل جوهري —
 * فقط بواجهة مخصَّصة لهذا النوع وحده.
 */
export default function ScheduleImport() {
  const { session } = useSession();
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState("pick");
  const [report, setReport] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [year, setYear] = useState(null);
  const [yearLabel, setYearLabel] = useState(null);
  const [term, setTerm] = useState(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["active_year", "active_term", "active_year_label"])
      .then(({ data }) => {
        const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
        setYear(m.active_year ?? null);
        setYearLabel(m.active_year_label ?? m.active_year ?? null);
        setTerm(m.active_term ? Number(m.active_term) : null);
      });
  }, []);

  const analyze = async () => {
    setError("");
    if (!file) return;
    if (!year) {
      setError("لم تُضبط السنة الدراسية النشطة في الإعدادات.");
      return;
    }
    try {
      const raw = await readSmartSchedule(file);
      const res = await matchSmart(raw, year, term);
      setReport({
        total: raw.length,
        valid: res.valid,
        rejected: res.rejected,
        newCount: res.valid.length,
        updateCount: 0,
        missingCount: res.existing,
      });
      setStage("preview");
    } catch (e) {
      setError(e.message ?? String(e));
    }
  };

  const run = async () => {
    setStage("running");
    setProgress(0);
    setError("");

    const { data: log } = await supabase
      .from("import_logs")
      .insert({
        import_type: "smart",
        file_name: file?.name ?? null,
        performed_by: session?.user?.id ?? null,
        status: "running",
        academic_year: year,
      })
      .select("id")
      .maybeSingle();

    try {
      await upsertBatched(
        "schedule",
        report.valid.map(({ __row, ...r }) => ({ ...r, term, academic_year: year })),
        "class_id,day_of_week,period_no,term,academic_year",
        setProgress
      );

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">استيراد الجدول الذكي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          الملف يُقرأ داخل متصفحك ولا يُرفع لأي خادم. تُرسل السجلات النظيفة فقط بعد مراجعتك.
          يتحدَّث الجدول تلقائيًا في كل مواقعه (جداول المعلمين والطلاب والجدول المدرسي والعام)
          فور تنفيذ الاستيراد.
        </p>
        <p className="mt-2 text-sm">
          السنة الدراسية:{" "}
          <span className="num font-semibold text-mint-deep">{yearLabel ?? "…"}</span>
          <span className="text-muted"> · الفصل </span>
          <span className="num font-semibold text-mint-deep">{term ?? "…"}</span>
          <span className="text-muted"> — تُؤخذ من إعدادات النظام.</span>
        </p>
      </div>

      {stage === "pick" && (
        <div className="card space-y-4 p-5">
          <div>
            <p className="text-xs leading-relaxed text-muted">
              ارفع ملف xlsx المُصدَّر من برنامج الجدول الذكي كما هو — بلا تعديل.
              يُقرأ الجدول كاملًا ويُطابَق مع المعلمين والمواد المسجَّلين في النظام.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="f">الملف</label>
            <input
              id="f"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="field file:ml-3 file:rounded-md file:border-0 file:bg-mint-deep-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-mint-deep"
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

      {stage === "preview" && report && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="جديد" value={report.newCount} tone="present" />
            <Stat label="مرفوض" value={report.rejected.length} tone="absent" />
            <Stat label="حصص موجودة مسبقًا" value={report.missingCount} tone="late" />
          </div>

          {report.rejected.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-semibold">
                  الصفوف المرفوضة ({report.rejected.length})
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  لن تُستورد. صحّحها في الملف أو راجع تسجيل المعلمين/المواد.
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
            <button className="btn-primary" onClick={run} disabled={report.valid.length === 0}>
              تنفيذ الاستيراد ({report.valid.length} حصة)
            </button>
            <button className="btn-ghost" onClick={reset}>إلغاء</button>
          </div>
        </>
      )}

      {stage === "running" && (
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium">جارٍ الاستيراد…</p>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-mint-deep transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 num text-xs text-muted">{progress}%</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            لا تغلق الصفحة. لو انقطع الاتصال، أعد الاستيراد — التكرار آمن.
          </p>
        </div>
      )}

      {stage === "done" && (
        <div className="card border-present/30 bg-present/5 p-5">
          <p className="font-semibold text-present">اكتمل الاستيراد</p>
          <p className="mt-1 text-sm text-muted">
            أُضيفت <span className="num">{report.newCount}</span> حصة. الجدول محدَّث الآن
            في كل الشاشات تلقائيًا.
          </p>
          <button className="btn-ghost mt-4" onClick={reset}>استيراد ملف آخر</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = { present: "text-present", absent: "text-absent", late: "text-late" };
  return (
    <div className="card p-4">
      <p className={`num text-2xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

/* ================================================================== */
/* مطابقة الجدول الذكي — نفس المنطق المنقول حرفيًا بلا تعديل جوهري       */
/* ================================================================== */

async function matchSmart(raw, year, term) {
  const [{ data: tRows }, { data: cRows }, { data: sRows },
         { data: aRows }, { data: exRows }] = await Promise.all([
    supabase.from("teachers").select("id, full_name"),
    supabase.from("classes").select("id, class_no, grade").eq("academic_year", year),
    supabase.from("subjects").select("id, name, grade").eq("term", term),
    supabase.from("subject_aliases").select("external_name, grade, subject_name"),
    supabase.from("schedule").select("id").eq("academic_year", year).eq("term", term),
  ]);

  const tId = new Map((tRows ?? []).map((r) => [normalizeArabic(r.full_name), r.id]));
  const cRow = new Map((cRows ?? []).map((r) => [r.class_no, r]));
  const sId = new Map(
    (sRows ?? []).map((r) => [`${normalizeArabic(r.name)}|${r.grade}`, r.id])
  );
  const alias = new Map(
    (aRows ?? []).map((r) => [`${normalizeArabic(r.external_name)}|${r.grade}`, r.subject_name])
  );

  const valid = [];
  const rejected = [];
  const seen = new Set();

  for (const r of raw) {
    const errors = [];
    const c = cRow.get(r.class_no);
    if (!c) errors.push(`الفصل ${r.class_no} غير موجود`);

    const tKey = normalizeArabic(r.teacher_name);
    const teacherId = tId.get(tKey);
    if (!teacherId) errors.push(`المعلم غير مسجّل: ${r.teacher_name}`);

    let subjectId = null;
    if (c) {
      const aliasName = alias.get(`${normalizeArabic(r.subject_name)}|${c.grade}`);
      const candidate = aliasName
        ? normalizeArabic(aliasName)
        : normalizeArabic(stripGradeSuffix(r.subject_name));
      subjectId = sId.get(`${candidate}|${c.grade}`);
      if (!subjectId) {
        errors.push(`المادة غير مطابقة: ${r.subject_name} (صف ${c.grade})`);
      }
    }

    const slot = `${r.class_no}|${r.day_of_week}|${r.period_no}`;
    if (seen.has(slot)) errors.push("تعارض: الفصل له حصة أخرى في نفس الوقت");
    seen.add(slot);

    if (errors.length) {
      rejected.push({ __row: r.__row, __errors: errors });
    } else {
      valid.push({
        __row: r.__row,
        teacher_id: teacherId,
        subject_id: subjectId,
        class_id: c.id,
        day_of_week: r.day_of_week,
        period_no: r.period_no,
      });
    }
  }

  return { valid, rejected, existing: (exRows ?? []).length };
}

async function upsertBatched(table, rows, onConflict, onProgress) {
  if (!rows.length) { onProgress?.(100); return; }
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`schedule: ${error.message}`);
    onProgress?.(Math.round(((i + chunk.length) / rows.length) * 100));
  }
}
