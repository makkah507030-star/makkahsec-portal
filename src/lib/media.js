// src/lib/media.js
/* =====================================================================
   استوديو الوسائط ومعرض المدرسة (supabase/media_1.sql): الصور والمقاطع في مخزن خاص،
   تُعرض داخل الحسابات فقط برابط موقّع قصير العمر، فالرابط المنسوخ يتعطل بعد دقائق
   ولا يفتح لغير المسجّل. ويُرسم اسم المشاهد علامةً مائية فوق المادة أثناء العرض.
   ===================================================================== */
import { supabase } from "./supabase";
import { shrinkImage } from "./imageResize.js";

export const MEDIA_BUCKET = "media-library";
export const MAX_VIDEO_MB = 50;
export const PHOTO_TTL = 300;        // ثوانٍ: رابط الصورة
export const VIDEO_TTL = 1800;       // ثوانٍ: رابط المقطع (يكفي لمشاهدته كاملًا)

/** روابط موقّتة لعدة ملفات بطلب واحد: مسار ← رابط */
export async function signedUrls(paths, ttl = PHOTO_TTL) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return new Map();
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(list, ttl);
  return new Map(list.map((p, i) => [p, data?.[i]?.signedUrl ?? null]));
}

/** صورة من أول ثانية في المقطع، لمصغّرته */
export function videoThumb(file) {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
    const done = (blob) => { URL.revokeObjectURL(url); ok(blob); };
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => {
      const w = 640, h = Math.round((v.videoHeight / (v.videoWidth || 1)) * w) || 360;
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(v, 0, 0, w, h);
      c.toBlob((b) => done(b), "image/jpeg", 0.8);
    };
    v.onerror = () => done(null);
  });
}

/** يرفع ملفًا (صورة تُصغَّر، أو مقطعًا كما هو) ومصغّرته، ويعيد { kind, path, thumb, size } */
export async function uploadMedia(file) {
  const id = crypto.randomUUID();
  const video = file.type.startsWith("video/");
  const put = async (path, body, type) => {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, body, { contentType: type });
    if (error) throw error;
  };
  if (video) {
    if (file.size > MAX_VIDEO_MB * 1048576) throw new Error(`المقطع أكبر من ${MAX_VIDEO_MB} ميجا؛ صوّره بدقة 720p أو قصّره.`);
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const path = `videos/${id}.${ext}`;
    await put(path, file, file.type);
    const t = await videoThumb(file);
    const thumb = t ? `thumbs/${id}.jpg` : null;
    if (t) await put(thumb, t, "image/jpeg");
    return { kind: "video", path, thumb, size: file.size };
  }
  const big = await shrinkImage(file, 2000, 0.85, { jpeg: true });
  const small = await shrinkImage(file, 520, 0.78, { jpeg: true });
  const path = `photos/${id}.jpg`, thumb = `thumbs/${id}.jpg`;
  await put(path, big, "image/jpeg");
  await put(thumb, small, "image/jpeg");
  return { kind: "photo", path, thumb, size: big.size };
}
