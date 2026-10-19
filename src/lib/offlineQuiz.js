// src/lib/offlineQuiz.js
// الاختبار دون إنترنت (supabase/quiz_offline_*.sql): التشفير، وحفظ الحزمة على جهاز الطالب،
// ورمز التسليم. يُستعمل في البوابة وفي صفحة الاختبار دون إنترنت (حزمة ملف المعمل)، فلا
// يستورد supabase.
//
// • الحزمة: أسئلة الاختبار (بلا الإجابات الصحيحة) وصورها، مشفّرة AES-GCM بمفتاح من
//   16 حرفًا يجهّزه متصفح المعلم ولا يصل الطالب إلا من السبورة في الحصة.
// • رمز التسليم: MKQ1.الإسناد.الإصدار.الإجابات.مرات المغادرة.الدقائق.التوقيع، يفكّه
//   quiz_offline_scan. التوقيع HMAC-SHA256 برمز خاص بالطالب يصله مع الحزمة.
import { hmacSha256 } from "./labSign.js";

// بلا الحروف والأرقام المتشابهة (I L O 0 1)
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

export const normKey = (s) => String(s ?? "").toUpperCase().replace(/^MKQK-?/, "").replace(/[^A-Z0-9]/g, "");
export const fmtKey = (k) => normKey(k).replace(/(.{4})(?=.)/g, "$1-");
/** نص رمز QR لمفتاح الفتح على السبورة */
export const keyQr = (k) => `MKQK-${normKey(k)}`;

export function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
}

const toB64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function aesKey(key) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normKey(key)));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPackage(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(key),
    new TextEncoder().encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return toB64(out);
}

/** يعيد الحزمة أو يرمي خطأ إن كان المفتاح غير صحيح */
export async function decryptPackage(b64, key) {
  const all = fromB64(b64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.subarray(0, 12) }, await aesKey(key), all.subarray(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

/** إجابة السؤال بصيغة الرمز (انظر رأس الملف)، والفارغ = بلا إجابة */
export function encodeAnswer(q, a) {
  if (a == null) return "";
  if (q.kind === "truefalse") return a === "true" ? "t" : a === "false" ? "f" : "";
  if (q.kind === "match") {
    const n = (q.options?.left ?? []).length;
    const s = Array.from({ length: n }, (_, k) => {
      const v = a?.[String(k)];
      return v == null || v === "" ? "-" : B36[Number(v)] ?? "-";
    }).join("");
    return /[^-]/.test(s) ? s : "";
  }
  return B36[Number(a)] ?? "";
}

export function submitCode({ origin = "", assignment, ver, token, qs, answers, leaves = 0, minutes = 0 }) {
  const ans = qs.map((q) => encodeAnswer(q, answers[q.id])).join("_");
  const body = ["MKQ1", assignment, ver, ans, leaves, minutes].join(".");
  return `${origin ? `${origin}/q/g/` : ""}${body}.${hmacSha256(token, body).slice(0, 16)}`;
}

// ترتيب ثابت لكل طالب وسؤال يختلف من طالب لآخر (كما في الاختبار الإلكتروني)
export function shuffled(n, seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/* ——— الحفظ على جهاز الطالب (Cache Storage: يتسع للصور ويبقى بعد إغلاق المتصفح) ——— */
export const OQ_CACHE = "mk-offline-quiz";
export const OQ_PAGE = "/offline-quiz";
const dataUrl = (id) => `/__oq/data/${id}`;

export async function savePackage(rec) {
  const c = await caches.open(OQ_CACHE);
  await c.put(dataUrl(rec.quiz_id), new Response(JSON.stringify(rec), { headers: { "content-type": "application/json" } }));
}

export async function listPackages() {
  if (!("caches" in window)) return [];
  const c = await caches.open(OQ_CACHE);
  const keys = (await c.keys()).filter((r) => new URL(r.url).pathname.startsWith("/__oq/data/"));
  const recs = await Promise.all(keys.map(async (r) => (await c.match(r))?.json().catch(() => null)));
  return recs.filter(Boolean);
}

export async function removePackage(id) {
  const c = await caches.open(OQ_CACHE);
  await c.delete(dataUrl(id));
}

/** صفحة الاختبار دون إنترنت تُحفظ بملف واحد، فيعرضها sw.js حين لا يتصل الجوال */
export async function savePage(html) {
  const c = await caches.open(OQ_CACHE);
  await c.put(OQ_PAGE, new Response(html, { headers: { "content-type": "text/html;charset=utf-8" } }));
}

/* حالة المحاولة على الجهاز: { key, started, answers, leaves, done, code } */
export const attemptKey = (rec) => `mkq:${rec.quiz_id}:${rec.ver}`;
export const loadAttempt = (rec) => { try { return JSON.parse(localStorage.getItem(attemptKey(rec)) || "null"); } catch { return null; } };
export const saveAttempt = (rec, v) => { try { localStorage.setItem(attemptKey(rec), JSON.stringify(v)); } catch { /* */ } };
