// src/pages/culture/CultValues.jsx
import { useState } from "react";
import { VALUES, AMB_ROLES, AMB_SKILLS, PROGRAMS } from "../../lib/culture.js";

/* القيم والأدوار: قيم الوزارة الخمس بتعريفها ومؤشراتها وممارساتها، وأدوار سفير الثقافة ومهاراته.
   ورسائل التوعية بالقيم و«مزايا» لكل الموظفين في «الإجراءات والرسائل» (CultSend.jsx). */

export default function CultValues({ me, go }) {
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

      {me.member && (
        <button onClick={() => go("send")} className="card flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-canvas">
          <span className="min-w-0 flex-1">
            <b className="block text-sm text-ink">رسائل التوعية بالقيم و«مزايا» و«رفاه» ←</b>
            <span className="text-[12px] text-muted">انتقلت إلى «الإجراءات والرسائل»: تُرسل من هناك وتُسجَّل في برنامجها وتظهر في لوحة التنفيذ والتقرير والشواهد.</span>
          </span>
        </button>
      )}

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
