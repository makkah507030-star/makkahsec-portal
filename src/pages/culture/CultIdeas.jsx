// src/pages/culture/CultIdeas.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import { sendPush } from "../../lib/pushSend.js";
import { IDEA_STATUS, PROGRAMS, setupMsg } from "../../lib/culture.js";
import Loader from "../../components/Loader.jsx";
import { CardMaker } from "./CultCard.jsx";

/* الأفكار والابتكار: يشارك كل موظف فكرته التطويرية ويرى ردّ الفريق عليها، والفريق يدرس الأفكار
   ويحدّث حالتها (قيد الدراسة، معتمدة، كُرّم صاحبها) ويرد، ويصل الرد صاحبها إشعارًا إن رد السفير. */

export default function CultIdeas({ me }) {
  const { profile } = useSession();
  const [, setMsg] = useNotice(null);
  const [rows, setRows] = useState(null);
  const [x, setX] = useState({ title: "", body: "" });
  const [open, setOpen] = useState(null);
  const load = () => supabase.from("cult_ideas").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
    if (error) setMsg({ ok: false, text: setupMsg(error) }); setRows(data ?? []);
  });
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loader />;
  const mine = (r) => r.author_id === profile?.id;
  const add = async () => {
    if (!x.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الفكرة." }); return; }
    const { error } = await supabase.from("cult_ideas").insert({ title: x.title.trim(), body: x.body.trim() || null, author_name: profile?.full_name ?? null });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setX({ title: "", body: "" }); setMsg({ ok: true, text: "وصلت فكرتك إلى فريق الثقافة المؤسسية، شكرًا لمبادرتك." }); load();
  };
  const remove = async (r) => {
    if (!(await confirmDanger({ title: `حذف الفكرة «${r.title}»`, impact: ["تُحذف الفكرة وردّ الفريق عليها."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("cult_ideas").delete().eq("id", r.id);
    if (error) setMsg({ ok: false, text: error.message }); else load();
  };
  const list = me.member ? rows : rows.filter(mine);

  return (
    <div className="space-y-3">
      <p className="rounded-sm2 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-muted">
        <b style={{ color: PROGRAMS.innov.c }}>{PROGRAMS.innov.t}</b> · {PROGRAMS.innov.d} شارك فكرة لتطوير إجراءات العمل أو بيئته أو خدمات المدرسة.
      </p>
      {me.staff && (
        <section className="card space-y-2 p-4">
          <h2 className="text-sm font-bold text-ink">شارك فكرة</h2>
          <input className="field w-full text-sm" maxLength={140} placeholder="عنوان الفكرة" value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} />
          <textarea className="field min-h-[80px] w-full text-sm" maxLength={1500} placeholder="وصفها: المشكلة التي تعالجها، وكيف تُنفَّذ، وأثرها المتوقع" value={x.body} onChange={(e) => setX({ ...x, body: e.target.value })} />
          <button className="btn-primary px-4 py-1.5 text-xs" onClick={add}>إرسال الفكرة</button>
        </section>
      )}
      {me.member && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
          {Object.entries(IDEA_STATUS).map(([k, s]) => <span key={k}>{s.t} <b className="num text-ink">{rows.filter((r) => r.status === k).length}</b></span>)}
        </div>
      )}
      <div className="card divide-y divide-line/70 overflow-hidden">
        {!me.member && <h2 className="px-4 py-2.5 text-sm font-bold text-ink">أفكاري</h2>}
        {list.length ? list.map((r) => (
          <div key={r.id}>
            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-start" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className="min-w-0 flex-1"><span className="block text-[13.5px] text-ink">{r.title}</span>
                <span className="block text-[11px] text-muted">{me.member && r.author_name ? `${r.author_name} · ` : ""}<span className="num">{fmtDate(r.created_at)}</span></span></span>
              <span className={`chip shrink-0 ${IDEA_STATUS[r.status].c}`}>{IDEA_STATUS[r.status].t}</span>
            </button>
            {open === r.id && (me.member
              ? <Review r={r} me={me} setMsg={setMsg} onChange={load} onRemove={() => remove(r)} />
              : <div className="space-y-2 border-t border-line bg-canvas/40 px-4 py-3 text-[12.5px] leading-relaxed">
                  {r.body && <p className="whitespace-pre-line text-muted">{r.body}</p>}
                  {r.reply ? <p className="rounded-sm2 bg-white px-3 py-2 text-ink"><b className="text-mint-deep">رد الفريق: </b>{r.reply}</p> : <p className="text-faint">لم يرد الفريق بعد.</p>}
                  {r.status === "new" && <button className="text-xs text-absent" onClick={() => remove(r)}>حذف الفكرة</button>}
                </div>)}
          </div>)) : <p className="px-4 py-6 text-center text-sm text-muted">{me.member ? "لم يشارك الموظفون أفكارًا بعد." : "لم تشارك فكرة بعد."}</p>}
      </div>
    </div>
  );
}

function Review({ r, me, setMsg, onChange, onRemove }) {
  const [card, setCard] = useState(false);
  const [status, setStatus] = useState(r.status === "new" ? "review" : r.status);
  const [reply, setReply] = useState(r.reply ?? "");
  const [notify, setNotify] = useState(me.amb);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("cult_ideas").update({ status, reply: reply.trim() || null, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { setMsg({ ok: false, text: error.message }); setBusy(false); return; }
    if (notify && me.amb && reply.trim()) {
      const { data: nid, error: e2 } = await supabase.rpc("cult_notify", { p_title: `فكرتك «${r.title}» · ${IDEA_STATUS[status].t}`, p_body: reply.trim(), p_user_ids: [r.author_id] });
      if (e2) setMsg({ ok: false, text: e2.message }); else sendPush(nid);
    }
    setMsg({ ok: true, text: "حُفظ الرد." }); setBusy(false); onChange();
  };
  return (
    <div className="space-y-2 border-t border-line bg-canvas/40 px-4 py-3">
      {r.body && <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{r.body}</p>}
      <div className="flex flex-wrap gap-1.5">{Object.entries(IDEA_STATUS).filter(([k]) => k !== "new").map(([k, s]) => (
        <button key={k} onClick={() => setStatus(k)} className={`rounded-pill border px-3 py-1 text-xs ${status === k ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-muted"}`}>{s.t}</button>))}</div>
      <textarea className="field min-h-[60px] w-full text-sm" placeholder="رد الفريق على صاحب الفكرة" value={reply} onChange={(e) => setReply(e.target.value)} />
      {status === "honored" && <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <button className="rounded-pill bg-[#25D366] px-3 py-1 text-[11.5px] font-bold text-white" onClick={() => setCard(true)}>بطاقة شكر واتساب</button>
        ولشهادة شكر رسمية استخدم «النماذج والشهادات».</p>}
      {card && <CardMaker init={{ kind: "honor", name: r.author_name ?? "" }} onClose={() => setCard(false)} />}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "…" : "حفظ"}</button>
        {me.amb && <label className="flex items-center gap-1.5 text-[11.5px] text-muted"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />إشعار صاحب الفكرة بالرد</label>}
        {me.amb && <button className="ms-auto text-xs text-absent" onClick={onRemove}>حذف</button>}
      </div>
    </div>
  );
}
