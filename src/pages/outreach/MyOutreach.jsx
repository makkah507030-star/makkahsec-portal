// src/pages/outreach/MyOutreach.jsx
// «النشرات والاستبانات» للمستلم (طالب أو ولي أمر أو موظف): ما وصله، وما ينتظره أولًا.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import { KIND, pendingFor, setupMsg } from "../../lib/outreach.js";

export default function MyOutreach() {
  const { session } = useSession();
  const uid = session?.user?.id;
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState("all");
  useEffect(() => {
    supabase.from("outreach_recipients").select("*, outreach_items(id, kind, title, topic, body, created_by_name, sent_at, needs_ack, closes_at, closed_at, anonymous)")
      .eq("user_id", uid).then(({ data, error }) => {
        if (error) { setErr(setupMsg(error)); setRows([]); return; }
        setRows((data ?? []).filter((r) => r.outreach_items).sort((a, b) => (pendingFor(b, b.outreach_items) - pendingFor(a, a.outreach_items))
          || new Date(b.outreach_items.sent_at) - new Date(a.outreach_items.sent_at)));
      });
  }, [uid]);
  if (!rows) return <Loader />;
  const shown = rows.filter((r) => f === "all" || (f === "pending" ? pendingFor(r, r.outreach_items) : r.outreach_items.kind === f));
  const pending = rows.filter((r) => pendingFor(r, r.outreach_items)).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">النشرات والاستبانات</h1>
        <p className="mt-1 text-sm text-muted">ما يرسله لك الموجه الطلابي وإدارة المدرسة: نشرات توعوية وتعليمات، واستبانات رأيك فيها مهم.</p>
      </div>
      {err && <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {[["all", "الكل"], ["pending", `بانتظارك${pending ? ` (${pending})` : ""}`], ["survey", "الاستبانات"], ["post", "النشرات"]].map(([k, t]) => (
          <button key={k} onClick={() => setF(k)} className={`rounded-pill px-4 py-1.5 text-sm ${f === k ? "bg-mint-deep font-semibold text-white" : "border border-line bg-white text-muted"}`}>{t}</button>))}
      </div>
      {shown.length === 0 && <p className="card px-4 py-6 text-center text-sm text-muted">لا شيء هنا بعد.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{shown.map((r) => {
        const i = r.outreach_items, k = KIND[i.kind], p = pendingFor(r, i);
        return (
          <Link key={i.id} to={`/o/${i.id}`} className="card flex gap-3 p-4 transition-shadow hover:shadow-md" style={{ borderTop: `4px solid ${k.c}` }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 text-white" style={{ background: k.c }}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={k.icon} /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold" style={{ color: k.c }}>{k.t}</span>
                {i.topic && <span className="text-muted">· {i.topic}</span>}
                {p && <span className="chip bg-warning-light text-[10.5px] text-warning">{i.kind === "survey" ? "بانتظار إجابتك" : i.needs_ack ? "بانتظار اطّلاعك" : "جديدة"}</span>}
                {!p && i.kind === "survey" && r.answered_at && <span className="chip bg-present/10 text-[10.5px] text-present">✓ أجبت</span>}
              </span>
              <b className="mt-0.5 block text-[14.5px] leading-snug text-ink">{i.title}</b>
              {i.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted">{i.body}</span>}
              <span className="num mt-1 block text-[11px] text-faint">{[i.created_by_name, fmtDate(i.sent_at)].filter(Boolean).join(" · ")}</span>
            </span>
          </Link>
        );
      })}</div>
    </div>
  );
}
