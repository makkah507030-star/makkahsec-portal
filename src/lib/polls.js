// src/lib/polls.js
/* =====================================================================
   التصويت والاستطلاعات (supabase/polls_1.sql وpolls_2.sql): ثوابت مشتركة بين صفحة الإدارة
   وصفحة المصوّت وبطاقة الرئيسية وتبويب التصويت في الترشيحات.
   ===================================================================== */
import { supabase } from "./supabase";

export const POLL_KIND = {
  poll:     { t: "استطلاع", hint: "رأي سريع بخيار واحد أو عدة خيارات" },
  election: { t: "انتخاب",  hint: "اقتراع سري بصوت واحد لكل حساب، والنتائج بعد الإغلاق" },
};
export const POLL_RESULTS = {
  live:  { t: "للمصوّت بعد تصويته" },
  after: { t: "للجميع بعد الإغلاق" },
  owner: { t: "لمنشئ التصويت وحده" },
};
export const VOTE_MODE = {
  committee: { t: "اللجنة وحدها", hint: "المقابلة والتقييم والقرار للجنة، بلا تصويت (الافتراضي)." },
  advisory:  { t: "تصويت استئناسي", hint: "يصوّت الطلاب على من رشّحتهم اللجنة للمقابلة، والنتيجة للجنة وحدها رقمًا مساعدًا، والقرار لها." },
  decisive:  { t: "تصويت حاسم", hint: "تختار اللجنة المؤهلين، ويحدد التصويت الفائزين بعدد المقاعد، وتعتمد اللجنة النتيجة قبل إعلانها." },
};

export const pollState = (p, now = Date.now()) =>
  p.cancelled_at ? { t: "ملغى", c: "bg-canvas text-muted" }
  : !p.published ? { t: "مسودة", c: "bg-canvas text-muted" }
  : now < new Date(p.opens_at).getTime() ? { t: "لم يبدأ", c: "bg-late/10 text-late" }
  : now < new Date(p.closes_at).getTime() ? { t: "مفتوح", c: "bg-mint-deep text-white" }
  : { t: "مغلق", c: "bg-present/10 text-present" };

export const isOpen = (p, now = Date.now()) =>
  p.published && !p.cancelled_at && now >= new Date(p.opens_at).getTime() && now < new Date(p.closes_at).getTime();

export const setupMsg = (e) => (/polls|poll_|schema cache|relation|function/i.test(e?.message ?? "")
  ? "التصويت يحتاج تشغيل supabase/polls_1.sql ثم polls_2.sql مرة واحدة في Supabase ← SQL Editor." : e?.message);

/** الاستطلاعات الظاهرة للمستخدم (القاعدة تحصرها في فئته) ومعها هل صوّت فيها */
export async function loadMyPolls() {
  const [{ data: p, error }, { data: v }] = await Promise.all([
    supabase.from("polls").select("*, poll_options(id, label, note, sort)").eq("published", true).is("cancelled_at", null)
      .order("closes_at", { ascending: false }).limit(60),
    supabase.from("poll_voters").select("poll_id"),
  ]);
  if (error) return { rows: [], err: setupMsg(error) };
  const voted = new Set((v ?? []).map((x) => x.poll_id));
  return { rows: (p ?? []).map((x) => ({ ...x, voted: voted.has(x.id),
    poll_options: (x.poll_options ?? []).sort((a, b) => a.sort - b.sort) })), err: "" };
}

export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
