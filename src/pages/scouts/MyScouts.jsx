// src/pages/scouts/MyScouts.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import Fleur from "../../components/Fleur.jsx";
import { POSTS, ATT_KIND, ATT_STATUS } from "../../lib/scouts.js";

/* =====================================================================
   «فريقي الكشفي» لعضو الفريق (supabase/scouts_6.sql: scout_my و scout_attend):
   منصبه وطليعته وشعارها ومهامها وزملاؤه. والعريف الأول ونائبه يحضّرون الفريق كله،
   وعريف الطليعة ونائبه طليعتهم، لليوم فقط (الاصطفاف الصباحي والفسحة).
   ===================================================================== */

const lines = (t) => (t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

export default function MyScouts() {
  const [me, setMe] = useState(undefined);
  const [kind, setKind] = useState("lineup");
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [rename, setRename] = useState(null);   // اسم الطليعة الجديد (لعريفها)
  const load = () => supabase.rpc("scout_my").then(({ data, error }) => { setMe(error ? null : data); setMarks({}); });
  useEffect(() => { load(); }, []);

  if (me === undefined) return <Loader />;
  if (!me) return <p className="card px-4 py-8 text-center text-sm text-muted">لست عضوًا في الفريق الكشفي.</p>;
  const p = me.patrol;
  const color = p?.color ?? "#3E6350";
  const roster = me.roster ?? [];
  const statusOf = (r) => marks[r.id] ?? r[kind] ?? null;
  const dirty = Object.keys(marks).length;

  const saveName = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("scout_patrol_rename", { p_name: rename });
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message }); return; }
    setRename(null); setMsg({ ok: true, t: "حُفظ اسم الطليعة." }); load();
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("scout_attend", { p_kind: kind, p_marks: Object.entries(marks).map(([id, status]) => ({ id, status })) });
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message }); return; }
    setMsg({ ok: true, t: `حُفظ تحضير ${ATT_KIND[kind]} لـ${data} أعضاء.` });
    load();
  };

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-4 text-white" style={{ background: `linear-gradient(135deg, #1F3D2E, ${color})` }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 text-[#D9B45A]"><Fleur className="h-7 w-7" /></span>
          <div className="min-w-0">
            <p className="text-xs text-white/75">الفريق الكشفي · مدرسة مكة الثانوية</p>
            <p className="text-lg font-bold">{POSTS[me.post]?.t ?? "عضو"}{p ? ` · ${p.name}` : ""}</p>
            {p?.motto && <p className="text-xs text-white/80">«{p.motto}»</p>}
          </div>
        </div>
        {p && me.post === "patrol_leader" && (
          <div className="border-b border-line px-4 py-2.5">
            {rename == null ? (
              <button className="text-xs font-semibold text-mint-deep underline" onClick={() => setRename(p.name)}>تغيير اسم الطليعة</button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input className="field min-w-0 flex-1" value={rename} maxLength={40} autoFocus onChange={(e) => setRename(e.target.value)} placeholder="اسم الطليعة" />
                <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy || rename.trim().length < 2} onClick={saveName}>حفظ</button>
                <button className="text-xs text-muted" onClick={() => setRename(null)}>إلغاء</button>
              </div>
            )}
          </div>
        )}
        {msg && !me.can_attend && <p className={`mx-4 mt-3 rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
        {p && (
          <div className="space-y-3 p-4">
            {lines(p.tasks).length > 0 && (
              <div><p className="mb-1 text-xs font-semibold text-muted">مهام الطليعة</p>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-ink">{lines(p.tasks).map((t) => <li key={t}>{t}</li>)}</ul></div>
            )}
            <div><p className="mb-1 text-xs font-semibold text-muted">أعضاء الطليعة</p>
              <div className="flex flex-wrap gap-1.5">
                {(me.mates ?? []).map((m) => (
                  <span key={m.id} className="rounded-pill bg-canvas px-2.5 py-1 text-xs text-ink">{m.name}
                    {m.post !== "member" && <b style={{ color }}> · {POSTS[m.post].short}</b>}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {me.can_attend && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <p className="flex-1 text-sm font-semibold text-ink">تحضير اليوم <span className="num text-xs font-normal text-muted">{fmtDate(me.today + "T12:00:00")}</span></p>
            {Object.entries(ATT_KIND).map(([k, t]) => (
              <button key={k} onClick={() => { setKind(k); setMarks({}); }}
                      className={`rounded-pill px-3.5 py-1 text-xs font-semibold ${kind === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{t}</button>
            ))}
          </div>
          {msg && <p className={`mx-4 mt-3 rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
          <div className="flex justify-end px-4 pt-2">
            <button className="text-xs font-semibold text-present" onClick={() => setMarks(Object.fromEntries(roster.map((r) => [r.id, "present"])))}>الكل حاضر</button>
          </div>
          <div className="divide-y divide-line">
            {roster.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <p className="min-w-0 flex-1 truncate text-sm text-ink">{r.name}{["chief", "chief_deputy"].includes(me.post) && r.patrol && <span className="text-[11px] text-muted"> · {r.patrol}</span>}</p>
                <div className="flex gap-1">
                  {Object.entries(ATT_STATUS).map(([k, s]) => (
                    <button key={k} onClick={() => setMarks((x) => ({ ...x, [r.id]: k }))}
                            className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${statusOf(r) === k ? s.c : "border border-line bg-white text-muted"}`}>{s.t}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4">
            <button className="btn-primary w-full" disabled={busy || !dirty} onClick={save}>{busy ? "جارٍ الحفظ…" : dirty ? `حفظ التحضير (${dirty})` : "اختر حالة كل عضو"}</button>
          </div>
        </section>
      )}
    </div>
  );
}
