// src/pages/media/MediaTeam.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   أعضاء المركز الإعلامي في استوديو الوسائط (supabase/media_3.sql): الطلاب الأعضاء بفروعهم.
   يُضافون تلقائيًا من إعلان الترشيح المربوط بالفريق عند إعلان نتائجه، ويُزالون من هنا.
   ===================================================================== */

export default function MediaTeam() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const load = () => supabase.rpc("media_team_list").then(({ data, error }) => {
    if (error) setErr(/media_team|schema cache|function/i.test(error.message) ? "الفريق يحتاج تشغيل supabase/media_3.sql مرة واحدة في Supabase ← SQL Editor." : error.message);
    setRows(data ?? []);
  });
  useEffect(() => { load(); }, []);
  if (!rows) return <Loader />;
  const remove = async (r) => {
    if (!(await confirmDanger({ title: `إزالة ${r.full_name} من المركز الإعلامي`, impact: ["لا يرى بعدها صفحة «المركز الإعلامي» ولا قائمة «لا يُصوَّر»."], confirmLabel: "إزالة" }))) return;
    await supabase.from("media_team").delete().eq("student_id", r.student_id);
    load();
  };
  const branches = [...new Set(rows.map((r) => r.branch ?? "بلا فرع"))];

  return (
    <div className="space-y-3">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <p className="text-sm text-muted">يُضاف الطلاب تلقائيًا من إعلان «المركز الإعلامي» في الترشيحات عند إعلان نتائجه، ويرى كل عضو في حسابه «المركز الإعلامي» وفيها قائمة «لا يُصوَّر».</p>
      {rows.length ? branches.map((b) => {
        const list = rows.filter((r) => (r.branch ?? "بلا فرع") === b);
        return (
          <section key={b} className="card overflow-hidden">
            <p className="border-b border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink">{b} <span className="num text-xs font-normal text-muted">({list.length})</span></p>
            {list.map((r) => (
              <div key={r.student_id} className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm last:border-0">
                <span className="min-w-0 flex-1 truncate text-ink">{r.full_name}</span>
                <span className="num text-xs text-muted">{r.grade}/{r.class_no}</span>
                <span className="hidden text-[11px] text-faint sm:inline">منذ {fmtDate(r.joined_at)}</span>
                <button className="text-xs text-absent" onClick={() => remove(r)}>إزالة</button>
              </div>
            ))}
          </section>
        );
      }) : !err && <p className="card px-4 py-8 text-center text-sm text-muted">لا أعضاء بعد. أنشئ إعلانًا من «الترشيحات» بقالب «المركز الإعلامي».</p>}
    </div>
  );
}
