// src/lib/omrReader.js
/* =====================================================================
   قارئ بطاقة الإجابة من صورة الجوال — يعمل كاملًا داخل المتصفح،
   ولا تُرفع الصورة لأي خادم.

   المراحل:
   ① تحويل للرمادي + عتبة تكيّفية (تتحمّل الإضاءة غير المتساوية والظلال)
   ② تجميع البكسلات الداكنة في كتل، واختيار أربع كتل مربعة كبيرة
      تكوّن مستطيلًا بنسبة أبعاد البطاقة المتوقعة = العلامات المرجعية
   ③ تحديد الاتجاه (حتى لو صُوّرت البطاقة مقلوبة أو مائلة)
   ④ تحويل منظوري دقيق (Homography) من مليمترات البطاقة إلى بكسلات الصورة
   ⑤ قياس تظليل كل دائرة في موضعها المعروف من cardLayout، والحكم لكل صف
   ===================================================================== */

/* ----------------------------- أدوات رياضية ----------------------------- */

// حل نظام خطي 8×8 بالحذف الغاوسي مع المحور الجزئي
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// تحويل منظوري يطابق أربع نقاط مصدر على أربع نقاط هدف
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
  }
  const h = solve(A, b);
  if (!h) return null;
  return (x, y) => {
    const d = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ----------------------------- ① الصورة ----------------------------- */

export function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذّر فتح الصورة")); };
    img.src = url;
  });
}

function toGray(img, maxSide) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.min(1, maxSide / Math.max(iw, ih));
  const w = Math.round(iw * s), h = Math.round(ih * s);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  }
  return { g, w, h };
}

// عتبة تكيّفية: البكسل داكن إن كان أغمق بوضوح من متوسط ما حوله
function adaptiveMask(g, w, h) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.min(w, h) / 14));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = g[y * w + x];
      if (v < mean * 0.75 && v < 170) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/* ----------------------------- ② العلامات ----------------------------- */

function components(mask, w, h, g) {
  const label = new Int32Array(w * h);
  const out = [];
  const stack = new Int32Array(w * h);
  let id = 0;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || label[p]) continue;
    id++;
    let sp = 0, area = 0, sx = 0, sy = 0, sg = 0;
    let minx = w, maxx = 0, miny = h, maxy = 0;
    stack[sp++] = p; label[p] = id;
    while (sp) {
      const q = stack[--sp];
      const x = q % w, y = (q - x) / w;
      area++; sx += x; sy += y; sg += g[q];
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && mask[q - 1] && !label[q - 1]) { label[q - 1] = id; stack[sp++] = q - 1; }
      if (x < w - 1 && mask[q + 1] && !label[q + 1]) { label[q + 1] = id; stack[sp++] = q + 1; }
      if (y > 0 && mask[q - w] && !label[q - w]) { label[q - w] = id; stack[sp++] = q - w; }
      if (y < h - 1 && mask[q + w] && !label[q + w]) { label[q + w] = id; stack[sp++] = q + w; }
    }
    out.push({ area, x: sx / area, y: sy / area, bw: maxx - minx + 1, bh: maxy - miny + 1, mean: sg / area });
  }
  return out;
}

// ترتيب أربع نقاط باتجاه عقارب الساعة بدءًا من الأعلى-يسار (في الصورة)
function orderQuad(pts) {
  const c = { x: pts.reduce((a, p) => a + p.x, 0) / 4, y: pts.reduce((a, p) => a + p.y, 0) / 4 };
  const s = [...pts].sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
  // atan2 مرتّب من -π: نبدأ بالأقرب لأعلى-يسار
  let start = 0, best = Infinity;
  s.forEach((p, i) => { const v = p.x + p.y; if (v < best) { best = v; start = i; } });
  return [0, 1, 2, 3].map((k) => s[(start + k) % 4]); // tl, tr, br, bl
}

function insideQuad(q, p) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const z = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (!sign) sign = Math.sign(z); else if (Math.sign(z) !== sign) return false;
  }
  return true;
}

function convex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-6) return false;
    if (!sign) sign = Math.sign(z); else if (Math.sign(z) !== sign) return false;
  }
  return true;
}

// markRel = ضلع العلامة ÷ المسافة بين مركزي العلامتين العلويتين (بالمليمتر)
function findMarks(comps, w, h, expectRatio, markRel) {
  const minSide = Math.min(w, h) * 0.012;
  const cands = comps
    .filter((c) => c.bw >= minSide && c.bh >= minSide)
    .filter((c) => { const a = c.bw / c.bh; return a > 0.4 && a < 2.5; })
    .filter((c) => c.area / (c.bw * c.bh) >= 0.5)      // كتلة مصمتة لا إطار
    .filter((c) => c.area < w * h * 0.04)
    .sort((a, b) => b.area - a.area)
    .slice(0, 16);
  if (cands.length < 4) return null;

  let best = null;
  const n = cands.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++)
  for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const set = [cands[a], cands[b], cands[c], cands[d]];
    const q = orderQuad(set);
    if (!convex(q)) continue;
    const top = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
    const side = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
    if (side < 1 || top < 1) continue;
    const r = top / side;
    // البطاقة عريضة، وقد تكون مصوّرة بالعرض أو بالطول (مدوّرة ٩٠°)
    const err = Math.min(Math.abs(Math.log(r / expectRatio)), Math.abs(Math.log(r * expectRatio)));
    if (err > 0.45) continue;
    const areas = set.map((s) => s.area);
    const spread = Math.log(Math.max(...areas) / Math.min(...areas));
    if (spread > 1.0) continue;
    // الحجم المتوقع للعلامة نسبةً للمسافة بين العلامات: يميّزها عن الدوائر المظلَّلة
    // (الدائرة المظلَّلة نصف العلامة تقريبًا، فتُرفض المجموعة التي تحويها)
    const longEdge = Math.max(top, side);
    const expSide = longEdge * markRel;
    let sizeErr = 0;
    for (const s of set) {
      const k = Math.sqrt(s.area) / expSide;
      if (k < 0.6 || k > 1.6) { sizeErr = Infinity; break; }
      sizeErr += Math.abs(Math.log(k));
    }
    if (!isFinite(sizeErr)) continue;
    // العلامات الحقيقية هي الأركان الخارجية للبطاقة: لا يجوز أن تبقى خارجها كتلة
    // أخرى بنفس السواد والحجم (وإلا فالمجموعة المختارة فيها دائرة مظلَّلة بدل علامة)
    const darkest = Math.max(...set.map((s) => s.mean ?? 0));
    const minArea = Math.min(...areas);
    const outsider = cands.some((o) => !set.includes(o) &&
      (o.mean ?? 255) <= darkest + 20 && o.area >= minArea * 0.6 && !insideQuad(q, o));
    if (outsider) continue;
    const dark = set.reduce((a, s) => a + (s.mean ?? 0), 0) / 4 / 255;   // العلامات سوداء تمامًا
    const score = err * 2 + spread + sizeErr + dark * 2;
    if (!best || score < best.score) best = { score, quad: q };
  }
  return best?.quad ?? null;
}

/* ----------------------------- ⑤ القياس ----------------------------- */

function sampler(g, w, h) {
  return (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 255;
    return g[yi * w + xi];
  };
}

// متوسط الرمادي داخل قرص نصف قطره rMm حول نقطة بالمليمتر (بعد التحويل)
function discMean(at, H, cx, cy, rMm) {
  let sum = 0, n = 0;
  const steps = 7;
  for (let i = -steps; i <= steps; i++) for (let j = -steps; j <= steps; j++) {
    const dx = (i / steps) * rMm, dy = (j / steps) * rMm;
    if (dx * dx + dy * dy > rMm * rMm) continue;
    const p = H(cx + dx, cy + dy);
    sum += at(p.x, p.y); n++;
  }
  return n ? sum / n : 255;
}

// قتامة الحلقة المطبوعة حول الدائرة — لاختيار الاتجاه الصحيح
function ringDark(at, H, cx, cy, rMm) {
  let s = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const p = H(cx + Math.cos(a) * rMm, cy + Math.sin(a) * rMm);
    s += 255 - at(p.x, p.y);
  }
  return s / 16;
}

function percentile(arr, q) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
}

/* ----------------------------- القراءة الكاملة ----------------------------- */

export const THRESH = { filled: 0.34, gap: 0.14, faint: 0.2 };

/**
 * يقرأ بطاقة الإجابة من صورة.
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} img
 * @param {ReturnType<import('./omrLayout').cardLayout>} layout
 * @returns {{ok:boolean, error?:string, rows?:Array, picks?:Object, preview?:string, contrast?:number}}
 */
export function readCard(img, layout, { maxSide = 1600, preview = true } = {}) {
  const { g, w, h } = toGray(img, maxSide);
  const mask = adaptiveMask(g, w, h);
  const comps = components(mask, w, h, g);

  const { marks, D, W: CW, H: CH } = layout;
  const mw = marks.tr.x - marks.tl.x, mh = marks.bl.y - marks.tl.y;
  const quad = findMarks(comps, w, h, mw / mh, layout.markSize / Math.max(mw, mh));
  if (!quad) {
    return { ok: false, error: "تعذّر العثور على المربعات السوداء الأربعة. صوّر البطاقة كاملة بمربعاتها، من الأعلى وبإضاءة جيدة." };
  }

  const at = sampler(g, w, h);
  const cardPts = [marks.tl, marks.tr, marks.br, marks.bl];

  // ③ الاتجاه: نجرب الدورات الأربع ونختار ما تتطابق فيه حلقات الدوائر المطبوعة
  let Hbest = null, bestRing = -1;
  for (let rot = 0; rot < 4; rot++) {
    const img4 = [0, 1, 2, 3].map((k) => quad[(k + rot) % 4]);
    const top = dist(img4[0], img4[1]), side = dist(img4[0], img4[3]);
    if ((top > side) !== (mw > mh)) continue;          // الضلع الطويل يطابق الطويل
    const Hm = homography(cardPts, img4);
    if (!Hm) continue;
    let ring = 0;
    layout.rows.forEach((r) => r.bubbles.forEach((b) => { ring += ringDark(at, Hm, b.x, b.y, D / 2); }));
    if (ring > bestRing) { bestRing = ring; Hbest = Hm; }
  }
  if (!Hbest) return { ok: false, error: "تعذّر تحديد اتجاه البطاقة. أعد التصوير والبطاقة مستقيمة في الإطار." };
  const Hm = Hbest;

  // مرجع الأبيض (الورق) والأسود (العلامات) من الصورة نفسها
  const whites = [];
  for (let y = layout.gridTop; y < layout.gridBottom; y += 1.7)
    for (let x = 4; x < CW - 4; x += 3.1) { const p = Hm(x, y); whites.push(at(p.x, p.y)); }
  const P = percentile(whites, 0.8);
  const K = ["tl", "tr", "br", "bl"].map((k) => discMean(at, Hm, marks[k].x, marks[k].y, 2.5))
    .reduce((a, b) => a + b, 0) / 4;
  const contrast = P - K;
  if (contrast < 40) {
    return { ok: false, error: "الصورة باهتة أو معتمة جدًا. أعد التصوير بإضاءة أفضل وبلا ظلّ على البطاقة." };
  }

  // ⑤ درجة التظليل لكل دائرة (٠ فارغة … ١ مظلَّلة بالكامل)
  const rIn = (D / 2) * 0.6;
  const raw = layout.rows.map((r) => r.bubbles.map((b) => {
    const m = discMean(at, Hm, b.x, b.y, rIn);
    return Math.max(0, Math.min(1, (P - m) / contrast));
  }));
  // مستوى «الدائرة الفارغة» في هذه البطاقة (أثر الحرف المطبوع داخلها): أغلب الدوائر فارغة،
  // فنأخذه من الربع الأدنى لكل الدرجات. ونطرحه من كل دائرة — لا أدنى الصف وحده،
  // وإلا صار الصف المظلَّل بالكامل (خانتا صح وخطأ معًا) «فارغًا».
  const emptyLevel = percentile(raw.flat(), 0.25);
  const rows = layout.rows.map((r, ri) => {
    const scores = raw[ri];
    const base = Math.min(Math.min(...scores), emptyLevel + 0.05);
    const adj = scores.map((s) => Math.max(0, s - base));
    const order = adj.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const [top, second] = [order[0], order[1] ?? [0, -1]];

    let pick = null, status;
    if (r.bubbles.length === 1) {
      pick = scores[0] >= THRESH.filled ? 0 : null; status = pick == null ? "blank" : "ok";
    } else if (top[0] < THRESH.faint) {
      status = "blank";
    } else if (second[0] >= THRESH.filled - 0.04 && top[0] - second[0] < THRESH.gap) {
      status = "multi";
    } else if (top[0] < THRESH.filled) {
      status = "faint"; pick = top[1];
    } else {
      status = "ok"; pick = top[1];
    }
    return { key: r.key, label: r.label, kind: r.kind, scores: adj.map((v) => +v.toFixed(2)), pick, status };
  });

  const picks = Object.fromEntries(rows.map((r) => [r.key, r.pick]));
  const out = { ok: true, rows, picks, contrast: Math.round(contrast) };

  // صورة مصحّحة للبطاقة مع إبراز القراءة — ليراجعها المعلم قبل الحفظ
  if (preview) out.preview = renderPreview(at, Hm, layout, rows);
  return out;
}

function renderPreview(at, Hm, layout, rows) {
  const S = 4; // بكسل لكل مليمتر
  const W = Math.round(layout.W * S), H = Math.round(layout.H * S);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const im = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = Hm(x / S, y / S);
    const v = at(p.x, p.y);
    const i = (y * W + x) * 4;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);

  const color = { ok: "#1f9d55", faint: "#d97706", multi: "#dc2626", blank: "#dc2626" };
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  layout.rows.forEach((lr) => {
    const r = byKey[lr.key];
    lr.bubbles.forEach((b, k) => {
      const chosen = r.pick === k;
      if (!chosen && r.status !== "multi" && r.status !== "blank") return;
      ctx.beginPath();
      ctx.arc(b.x * S, b.y * S, (layout.D / 2 + 0.9) * S, 0, Math.PI * 2);
      ctx.lineWidth = chosen ? 3 : 1.5;
      ctx.strokeStyle = chosen ? color[r.status] : color.multi + "88";
      ctx.stroke();
    });
  });
  return cv.toDataURL("image/jpeg", 0.85);
}
