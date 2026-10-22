// src/pages/admin/StaffChildren.jsx
/* =====================================================================
   أبناء المنسوبين — في «إدارة السجلات»: ربط سجل ولي أمر الطالب (من نور) بحساب المعلم أو الإداري
   نفسه، فيتابع أبناءه من واجهة «أبنائي» في حسابه بدل حساب ولي أمر منفصل
   (supabase/staff_children_1.sql). للمدير والدعم الفني ووكيل شؤون الطلاب.
   ===================================================================== */
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Loader from "../../components/Loader.jsx";

export default function StaffChildren() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [sq, setSq] = useState("");
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(null);
  const [guardians, setGuardians] = useState([]);
  const [guardian, setGuardian] = useState(null);
  const [tq, setTq] = useState("");
  const [staff, setStaff] = useState([]);
  const [member, setMember] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => supabase.rpc("staff_children_list").then(({ data, error }) => {
    if (error) setErr(/staff_children_list/.test(error.message) ? "الصفحة تحتاج تشغيل supabase/staff_children_1.sql." : error.message);
    setList(data ?? []);
  });
  useEffect(() => { load(); }, []);

  // البحث عن الطالب، ثم سجل ولي أمره، ثم حساب الموظف
  useEffect(() => {
    const t = sq.trim();
    if (t.length < 2 || student) { setStudents([]); return; }
    const h = setTimeout(() => supabase.from("students").select("id, full_name, national_id").ilike("full_name", `%${t}%`).limit(8)
      .then(({ data }) => setStudents(data ?? [])), 300);
    return () => clearTimeout(h);
  }, [sq, student]);
  useEffect(() => {
    if (!student) { setGuardians([]); setGuardian(null); return; }
    supabase.from("guardian_student").select("guardians(id, full_name, mobile, user_id)").eq("student_id", student.id)
      .then(({ data }) => {
        const g = (data ?? []).map((r) => r.guardians).filter(Boolean);
        setGuardians(g);
        setGuardian(g.length === 1 ? g[0] : null);
      });
  }, [student]);
  useEffect(() => {
    const t = tq.trim();
    if (t.length < 2 || member) { setStaff([]); return; }
    const h = setTimeout(() => supabase.from("users").select("id, full_name, role").in("role", ["teacher", "admin"]).eq("is_active", true)
      .ilike("full_name", `%${t}%`).limit(8).then(({ data }) => setStaff(data ?? [])), 300);
    return () => clearTimeout(h);
  }, [tq, member]);

  const reset = () => { setSq(""); setStudent(null); setGuardian(null); setTq(""); setMember(null); };

  const link = async () => {
    if (!guardian || !member) return;
    const sure = window.confirm(
      `ربط أبناء ولي الأمر «${guardian.full_name}» (${guardian.mobile}) بحساب «${member.full_name}»؟\n\n` +
      "• يتابع أبناءه من واجهة «أبنائي» في حسابه، وتصله إشعاراتهم.\n" +
      (guardian.user_id ? "• يُعطَّل حساب ولي الأمر المنفصل لهذا الرقم، فلا يبقى له حسابان.\n" : ""));
    if (!sure) return;
    setBusy(true); setMsg(""); setErr("");
    const { data, error } = await supabase.rpc("staff_link_children", { p_guardian: guardian.id, p_staff: member.id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(`رُبط الأبناء بحساب ${member.full_name} (عددهم: ${data?.children ?? "—"}). تظهر له «أبنائي» عند دخوله التالي.`);
    reset(); load();
  };

  const unlink = async (r) => {
    if (!window.confirm(`فك ربط أبناء «${r.staff_name}»؟ تختفي واجهة «أبنائي» من حسابه، ويعود سجل ولي الأمر بلا حساب.`)) return;
    const { error } = await supabase.rpc("staff_unlink_children", { p_guardian: r.guardian_id });
    if (error) setErr(error.message); else { setMsg("فُك الربط."); load(); }
  };

  const Pick = ({ items, label, onPick }) => items.length > 0 && (
    <div className="mt-1 divide-y divide-line/60 rounded-card border border-line bg-paper">
      {items.map((x) => (
        <button key={x.id} type="button" onClick={() => onPick(x)} className="block w-full px-3 py-2 text-start text-sm hover:bg-canvas">{label(x)}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="rounded-card bg-mint-tint px-4 py-3 text-sm leading-relaxed text-ink">
        للمعلم أو الإداري الذي له أبناء في المدرسة: اربط سجل ولي أمرهم بحسابه، فيظهر له «أبنائي» بجانب واجهته،
        ويتابع منها الحضور والدرجات والسلوك والنماذج، وتصله إشعاراتهم، بلا حساب ولي أمر منفصل.
      </p>
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {msg && <p className="rounded-card bg-present/10 px-3 py-2 text-sm text-present">{msg}</p>}

      <div className="card space-y-3 p-4">
        <p className="font-semibold text-ink">ربط جديد</p>
        <label className="block text-xs text-muted">1) أحد الأبناء (اسم الطالب)
          {student ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-ink"><b>{student.full_name}</b>
              <button type="button" className="text-xs text-muted underline" onClick={() => { setStudent(null); setSq(""); }}>تغيير</button></p>
          ) : <input className="field mt-1" value={sq} onChange={(e) => setSq(e.target.value)} placeholder="اكتب جزءًا من اسم الطالب…" />}
        </label>
        {!student && <Pick items={students} label={(x) => x.full_name} onPick={setStudent} />}

        {student && (
          <div className="text-xs text-muted">2) سجل ولي الأمر
            {!guardians.length ? <p className="mt-1 text-sm text-absent">لا سجل ولي أمر لهذا الطالب. أضفه من تبويب «أولياء الأمور» أولًا.</p> : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {guardians.map((g) => (
                  <button key={g.id} type="button" onClick={() => setGuardian(g)}
                    className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${guardian?.id === g.id ? "bg-mint-deep text-white" : "border border-line text-ink"}`}>
                    {g.full_name} · <bdi className="num">{g.mobile}</bdi>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-faint">يُربط كل أبناء هذا السجل معًا.</p>
          </div>
        )}

        {guardian && (
          <label className="block text-xs text-muted">3) حساب المعلم أو الإداري
            {member ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-ink"><b>{member.full_name}</b> <span className="text-xs text-muted">({member.role === "admin" ? "إداري" : "معلم"})</span>
                <button type="button" className="text-xs text-muted underline" onClick={() => { setMember(null); setTq(""); }}>تغيير</button></p>
            ) : <input className="field mt-1" value={tq} onChange={(e) => setTq(e.target.value)} placeholder="اكتب جزءًا من اسم الموظف…" />}
          </label>
        )}
        {guardian && !member && <Pick items={staff} label={(x) => `${x.full_name} — ${x.role === "admin" ? "إداري" : "معلم"}`} onPick={setMember} />}

        <button type="button" className="btn-primary w-full" disabled={busy || !guardian || !member} onClick={link}>
          {busy ? "جارٍ الربط…" : "ربط الأبناء بحسابه"}
        </button>
      </div>

      <div className="card overflow-x-auto">
        <p className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">المنسوبون المربوط بهم أبناؤهم</p>
        {!list ? <Loader compact /> : !list.length ? <p className="p-6 text-center text-sm text-muted">لا روابط بعد.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="bg-canvas text-right text-xs text-muted"><th className="p-2">الموظف</th><th className="p-2">الأبناء</th><th className="p-2">جوال سجل ولي الأمر</th><th className="p-2" /></tr></thead>
            <tbody className="divide-y divide-line/50">
              {list.map((r) => (
                <tr key={r.guardian_id}>
                  <td className="p-2 font-semibold text-ink">{r.staff_name}</td>
                  <td className="p-2">{r.children || "—"}</td>
                  <td className="num p-2 text-muted">{r.mobile}</td>
                  <td className="p-2 text-left"><button type="button" className="text-xs text-absent underline" onClick={() => unlink(r)}>فك الربط</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
