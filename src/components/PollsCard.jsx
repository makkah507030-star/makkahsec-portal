// src/components/PollsCard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { loadMyPolls, isOpen } from "../lib/polls.js";

/* بطاقة «شارك برأيك» في الرئيسية (supabase/polls_1..2.sql): ما فُتح للمستخدم من تصويت ولم يصوّت
   فيه بعد، وزرها يفتح «التصويت والاستطلاعات». لا تظهر إن لم يكن شيء ينتظره أو لم يُشغَّل الملف. */
export default function PollsCard() {
  const { effectiveRole } = useSession();
  const mine = effectiveRole === "student" ? "student" : effectiveRole === "guardian" ? "guardian" : "staff";
  const [rows, setRows] = useState([]);
  useEffect(() => {
    loadMyPolls().then(({ rows: r }) => setRows(r.filter((p) => isOpen(p) && !p.voted && p.audience.includes(mine))));
  }, [mine]);
  if (!rows.length) return null;
  return (
    <section className="card flex flex-wrap items-center gap-3 border-2 border-mint-light p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-lg text-mint-deep" aria-hidden="true">✓</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{rows.length === 1 ? rows[0].title : rows.length === 2 ? "تصويتان ينتظران رأيك"
          : rows.length <= 10 ? `${rows.length} تصويتات تنتظر رأيك` : `${rows.length} تصويتًا ينتظر رأيك`}</p>
        <p className="text-xs text-muted">{rows.length === 1 ? (rows[0].kind === "election" ? "انتخاب سري · صوت واحد" : "استطلاع رأي") : rows.map((p) => p.title).slice(0, 2).join("، ")}</p>
      </div>
      <Link to="/polls" className="btn-primary shrink-0 px-4 py-1.5 text-xs">شارك برأيك</Link>
    </section>
  );
}
