// src/lib/labExam.js
// مركز اختبارات التقنية الرقمية (supabase/lab_exam_1.sql): بنك الأسئلة من دروس المعمل، وتوليد الاختبار،
// والتصحيح، وترميز إجابات الاختبار الإلكتروني في رمز QR، وتشفير الأسئلة في ملف المعمل بمفتاح الفتح.
// صيغة الأسئلة نفسها في الورقة المطبوعة وبطاقة الإجابة (omrLayout): mcq "k"، truefalse "true"/"false"،
// match { "رقم العنصر": "k" }، فيُصحَّح الورقي والإلكتروني بالطريقة نفسها.
import { LESSONS } from "../lab-content/index.js";
import { hmacSha256 } from "./labSign.js";
import { correctness } from "./quizItems.js";

export const EXAM_GRADES = { 1: { key: "g10", t: "الأول الثانوي", subject: "التقنية الرقمية 1" }, 3: { key: "g12", t: "الثالث الثانوي", subject: "التقنية الرقمية 3" } };
export const gradeOfLesson = (l) => (l.id.startsWith("g12") ? 3 : 1);
export const KIND_T = { mcq: "اختيار من متعدد", truefalse: "صح أو خطأ", match: "مزاوجة" };
export const THEORY_TOTAL = 15;
export const PRACTICAL_TOTAL = 25;

/* مولّد عشوائي ثابت بالبذرة: الاختبار نفسه يُولَّد بالترتيب نفسه */
export function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, seed) {
  const r = rng(seed), a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* سؤال من الدروس بصيغة الاختبار */
function fromLesson(l, q, id) {
  const base = { id, grade: gradeOfLesson(l), unit: l.unit.no, lesson: l.id, lessonTitle: l.lesson.title };
  if (q.kind === "mcq") {
    // الخيارات بترتيب ثابت مخلوط لكل سؤال: في الدروس تأتي الإجابة الصحيحة أولًا غالبًا
    const order = shuffle(q.options.map((_, i) => i), `${id}:opts`);
    return { ...base, kind: "mcq", text: q.q, options: order.map((i) => q.options[i]), answer: String(order.indexOf(q.answer)) };
  }
  if (q.kind === "tf") return { ...base, kind: "truefalse", text: q.q, answer: q.answer ? "true" : "false" };
  if (q.kind === "match") {
    const order = shuffle(q.pairs.map((_, i) => i), id);                 // العمود الثاني بترتيب ثابت مختلف
    return { ...base, kind: "match", text: q.q, options: { left: q.pairs.map((p) => p[0]), right: order.map((i) => q.pairs[i][1]) },
      answer: Object.fromEntries(q.pairs.map((_, i) => [String(i), String(order.indexOf(i))])) };
  }
  return null;                                                          // الإكمال لا يصلح لبطاقة التظليل
}

/** أسئلة البنك من الدروس: أسئلة الاختبار وتحقق الفهم في كل محطة */
export function lessonBank() {
  const out = [];
  LESSONS.forEach((l) => l.stations.forEach((s) => {
    if (s.check) { const q = fromLesson(l, s.check, `${l.id}:${s.id}:c`); if (q) out.push(q); }
    if (s.type === "quiz") s.questions.forEach((x, i) => { const q = fromLesson(l, x, `${l.id}:${s.id}:${i}`); if (q) out.push(q); });
  }));
  return out;
}

/** البنك بعد تعديلات المعلمين (lab_qbank): المعدّل يحل محل الأصل، والمخفي يُعلَّم، والمضاف يُلحق */
export function mergeBank(rows = []) {
  const byId = Object.fromEntries(rows.map((r) => [r.qid, r]));
  const base = lessonBank().map((q) => {
    const r = byId[q.id];
    return r ? { ...q, ...(r.data ?? {}), id: q.id, hidden: r.hidden, edited: Object.keys(r.data ?? {}).length > 0 } : q;
  });
  const custom = rows.filter((r) => r.custom).map((r) => ({ ...r.data, id: r.qid, grade: r.grade, unit: r.unit, lesson: r.lesson, hidden: r.hidden, custom: true }));
  return [...base, ...custom];
}

/** بنود بطاقة الإجابة لسؤال (المزاوجة بعدد عناصرها) */
export const itemsOf = (q) => (q.kind === "match" ? (q.options?.left?.length ?? 0) : 1);

/**
 * توليد اختبار نظري: من الوحدات المختارة، بعدد من كل نوع، والدرجة الكلية موزعة بالتساوي على البنود.
 * يُرجع الأسئلة بترتيب الورقة (اختيار، ثم صح وخطأ، ثم مزاوجة) ولكل منها درجته.
 */
export function buildTheory(bank, { grade, units, counts, total = THEORY_TOTAL, seed }) {
  const pool = bank.filter((q) => !q.hidden && q.grade === grade && units.includes(q.unit));
  const pick = ["mcq", "truefalse", "match"].flatMap((k) => {
    // توزيع عادل على الدروس: دورة على الدروس المختارة عشوائيًا
    const list = shuffle(pool.filter((q) => q.kind === k), `${seed}:${k}`);
    const byLesson = {};
    list.forEach((q) => (byLesson[q.lesson] ??= []).push(q));
    const lanes = Object.values(byLesson), got = [];
    for (let i = 0; got.length < (counts[k] ?? 0) && lanes.some((x) => x.length); i++) { const ln = lanes[i % lanes.length]; if (ln.length) got.push(ln.shift()); }
    return got;
  });
  return withMarks(pick, total);
}

/** درجة كل سؤال: الكلية بأرباع الدرجة موزعة على البنود بالتساوي، والباقي ربعًا ربعًا على أوائل البنود */
export function withMarks(questions, total) {
  const items = questions.reduce((a, q) => a + itemsOf(q), 0) || 1;
  const units = Math.round(total * 4), base = Math.floor(units / items);
  let extra = units - base * items;
  return questions.map((q, i) => {
    let u = 0;
    for (let k = 0; k < itemsOf(q); k++) { u += base + (extra > 0 ? 1 : 0); extra--; }
    return { ...q, sort_order: i, marks: u / 4 };
  });
}

/** درجة الإجابات: مجموع (الصواب × درجة السؤال)، مقربة لأقرب نصف كما في سجل التطبيقات */
export function scoreTheory(questions, answers = {}) {
  const raw = questions.reduce((a, q) => a + (correctness(q, answers[q.id]) ?? 0) * Number(q.marks || 0), 0);
  return Math.round(raw * 2) / 2;
}

/* ---------------- الاختبار الإلكتروني: ترميز الإجابات ورمز النتيجة ---------------- */
// حرف لكل بند بترتيب أسئلة الاختبار الأصلي: اختيار "0..9"، صح وخطأ "t/f"، المزاوجة رقم لكل عنصر، و"-" بلا إجابة
export function packAnswers(questions, answers = {}) {
  return questions.map((q) => {
    const a = answers[q.id];
    if (q.kind === "mcq") return a == null ? "-" : String(a);
    if (q.kind === "truefalse") return a === "true" ? "t" : a === "false" ? "f" : "-";
    return (q.options?.left ?? []).map((_, k) => (a?.[String(k)] == null ? "-" : String(a[String(k)]))).join("");
  }).join("");
}
export function unpackAnswers(questions, s) {
  const out = {}; let p = 0;
  questions.forEach((q) => {
    if (q.kind === "match") {
      const m = {};
      (q.options?.left ?? []).forEach((_, k) => { const c = s[p++]; if (c && c !== "-") m[String(k)] = c; });
      if (Object.keys(m).length) out[q.id] = m;
    } else {
      const c = s[p++];
      if (c && c !== "-") out[q.id] = q.kind === "truefalse" ? (c === "t" ? "true" : "false") : c;
    }
  });
  return out;
}

/** رمز نتيجة الجهاز: MKE1.رمز الاختبار.رقم الفصل.رقم الطالب.الجهاز.المحتوى.التوقيع (المحتوى إجابات النظري، أو درجات مهام العملي) */
export function examResultCode({ code, secret, cls, stu, seat, body }) {
  const head = ["MKE1", code, cls, stu, seat ?? 0, body].join(".");
  return `${head}.${hmacSha256(secret, head).slice(0, 16)}`;
}
/** { code, cls, stu, seat, body } أو null إن لم يكن رمزًا صحيحًا لهذا الاختبار */
export function readResultCode(text, exam) {
  const m = String(text ?? "").trim().match(/(MKE1\.([A-Z0-9]+)\.(\d+)\.(\d+)\.(\d+)\.([^.]*))\.([0-9a-f]{16})$/);
  if (!m || m[2] !== exam.code) return null;
  if (hmacSha256(exam.secret, m[1]).slice(0, 16) !== m[7]) return null;
  return { cls: Number(m[3]), stu: Number(m[4]), seat: Number(m[5]), body: m[6] };
}

/* ---------------- تشفير محتوى الاختبار بمفتاح الفتح (بلا crypto.subtle لملف يُفتح من القرص) ---------------- */
const keystream = (key, n) => {
  const out = new Uint8Array(n);
  for (let i = 0, b = 0; i < n; b++) {
    const h = hmacSha256(key, `S|${b}`);
    for (let j = 0; j < 64 && i < n; j += 2) out[i++] = parseInt(h.slice(j, j + 2), 16);
  }
  return out;
};
const b64 = (u8) => { let s = ""; u8.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const normOpenKey = (k) => String(k ?? "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");

export function sealPayload(obj, key) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const ks = keystream(normOpenKey(key), bytes.length);
  return { data: b64(bytes.map((x, i) => x ^ ks[i])), check: hmacSha256(normOpenKey(key), "CHK").slice(0, 10) };
}
/** المحتوى، أو null إن كان المفتاح خطأ */
export function openPayload(sealed, key) {
  const k = normOpenKey(key);
  if (hmacSha256(k, "CHK").slice(0, 10) !== sealed.check) return null;
  const bytes = unb64(sealed.data), ks = keystream(k, bytes.length);
  try { return JSON.parse(new TextDecoder().decode(bytes.map((x, i) => x ^ ks[i]))); } catch { return null; }
}

const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newExamSecrets() {
  const r = crypto.getRandomValues(new Uint32Array(14));
  return {
    code: Array.from(r.slice(0, 6), (x) => ALNUM[x % ALNUM.length]).join(""),
    secret: Array.from(r.slice(6, 12), (x) => x.toString(36)).join(""),
    open_key: String(100000 + (r[12] % 900000)),
  };
}

/** الاختبار بصيغة ورقة البوابة المطبوعة (QuizPaper) */
export const paperQuiz = (exam) => ({ id: exam.id, title: exam.title, subject_name: EXAM_GRADES[exam.grade]?.subject,
  total_marks: exam.total, duration_min: exam.duration, lang: "ar", instructions: "" });
