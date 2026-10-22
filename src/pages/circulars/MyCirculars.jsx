// src/pages/circulars/MyCirculars.jsx
/* =====================================================================
   تعاميمي (/my-circulars) — للمنسوبين وأولياء الأمور: كل تعميم وصلهم، وما ينتظر اطلاعهم أولًا.
   ===================================================================== */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import { DIRECTION, PRIORITY, recStatus, circNo, setupMsg, isSetupErr } from "../../lib/circulars.js";

const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export default function MyCirculars() {
  const { session, can } = useSession();
  const uid = session?.user?.id;
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!uid) return;
    supabase.from("circular_recipients")
      .select("circular_id, read_at, ack_at, circulars!inner(id, seq, academic_year, direction, subject, source, category, priority, needs_ack, due_date, sent_at, closed_at)")
      .eq("user_id", uid).limit(500)
      .then(({ data, error }) => {
        if (error) setErr(isSetupErr(error) ? setupMsg : error.message);
        setRows((data ?? []).sort((a, b) => String(b.circulars.sent_at).localeCompare(String(a.circulars.sent_at))));
      });
  }, [uid]);

  if (!rows) return <Loader />;
  const pending = rows.filter((r) => recStatus(r, r.circulars.needs_ack).k !== "done" && !r.circulars.closed_at);
  const list = (tab === "pending" ? pending : rows)
    .filter((r) => !q.trim() || [r.circulars.subject, r.circulars.source].some((x) => String(x ?? "").includes(q.trim())));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-ink">تعاميمي</h1>
          <p className="mt-1 text-sm text-muted">التعاميم التي وصلتك من المدرسة. افتح التعميم واضغط «اطّلعت» إن طُلب منك الإقرار.</p>
        </div>
        {can("circulars") && <Link to="/circulars" className="btn-ghost text-xs">إدارة التعاميم</Link>}
      </div>
      {err && <p className="card px-4 py-3 text-sm text-absent">{err}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={pill(tab === "pending")} onClick={() => setTab("pending")}>بانتظار اطلاعي ({pending.length})</button>
        <button className={pill(tab === "all")} onClick={() => setTab("all")}>كل التعاميم ({rows.length})</button>
        <input className="field mr-auto w-48" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث" />
      </div>
      {list.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted">{tab === "pending" ? "لا تعاميم تنتظر اطلاعك. أحسنت." : "لم يصلك تعميم بعد."}</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const c = r.circulars;
            const st = recStatus(r, c.needs_ack);
            return (
              <Link key={c.id} to={`/circulars/${c.id}`} className={`card block p-3 transition hover:border-mint-light ${st.k !== "done" ? "border-r-4 border-r-warning" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-xs font-bold text-muted">{circNo(c)}</span>
                  <span className={`chip ${DIRECTION[c.direction]?.c}`}>{DIRECTION[c.direction]?.t}</span>
                  {c.priority !== "normal" && <span className={`chip ${PRIORITY[c.priority].c}`}>{PRIORITY[c.priority].t}</span>}
                  <span className={`chip ${st.c}`}>{st.k === "pending" ? "جديد" : st.t}</span>
                  <span className="mr-auto text-[11px] text-muted">{fmtDate(c.sent_at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-ink">{c.subject}</p>
                <p className="text-[11px] text-muted">{[c.source, c.category, c.due_date && `آخر موعد ${fmtDate(c.due_date)}`].filter(Boolean).join(" · ")}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
