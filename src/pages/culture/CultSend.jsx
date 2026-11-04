// src/pages/culture/CultSend.jsx
// الإجراءات والرسائل: مكان واحد لكل ما يرسله سفير الثقافة. الرسالة لكل الموظفين تُختار من برنامجها
// (القيم، مزايا، رفاه، تكافؤ، الصحة التنظيمية، التواصل الملهم، الابتكار) وتُربط بنشاطها في الخطة، فتُرسل إشعارًا
// وتُسجَّل في سجل البرنامج (cult_messages)، وتُحسب في لوحة التنفيذ والتقرير وشواهد مرسلها (supabase/cult_6.sql).
// والإجراءات لشخص بعينه (تهنئة، ترحيب، رد على فكرة، لقاء) روابط إلى تبويبها.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { sendPush } from "../../lib/pushSend.js";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import { ACTIONS, PERSON_ACTIONS, PROGRAMS, cardInit, setupMsg } from "../../lib/culture.js";
import { CardMaker, SendPreview } from "./CultCard.jsx";
import { friendlyError } from "../../lib/friendlyError.js";

export default function CultSend({ me, go }) {
  const [log, setLog] = useState(null);
  const [acts, setActs] = useState([]);
  const [prog, setProg] = useState("all");
  const [a, setA] = useState(null);           // الإجراء المختار
  const [x, setX] = useState({ title: "", body: "", activity: "" });
  const [preview, setPreview] = useState(false);
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const load = useCallback(() => {
    supabase.from("cult_messages").select("*").order("sent_at", { ascending: false }).then(({ data, error }) => {
      if (error) setMsg({ ok: false, text: setupMsg(error) }); setLog(data ?? []);
    });
  }, [setMsg]);
  useEffect(() => { load(); supabase.from("cult_activities").select("id, program, title, status").order("sort").then(({ data }) => setActs(data ?? [])); }, [load]);

  const pick = (y) => {
    setA(y);
    const first = acts.find((t) => t.program === y.program && t.status !== "done") ?? acts.find((t) => t.program === y.program);
    setX({ title: y.title, body: y.body, activity: first?.id ?? "" });
  };
  const cardOf = () => {
    const c = a?.card ?? { kind: "general" };
    const base = cardInit(c.kind, c.sub);
    return { ...base, title: c.kind === "value" ? base.title : x.title.replace(/^[^·]*·\s*/, "") || base.title, body: x.body.trim() || base.body };
  };
  const send = async () => {
    setBusy(true);
    const { data: nid, error } = await supabase.rpc("cult_send", { p_program: a.program, p_kind: a.k, p_title: x.title.trim(),
      p_body: x.body.trim(), p_activity: x.activity || null, p_user_ids: null });
    setBusy(false); setPreview(false);
    if (error) { setMsg({ ok: false, text: setupMsg(error) }); return; }
    sendPush(nid);
    setMsg({ ok: true, text: "أُرسلت الرسالة لكل الموظفين، وسُجّلت في سجل برنامجها." });
    setA(null); load();
  };
  const remove = async (r) => {
    if (!(await confirmDanger({ title: `حذف «${r.title}» من السجل`, impact: ["يُحذف من سجل البرنامج والتقرير والشواهد، ولا يُسترجع الإشعار المرسل."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("cult_messages").delete().eq("id", r.id);
    if (error) setMsg({ ok: false, text: friendlyError(error.message) }); else load();
  };

  const list = useMemo(() => (log ?? []).filter((r) => prog === "all" || r.program === prog), [log, prog]);
  const actOf = Object.fromEntries(acts.map((t) => [t.id, t]));
  const programs = [...new Set(ACTIONS.map((y) => y.program))];

  return (
    <div className="space-y-4">
      <p className="rounded-sm2 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-muted">
        كل ما يُرسل للموظفين من مكان واحد: اختر الإجراء من برنامجه، واربطه بنشاطه في الخطة، ثم عاين وأرسل. يصل إشعارًا في الجرس والجوال،
        ويُسجَّل في سجل البرنامج أدناه، ويظهر في لوحة التنفيذ والتقرير وشواهد مرسله.
      </p>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {me.amb && (
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-bold text-ink">رسالة لكل الموظفين</h2>
          {programs.map((pk) => (
            <div key={pk} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 shrink-0 text-[12px] font-bold" style={{ color: PROGRAMS[pk]?.c }}>{PROGRAMS[pk]?.t}</span>
              {ACTIONS.filter((y) => y.program === pk).map((y) => (
                <button key={y.k} onClick={() => pick(y)}
                        className={`rounded-pill border px-3 py-1 text-xs ${a?.k === y.k ? "text-white" : "bg-white text-muted hover:bg-canvas"}`}
                        style={a?.k === y.k ? { background: PROGRAMS[pk]?.c, borderColor: PROGRAMS[pk]?.c } : { borderColor: "rgb(var(--c-line))" }}>{y.t}</button>
              ))}
            </div>
          ))}
          {a && (
            <div className="space-y-2 rounded-sm2 border border-line bg-canvas/50 p-3">
              <label className="block text-[11.5px] text-muted">نشاط الخطة المرتبط
                <select className="field mt-1 w-full text-sm" value={x.activity} onChange={(e) => setX({ ...x, activity: e.target.value })}>
                  <option value="">— دون ربط بنشاط —</option>
                  {acts.filter((t) => t.program === a.program).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select></label>
              <input className="field w-full text-sm" maxLength={120} placeholder="العنوان" value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} />
              <textarea className="field min-h-[90px] w-full text-sm" maxLength={1200} placeholder="النص" value={x.body} onChange={(e) => setX({ ...x, body: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy || !x.title.trim() || !x.body.trim()} onClick={() => setPreview(true)}>معاينة وإشعار لكل الموظفين</button>
                <button className="rounded-pill bg-[#25D366] px-4 py-1.5 text-xs font-bold text-white" onClick={() => setCard({ ...(a.card ?? { kind: "general" }), title: cardOf().title, body: cardOf().body })}>بطاقة لقروب العمل في واتساب</button>
                <button className="btn-ghost px-4 py-1.5 text-xs" onClick={() => setA(null)}>إلغاء</button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-bold text-ink">إجراءات لموظف بعينه</h2>
        <div className="grid gap-2 sm:grid-cols-2">{PERSON_ACTIONS.map((y) => (
          <button key={y.tab} onClick={() => go(y.tab)} className="rounded-sm2 border border-line bg-white px-3 py-2 text-start hover:bg-canvas"
                  style={{ borderInlineStartWidth: 4, borderInlineStartColor: PROGRAMS[y.program]?.c }}>
            <b className="block text-[13px] text-ink">{y.t} ←</b><span className="text-[11.5px] text-muted">{y.d}</span>
          </button>))}</div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
          <h2 className="me-2 text-sm font-bold text-ink">سجل الرسائل</h2>
          {["all", ...programs].map((pk) => (
            <button key={pk} onClick={() => setProg(pk)} className={`rounded-pill px-2.5 py-0.5 text-[11.5px] ${prog === pk ? "bg-mint-deep text-white" : "text-muted hover:bg-canvas"}`}>
              {pk === "all" ? "الكل" : PROGRAMS[pk]?.t}{log && <span className="num"> ({(log ?? []).filter((r) => pk === "all" || r.program === pk).length})</span>}</button>))}
        </div>
        {!log ? <Loader /> : list.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">لا رسائل مرسلة بعد.</p> : (
          <div className="divide-y divide-line/70">{list.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: PROGRAMS[r.program]?.c }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">{r.title}</span>
                <span className="block text-[11px] text-muted">
                  {PROGRAMS[r.program]?.t} · <span className="num">{fmtDate(r.sent_at)}</span> · {r.sent_by_name} · إلى <span className="num">{r.recipients}</span> موظفًا
                  {r.activity_id && actOf[r.activity_id] && <> · النشاط: {actOf[r.activity_id].title}</>}
                </span>
                {r.body && <span className="mt-0.5 block line-clamp-2 text-[12px] text-muted">{r.body}</span>}
              </span>
              {me.amb && <button className="shrink-0 text-[11px] text-absent" onClick={() => remove(r)}>حذف</button>}
            </div>))}</div>
        )}
      </section>

      {card && <CardMaker init={card} onClose={() => setCard(null)} />}
      {preview && a && <SendPreview card={cardOf()} notif={{ title: x.title.trim(), body: x.body.trim() }}
        to="كل المعلمين والإداريين — في جرس البوابة وعلى جوالاتهم" busy={busy} onConfirm={send} onClose={() => setPreview(false)} />}
    </div>
  );
}
