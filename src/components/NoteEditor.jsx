// src/components/NoteEditor.jsx
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { NOTE_COLORS, NOTE_COLS } from "../lib/notes.js";
import { refreshNavBadges } from "../lib/navBadges.js";

/* =====================================================================
   محرّر ملاحظة في «مفكرتي» — جديدة أو تعديل، في الصفحة وفي الإضافة السريعة.
   note: الملاحظة للتعديل، أو null لجديدة. link: { path, title } للجديدة من صفحة.
   onSaved(row) بعد الحفظ.
   ===================================================================== */

const blank = { title: "", body: "", items: [], due_date: "", due_time: "", color: null, pinned: false };

export default function NoteEditor({ note = null, link = null, onSaved, onCancel, autoFocus = false }) {
  const [f, setF] = useState(() => (note ? {
    ...blank, ...note, due_date: note.due_date ?? "", due_time: note.due_time?.slice(0, 5) ?? "", items: note.items ?? [],
  } : blank));
  const [keepLink, setKeepLink] = useState(!!(note ? note.link_path : link?.path));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const linkPath = note ? note.link_path : link?.path, linkTitle = note ? note.link_title : link?.title;

  const setItem = (i, patch) => set("items", f.items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const empty = !f.title.trim() && !f.body.trim() && !f.items.some((x) => x.t?.trim());

  const save = async () => {
    if (empty) { setErr("اكتب عنوانًا أو نصًا."); return; }
    setBusy(true); setErr("");
    const row = {
      title: f.title.trim(), body: f.body.trim(),
      items: f.items.filter((x) => x.t?.trim()).map((x) => ({ t: x.t.trim(), done: !!x.done })),
      due_date: f.due_date || null, due_time: f.due_date && f.due_time ? f.due_time : null,
      color: f.color, pinned: f.pinned,
      link_path: keepLink ? linkPath ?? null : null, link_title: keepLink ? linkTitle ?? null : null,
      updated_at: new Date().toISOString(),
    };
    const q = note
      ? supabase.from("staff_notes").update(row).eq("id", note.id).select(NOTE_COLS).single()
      : supabase.from("staff_notes").insert(row).select(NOTE_COLS).single();
    const { data, error } = await q;
    setBusy(false);
    if (error) {
      setErr(/staff_notes|schema cache/i.test(error.message)
        ? "المفكرة لم تُفعَّل بعد في قاعدة البيانات (supabase/staff_notes.sql)." : error.message);
      return;
    }
    refreshNavBadges(true);
    onSaved?.(data);
    if (!note) { setF(blank); }
  };

  return (
    <div className="space-y-2.5">
      <input className="field w-full font-semibold" placeholder="العنوان" value={f.title} autoFocus={autoFocus}
             onChange={(e) => set("title", e.target.value)} />
      <textarea className="field w-full" rows={3} placeholder="اكتب ملاحظتك…" value={f.body}
                onChange={(e) => set("body", e.target.value)} />

      {/* قائمة مهام اختيارية */}
      {f.items.length > 0 && (
        <div className="space-y-1.5">
          {f.items.map((x, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#3E6350]" checked={!!x.done}
                     onChange={(e) => setItem(i, { done: e.target.checked })} />
              <input className="field flex-1 py-1.5 text-sm" value={x.t} placeholder={`مهمة ${i + 1}`}
                     onChange={(e) => setItem(i, { t: e.target.value })}
                     onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); set("items", [...f.items, { t: "", done: false }]); } }} />
              <button type="button" className="text-xs text-faint hover:text-absent"
                      onClick={() => set("items", f.items.filter((_, k) => k !== i))}>حذف</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="text-xs font-medium text-mint-deep hover:underline"
              onClick={() => set("items", [...f.items, { t: "", done: false }])}>
        + {f.items.length ? "مهمة أخرى" : "قائمة مهام"}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          الموعد
          <input type="date" className="field py-1.5 text-sm" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </label>
        {f.due_date && (
          <input type="time" className="field py-1.5 text-sm" value={f.due_time} onChange={(e) => set("due_time", e.target.value)}
                 title="اختياري: تظهر في «بانتظار إجرائك» من هذا الوقت" />
        )}
        {f.due_date && (
          <button type="button" className="text-xs text-faint hover:text-ink" onClick={() => setF((x) => ({ ...x, due_date: "", due_time: "" }))}>
            بلا موعد
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {NOTE_COLORS.map((c) => (
          <button key={c.key} type="button" onClick={() => set("color", f.color === c.key ? null : c.key)}
                  className="rounded-pill px-3 py-1 text-xs font-semibold"
                  style={{ background: c.bg, color: c.c, outline: f.color === c.key ? `2px solid ${c.c}` : "none" }}>
            {c.t}
          </button>
        ))}
        <label className="mr-auto flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" className="h-4 w-4 accent-[#3E6350]" checked={f.pinned} onChange={(e) => set("pinned", e.target.checked)} />
          تثبيت أعلى المفكرة
        </label>
      </div>

      {linkPath && (
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" className="h-4 w-4 accent-[#3E6350]" checked={keepLink} onChange={(e) => setKeepLink(e.target.checked)} />
          ربطها بصفحة: <span className="truncate font-medium text-ink">{linkTitle || linkPath}</span>
        </label>
      )}

      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : note ? "حفظ التعديل" : "حفظ في مفكرتي"}</button>
        {onCancel && <button className="rounded-pill border border-line px-4 text-sm text-muted" onClick={onCancel}>إلغاء</button>}
      </div>
    </div>
  );
}
