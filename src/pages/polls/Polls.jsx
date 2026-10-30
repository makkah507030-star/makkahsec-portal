// src/pages/polls/Polls.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDateTime } from "../../lib/dates";
import { loadMyPolls, isOpen, pollState, POLL_KIND } from "../../lib/polls.js";
import Loader from "../../components/Loader.jsx";
import { useSession } from "../../lib/session.jsx";
import PollResults, { usePollResults } from "./PollResults.jsx";

/* =====================================================================
   التصويت والاستطلاعات لكل الفئات (supabase/polls_1..2.sql): ما فُتح لفئة المستخدم وصفّه،
   فيصوّت مرة واحدة، ويرى النتائج متى أتاحها منشئ التصويت. الانتخاب سري: لا يُعرف لمن صوّت.
   ===================================================================== */

export default function Polls() {
  const { effectiveRole } = useSession();
  // صاحب الصلاحية تعيد له القاعدة كل الاستطلاعات؛ هنا ما يخص فئته فقط
  const mine = effectiveRole === "student" ? "student" : effectiveRole === "guardian" ? "guardian" : "staff";
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => { loadMyPolls().then(({ rows: r, err: e }) => { setRows(r.filter((p) => p.audience.includes(mine))); setErr(e); }); }, [reload, mine]);
  if (!rows) return <Loader />;
  const open = rows.filter((p) => isOpen(p));
  const past = rows.filter((p) => !isOpen(p));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">التصويت والاستطلاعات</h1>
        <p className="mt-1 text-sm text-muted">شارك برأيك فيما تطرحه المدرسة. لكل حساب صوت واحد، والانتخاب سري لا يُعرف فيه لمن صوّت أحد.</p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink">المفتوح الآن <span className="num text-muted">({open.length})</span></p>
        {open.length ? open.map((p) => <PollCard key={p.id} p={p} onVoted={() => setReload((x) => x + 1)} />)
          : <p className="card px-4 py-8 text-center text-sm text-muted">لا تصويت مفتوح لك الآن.</p>}
      </section>
      {past.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">السابق</p>
          {past.map((p) => <PollCard key={p.id} p={p} />)}
        </section>
      )}
    </div>
  );
}

function PollCard({ p, onVoted }) {
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showRes, setShowRes] = useState(false);
  const st = pollState(p);
  const open = isOpen(p);
  const canSee = p.results !== "owner" && ((p.results === "live" && (p.voted || !open)) || (p.results === "after" && !open));
  const { rows } = usePollResults(showRes && canSee ? p.id : null);
  const multi = p.max_choices > 1;
  const pick = (id) => setSel((x) => multi ? (x.includes(id) ? x.filter((y) => y !== id) : x.length < p.max_choices ? [...x, id] : x) : [id]);

  const vote = async () => {
    if (p.kind === "election" && !window.confirm("تأكيد صوتك؟ لا يمكن تغييره بعد الإرسال، ولا يُعرف اختيارك لأحد.")) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("poll_vote", { p_poll: p.id, p_options: sel });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onVoted?.();
  };

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{p.title}</p>
          <p className="text-xs text-muted">{POLL_KIND[p.kind]?.t} · {open ? "حتى" : "انتهى"} {fmtDateTime(p.closes_at)}
            {multi && open && !p.voted && <> · اختر حتى <span className="num">{p.max_choices}</span></>}</p>
        </div>
        <span className={`chip shrink-0 ${p.voted ? "bg-present/10 text-present" : st.c}`}>{p.voted ? "تم تصويتك ✓" : st.t}</span>
      </div>
      {p.body && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{p.body}</p>}
      {open && !p.voted && (
        <>
          <div className="space-y-1.5">
            {p.poll_options.map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-start gap-2.5 rounded-sm2 border px-3 py-2 text-sm ${sel.includes(o.id) ? "border-mint-deep bg-mint-tint" : "border-line bg-white hover:bg-canvas"}`}>
                <input type={multi ? "checkbox" : "radio"} name={p.id} className="mt-1" checked={sel.includes(o.id)} onChange={() => pick(o.id)} />
                <span className="min-w-0"><span className="font-medium text-ink">{o.label}</span>
                  {o.note && <span className="block text-xs text-muted">{o.note}</span>}</span>
              </label>
            ))}
          </div>
          {msg && <p className="text-sm text-absent">{msg}</p>}
          <button className="btn-primary" disabled={busy || !sel.length} onClick={vote}>{busy ? "جارٍ الإرسال…" : "إرسال صوتي"}</button>
        </>
      )}
      {p.voted && open && <p className="text-sm text-present">وصل صوتك، شكرًا لمشاركتك.{p.results === "after" && " تظهر النتائج بعد الإغلاق."}</p>}
      {canSee && (showRes ? <PollResults rows={rows} />
        : <button className="text-xs font-semibold text-mint-deep underline" onClick={() => setShowRes(true)}>عرض النتائج</button>)}
      {!open && p.results === "owner" && <p className="text-xs text-faint">النتائج لدى منشئ التصويت.</p>}
    </div>
  );
}
