// src/lib/activities.js
// بنك الأنشطة (supabase/activities_1.sql و_2): أقسام الحقيبة والأنشطة الصفية، والوسائط.
import { supabase } from "./supabase";

// حقيبة حصص الانتظار: الترفيه أولًا، والألعاب والتقنية في المقدمة
export const WAITING_SECTIONS = [
  { key: "games",   label: "ألعاب إلكترونية", emoji: "🎮", tint: "from-[#3E6350] to-[#2C4A3B]" },
  { key: "tech",    label: "تقنية",           emoji: "💻", tint: "from-[#5B4A8F] to-[#3E3266]" },
  { key: "puzzles", label: "ألغاز وتفكير",    emoji: "🧩", tint: "from-[#8F6A2F] to-[#664B1F]" },
  { key: "culture", label: "مسابقات وثقافة",  emoji: "🏆", tint: "from-[#8F3F3F] to-[#662C2C]" },
];

export const CLASS_SECTIONS = [
  { key: "warmup", label: "تهيئة",        emoji: "💡", tint: "from-[#8F6A2F] to-[#664B1F]" },
  { key: "active", label: "تعلم نشط",     emoji: "🚀", tint: "from-[#3E6350] to-[#2C4A3B]" },
  { key: "coop",   label: "تعاوني",       emoji: "🤝", tint: "from-[#2F6E8F] to-[#1F4E66]" },
  { key: "assess", label: "تقويم بنائي",  emoji: "✅", tint: "from-[#5B4A8F] to-[#3E3266]" },
  { key: "diff",   label: "فروق فردية",   emoji: "🎯", tint: "from-[#8F3F3F] to-[#662C2C]" },
];

export const sectionsOf = (kind) => (kind === "waiting" ? WAITING_SECTIONS : CLASS_SECTIONS);
export const sectionMeta = (kind, key) => sectionsOf(kind).find((s) => s.key === key) ?? { key, label: key, emoji: "⭐", tint: "from-[#3E6350] to-[#2C4A3B]" };

export const GAMES = { huroof: "حروف", teams_quiz: "مسابقة الفرق" };

export const MEDIA_BUCKET = "activity-media";
export const mediaUrl = (path) => (path ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl : null);

/** معرّف فيديو يوتيوب من رابطه (لصورة مصغّرة)، أو null */
export function youtubeId(url) {
  const m = String(url ?? "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  return m?.[1] ?? null;
}

// ألوان مجموعات كأس المادة
export const CUP_COLORS = ["#3E6350", "#2F6E8F", "#8F3F3F", "#8F6A2F", "#5B4A8F", "#2F8F7A", "#8F2F6A", "#4A4A4A"];
