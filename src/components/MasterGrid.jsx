import { useState } from "react";
import { DAY_NAMES, DAYS, indexByDayPeriod, periodNumbers } from "../lib/scheduleGrid";

/**
 * جدول شامل — كل الكيانات (معلمون أو فصول) × كل الحصص، ليوم واحد
 * في كل مرة، مع تبويبات للتنقل بين الأيام.
 *
 * entities: [{ id, label }]
 * rowsByEntity: Map<entity.id, schedule rows>
 */
export default function MasterGrid({ entities, rowsByEntity, cell, entityHeader = "المعلم" }) {
  const [day, setDay] = useState(1);

  const allPeriods = new Set();
  entities.forEach((e) => {
    periodNumbers(rowsByEntity.get(e.id) ?? []).forEach((p) => allPeriods.add(p));
  });
  const periods = [...allPeriods].sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => (
          <button key={d} onClick={() => setDay(d)}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
              day === d ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {DAY_NAMES[d]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky right-0 z-10 border border-line bg-mint-tint px-2 py-2 text-right font-semibold text-mint-deep">
                {entityHeader}
              </th>
              {periods.map((p) => (
                <th key={p} className="num border border-line bg-mint-tint px-2 py-2 font-semibold text-mint-deep">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => {
              const idx = indexByDayPeriod(rowsByEntity.get(e.id) ?? []);
              return (
                <tr key={e.id}>
                  <td className="sticky right-0 z-10 truncate border border-line bg-white px-2 py-1.5 text-right font-medium text-ink">
                    {e.label}
                  </td>
                  {periods.map((p) => {
                    const r = idx[day]?.[p];
                    return (
                      <td key={p} className="border border-line px-1.5 py-1.5 text-center">
                        {r ? cell(r) : <span className="text-faint">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
