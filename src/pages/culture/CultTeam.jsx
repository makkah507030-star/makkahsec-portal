// src/pages/culture/CultTeam.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";

/* فريق الثقافة المؤسسية: السفير وأعضاء الفريق الذين يوثّقون التنفيذ معه.
   يضيف السفير الأعضاء ويزيلهم، ويعيّن المدير والوكلاء والدعم الفني السفير. */

export default function CultTeam({ me, reload }) {
  const { profile } = useSession();
  const [, setMsg] = useNotice(null);
  const [team, setTeam] = useState(null);
  const [staff, setStaff] = useState([]);
  const [pick, setPick] = useState("");
  const load = () => supabase.rpc("cult_team_list").then(({ data, error }) => {
    if (error) setMsg({ ok: false, text: error.message }); setTeam(data ?? []);
  });
  useEffect(() => { load(); supabase.rpc("cult_staff").then(({ data }) => setStaff(data ?? [])); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!team) return <Loader />;
  const ids = new Set(team.map((t) => t.user_id));
  const run = async (q, ok) => {
    const { error } = await q;
    if (error) setMsg({ ok: false, text: error.message }); else { setMsg({ ok: true, text: ok }); load(); reload(); }
  };
  const add = () => {
    if (!pick) return;
    run(supabase.from("cult_team").insert({ user_id: pick, role: "member", added_by_name: profile?.full_name ?? null }), "أُضيف إلى الفريق.");
    setPick("");
  };
  const setRole = (t, role) => run(supabase.from("cult_team").update({ role }).eq("user_id", t.user_id),
    role === "ambassador" ? `عُيّن ${t.full_name} سفيرًا للثقافة المؤسسية.` : `أصبح ${t.full_name} عضوًا في الفريق.`);
  const remove = async (t) => {
    if (!(await confirmDanger({ title: `إزالة ${t.full_name} من الفريق`, impact: ["لا يرى بعدها أعمال الفريق، ويبقى ما وثّقه."], confirmLabel: "إزالة" }))) return;
    run(supabase.from("cult_team").delete().eq("user_id", t.user_id), "أُزيل من الفريق.");
  };
  const sorted = [...team].sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, "ar") : a.role === "ambassador" ? -1 : 1));

  return (
    <div className="space-y-3">
      <p className="rounded-sm2 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-muted">
        يدير السفير القسم كله، ويوثّق أعضاء الفريق التنفيذ معه. ويرى مدير المدرسة والوكلاء والدعم الفني القسم كاملًا ويعيّنون السفير.
      </p>
      <div className="card divide-y divide-line/70 overflow-hidden">
        {sorted.length ? sorted.map((t) => (
          <div key={t.user_id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <span className="min-w-0 flex-1 text-[13.5px] text-ink">{t.full_name}</span>
            <span className={`chip shrink-0 ${t.role === "ambassador" ? "bg-mint-tint text-mint-deep" : "bg-canvas text-muted"}`}>{t.role === "ambassador" ? "سفير الثقافة" : "عضو الفريق"}</span>
            {me.all && <button className="text-[11.5px] font-semibold text-mint-deep" onClick={() => setRole(t, t.role === "ambassador" ? "member" : "ambassador")}>{t.role === "ambassador" ? "إعادته عضوًا" : "تعيينه سفيرًا"}</button>}
            {me.amb && (t.role !== "ambassador" || me.all) && <button className="text-[11px] text-absent" onClick={() => remove(t)}>إزالة</button>}
          </div>)) : <p className="px-4 py-6 text-center text-sm text-muted">لم يُعيَّن سفير ولا أعضاء بعد.</p>}
      </div>
      {me.amb && (
        <section className="card flex flex-wrap items-end gap-2 p-4">
          <label className="min-w-0 flex-1 text-[11.5px] text-muted">إضافة عضو إلى الفريق
            <select className="field mt-1 w-full text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">— اختر من الموظفين —</option>
              {staff.filter((s) => !ids.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select></label>
          <button className="btn-primary px-4 py-1.5 text-xs" disabled={!pick} onClick={add}>إضافة</button>
        </section>
      )}
    </div>
  );
}
