// src/pages/accreditation/AccCommittee.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { cmpAr } from "../../lib/sortAr.js";
import { confirmDanger } from "../../lib/danger";
import { DOMAINS, roleT } from "../../lib/accreditation.js";
import Loader from "../../components/Loader.jsx";
import AccMinutes from "./AccMinutes.jsx";

/* =====================================================================
   لجنة التميز (supabase/acc_1.sql، acc_3.sql): برئاسة مدير المدرسة، ومشرفها يوزّع العمل:
   يضيف الأعضاء ويسند لكل عضو مجالًا أو أكثر فيرى مؤشراته وبرامجه وشواهده وحدها.
   تعيين المشرف للمدير ووكيل الشؤون التعليمية والدعم الفني. ومحاضر اجتماعات اللجنة بقراراتها.
   ===================================================================== */

export default function AccCommittee({ me, year, members, reload, go }) {
  const { profile } = useSession();
  const [, setMsg] = useNotice(null);

  return (
    <div className="space-y-4">
      <Members me={me} members={members} reload={reload} setMsg={setMsg} by={profile?.full_name} />
      <section className="card p-4">
        <p className="mb-2 text-sm font-semibold text-ink">تقارير المجالات</p>
        <div className="flex flex-wrap gap-2">{me.coord && <button onClick={() => go("team", { report: "all" })} className="rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white">التقرير العام للجنة</button>}{Object.entries(DOMAINS).filter(([d]) => me.coord || me.domains.includes(+d)).map(([d, t]) => (
          <button key={d} onClick={() => go("team", { report: d })} className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs text-mint-deep hover:border-mint-light">تقرير مجال {t}</button>))}</div>
        <p className="mt-2 text-[11px] text-faint">لكل مجال تقرير بهوية التقارير الشهرية: المؤشرات، والبرامج وقياس نواتجها، والشواهد المرفوعة وغير المرفوعة، ومساهمة مشرف المجال، والاعتماد. والتقرير العام يجمع المجالات الأربعة ومساهمة كل مشرف.</p>
      </section>
      <AccMinutes me={me} year={year} members={members} setMsg={setMsg} by={profile?.full_name} />
    </div>
  );
}

function Members({ me, members, reload, setMsg, by }) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState(null);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!open || staff) return;
    supabase.rpc("acc_staff").then(({ data }) => setStaff((data ?? []).sort((a, b) => cmpAr(a.full_name, b.full_name))));
  }, [open, staff]);
  const inSet = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const found = (staff ?? []).filter((u) => !inSet.has(u.id) && (!q.trim() || u.full_name.includes(q.trim()))).slice(0, 12);
  const run = async (p, ok) => { const { error } = await p; if (error) setMsg({ ok: false, text: error.message }); else { if (ok) setMsg({ ok: true, text: ok }); reload(); } };
  const add = (u) => run(supabase.from("acc_members").insert({ user_id: u.id, title: title.trim() || null, added_by_name: by ?? null }), `أُضيف ${u.full_name} إلى اللجنة. أسند له مجالاته.`);
  const toggleD = (m, d) => run(supabase.from("acc_members").update({ domains: m.domains.includes(d) ? m.domains.filter((x) => x !== d) : [...m.domains, d].sort() }).eq("user_id", m.user_id));
  const setRole = (m, role) => run(supabase.from("acc_members").update({ role }).eq("user_id", m.user_id));
  const setTitleOf = (m) => { const t = window.prompt("صفة العضو:", m.title ?? ""); if (t != null) run(supabase.from("acc_members").update({ title: t.trim() || null }).eq("user_id", m.user_id)); };
  const remove = async (m) => {
    if (!(await confirmDanger({ title: `إزالة ${m.full_name} من لجنة التميز`, impact: ["لا يرى القسم بعدها، وتبقى شواهده ومحاضر اللجنة كما هي."], confirmLabel: "إزالة" }))) return;
    run(supabase.from("acc_members").delete().eq("user_id", m.user_id));
  };
  const unassigned = Object.keys(DOMAINS).map(Number).filter((d) => !members.some((m) => m.role === "member" && m.domains.includes(d)));

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">أعضاء لجنة التميز <span className="num text-muted">({members.length})</span></h2>
        {me.coord && <button onClick={() => setOpen(!open)} className="ms-auto text-xs font-semibold text-mint-deep">{open ? "إغلاق" : "+ إضافة عضو"}</button>}
      </div>
      {me.coord && unassigned.length > 0 && members.length > 0 && <p className="border-b border-line bg-late/5 px-4 py-2 text-xs text-late">مجالات بلا عضو مسند: {unassigned.map((d) => DOMAINS[d]).join("، ")}</p>}
      {open && (
        <div className="space-y-2 border-b border-line bg-canvas/50 p-3">
          <div className="flex flex-wrap gap-2">
            <input className="field min-w-[180px] flex-1 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المعلم أو الإداري" />
            <input className="field w-48 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="الصفة: معلم متميز…" />
          </div>
          {!staff ? <Loader /> : <div className="flex flex-wrap gap-1.5">
            {found.map((u) => <button key={u.id} onClick={() => add(u)} className="rounded-pill border border-line bg-white px-3 py-1 text-xs text-ink hover:border-mint-light">+ {u.full_name}</button>)}
            {found.length === 0 && <span className="text-xs text-muted">لا نتائج.</span>}</div>}
        </div>
      )}
      <div className="divide-y divide-line">
        <div className="flex items-center gap-2 px-4 py-2.5"><span className="chip bg-mint-deep text-[11px] text-white">رئيس اللجنة</span><span className="text-sm font-medium text-ink">مدير المدرسة</span>
          <span className="text-[11px] text-faint">· ويرى القسم كله وكيل الشؤون التعليمية والدعم الفني</span></div>
        {members.map((m) => (
          <div key={m.user_id} className="space-y-1.5 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip text-[11px] ${m.role === "coordinator" ? "bg-mint-tint text-mint-deep" : "bg-canvas text-muted"}`}>{roleT(m)}</span>
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{m.full_name}{m.title && <span className="text-[12px] font-normal text-muted"> · {m.title}</span>}</span>
              {me.coord && <button onClick={() => setTitleOf(m)} className="text-[11px] text-muted hover:underline">الصفة</button>}
              {me.all && <button onClick={() => setRole(m, m.role === "coordinator" ? "member" : "coordinator")} className="text-[11px] text-mint-deep hover:underline">{m.role === "coordinator" ? "جعله عضوًا" : "جعله المشرف"}</button>}
              {me.coord && (m.role !== "coordinator" || me.all) && <button onClick={() => remove(m)} className="text-[11px] text-absent hover:underline">إزالة</button>}
            </div>
            {m.role === "coordinator" ? <p className="text-[11px] text-faint">يرى كل المجالات، ويوزّع العمل على الأعضاء.</p> : (
              <div className="flex flex-wrap gap-1.5">{Object.entries(DOMAINS).map(([d, t]) => {
                const on = m.domains.includes(+d);
                return <button key={d} disabled={!me.coord} onClick={() => toggleD(m, +d)} className={`rounded-pill border px-2.5 py-0.5 text-[11px] ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-faint"}`}>{on ? "✓ " : ""}{t}</button>;
              })}{!m.domains.length && <span className="text-[11px] text-late">لم يُسند له مجال بعد</span>}</div>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="px-4 py-4 text-sm text-muted">{me.all ? "أضف أعضاء اللجنة، ثم اجعل أحدهم مشرفها ليوزّع المجالات." : "لا أعضاء بعد."}</p>}
      </div>
    </section>
  );
}
