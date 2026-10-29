// src/pages/polls/PollResults.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { pct } from "../../lib/polls.js";

/* نتائج الاستطلاع بأشرطة: الأصوات لكل خيار ونسبتها، وعدد المصوّتين ونسبة المشاركة لمنشئه.
   rows تمرَّر جاهزة إن حُمّلت مسبقًا، وإلا تُطلب من poll_results (القاعدة تقرر هل تظهر). */
export function usePollResults(pollId, reloadKey = 0) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!pollId) return;
    supabase.rpc("poll_results", { p_poll: pollId }).then(({ data, error }) => {
      setErr(error ? error.message : ""); setRows(error ? [] : data ?? []);
    });
  }, [pollId, reloadKey]);
  return { rows, err };
}

export default function PollResults({ rows, showTurnout = false }) {
  if (!rows?.length) return null;
  const total = rows.reduce((a, r) => a + r.votes, 0);
  const max = Math.max(1, ...rows.map((r) => r.votes));
  const sorted = [...rows].sort((a, b) => b.votes - a.votes);
  const { voters, eligible } = rows[0];
  return (
    <div className="space-y-2">
      {sorted.map((r, i) => (
        <div key={r.option_id} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className={`min-w-0 truncate ${i === 0 && r.votes > 0 ? "font-bold text-ink" : "text-ink"}`}>
              {i === 0 && r.votes > 0 && <span className="me-1 text-late" aria-hidden="true">★</span>}{r.label}
              {r.note && <span className="ms-1 text-xs text-muted">· {r.note}</span>}
            </span>
            <span className="num shrink-0 text-xs text-muted"><b className="text-ink">{r.votes}</b> · {pct(r.votes, total)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-mint-deep" style={{ width: `${(100 * r.votes) / max}%` }} />
          </div>
        </div>
      ))}
      <p className="pt-1 text-xs text-muted">
        صوّت <span className="num font-semibold text-ink">{voters}</span>
        {showTurnout && eligible != null && <> من <span className="num">{eligible}</span> يحق لهم · المشاركة <span className="num font-semibold text-ink">{pct(voters, eligible)}%</span></>}
      </p>
    </div>
  );
}
