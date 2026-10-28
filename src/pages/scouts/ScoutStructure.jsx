// src/pages/scouts/ScoutStructure.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import { POSTS, PATROL_COLORS } from "../../lib/scouts.js";
import { loadTeam } from "./data.js";

/* =====================================================================
   هيكل الفريق الكشفي والطلائع (supabase/scouts_5.sql):
   القائد ← النائب ← العريف الأول ← نائب العريف الأول ← عرفاء الطلائع، ولكل طليعة
   اسمها وشعارها ولونها ومهامها، وعريفها ونائبه وأعضاؤها.
   ===================================================================== */

const ORDINAL = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
const lines = (t) => (t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

function Node({ title, name, color = "#3E6350", tint, small }) {
  return (
    <div className={`min-w-0 rounded-sm2 border px-3 py-2 text-center ${small ? "" : "shadow-sm"}`}
         style={{ borderColor: color, background: tint ?? "#fff" }}>
      <p className="text-[10.5px] font-semibold" style={{ color }}>{title}</p>
      <p className={`truncate font-bold text-ink ${small ? "text-[12px]" : "text-[13.5px]"}`}>{name || <span className="text-faint">لم يُحدَّد</span>}</p>
    </div>
  );
}
const Stem = () => <div className="mx-auto h-4 w-px bg-line" />;

export default function ScoutStructure() {
  const [team, setTeam] = useState(null);
  const [staff, setStaff] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({});           // patrol_id ← تعديلات غير محفوظة
  const load = () => loadTeam().then((t) => { setTeam(t); if (t.err) setMsg({ ok: false, t: t.err }); });
  useEffect(() => {
    load();
    supabase.rpc("scout_staff_list").then(({ data }) => setStaff(data ?? []));
  }, []);

  if (!team) return <Loader />;
  const { members, patrols } = team;
  const byPost = (post, pid) => members.find((m) => m.post === post && (pid === undefined || m.patrol_id === pid));
  const leader = staff.find((s) => !s.deputy), deputy = staff.find((s) => s.deputy);
  const free = members.filter((m) => !m.patrol_id && !["chief", "chief_deputy"].includes(m.post));

  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, t: e.message }); }
    setBusy(false); load();
  };
  const upd = async (id, patch) => { const { error } = await supabase.from("scout_members").update(patch).eq("student_id", id); if (error) throw error; };

  // منصب فريد (العريف الأول ونائبه، أو عريف الطليعة ونائبه): يعود صاحبه السابق عضوًا أولًا
  const setUnique = (post, id, pid = null) => run(async () => {
    const prev = byPost(post, pid ?? undefined);
    if (prev && prev.id !== id) await upd(prev.id, { post: "member" });
    if (id) await upd(id, { post, patrol_id: pid });
  });
  const addPatrol = () => run(async () => {
    const { error } = await supabase.from("scout_patrols").insert({
      name: `الطليعة ${ORDINAL[patrols.length] ?? patrols.length + 1}`, color: PATROL_COLORS[patrols.length % PATROL_COLORS.length], sort: patrols.length });
    if (error) throw error;
  });
  const savePatrol = (p) => run(async () => {
    const e = edit[p.id];
    const { error } = await supabase.from("scout_patrols").update({
      name: e.name.trim() || p.name, motto: e.motto?.trim() || null, tasks: e.tasks?.trim() || null, color: e.color }).eq("id", p.id);
    if (error) throw error;
    setEdit((x) => { const n = { ...x }; delete n[p.id]; return n; });
  });
  const delPatrol = async (p) => {
    if (!(await confirmDanger({ title: `حذف ${p.name}`, impact: ["يعود عريفها ونائبه وأعضاؤها أعضاءً بلا طليعة.", "تُحذف تقييمات الطليعة الأسبوعية."], confirmLabel: "حذف الطليعة" }))) return;
    run(async () => { const { error } = await supabase.from("scout_patrols").delete().eq("id", p.id); if (error) throw error; });
  };

  return (
    <div className="space-y-4">
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}

      {/* شجرة الهيكل */}
      <section className="card overflow-x-auto p-4">
        <p className="mb-3 text-sm font-semibold text-ink">هيكل الفريق الكشفي</p>
        <div className="mx-auto max-w-sm space-y-0">
          <Node title="القائد الكشفي" name={leader?.full_name} tint="#EEF6F1" />
          <Stem />
          <Node title="نائب القائد" name={deputy?.full_name} tint="#F6F9F7" />
          <Stem />
          <div className="grid grid-cols-2 gap-2">
            <Node title={POSTS.chief.t} name={byPost("chief")?.name} color="#B8912F" tint="#FBF6EA" />
            <Node title={POSTS.chief_deputy.t} name={byPost("chief_deputy")?.name} color="#B8912F" tint="#FDFAF2" />
          </div>
          <Stem />
        </div>
        {patrols.length ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(patrols.length, 4)}, minmax(0, 1fr))` }}>
            {patrols.map((p) => {
              const n = members.filter((m) => m.patrol_id === p.id).length;
              return (
                <div key={p.id} className="space-y-1 rounded-sm2 border-t-4 bg-canvas p-2" style={{ borderTopColor: p.color }}>
                  <p className="truncate text-center text-[12.5px] font-bold" style={{ color: p.color }}>{p.name}</p>
                  <Node small title="العريف" name={byPost("patrol_leader", p.id)?.name} color={p.color} />
                  <Node small title="نائب العريف" name={byPost("patrol_deputy", p.id)?.name} color={p.color} />
                  <p className="text-center text-[11px] text-muted"><span className="num">{n}</span> أعضاء</p>
                </div>
              );
            })}
          </div>
        ) : <p className="text-center text-xs text-muted">لا طلائع بعد. أضف الطلائع من الأسفل (العادة أربع طلائع).</p>}
      </section>

      {/* العريف الأول ونائبه */}
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        {["chief", "chief_deputy"].map((post) => (
          <label key={post} className="text-xs font-medium text-muted">{POSTS[post].t}
            <select className="field mt-1 w-full" disabled={busy} value={byPost(post)?.id ?? ""}
                    onChange={(e) => setUnique(post, e.target.value || null)}>
              <option value="">— اختر من أعضاء الفريق —</option>
              {members.filter((m) => m.post === post || (!m.patrol_id && m.post === "member")).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.cls}</option>)}
            </select>
            {byPost(post) && <button className="mt-1 text-[11px] text-absent" onClick={() => run(() => upd(byPost(post).id, { post: "member" }))}>إلغاء التعيين</button>}
          </label>
        ))}
        <p className="text-[11px] text-faint sm:col-span-2">العريف الأول ونائبه على الفريق كله، فلا يكونان في طليعة. يحضّران الفريق كله من حسابيهما.</p>
      </section>

      {/* الطلائع */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">الطلائع <span className="num text-muted">({patrols.length})</span></p>
        <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={addPatrol}>+ طليعة</button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {patrols.map((p) => {
          const e = edit[p.id];
          const mates = members.filter((m) => m.patrol_id === p.id)
            .sort((a, b) => ["patrol_leader", "patrol_deputy", "member"].indexOf(a.post) - ["patrol_leader", "patrol_deputy", "member"].indexOf(b.post));
          return (
            <article key={p.id} className="card overflow-hidden border-t-4" style={{ borderTopColor: p.color }}>
              <div className="space-y-2 p-4">
                {e ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input className="field flex-1" value={e.name} onChange={(x) => setEdit({ ...edit, [p.id]: { ...e, name: x.target.value } })} placeholder="اسم الطليعة" />
                      <input type="color" className="h-10 w-12 cursor-pointer rounded-sm2 border border-line" value={e.color} onChange={(x) => setEdit({ ...edit, [p.id]: { ...e, color: x.target.value } })} />
                    </div>
                    <input className="field w-full" value={e.motto ?? ""} onChange={(x) => setEdit({ ...edit, [p.id]: { ...e, motto: x.target.value } })} placeholder="شعار الطليعة (اختياري)" />
                    <textarea className="field w-full" rows={3} value={e.tasks ?? ""} onChange={(x) => setEdit({ ...edit, [p.id]: { ...e, tasks: x.target.value } })}
                              placeholder="مهام الطليعة: سطر لكل مهمة، مثل: تنظيم الاصطفاف الصباحي، متابعة الفسحة في الساحة الشرقية" />
                    <div className="flex gap-2">
                      <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={() => savePatrol(p)}>حفظ</button>
                      <button className="btn-ghost px-4 py-1.5 text-xs" onClick={() => setEdit((x) => { const n = { ...x }; delete n[p.id]; return n; })}>إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold" style={{ color: p.color }}>{p.name}</p>
                        {p.motto && <p className="text-xs text-muted">«{p.motto}»</p>}
                      </div>
                      <button className="text-xs text-mint-deep underline" onClick={() => setEdit({ ...edit, [p.id]: { name: p.name, motto: p.motto, tasks: p.tasks, color: p.color } })}>تعديل</button>
                      <button className="text-xs text-absent" onClick={() => delPatrol(p)}>حذف</button>
                    </div>
                    {lines(p.tasks).length > 0 ? (
                      <div className="rounded-sm2 bg-canvas px-3 py-2">
                        <p className="mb-1 text-[11px] font-semibold text-muted">مهام الطليعة</p>
                        <ul className="list-inside list-disc space-y-0.5 text-[13px] text-ink">{lines(p.tasks).map((t) => <li key={t}>{t}</li>)}</ul>
                      </div>
                    ) : <p className="text-xs text-faint">لم تُحدَّد مهام الطليعة بعد. اضغط «تعديل».</p>}
                  </>
                )}
              </div>
              <div className="divide-y divide-line border-t border-line">
                {mates.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.name} <span className="text-[11px] text-muted">· {m.cls}</span></span>
                    <select className="field !h-8 w-auto !py-0 text-xs" disabled={busy} value={m.post}
                            style={m.post !== "member" ? { color: p.color, fontWeight: 700 } : undefined}
                            onChange={(x) => x.target.value === "member" ? run(() => upd(m.id, { post: "member" })) : setUnique(x.target.value, m.id, p.id)}>
                      {["patrol_leader", "patrol_deputy", "member"].map((k) => <option key={k} value={k}>{POSTS[k].t}</option>)}
                    </select>
                    <button className="text-[11px] text-muted hover:text-absent" disabled={busy}
                            onClick={() => run(() => upd(m.id, { post: "member", patrol_id: null }))}>إخراج</button>
                  </div>
                ))}
                {free.length > 0 && (
                  <div className="px-4 py-2">
                    <select className="field w-full text-sm" disabled={busy} value=""
                            onChange={(x) => x.target.value && run(() => upd(x.target.value, { patrol_id: p.id, post: "member" }))}>
                      <option value="">+ إضافة عضو إلى {p.name}</option>
                      {free.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.cls}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {free.length > 0 && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-semibold text-ink">أعضاء بلا طليعة <span className="num text-muted">({free.length})</span></p>
          <div className="flex flex-wrap gap-1.5">{free.map((m) => <span key={m.id} className="rounded-pill bg-canvas px-2.5 py-1 text-xs text-ink">{m.name}</span>)}</div>
        </section>
      )}
    </div>
  );
}
