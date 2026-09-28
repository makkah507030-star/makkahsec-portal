// إعادة ضبط أبعاد صورة مرفوعة إلى إطار موحّد قبل رفعها للتخزين — حتى تظهر
// كل صور المقال بمقاس متناسق وممتاز في الشريط وفي الطباعة، مهما كان مقاس
// الصورة الأصلية (صغيرة أو كبيرة). يُقصّ الفائض توسيطًا (cover) لملء الإطار
// كما يفعل عرض الشريط تمامًا، ثم يُصدَّر JPEG مضغوطًا لتقليل الحجم.
//
// عند أي تعذّر (نوع غير صورة، فشل التحميل) تُعاد الصورة الأصلية كما هي.
export function normalizeImage(file, targetW = 1280, targetH = 720, quality = 0.85) {
  return new Promise((resolve) => {
    if (!file || !(file.type || "").startsWith("image/")) { resolve(file); return; }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");

        // خلفية بيضاء (تفاديًا لشفافية PNG عند التحويل إلى JPEG)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);

        // ملء الإطار مع الحفاظ على النسبة وقصّ الفائض توسيطًا
        const scale = Math.max(targetW / img.width, targetH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);

        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], "image.jpg", { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * تصغير صورة مع الحفاظ على نسبتها كاملة (بلا قصّ) — لصور الأسئلة والرسوم.
 * لا تُكبَّر الصورة الصغيرة. PNG يبقى PNG (للرسوم الحادة)، وغيره JPEG.
 */
export function shrinkImage(file, maxSide = 1600, quality = 0.88) {
  return new Promise((resolve) => {
    if (!file || !(file.type || "").startsWith("image/")) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        const png = file.type === "image/png";
        if (!png) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const type = png ? "image/png" : "image/jpeg";
        canvas.toBlob((blob) => resolve(blob ? new File([blob], png ? "image.png" : "image.jpg", { type }) : file),
                      type, quality);
      } catch { URL.revokeObjectURL(url); resolve(file); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
