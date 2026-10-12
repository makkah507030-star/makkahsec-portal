// src/pages/studio/raster.js
import { isMobileDevice } from "../../lib/print";

/* =====================================================================
   طباعة الأوراق المصمّمة من الجوال — مشتركة بين استوديو البوابة والتقرير
   الشهري للتوجيه الطلابي: تُلتقط كل ورقة صورةً ويُبنى منها ملف PDF (pdf.js).
   ===================================================================== */

/* مقاس صورة الطباعة على الجوال بالمليمتر (لمن يطبع من قائمة المتصفح): Safari يفرض هوامش (~14 مم) لرابط الصفحة
   وتاريخها ولا يلتزم بتصغير zoom للصور، فتُحسب الصورة لتتسع داخل الورقة ناقص 32 مم
   في كل اتجاه مع حفظ نسبتها — فلا تفيض إلى ورقة ثانية */
export function iosFit(size, realSize) {
  const toMm = realSize ? 1 : 25.4 / 96; // القالب بالمقاس الحقيقي مرسوم 1 بكسل = 1 مم
  const w = size.w * toMm, h = size.h * toMm;
  const [pw, ph] = realSize ? [w, h] : size.w > size.h ? [297, 210] : [210, 297];
  const k = Math.min(1, (pw - 32) / w, (ph - 32) / h);
  return { width: `${(w * k).toFixed(1)}mm`, height: `${(h * k).toFixed(1)}mm` };
}

/* جهاز لمسي (جوال أو لوحي) — يشمل Chrome على iPhone ولو طُلب «موقع سطح المكتب»
   فصار يعرّف نفسه كجهاز Mac */
export function isTouchDevice() {
  if (isMobileDevice()) return true;
  const ua = navigator.userAgent || "";
  if (/CriOS|FxiOS|EdgiOS/.test(ua)) return true;
  return !!window.matchMedia?.("(pointer: coarse)").matches && navigator.maxTouchPoints > 0;
}

/* صور أوراق الطباعة من النسخة الحيّة الموضوعة خارج الشاشة */
export async function rasterSheets(root, size) {
  if (!root) return null;
  const { toJpeg } = await import("html-to-image");
  await document.fonts?.ready;
  // دقة تقارب 300 نقطة/بوصة للـ A4، ضمن حد مساحة الرسم في Safari (~16 مليون بكسل)
  const ratio = Math.min(3, Math.sqrt(15e6 / (size.w * size.h)));
  const out = [];
  for (const node of root.querySelectorAll(".sheet")) {
    const opts = { pixelRatio: ratio, cacheBust: true, width: size.w, height: size.h, quality: 0.93, backgroundColor: "#fff" };
    await toJpeg(node, opts); // Safari يرسم الصور المضمّنة في المرة الثانية فقط
    out.push(await toJpeg(node, opts));
  }
  return out;
}
