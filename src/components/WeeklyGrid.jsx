import { DAY_NAMES, DAYS, fmtClock, indexByDayPeriod, periodNumbers } from "../lib/scheduleGrid";

/**
 * جدول فردي أسبوعي — لمعلم واحد أو فصل واحد.
 * الحصص أعمدة أفقية أعلى الجدول، والأيام صفوف عمودية.
 */
export default function WeeklyGrid({ rows, cell }) {
  const idx = indexByDayPeriod(rows);
  const periods = periodNumbers(rows);

  if (!periods.length) {
    return (
      <p className="rounded-card bg-gray-tint px-4 py-8 text-center text-sm text-muted">
        لا حصص مسجَّلة.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-line bg-mint-tint px-2 py-2 text-xs font-semibold text-mint-deep">
              اليوم
            </th>
            {periods.map((p) => (
              <th key={p} className="num border border-line bg-mint-tint px-2 py-2 text-xs font-semibold text-mint-deep">
                {p}
                {idx[DAYS[0]]?.[p] && (
                  <span className="num mt-0.5 block text-[10px] font-normal text-faint">
                    {fmtClock(idx[DAYS[0]][p].start_time)}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d) => (
            <tr key={d}>
              <td className="border border-line bg-gray-tint px-2 py-2 text-center text-xs font-bold text-ink">
                {DAY_NAMES[d]}
              </td>
              {periods.map((p) => {
                const r = idx[d]?.[p];
                return (
                  <td key={p} className="border border-line px-2 py-2 text-center align-middle">
                    {r ? cell(r) : <span className="text-faint">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
