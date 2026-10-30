// src/pages/accreditation/AccTools.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { TOOLS, sampleMin } from "../../lib/accreditation.js";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   أدوات التقويم (supabase/acc_3.sql): الأدوات نفسها تُطبَّق في منصة تميز، وهنا تنظيمها فقط:
   المسؤول وموعد الإنجاز والحالة والمطلوب والمنجز (عينة الاستبانة أو عدد الملاحظات)، مع الحد
   الأدنى لعينة الاستبانات حسب عدد الطلاب كما في الدليل. يعدّلها المشرف ويراها الأعضاء.
   ===================================================================== */

const ST = { todo: { t: "لم يبدأ", c: "bg-canvas text-muted" }, doing: { t: "قيد التطبيق", c: "bg-late/10 text-late" }, done: { t: "أُغلقت", c: "bg-present/10 text-present" } };

export default function AccTools({ me, year }) {
  const [msg, setMsg] = useNotice(null);
  const [rows, setRows] = useState(null);
  const [students, setStudents] = useState(null);
  const load = () => supabase.from("acc_tools").select("*").eq("academic_year", year)
    .then(({ data }) => setRows(Object.fromEntries((data ?? []).map((x) => [x.tool, x]))));
  useEffect(() => {
    load();
    supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true).then(({ count, error }) => setStudents(error ? null : count));
  }, [year]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loader />;
  const min = students ? sampleMin(students) : null;

  const save = async (tool, patch) => {
    const cur = rows[tool] ?? { academic_year: year, tool, status: "todo" };
    const next = { ...cur, ...patch };
    setRows((r) => ({ ...r, [tool]: next }));
    const { error } = await supabase.from("acc_tools").upsert({ academic_year: year, tool, owner_name: next.owner_name ?? null, due: next.due || null,
      status: next.status, target: next.target === "" || next.target == null ? null : Number(next.target), done: next.done === "" || next.done == null ? null : Number(next.done), notes: next.notes ?? null });
    if (error) { setMsg({ ok: false, text: error.message }); load(); }
  };
  const closed = TOOLS.filter((t) => rows[t.key]?.status === "done").length;

  return (
    <div className="space-y-3">
      <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">تُطبَّق الأدوات في منصة تميز؛ هنا توزيعها ومتابعتها. أُغلقت <span className="num font-bold text-ink">{closed}</span> من <span className="num">{TOOLS.length}</span> أدوات.</p>
      <section className="card p-4 text-sm">
        <p className="mb-1 font-semibold text-ink">الحد الأدنى لعينة الاستبانات</p>
        {min ? <p className="text-muted">عدد الطلاب <span className="num font-bold text-ink">{students}</span>: الطلاب <span className="num font-bold text-ink">{min.q_students}%</span> (نحو <span className="num">{Math.ceil(students * min.q_students / 100)}</span> طالبًا)، والمعلمون <span className="num font-bold text-ink">{min.q_teachers}%</span>، والأسر <span className="num font-bold text-ink">{min.q_family}%</span>.</p>
          : <p className="text-muted">أقل من 100 طالب: 50% و70% و25% · من 100 إلى 300: 40% و60% و15% · أكثر من 300: 30% و50% و10% (الطلاب والمعلمون والأسر).</p>}
        <p className="mt-1 text-xs text-faint">الملاحظات الصفية: 15 على الأقل، موزعة على المواد والمعلمين.</p>
      </section>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">الأداة</th><th className="p-2">المسؤول</th><th className="p-2">الموعد</th><th className="p-2">المطلوب</th><th className="p-2">المنجز</th><th className="p-2">الحالة</th><th className="p-2">ملاحظة</th></tr></thead>
          <tbody className="divide-y divide-line/60">{TOOLS.map((t) => {
            const r = rows[t.key] ?? {};
            const inp = (k, type = "text", w = "") => <input type={type} disabled={!me.coord} className={`field py-1 text-xs ${w}`} defaultValue={r[k] ?? ""} onBlur={(e) => e.target.value !== String(r[k] ?? "") && save(t.key, { [k]: e.target.value })} />;
            return (
              <tr key={t.key}>
                <td className="p-2 text-ink">{t.t}{t.hint && <span className="block text-[10.5px] text-faint">{t.hint}</span>}</td>
                <td className="p-2">{inp("owner_name")}</td>
                <td className="p-2">{inp("due", "date")}</td>
                <td className="p-2">{inp("target", "number", "w-20")}</td>
                <td className="p-2">{inp("done", "number", "w-20")}</td>
                <td className="p-2"><select disabled={!me.coord} className={`field w-auto py-1 text-xs ${ST[r.status ?? "todo"].c}`} value={r.status ?? "todo"} onChange={(e) => save(t.key, { status: e.target.value })}>
                  {Object.entries(ST).map(([k, s]) => <option key={k} value={k}>{s.t}</option>)}</select></td>
                <td className="p-2">{inp("notes")}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {msg && !msg.ok && <p className="text-sm text-absent">{msg.text}</p>}
    </div>
  );
}
