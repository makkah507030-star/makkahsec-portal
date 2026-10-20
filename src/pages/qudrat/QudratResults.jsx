// src/pages/qudrat/QudratResults.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtHijri } from "../../lib/dates";
import { MOCK_SETS, SKILLS } from "../../qudrat-content/index.js";
import { pctOf } from "./shared.jsx";

/* =====================================================================
   «نتائجي ومقارنتي» في مركز التدريب: سجل الاختبارات المحاكية وتطوّرها،
   ومقارنة نسبة صواب الطالب في كل مهارة بمتوسط المتدربين في المدرسة،
   وترتيبه بينهم (qudrat_compare: أرقام مجمّعة بلا أسماء، qudrat_2.sql).
   ===================================================================== */

export default function QudratResults({ mocks, refreshKey }) {
  const [cmp, setCmp] = useState(null);
  useEffect(() => {
    supabase.rpc("qudrat_compare").then(({ data }) => setCmp(data ?? []));
  }, [refreshKey]);

  const rank = cmp?.find((r) => r.my_rank != null);
  const rows = (cmp ?? []).filter((r) => SKILLS[r.skill] && r.my_pct != null);
  const hist = [...mocks].reverse();   // الأقدم أولًا للرسم

  if (!mocks.length && !rows.length) return null;
  return (
    <section className="space-y-2.5">
      <h2 className="font-bold text-ink">نتائجي ومقارنتي</h2>

      {mocks.length > 0 && (
        <div className="card px-4 py-3.5">
          <p className="text-sm font-bold text-ink">الاختبارات المحاكية</p>
          <div className="mt-3 flex h-28 items-end gap-2">
            {hist.slice(-10).map((m) => {
              const p = pctOf(m.correct, m.total);
              return (
                <div key={m.id ?? m.created_at} className="flex flex-1 flex-col items-center gap-1">
                  <span className="num text-[11px] font-semibold text-ink">{p}%</span>
                  <div className={`w-full max-w-10 rounded-t-sm2 ${p >= 70 ? "bg-present" : p >= 50 ? "bg-late" : "bg-absent"}`} style={{ height: `${Math.max(4, p * 0.8)}px` }} />
                  <span className="num text-[10px] text-faint">{fmtHijri(m.created_at).slice(0, 5)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 divide-y divide-line/50 border-t border-line/60">
            {mocks.slice(0, 5).map((m) => (
              <p key={m.id ?? m.created_at} className="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
                <span className="text-ink">{MOCK_SETS.find((s) => s.code === m.set_code)?.t ?? m.set_code}</span>
                <span className="text-muted">الكمي <span className="num">{m.quant_pct}%</span> · اللفظي <span className="num">{m.verbal_pct}%</span> ·
                  <b className="num text-ink"> {pctOf(m.correct, m.total)}%</b></span>
              </p>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card px-4 py-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-ink">مقارنة بمتوسط المتدربين في المدرسة</p>
            {rank?.ranked > 1 && <p className="text-xs text-muted">ترتيبك <b className="num text-mint-deep">{rank.my_rank}</b> من <span className="num">{rank.ranked}</span> متدربًا</p>}
          </div>
          <div className="mt-1 flex gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-mint-deep" />أنت</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-faint/50" />المتوسط</span>
          </div>
          <div className="mt-2 space-y-2.5">
            {rows.sort((a, b) => (a.my_pct - a.avg_pct) - (b.my_pct - b.avg_pct)).map((r) => (
              <div key={r.skill} className="text-sm">
                <div className="flex justify-between">
                  <span className="text-ink">{SKILLS[r.skill].t}</span>
                  <span className={`text-xs font-semibold ${r.my_pct >= r.avg_pct ? "text-present" : "text-late"}`}>
                    {r.my_pct >= r.avg_pct ? "فوق المتوسط" : "دون المتوسط"}</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-canvas"><div className="h-full rounded-full bg-mint-deep" style={{ width: `${r.my_pct}%` }} /></div><span className="num w-9 text-left text-[11px] text-ink">{r.my_pct}%</span></div>
                  <div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-canvas"><div className="h-full rounded-full bg-faint/50" style={{ width: `${r.avg_pct}%` }} /></div><span className="num w-9 text-left text-[11px] text-muted">{r.avg_pct}%</span></div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-faint">المتوسط من كل من تدرّب في المركز، دون أسماء. والترتيب لمن أجاب عن <span className="num">20</span> سؤالًا فأكثر.</p>
        </div>
      )}
    </section>
  );
}
