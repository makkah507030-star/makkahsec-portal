// src/lib/notes.js
import { supabase } from "./supabase";
import { todayISO } from "./schoolTime.js";

/* =====================================================================
   مفكرتي (supabase/staff_notes.sql): ملاحظات ومهام شخصية للمعلمين والإداريين،
   لا يقرؤها إلا صاحبها. ما حلّ موعده يظهر في «بانتظار إجرائك» (lib/navBadges.js).
   ===================================================================== */

export const NOTE_COLS = "id, title, body, items, due_date, due_time, color, pinned, done_at, link_path, link_title, created_at, updated_at";

// ألوان للتمييز: الاسم يظهر للمستخدم، والقيمة تُحفظ
export const NOTE_COLORS = [
  { key: "urgent",  t: "عاجل",   c: "#A23B3B", bg: "#FBEBEB" },
  { key: "follow",  t: "متابعة", c: "#8A6C17", bg: "#FBF3DE" },
  { key: "idea",    t: "فكرة",   c: "#2F5F86", bg: "#E7F0F8" },
  { key: "class",   t: "صفي",    c: "#3E6350", bg: "#EDFAF2" },
];
export const colorOf = (k) => NOTE_COLORS.find((x) => x.key === k) ?? null;

const nowHM = () => new Date().toTimeString().slice(0, 5);

/** حال الملاحظة: done | overdue | today | soon (اليوم لكن وقتها لم يحن) | upcoming | none */
export function dueState(n) {
  if (n.done_at) return "done";
  if (!n.due_date) return "none";
  const today = todayISO();
  if (n.due_date < today) return "overdue";
  if (n.due_date > today) return "upcoming";
  if (n.due_time && n.due_time.slice(0, 5) > nowHM()) return "soon";
  return "today";
}

/** حلّ موعدها: تظهر في «بانتظار إجرائك» */
export const isDue = (n) => ["overdue", "today"].includes(dueState(n));

/** ما حلّ موعده من مهامي — لصندوق «بانتظار إجرائك» (الخطأ: لا شيء) */
export async function loadDueNotes() {
  const { data, error } = await supabase.from("staff_notes").select("id, title, body, due_date, due_time, color")
    .is("done_at", null).not("due_date", "is", null).lte("due_date", todayISO())
    .order("due_date").limit(50);
  return error ? [] : (data ?? []).filter(isDue);
}

/** عنوان يُعرض: العنوان، وإلا أول سطر من النص */
export const noteTitle = (n) => n.title?.trim() || (n.body ?? "").trim().split("\n")[0].slice(0, 60) || "ملاحظة بلا عنوان";
