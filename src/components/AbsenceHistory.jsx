import { useMemo, useState } from "react";
import { fmtGreg } from "../lib/dates";

const LABEL = { absent: "غائب", late: "متأخر", excused: "مستأذن" };
const TONE = {
  absent: "bg-absent/10 text-absent",
  late: "bg-late/10 text-late",
  excused: "bg-excused/10 text-excused",
};

/**
 * سجل الغياب والتأخر — مُجمَّع باليوم (وليس بالحصة كقيمة رئيسية):
 * كل يوم صف واحد قابل للفتح يعرض ملخص الحالات، وبالفتح تفاصيل كل
 * حصة غاب/تأخر/استأذن عنها الطالب في ذلك اليوم.
 */
export default function AbsenceHistory({ records }) {
  const [openDate, setOpenDate] = useState(null);

  const byDay = useMemo(() => {
    const m = new Map();
    records.forEach((r) => {
      if (!m.has(r.attend_date)) m.set(r.attend_date, []);
      m.get(r.attend_date).push(r);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
        سجل الغياب والتأخر
      </h2>

      {byDay.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted">السجل نظيف — لا غياب ولا تأخر.</p>
      ) : (
        <div className="divide-y divide-line">
          {byDay.map(([date, list]) => {
            const isOpen = openDate === date;
            const counts = { absent: 0, late: 0, excused: 0 };
            list.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });

            return (
              <div key={date}>
                <button
                  onClick={() => setOpenDate(isOpen ? null : date)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-right hover:bg-canvas"
                >
                  <span className="num text-sm font-medium text-ink">
                    {fmtGreg(date + "T00:00:00")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {["absent", "late", "excused"].map((k) =>
                      counts[k] > 0 ? (
                        <span key={k} className={`chip ${TONE[k]}`}>
                          <span className="num">{counts[k]}</span> {LABEL[k]}
                        </span>
                      ) : null
                    )}
                    <svg viewBox="0 0 24 24" fill="none"
                      className={`h-4 w-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-line bg-canvas">
                    {list.map((r, i) => (
                      <div key={i}
                        className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
                        <p className="truncate text-xs text-muted">
                          الحصة <span className="num">{r.schedule?.period_no ?? "—"}</span> ·{" "}
                          {r.schedule?.subjects?.name ?? "—"}
                        </p>
                        <span className={`chip shrink-0 ${TONE[r.status]}`}>{LABEL[r.status]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
