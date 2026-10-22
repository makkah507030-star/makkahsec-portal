// src/components/PeriodNoticeCard.jsx
/* =====================================================================
   إشعار الفترة — في رئيسية الطالب وولي الأمر (supabase/period_notices.sql): المواد التي اكتمل
   رصدها في نور فقط، بأجزاء درجتها، والمواظبة والسلوك، و«آخر تحديث» لأن الإشعار يُعاد نشره
   كلما اكتمل رصد مواد أخرى. لا مجموع ولا نسبة ولا ترتيب.
   ===================================================================== */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { NOOR_NOTE } from "../lib/periodNotice";

function Notice({ n, open, onToggle }) {
  // أصناف التقويم كما وردت في المواد، بترتيب ظهورها
  const kinds = [...new Set(n.subjects.flatMap((s) => (s.parts ?? []).map((p) => p.label)))];
  const extra = [["المواظبة", n.attendance], ["السلوك المتميز", n.behavior_excellent], ["السلوك الإيجابي", n.behavior_positive]]
    .filter(([, v]) => v != null);
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 text-right">
        <span className="text-sm font-semibold text-ink">{n.title}</span>
        {n.term && <span className="chip bg-canvas text-muted">{n.term}</span>}
        <span className="mr-auto text-[11px] text-muted">آخر تحديث: <span className="num">{fmtDateTime(n.updated_at)}</span></span>
        <span className="text-xs text-mint-deep">{open ? "إخفاء" : "عرض"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {/* جدول كإشعار نور: المادة، ثم عمود لكل صنف من أصناف التقويم، والمجموع من العظمى آخرًا */}
          <div className="overflow-x-auto rounded-sm2 border border-line">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-mint-tint/60 text-[11px] leading-snug text-mint-deep">
                <tr>
                  <th className="sticky right-0 min-w-[8rem] bg-mint-tint px-3 py-2 text-right font-semibold">المادة</th>
                  {kinds.map((k) => <th key={k} className="min-w-[5rem] px-2 py-2 text-center font-medium">{k}</th>)}
                  <th className="bg-mint-tint px-3 py-2 text-center font-semibold">المجموع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {n.subjects.map((s) => {
                  const v = Object.fromEntries((s.parts ?? []).map((p) => [p.label, p.value]));
                  return (
                    <tr key={s.name}>
                      <td className="sticky right-0 min-w-[8rem] bg-white px-3 py-2 font-medium text-ink">{s.name}
                        {s.note && <span className="block text-[11px] font-normal text-warning">{s.note}</span>}</td>
                      {kinds.map((k) => <td key={k} className="num px-2 py-2 text-center text-ink">{v[k] ?? <span className="text-faint">—</span>}</td>)}
                      <td className="num whitespace-nowrap bg-mint-tint/30 px-3 py-2 text-center font-bold text-ink">{s.total}<span className="text-xs font-normal text-muted"> / {s.max}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {extra.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {extra.map(([k, v]) => (
                <div key={k} className="rounded-sm2 border border-line bg-canvas px-2 py-2">
                  <p className="num text-base font-bold leading-none text-ink">{v}</p>
                  <p className="mt-1 text-[11px] text-muted">{k}</p>
                </div>
              ))}
            </div>
          )}
          <p className="rounded-sm2 bg-canvas px-3 py-2 text-[11px] leading-relaxed text-muted">{NOOR_NOTE(n.title)}</p>
        </div>
      )}
    </div>
  );
}

export default function PeriodNoticeCard({ studentId }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const { data: y } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
      const { data } = await supabase.from("period_notices")
        .select("id, title, term, subjects, attendance, behavior_excellent, behavior_positive, updated_at")
        .eq("student_id", studentId).eq("academic_year", y?.value ?? "").eq("published", true)
        .order("updated_at", { ascending: false });
      setRows(data ?? []); setOpen(data?.[0]?.id ?? null);
    })();
  }, [studentId]);

  if (!rows?.length) return null;
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">درجات الفترة</h2>
        <p className="text-[11px] text-muted">المواد التي اكتمل رصدها في نور، وتُحدَّث كلما رُصدت مواد أخرى.</p>
      </div>
      <div className="divide-y divide-line">
        {rows.map((n) => <Notice key={n.id} n={n} open={open === n.id} onToggle={() => setOpen(open === n.id ? null : n.id)} />)}
      </div>
    </section>
  );
}
