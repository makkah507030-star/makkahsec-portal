// src/pages/Notebook.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { fmtDate } from "../lib/dates";
import { NOTE_COLS, colorOf, dueState, noteTitle } from "../lib/notes.js";
import { refreshNavBadges } from "../lib/navBadges.js";
import NoteEditor from "../components/NoteEditor.jsx";
import Loader from "../components/Loader.jsx";

/* =====================================================================
   مفكرتي — ملاحظات ومهام شخصية للمعلمين والإداريين (supabase/staff_notes.sql).
   لا يراها إلا صاحبها. تُقسم بحسب موعدها: المثبتة، فالمتأخرة، فاليوم، فالقادمة،
   فبلا موعد، والمنجزة في الآخر. وما حلّ موعده يظهر في «بانتظار إجرائك».
   ===================================================================== */

const SECTIONS = [
  { key: "pinned",   t: "المثبتة" },
  { key: "overdue",  t: "متأخرة", tone: "text-absent" },
  { key: "today",    t: "اليوم", tone: "text-warning" },
  { key: "upcoming", t: "قادمة" },
  { key: "none",     t: "بلا موعد" },
];

const sectionOf = (n) => {
  const s = dueState(n);
  if (s === "done") return "done";
  if (n.pinned) return "pinned";
  return s === "soon" ? "today" : s;
};

export default function Notebook() {
  const { session, effectiveRole } = useSession();
  const uid = session?.user?.id;
  const staff = effectiveRole === "admin" || effectiveRole === "teacher";
  const [params] = useSearchParams();
  const focus = params.get("n");
  const [notes, setNotes] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("staff_notes").select(NOTE_COLS)
      .order("pinned", { ascending: false }).order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false }).limit(500);
    if (error) setErr(/staff_notes|schema cache/i.test(error.message)
      ? "المفكرة لم تُفعَّل بعد في قاعدة البيانات (supabase/staff_notes.sql)." : error.message);
    setNotes(data ?? []);
  };
  useEffect(() => { if (uid && staff) load(); }, [uid, staff]);

  // فتح ملاحظة من «بانتظار إجرائك»: الانتقال إليها
  useEffect(() => {
    if (!focus || !notes) return;
    requestAnimationFrame(() => document.getElementById(`note-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [focus, notes]);

  const shown = useMemo(() => {
    const t = q.trim();
    return (notes ?? []).filter((n) => !t || [n.title, n.body, ...(n.items ?? []).map((x) => x.t)].join(" ").includes(t));
  }, [notes, q]);

  const patch = async (n, fields) => {
    setNotes((xs) => xs.map((x) => (x.id === n.id ? { ...x, ...fields } : x)));
    await supabase.from("staff_notes").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", n.id);
    refreshNavBadges(true);
  };
  const remove = async (n) => {
    if (!window.confirm(`حذف «${noteTitle(n)}» نهائيًا؟`)) return;
    setNotes((xs) => xs.filter((x) => x.id !== n.id));
    await supabase.from("staff_notes").delete().eq("id", n.id);
    refreshNavBadges(true);
  };
  const upsert = (row) => setNotes((xs) => (xs.some((x) => x.id === row.id) ? xs.map((x) => (x.id === row.id ? row : x)) : [row, ...xs]));

  if (!staff) return <p className="card px-4 py-6 text-sm text-muted">المفكرة للمعلمين والإداريين.</p>;

  const done = shown.filter((n) => n.done_at);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">مفكرتي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ملاحظاتك ومهامك الخاصة، لا يراها غيرك. ما حلّ موعده يظهر في «بانتظار إجرائك» في الرئيسية.
          وتضيف ملاحظة من أي صفحة بزر <b className="text-ink">✎</b> أسفل الشاشة، فتُربط بتلك الصفحة.
        </p>
      </div>

      <section className="card p-4">
        <NoteEditor onSaved={upsert} />
      </section>

      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {!notes ? <Loader compact /> : (
        <>
          {notes.length > 0 && (
            <input className="field w-full" placeholder="بحث في ملاحظاتك…" value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          {notes.length === 0 && !err && <p className="card px-4 py-6 text-center text-sm text-muted">لا ملاحظات بعد. اكتب أولها أعلاه.</p>}

          {SECTIONS.map((s) => {
            const list = shown.filter((n) => sectionOf(n) === s.key);
            if (!list.length) return null;
            return (
              <section key={s.key} className="space-y-2">
                <h2 className={`text-sm font-bold ${s.tone ?? "text-ink"}`}>{s.t} <span className="num font-normal text-muted">({list.length})</span></h2>
                {list.map((n) => (
                  <NoteCard key={n.id} n={n} focus={focus === n.id} editing={editing === n.id}
                            onEdit={() => setEditing(n.id)} onCancel={() => setEditing(null)}
                            onSaved={(row) => { upsert(row); setEditing(null); }}
                            onPatch={(f) => patch(n, f)} onRemove={() => remove(n)} />
                ))}
              </section>
            );
          })}

          {done.length > 0 && (
            <section className="space-y-2">
              <button className="text-sm font-bold text-muted" onClick={() => setShowDone((v) => !v)}>
                المنجزة <span className="num font-normal">({done.length})</span> {showDone ? "▾" : "◂"}
              </button>
              {showDone && done.map((n) => (
                <NoteCard key={n.id} n={n} editing={editing === n.id}
                          onEdit={() => setEditing(n.id)} onCancel={() => setEditing(null)}
                          onSaved={(row) => { upsert(row); setEditing(null); }}
                          onPatch={(f) => patch(n, f)} onRemove={() => remove(n)} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function NoteCard({ n, focus, editing, onEdit, onCancel, onSaved, onPatch, onRemove }) {
  const c = colorOf(n.color);
  const st = dueState(n);
  const items = n.items ?? [];
  const toggleItem = (i) => onPatch({ items: items.map((x, k) => (k === i ? { ...x, done: !x.done } : x)) });

  if (editing) return <section id={`note-${n.id}`} className="card p-4"><NoteEditor note={n} onSaved={onSaved} onCancel={onCancel} autoFocus /></section>;

  return (
    <section id={`note-${n.id}`} className={`card overflow-hidden p-0 ${focus ? "ring-2 ring-mint-deep" : ""} ${n.done_at ? "opacity-60" : ""}`}
             style={c ? { borderInlineStart: `4px solid ${c.c}` } : undefined}>
      <div className="space-y-2 p-3.5">
        <div className="flex items-start gap-2">
          <button title={n.done_at ? "إعادة إلى المهام" : "تمّت"} onClick={() => onPatch({ done_at: n.done_at ? null : new Date().toISOString() })}
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${
                    n.done_at ? "border-mint-deep bg-mint-deep text-white" : "border-line text-transparent hover:border-mint-deep"}`}>✓</button>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold text-ink ${n.done_at ? "line-through" : ""}`}>
              {n.pinned && <span title="مثبتة">📌 </span>}{noteTitle(n)}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {c && <span className="rounded-pill px-2 py-0.5 font-semibold" style={{ background: c.bg, color: c.c }}>{c.t}</span>}
              {n.due_date && (
                <span className={`num rounded-pill px-2 py-0.5 ${st === "overdue" ? "bg-absent/10 text-absent" : st === "today" || st === "soon" ? "bg-warning-light text-warning" : "bg-canvas text-muted"}`}>
                  {st === "overdue" ? "متأخرة · " : st === "today" || st === "soon" ? "اليوم · " : ""}{fmtDate(n.due_date + "T00:00:00")}{n.due_time ? ` · ${n.due_time.slice(0, 5)}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {n.title?.trim() && n.body?.trim() && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{n.body}</p>}

        {items.length > 0 && (
          <div className="space-y-1">
            {items.map((x, i) => (
              <label key={i} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#3E6350]" checked={!!x.done} onChange={() => toggleItem(i)} />
                <span className={x.done ? "text-faint line-through" : "text-ink"}>{x.t}</span>
              </label>
            ))}
            <p className="num text-[11px] text-faint">{items.filter((x) => x.done).length} من {items.length}</p>
          </div>
        )}

        {n.link_path && (
          <Link to={n.link_path} className="inline-flex max-w-full items-center gap-1 truncate rounded-pill bg-mint-tint px-2.5 py-1 text-xs font-medium text-mint-deep hover:underline">
            ↗ من: <span className="truncate">{n.link_title || n.link_path}</span>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-line bg-canvas/50 px-3.5 py-1.5 text-xs">
        <button className="text-muted hover:text-ink" onClick={onEdit}>تعديل</button>
        <button className="text-muted hover:text-ink" onClick={() => onPatch({ pinned: !n.pinned })}>{n.pinned ? "إلغاء التثبيت" : "تثبيت"}</button>
        <button className="mr-auto text-faint hover:text-absent" onClick={onRemove}>حذف</button>
      </div>
    </section>
  );
}
