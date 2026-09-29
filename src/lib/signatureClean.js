// تنظيف صورة توقيع قبل رفعها — يحوّل صورة ورقة موقّعة (ولو التُقطت بالجوال
// في إضاءة غير متساوية) إلى توقيع أسود صافٍ عريض على خلفية شفافة:
//   ١) يقدّر لون الورقة في كل منطقة من الصورة فيزيل الظلال وتفاوت الإضاءة.
//   ٢) يفصل الحبر عن الورقة بعتبة تُحسب تلقائيًا (Otsu) مع حواف ناعمة.
//   ٣) يحذف النقاط الصغيرة المتناثرة (غبار، حبيبات الورق).
//   ٤) يسمّك الخط بحسب الدرجة المختارة.
//   ٥) يقصّ الفراغ حول التوقيع ويصدّر PNG شفافًا.
// كل المعالجة داخل المتصفح؛ الصورة الأصلية لا تغادر جهاز المستخدم.

const MAX_SIDE = 1400;   // أطول ضلع للصورة المعالَجة
const MIN_SIDE = 700;    // تُكبَّر الصور الصغيرة حتى تبقى الحواف ناعمة
const PAD = 16;          // هامش شفاف حول التوقيع بعد القصّ

/** درجات السماكة المتاحة في الواجهة */
export const SIGNATURE_WEIGHTS = [
  { key: 0, label: "عادي" },
  { key: 1, label: "عريض" },
  { key: 2, label: "عريض جدًا" },
];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذّرت قراءة الصورة.")); };
    img.src = url;
  });
}

/** عتبة Otsu لمصفوفة قيم بين ٠ و١ */
function otsu(values) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < values.length; i++) hist[Math.min(255, (values[i] * 255) | 0)]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  return t / 255;
}

/** تقدير لون الورقة: أفتح قيمة في كل مربع، ثم استيفاء خطي بين المربعات */
function paperLevel(lum, w, h) {
  const B = Math.max(24, Math.round(Math.max(w, h) / 24));
  const gw = Math.ceil(w / B), gh = Math.ceil(h / B);
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      // النسبة المئوية ٩٥ بدل الأقصى حتى لا تؤثر نقطة لامعة منفردة
      const vals = [];
      for (let y = gy * B; y < Math.min(h, (gy + 1) * B); y += 2)
        for (let x = gx * B; x < Math.min(w, (gx + 1) * B); x += 2) vals.push(lum[y * w + x]);
      vals.sort((a, b) => a - b);
      grid[gy * gw + gx] = vals[Math.floor(vals.length * 0.95)] ?? 1;
    }
  }
  const bg = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, y / B - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, x / B - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const a = grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x1] * tx;
      const b = grid[y1 * gw + x0] * (1 - tx) + grid[y1 * gw + x1] * tx;
      bg[y * w + x] = Math.max(0.05, a * (1 - ty) + b * ty);
    }
  }
  return bg;
}

/** حذف المكوّنات المتصلة الأصغر من minArea بكسل */
function dropSpecks(alpha, w, h, minArea) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const comp = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || alpha[i] < 0.5) continue;
    comp.length = 0; stack.push(i); seen[i] = 1;
    while (stack.length) {
      const p = stack.pop(); comp.push(p);
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!seen[q] && alpha[q] >= 0.5) { seen[q] = 1; stack.push(q); }
      }
    }
    if (comp.length < minArea) {
      // يُمحى المكوّن مع حوافه الناعمة المجاورة
      for (const p of comp) {
        const x = p % w, y = (p - x) / w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) alpha[ny * w + nx] = 0;
        }
      }
    }
  }
  // بقايا الحواف الناعمة التي لا تلامس أي خط
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (alpha[i] <= 0 || alpha[i] >= 0.5) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && alpha[ny * w + nx] >= 0.5) { near = true; break; }
    }
    if (!near) alpha[i] = 0;
  }
}

/** تسميك: أقصى قيمة داخل قرص نصف قطره r (مع جزء كسري للنعومة) */
function dilate(alpha, w, h, r) {
  if (r <= 0) return alpha;
  const R = Math.ceil(r);
  const offs = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= r + 0.5) offs.push([dx, dy, Math.min(1, r + 0.5 - d)]);
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (const [dx, dy, k] of offs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const v = alpha[ny * w + nx] * k;
      if (v > m) { m = v; if (m >= 1) break; }
    }
    out[y * w + x] = m;
  }
  return out;
}

/**
 * يعالج صورة توقيع ويعيد { file, url } — ملف PNG شفاف ورابط معاينة محلي.
 * weight: ٠ عادي، ١ عريض، ٢ عريض جدًا.
 */
export async function cleanSignature(file, weight = 1) {
  if (!file || !(file.type || "").startsWith("image/")) throw new Error("الملف ليس صورة.");
  const img = await loadImage(file);

  const long = Math.max(img.width, img.height);
  const k = long > MAX_SIDE ? MAX_SIDE / long : long < MIN_SIDE ? Math.min(2, MIN_SIDE / long) : 1;
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // الأجزاء الشفافة في الأصل تُعامل كورق أبيض
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  // الإضاءة: أغمق قناة تُبرز الحبر الأزرق والأحمر أيضًا
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    lum[i] = (0.5 * (0.299 * r + 0.587 * g + 0.114 * b) + 0.5 * Math.min(r, g, b)) / 255;
  }

  // درجة الحبر بعد إزالة تفاوت الإضاءة: ٠ ورق، ١ أسود
  const bg = paperLevel(lum, w, h);
  const ink = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = Math.max(0, Math.min(1, 1 - lum[i] / bg[i]));

  // العتبة: Otsu مع حد أدنى حتى لا تُعدّ حبيبات الورق حبرًا
  const t = Math.max(0.16, otsu(ink));
  const lo = t * 0.6, hi = Math.min(0.95, t * 1.25);
  let alpha = new Float32Array(w * h);
  let inkCount = 0;
  for (let i = 0; i < w * h; i++) {
    const v = ink[i];
    if (v <= lo) continue;
    if (v >= hi) { alpha[i] = 1; inkCount++; continue; }
    const s = (v - lo) / (hi - lo);
    alpha[i] = s * s * (3 - 2 * s);
  }
  if (inkCount < 30) throw new Error("لم يُعثر على توقيع واضح في الصورة. جرّب صورة أوضح بقلم أغمق.");
  if (inkCount > w * h * 0.45) throw new Error("الخلفية غير واضحة. صوّر التوقيع على ورقة بيضاء في إضاءة جيدة.");

  dropSpecks(alpha, w, h, Math.max(12, Math.round((w * h) / 20000)));

  // سماكة الخط: تتناسب مع حجم الصورة حتى تبدو واحدة مهما كان المقاس
  const unit = Math.max(w, h) / 900;
  alpha = dilate(alpha, w, h, [0.4, 1.3, 2.0][weight] * unit);

  // حدود التوقيع
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alpha[y * w + x] > 0.08) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("لم يُعثر على توقيع واضح في الصورة.");
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
  x1 = Math.min(w - 1, x1 + PAD); y1 = Math.min(h - 1, y1 + PAD);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  const octx = out.getContext("2d");
  const od = octx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const a = alpha[(y + y0) * w + (x + x0)];
    const o = (y * cw + x) * 4;
    // أسود صافٍ؛ الشفافية وحدها تحمل النعومة
    od.data[o] = od.data[o + 1] = od.data[o + 2] = 0;
    od.data[o + 3] = Math.round(Math.min(1, a * 1.15) * 255);
  }
  octx.putImageData(od, 0, 0);

  const blob = await new Promise((r) => out.toBlob(r, "image/png"));
  if (!blob) throw new Error("تعذّر حفظ الصورة المعالجة.");
  const cleaned = new File([blob], "signature.png", { type: "image/png" });
  return { file: cleaned, url: URL.createObjectURL(blob) };
}
