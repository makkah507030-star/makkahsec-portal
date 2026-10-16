import { supabase } from "./supabase";
import { todayISO } from "./schoolTime.js";
import { ELEMENTS } from "./dfile.js";
import { plcNotify } from "./plc.js";

/* =====================================================================
   حلقة التحسين: توصية ← خطة ← متابعة بموعد ← أثر يُقاس آليًا
   (supabase/improvement_loop_*.sql).
   • التوصية تُقترح من البنود المقدَّرة 3 فأقل ومن نص «جوانب تحتاج دعمًا»، ويؤكدها
     الزائر أو المدير، وتُحفظ درجة البند خط أساس.
   • يكتب المعلم خطته (الإجراءات والدعم المطلوب وموعد المتابعة)، ويعتمدها الزائر.
   • الأثر: درجة البند نفسه في الزيارة أو التقييم التالي مقابل خط الأساس، وما لم
     يتحسّن تُفتح له دورة ثانية بدعم أعلى. كل ذلك في القاعدة عند صدور الزيارة.
   ===================================================================== */

export const EL_TITLE = Object.fromEntries(ELEMENTS);
export const elKey = (i) => `e${String(i + 1).padStart(2, "0")}`;

export const SCORE_LABEL = { 5: "مثالي", 4: "تخطى التوقعات", 3: "وافق التوقعات", 2: "بحاجة إلى تطوير", 1: "غير مرضٍ" };

/* الحد الذي تُقترح عنده التوصية، والمدة الافتراضية للمتابعة، ومهلة المتأخر */
export const SUGGEST_AT = 3;
export const FOLLOW_DAYS = 28;
export const LATE_AFTER = 7;

export const STATUS = {
  plan:      { t: "تنتظر خطة المعلم", c: "bg-warning-light text-warning" },
  review:    { t: "خطة تنتظر الاعتماد", c: "bg-warning-light text-warning" },
  active:    { t: "خطة جارية", c: "bg-mint-light text-mint-deep" },
  closed:    { t: "أُغلقت", c: "bg-canvas text-ink" },
  cancelled: { t: "أُلغيت", c: "bg-canvas text-muted" },
};
export const OPEN = ["plan", "review", "active"];
export const SOURCE_LABEL = { visit: "زيارة دعم", review: "تقييم الأداء الوظيفي" };

/* أمثلة للدعم المطلوب، والدورة الثانية تحتاج دعمًا أعلى */
export const SUPPORT_PRESETS = [
  "زيارة تبادلية لزميل متميز في هذا البند",
  "حضور برنامج تدريبي في منصة التطوير المهني",
  "لقاء في مجتمع التعلم المهني بالقسم",
  "درس تطبيقي يقدّمه الزائر أو رئيس القسم",
  "مصادر ونماذج مكتوبة",
];

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** حالة موعد المتابعة لخطة جارية: late بعد مهلة المتأخر، وdue يوم الموعد وما بعده */
export function dueState(g, today = todayISO()) {
  if (g?.status !== "active" || !g.follow_up_date) return null;
  if (g.follow_up_date < addDays(today, -LATE_AFTER)) return "late";
  if (g.follow_up_date <= today) return "due";
  return null;
}

/* تخمين البند من نص «جوانب تحتاج دعمًا» — الأخص أولًا، ويصحّحه الزائر */
const KEYWORDS = [
  ["e09", /الإدارة الصفية|إدارة الصف|ضبط|الانضباط الصفي|إدارة الوقت|السلوك/],
  ["e10", /تحليل|تشخيص/],
  ["e11", /تقويم|التقييم|أسئلة|الأسئلة|الاختبار|التغذية الراجعة/],
  ["e05", /علاج|إثرائ|الفروق الفردية|الضعاف|المتعثر|المتفوق|نتائج|مستوى الطلاب/],
  ["e04", /استراتيج|التعلم النشط|التعاوني|طرائق|طرق التدريس|أساليب التدريس|التنويع/],
  ["e07", /تقني|وسائل|الوسيلة|السبورة|العرض|منصة|مدرستي|الحاسب/],
  ["e03", /ولي الأمر|أولياء|الأسرة/],
  ["e06", /خطة|التخطيط|التحضير|الأهداف|توزيع المنهج|الزمن/],
  ["e08", /بيئة|التهيئة|التحفيز|المناخ/],
  ["e02", /مجتمع|الزملاء|تبادل|التطوير المهني|برنامج تدريبي|دورة/],
  ["e01", /الدوام|الواجبات|الأنظمة|الحضور المبكر/],
];
export const guessElement = (t) => KEYWORDS.find(([, re]) => re.test(t))?.[0] ?? "";

const lines = (t) => String(t ?? "").split("\n").map((x) => x.replace(/^[\s•\-*–]+/, "").trim()).filter(Boolean);
const defaultText = (k) => `تطوير «${EL_TITLE[k] ?? ""}»`;

/** المقترحات: كل بند قُدِّر 3 فأقل (ونصه مجالات التطوير إن كُتبت)، وكل سطر في النص الحر
 *  يُضم لبنده إن كان مقترحًا، وإلا صار توصية ببند مخمَّن */
export function suggest(scores, text, notes = {}) {
  const out = [];
  for (const [k] of ELEMENTS) {
    const s = Number(scores?.[k]);
    if (s >= 1 && s <= SUGGEST_AT) out.push({ id: `s:${k}`, key: k, text: notes[k]?.trim() || defaultText(k) });
  }
  for (const l of lines(text)) {
    const k = guessElement(l);
    const hit = k && out.find((x) => x.key === k && x.id.startsWith("s:"));
    if (hit) hit.text = hit.text === defaultText(k) ? l : hit.text.includes(l) ? hit.text : `${hit.text}؛ ${l}`;
    else out.push({ id: `t:${l}`, key: k, text: l });
  }
  return out;
}

/** دمج المقترحات مع ما عدّله الزائر (ek: غيّر البند، et: غيّر النص، manual: أضافها بنفسه) */
export function merge(suggested, saved, scores) {
  const by = Object.fromEntries((saved ?? []).map((x) => [x.id, x]));
  const withScore = (x) => {
    const s = Number(scores?.[x.key]);
    return { ...x, score: s >= 1 && s <= 5 ? s : null };
  };
  return [
    ...suggested.map((s) => {
      const x = by[s.id];
      return withScore({ id: s.id, key: x?.ek ? x.key : s.key, text: x?.et ? x.text : s.text,
                         on: !!x?.on, ek: !!x?.ek, et: !!x?.et });
    }),
    ...(saved ?? []).filter((x) => x.manual).map(withScore),
  ];
}

/** درجات البنود من جدول rb_perf في زيارة الدعم: العنصر i هو e(i+1) */
export function visitScores(rb) {
  const scores = {}, notes = {};
  ELEMENTS.forEach(([k], i) => {
    const e = rb?.[i];
    if (Number(e?.score) >= 1) scores[k] = Number(e.score);
    if (e?.note) notes[k] = e.note;
  });
  return { scores, notes };
}

export const confirmedCount = (list) => (list ?? []).filter((x) => x.on && x.key && x.text?.trim()).length;

export async function loadGoals(build) {
  let q = supabase.from("improvement_goals")
    .select("*, teacher:users!improvement_goals_teacher_user_id_fkey(full_name), owner:users!improvement_goals_owner_user_id_fkey(full_name)")
    .order("created_at", { ascending: false }).limit(1000);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** إجراء على التوصية (improve_act) ثم إشعار الطرف الآخر */
export async function act(g, action, { note = null, support = null, date = null } = {}) {
  const { error } = await supabase.rpc("improve_act", { p_id: g.id, p_action: action, p_note: note, p_support: support, p_date: date });
  if (error) throw error;
  const el = EL_TITLE[g.element_key] ?? "";
  const toOwner = (t, b) => plcNotify([g.owner_user_id], t, b, `/improve?tab=follow&g=${g.id}`);
  const toTeacher = (t, b) => plcNotify([g.teacher_user_id], t, b, `/improve?g=${g.id}`);
  if (action === "plan") await toOwner("خطة تطوير تنتظر اعتمادك", `أرسل ${g.teacher?.full_name ?? "المعلم"} خطته في «${el}».`);
  if (action === "approve") await toTeacher("اعتُمدت خطة التطوير", `اعتُمدت خطتك في «${el}»، وموعد المتابعة ${date ?? g.follow_up_date}.`);
  if (action === "return") await toTeacher("أُعيدت خطة التطوير", `أُعيدت خطتك في «${el}» بملاحظة: ${note}`);
  if (action === "reschedule") await toTeacher("تغيّر موعد متابعة خطتك", `موعد متابعة «${el}» صار ${date}.`);
  if (action === "cancel") await toTeacher("أُلغيت توصية تطوير", `أُلغيت التوصية في «${el}»: ${note}`);
}


