// src/lib/outreach.js
import { supabase } from "./supabase";
import { shrinkImage } from "./imageResize.js";

/* =====================================================================
   النشرات والاستبانات (supabase/outreach_1..2.sql): نشرة توعوية بنصها وصورها ومقاطعها وروابطها،
   أو استبانة بأسئلة متنوعة، يرسلها الموجه الطلابي ومن له الصلاحية للطلاب أو أولياء الأمور أو
   الموظفين، ويتابع الاطلاع والإجابة. الرابط /o/:id يُفتح من الإشعار أو من رسالة واتساب أو رمز QR.
   ===================================================================== */

export const BUCKET = "outreach";
export const MAX_MB = 50;

export const KIND = {
  post: { t: "نشرة توعوية", c: "#2F7F7A", icon: "M4 5h16v11H8l-4 4ZM8 9h8M8 12h5" },
  survey: { t: "استبانة", c: "#5A5199", icon: "M9 4h6v3H9zM6 6h12v15H6zM9 11h6M9 15h4" },
};

export const QTYPES = {
  single: { t: "اختيار واحد", opts: true },
  multi: { t: "اختيار متعدد", opts: true },
  scale: { t: "مقياس من 1 إلى 5", scale: ["غير موافق بشدة", "غير موافق", "محايد", "موافق", "موافق بشدة"] },
  yesno: { t: "نعم / لا", fixed: ["نعم", "لا"] },
  text: { t: "إجابة قصيرة" },
  long: { t: "إجابة مطوّلة" },
};

export const TOPICS = ["توعية", "تعليمات", "الصحة النفسية", "السلوك والانضباط", "التوجيه المهني", "الصحة", "السلامة", "الأمن الرقمي", "التحصيل الدراسي", "رأي وتقييم"];

const q = (type, text, options, required = true) => ({ id: Math.random().toString(36).slice(2, 8), type, q: text, options: options ?? [], required });

/* قوالب جاهزة تبدأ منها، وتُعدَّل بالكامل */
export const TEMPLATES = [
  { kind: "survey", topic: "رأي وتقييم", title: "الرضا عن خدمات التوجيه الطلابي", anonymous: true,
    body: "رأيك يساعدنا على تحسين خدمات التوجيه في المدرسة. الإجابة دون اسم.",
    questions: () => [q("scale", "أعرف من هو الموجه الطلابي لصفي وكيف أصل إليه"), q("scale", "أجد المساعدة حين أحتاجها"),
      q("scale", "أشعر بالارتياح عند الحديث مع الموجه الطلابي"), q("multi", "ما البرامج التي تفيدك أكثر؟", ["مهارات المذاكرة", "إدارة الوقت", "التعامل مع القلق", "اختيار التخصص والمسار", "العلاقات مع الزملاء"]),
      q("long", "اقتراحاتك لتطوير خدمات التوجيه", null, false)] },
  { kind: "survey", topic: "السلوك والانضباط", title: "استبانة البيئة المدرسية الآمنة", anonymous: true,
    body: "استبانة سرية دون اسم، هدفها مدرسة آمنة للجميع.",
    questions: () => [q("scale", "أشعر بالأمان داخل المدرسة"), q("yesno", "هل تعرضت لتنمر أو إساءة هذا الفصل الدراسي؟"),
      q("multi", "إن حدث ذلك، فأين؟", ["الفصل", "الساحة", "دورات المياه", "الطريق إلى المدرسة", "وسائل التواصل"], false),
      q("single", "لمن تلجأ إذا تعرضت لموقف مزعج؟", ["الموجه الطلابي", "المعلم", "الوكيل", "ولي الأمر", "لا ألجأ لأحد"]),
      q("long", "هل تود إضافة شيء؟", null, false)] },
  { kind: "survey", topic: "التوجيه المهني", title: "الميول المهنية والمسار بعد الثانوية", anonymous: false,
    body: "تساعدنا إجابتك على ترتيب لقاءات التوجيه المهني المناسبة لك.",
    questions: () => [q("single", "ما المسار الذي تميل إليه بعد الثانوية؟", ["الجامعة", "الكليات التقنية", "الكليات العسكرية", "سوق العمل", "لم أحدد بعد"]),
      q("multi", "المجالات التي تهمك", ["الطب والعلوم الصحية", "الهندسة", "الحاسب والتقنية", "إدارة الأعمال", "التعليم", "العلوم الشرعية", "الأمن والعسكرية"]),
      q("scale", "أعرف متطلبات القبول في التخصص الذي أريده"), q("text", "ما التخصص الذي تفكر فيه؟", null, false)] },
  { kind: "survey", topic: "التحصيل الدراسي", title: "عادات المذاكرة والاستعداد للاختبارات", anonymous: true,
    body: "", questions: () => [q("single", "كم ساعة تذاكر يوميًا تقريبًا؟", ["أقل من ساعة", "ساعة إلى ساعتين", "أكثر من ساعتين"]),
      q("scale", "أنظم وقتي بين المذاكرة والراحة"), q("scale", "أشعر بالقلق قبل الاختبارات"),
      q("multi", "ما الذي يساعدك على المذاكرة؟", ["الملخصات", "حل الاختبارات السابقة", "المذاكرة مع زميل", "المقاطع التعليمية", "منصة مدرستي"])] },
  { kind: "post", topic: "الأمن الرقمي", title: "الاستخدام الآمن للأجهزة ووسائل التواصل",
    body: "لا تشارك كلمات المرور أو بياناتك الشخصية مع أحد، ولا تفتح روابط مجهولة المصدر، وأبلغ الموجه الطلابي عن أي ابتزاز أو إساءة إلكترونية.\nتذكّر أن ما يُنشر على الإنترنت يبقى." },
  { kind: "post", topic: "الصحة النفسية", title: "الاستعداد النفسي للاختبارات",
    body: "النوم الكافي، والمذاكرة الموزعة، والتغذية المتوازنة، والتفكير الإيجابي؛ مفاتيح هدوئك في أيام الاختبارات.\nإن شعرت بقلق زائد فمكتب التوجيه الطلابي مفتوح لك." },
  { kind: "post", topic: "تعليمات", title: "تعليمات مهمة للطلاب", body: "" },
];

export const blankItem = (kind) => ({ kind, title: "", body: "", topic: kind === "survey" ? "رأي وتقييم" : "توعية", media: [], links: [],
  questions: kind === "survey" ? [q("single", "", ["", ""])] : [], needs_ack: false, anonymous: kind === "survey", closes_at: null });
export const fromTemplate = (t) => ({ ...blankItem(t.kind), title: t.title, body: t.body, topic: t.topic, anonymous: !!t.anonymous,
  questions: t.questions ? t.questions() : [] });
/** نسخة جديدة من نشرة أو استبانة سابقة: محتواها وأسئلتها، ووسائطها منسوخة إلى مجلد المرسل
    (فلا يمسّها حذف الأصل)، بلا إرسال ولا موعد إغلاق */
export async function copyItem(uid, i) {
  const media = [];
  for (const m of i.media ?? []) {
    const to = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${m.path.split(".").pop()}`;
    const { error } = await supabase.storage.from(BUCKET).copy(m.path, to);
    if (!error) media.push({ ...m, path: to });
  }
  return { ...blankItem(i.kind), title: i.title, body: i.body ?? "", topic: i.topic ?? "", media, links: [...(i.links ?? [])],
    questions: (i.questions ?? []).map((q) => ({ ...q, options: [...(q.options ?? [])] })), needs_ack: !!i.needs_ack, anonymous: !!i.anonymous };
}
export const newQuestion = (type = "single") => q(type, "", QTYPES[type].opts ? ["", ""] : []);

/** رابط النشرة الثابت: يُفتح بعد الدخول (من واتساب أو رمز QR أو الإشعار) */
export const itemLink = (id) => `${window.location.origin}/o/${id}`;

/** معرّف مقطع يوتيوب من الرابط، لعرضه داخل الصفحة */
export function youtubeId(url) {
  const m = String(url ?? "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  return m ? m[1] : null;
}

/** يرفع صورة (تُصغَّر) أو مقطعًا أو PDF إلى مجلد المرسل */
export async function uploadMedia(uid, file) {
  const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
  const f = type === "image" && file.type !== "image/gif" ? await shrinkImage(file, 1800, 0.85) : file;
  if (f.size > MAX_MB * 1024 * 1024) throw new Error(`«${file.name}» أكبر من ${MAX_MB} م.ب.`);
  const ext = (file.name.match(/\.(\w+)$/)?.[1] ?? (type === "image" ? "jpg" : "bin")).toLowerCase();
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${type === "image" && f !== file ? "jpg" : ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || file.type, upsert: false });
  if (error) throw new Error(`تعذّر رفع «${file.name}»: ${error.message}`);
  return { type, path, name: file.name };
}

/** روابط مؤقتة لكل وسائط النشرة دفعة واحدة: { path: url } */
export async function mediaUrls(media) {
  const paths = (media ?? []).map((m) => m.path).filter(Boolean);
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  return Object.fromEntries((data ?? []).map((x, i) => [paths[i], x.signedUrl]));
}

export function setupMsg(e) {
  return /outreach/.test(e?.message ?? "") ? "النشرات والاستبانات تحتاج تشغيل الملفين outreach_1.sql وoutreach_2.sql في Supabase." : e?.message;
}

/** حالة النشرة للمرسل */
export function statusOf(i) {
  if (!i.sent_at) return { t: "مسودة", c: "bg-canvas text-muted" };
  if (i.closed_at || (i.closes_at && new Date(i.closes_at) <= new Date())) return { t: "مغلقة", c: "bg-line/60 text-ink" };
  return { t: "مرسلة", c: "bg-present/10 text-present" };
}

/** هل ينتظر المستلم إجراءً: استبانة لم يُجب عنها وهي مفتوحة، أو نشرة لم تُفتح أو لم يُقرّ بها */
export function pendingFor(r, i) {
  if (!i) return false;
  if (i.kind === "survey") return !r.answered_at && !i.closed_at && !(i.closes_at && new Date(i.closes_at) <= new Date());
  return i.needs_ack ? !r.ack_at : !r.read_at;
}
