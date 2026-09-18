import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { gradeBand, REPORT_TYPE_LABEL } from "../lib/gradeBands";

const ORDER = ["period1", "period2", "final"];

/** بطاقة نتائج الطالب — تُستخدم في صفحة الطالب وولي الأمر */
export default function ResultsCard({ studentId }) {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const { data: sset } = await supabase
        .from("settings").select("key, value").eq("key", "active_year").maybeSingle();
      const year = sset?.value ?? "";

      const { data } = await supabase
        .from("student_results")
        .select("id, report_type, average, rank_class, class_count, rank_grade, grade_count, file_path")
        .eq("student_id", studentId)
        .eq("academic_year", year);

      const sorted = (data ?? []).sort(
        (a, b) => ORDER.indexOf(a.report_type) - ORDER.indexOf(b.report_type)
      );
      setRows(sorted);
    })();
  }, [studentId]);

  const openPdf = async (row) => {
    setBusyId(row.id);
    const { data, error } = await supabase.storage
      .from("results")
      .createSignedUrl(row.file_path, 120);
    setBusyId(null);
    if (error || !data?.signedUrl) {
      alert("تعذّر فتح الملف، حاول مرة أخرى.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (rows === null) return null;

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">النتائج</h2>

      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted">لم تُنشر نتائج بعد.</p>
      ) : (
        <div className="divide-y divide-line">
          {rows.map((r) => {
            const band = gradeBand(r.average, r.report_type);
            return (
              <div key={r.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">
                    {REPORT_TYPE_LABEL[r.report_type] ?? r.report_type}
                  </p>
                  {band && (
                    <span
                      className="rounded-pill px-3 py-1 text-xs font-bold"
                      style={{ background: band.bg, color: band.text }}
                    >
                      {band.label}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-sm2 border border-line bg-canvas px-2 py-2.5">
                    <p className="num text-lg font-bold leading-none text-ink">
                      {r.average != null ? r.average : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">النسبة المئوية</p>
                  </div>
                  <div className="rounded-sm2 border border-line bg-canvas px-2 py-2.5">
                    <p className="num text-lg font-bold leading-none text-ink">
                      {r.rank_class != null ? `${r.rank_class} / ${r.class_count}` : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">ترتيبه على الفصل</p>
                  </div>
                  <div className="rounded-sm2 border border-line bg-canvas px-2 py-2.5">
                    <p className="num text-lg font-bold leading-none text-ink">
                      {r.rank_grade != null ? `${r.rank_grade} / ${r.grade_count}` : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">ترتيبه على المدرسة</p>
                  </div>
                </div>

                <button
                  onClick={() => openPdf(r)}
                  disabled={busyId === r.id}
                  className="mt-3 w-full rounded-sm2 border border-line bg-paper py-2 text-sm font-medium text-mint-deep hover:bg-mint-tint disabled:opacity-50"
                >
                  {busyId === r.id ? "جارٍ الفتح…" : "عرض النتيجة PDF"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
