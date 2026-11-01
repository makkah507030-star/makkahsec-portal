// src/pages/culture/CultValues.jsx
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { sendPush } from "../../lib/pushSend.js";
import { VALUES, AMB_ROLES, AMB_SKILLS, PROGRAMS } from "../../lib/culture.js";
import { CardMaker } from "./CultCard.jsx";

/* القيم والأدوار: قيم الوزارة الخمس بتعريفها ومؤشراتها وممارساتها، وأدوار سفير الثقافة ومهاراته.
   ويرسل السفير منها رسائل التوعية بالقيم وعروض «مزايا» إشعارًا لكل الموظفين. */

const PRESETS = [
  ...VALUES.map((v) => ({ k: v.k, t: `قيمة ${v.t}`, title: `قيمنا المؤسسية · ${v.t}`, body: `${v.t}: ${v.d}\nمن ممارساتها: ${v.pr.join(" ")}` })),
  { k: "mazaya", t: "عرض من «مزايا»", title: "مزايا · عرض لمنسوبي التعليم", body: "يسرّنا إطلاعكم على عرض جديد ضمن برنامج «مزايا» لمنسوبي التعليم: " },
  { k: "rafah", t: "رسالة «رفاه»", title: "رفاه · لصحتك وجودة حياتك", body: "" },
];

export default function CultValues({ me }) {
  const [open, setOpen] = useState(VALUES[0].k);
  const v = VALUES.find((x) => x.k === open);
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold text-ink">القيم المؤسسية لوزارة التعليم</h2>
        <div className="flex flex-wrap gap-2">{VALUES.map((x) => (
          <button key={x.k} onClick={() => setOpen(x.k)} className="rounded-pill border px-4 py-1.5 text-sm font-semibold"
            style={open === x.k ? { background: x.c, borderColor: x.c, color: "#fff" } : { borderColor: x.c, color: x.c }}>{x.t}</button>))}</div>
        <p className="text-[13.5px] leading-relaxed text-ink"><b style={{ color: v.c }}>{v.t}: </b>{v.d}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm2 border border-line bg-white p-3">
            <p className="mb-1.5 text-[12px] font-bold" style={{ color: v.c }}>الممارسات السلوكية</p>
            <ul className="list-disc space-y-1 ps-4 text-[12.5px] leading-relaxed text-muted">{v.pr.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="rounded-sm2 border border-line bg-white p-3">
            <p className="mb-1.5 text-[12px] font-bold" style={{ color: v.c }}>مؤشرات القياس</p>
            <ul className="list-disc space-y-1 ps-4 text-[12.5px] leading-relaxed text-muted">{v.ind.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </section>

      {me.amb && <Composer />}

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold text-ink">أدوار سفير الثقافة المؤسسية</h2>
        <div className="grid gap-2 sm:grid-cols-3">{AMB_ROLES.map((r) => (
          <div key={r.t} className="rounded-sm2 border border-line bg-white p-3">
            <b className="block text-[13px] text-mint-deep">{r.t}</b>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{r.d}</p>
            <ul className="mt-1.5 list-disc space-y-0.5 ps-4 text-[11.5px] leading-relaxed text-faint">{r.ex.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>))}</div>
        <h3 className="text-[13px] font-bold text-ink">مهاراته</h3>
        <div className="grid gap-2 sm:grid-cols-2">{AMB_SKILLS.map(([t, d]) => (
          <p key={t} className="rounded-sm2 bg-canvas px-3 py-2 text-[12px] leading-relaxed text-muted"><b className="text-ink">{t}: </b>{d}</p>))}</div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-bold text-ink">برامج الثقافة المؤسسية في المدرسة</h2>
        <div className="grid gap-2 sm:grid-cols-3">{Object.values(PROGRAMS).map((p) => (
          <div key={p.t} className="rounded-sm2 border border-line bg-white p-3" style={{ borderInlineStartWidth: 4, borderInlineStartColor: p.c }}>
            <b className="block text-[13px]" style={{ color: p.c }}>{p.t}</b>
            <span className="text-[10.5px] text-faint">{p.axis}</span>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{p.d}</p>
          </div>))}</div>
      </section>
    </div>
  );
}

function Composer() {
  const [, setMsg] = useNotice(null);
  const [x, setX] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("");
  const [card, setCard] = useState(null);
  const send = async () => {
    if (!x.title.trim() || !x.body.trim()) { setMsg({ ok: false, text: "اكتب العنوان والنص." }); return; }
    setBusy(true);
    const { data: nid, error } = await supabase.rpc("cult_notify", { p_title: x.title.trim(), p_body: x.body.trim(), p_user_ids: null });
    if (error) setMsg({ ok: false, text: error.message });
    else { sendPush(nid); setX({ title: "", body: "" }); setMsg({ ok: true, text: "أُرسلت الرسالة لكل الموظفين." }); }
    setBusy(false);
  };
  return (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-bold text-ink">رسالة لكل الموظفين</h2>
      <p className="text-[11.5px] text-muted">رسائل التوعية بالقيم، وعروض «مزايا»، ورسائل «رفاه»: تصل إشعارًا في الجرس والجوال لكل المعلمين والإداريين.</p>
      <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => (
        <button key={p.k} className="rounded-pill border border-line bg-white px-3 py-1 text-xs text-muted hover:bg-canvas" onClick={() => { setX({ title: p.title, body: p.body }); setKind(p.k); }}>{p.t}</button>))}</div>
      <input className="field w-full text-sm" maxLength={120} placeholder="العنوان" value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} />
      <textarea className="field min-h-[90px] w-full text-sm" maxLength={1200} placeholder="النص" value={x.body} onChange={(e) => setX({ ...x, body: e.target.value })} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={send}>{busy ? "…" : "إشعار لكل الموظفين"}</button>
        <button className="rounded-pill bg-[#25D366] px-4 py-1.5 text-xs font-bold text-white" onClick={() => {
          const v = VALUES.some((y) => y.k === kind);
          setCard(v ? { kind: "value", sub: kind, body: x.body.trim() || undefined }
            : { kind: ["mazaya", "rafah"].includes(kind) ? kind : "general", title: x.title.trim() || undefined, body: x.body.trim() || undefined });
        }}>بطاقة لقروب العمل في واتساب</button>
      </div>
      {card && <CardMaker init={card} onClose={() => setCard(null)} />}
    </section>
  );
}
