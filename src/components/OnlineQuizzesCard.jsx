// src/components/OnlineQuizzesCard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";

/* بطاقة «اختباراتي الإلكترونية» في الصفحة الرئيسية للطالب:
   ما هو متاح الآن أو قادم أو جارٍ، وما سُلِّم خلال الأيام الثلاثة الأخيرة. */
export default function OnlineQuizzesCard() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    supabase.rpc("my_online_quizzes").then(({ data }) => setRows(data ?? []));
  }, []);

  if (!rows?.length) return null;
  const now = Date.now();

  return (
    <section className="card p-4">
      <p className="text-sm font-bold text-ink">الاختبارات الإلكترونية</p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => {
          const opens = new Date(r.opens_at).getTime();
          const closes = new Date(r.closes_at).getTime();
          const st = r.submitted_at ? ["سُلِّم", "bg-present/10 text-present"]
            : r.started_at ? ["جارٍ — أكمل", "bg-warning/10 text-warning"]
            : now < opens ? ["قادم", "bg-canvas text-muted"]
            : now >= closes ? ["انتهى", "bg-absent/10 text-absent"]
            : ["متاح الآن", "bg-mint-deep text-white"];
          return (
            <Link key={r.quiz_id} to={`/quiz/${r.quiz_id}`}
                  className="flex items-center gap-3 rounded-card border border-line/70 px-3 py-2.5 transition-colors hover:bg-canvas">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
                <p className="text-[11px] text-muted">
                  {r.subject_name ? `${r.subject_name} · ` : ""}
                  {now < opens ? `يُفتح ${fmtDateTime(r.opens_at)}` : `يُغلق ${fmtDateTime(r.closes_at)}`}
                  {" · "}<bdi className="num">{r.duration_min}</bdi> دقيقة
                </p>
              </div>
              <span className={`chip shrink-0 ${st[1]}`}>{st[0]}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
