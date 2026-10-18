// src/lib/labWallpaper.js
// رسم خلفية سطح المكتب لجهاز المعمل على canvas: رقم الجهاز ورمز QR للإبلاغ عن
// عطل فيه. اللوحة في الجهة اليمنى لأن أيقونات سطح مكتب Windows تبدأ من اليسار،
// وتبقى مسافة في الأسفل لشريط المهام.
import QRCode from "qrcode";
import { reportUrl } from "./lab.js";
import iconWhite from "../assets/icon-white.png";

export const WALLPAPER_SIZES = [
  { w: 1920, h: 1080, label: "1920 × 1080 (Full HD)" },
  { w: 1600, h: 900,  label: "1600 × 900" },
  { w: 1366, h: 768,  label: "1366 × 768" },
  { w: 1280, h: 1024, label: "1280 × 1024 (شاشة مربعة)" },
  { w: 1024, h: 768,  label: "1024 × 768 (أجهزة قديمة)" },
];

const FONT = '"IBM Plex Sans Arabic", Tahoma, sans-serif';
let iconImg = null;

function loadImage(src) {
  return new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** يرسم الخلفية ويعيد canvas. device: { seat_no, code } */
export async function drawWallpaper(device, { w, h, labName, note, origin }) {
  await Promise.all([
    document.fonts?.load(`700 40px ${FONT}`), document.fonts?.load(`400 20px ${FONT}`),
  ].filter(Boolean)).catch(() => {});
  if (!iconImg) iconImg = await loadImage(iconWhite).catch(() => null);

  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const s = Math.min(w / 1920, h / 1080);   // مقياس الرسم
  const S = (n) => Math.round(n * s);

  // الخلفية: تدرّج بألوان الهوية مع دوائر خافتة
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#10231A"); g.addColorStop(0.55, "#1F3A2D"); g.addColorStop(1, "#33604A");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(137,215,173,0.07)"; ctx.lineWidth = S(2);
  [[0.18, 0.75, 520], [0.3, 0.2, 300], [0.62, 0.95, 380]].forEach(([fx, fy, r]) => {
    ctx.beginPath(); ctx.arc(w * fx, h * fy, S(r), 0, Math.PI * 2); ctx.stroke();
  });
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let x = S(40); x < w * 0.55; x += S(36)) for (let y = S(40); y < h - S(80); y += S(36)) {
    ctx.beginPath(); ctx.arc(x, y, S(1.6), 0, Math.PI * 2); ctx.fill();
  }

  // اللوحة اليمنى
  const pw = S(440), m = S(56), bottomSafe = S(70);
  const px = w - pw - m, py = m, ph = h - m - bottomSafe - py;
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  roundRect(ctx, px, py, pw, ph, S(28)); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = S(1.5); ctx.stroke();

  const right = px + pw - S(36), cx = px + pw / 2;
  ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";

  // الترويسة
  let y = py + S(64);
  if (iconImg) ctx.drawImage(iconImg, px + S(36), y - S(44), S(56), S(56));
  ctx.fillStyle = "#FFFFFF"; ctx.font = `700 ${S(30)}px ${FONT}`;
  ctx.fillText("مدرسة مكة الثانوية", right, y - S(8));
  ctx.fillStyle = "#89D7AD"; ctx.font = `400 ${S(22)}px ${FONT}`;
  ctx.fillText(labName, right, y + S(26));

  // رقم الجهاز
  const qrSize = Math.min(S(250), Math.round(ph * 0.3));
  const numBase = py + Math.round(ph * 0.48);
  ctx.textAlign = "center"; ctx.direction = "ltr";
  ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = `400 ${S(24)}px ${FONT}`;
  ctx.direction = "rtl"; ctx.fillText("رقم الجهاز", cx, numBase - Math.round(ph * 0.2)); ctx.direction = "ltr";
  ctx.fillStyle = "#FFFFFF"; ctx.font = `700 ${Math.round(ph * 0.22)}px ${FONT}`;
  ctx.fillText(String(device.seat_no), cx, numBase);
  ctx.fillStyle = "#89D7AD"; ctx.font = `700 ${S(30)}px ${FONT}`;
  ctx.fillText(device.code, cx, numBase + S(46));

  // رمز QR
  const qy = py + ph - qrSize - S(96);
  const pad = S(14);
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cx - qrSize / 2 - pad, qy - pad, qrSize + pad * 2, qrSize + pad * 2, S(18)); ctx.fill();
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, reportUrl(device.seat_no, origin), {
    margin: 0, width: qrSize, errorCorrectionLevel: "M", color: { dark: "#1F3A2D", light: "#FFFFFF" },
  });
  ctx.drawImage(qr, cx - qrSize / 2, qy, qrSize, qrSize);
  ctx.direction = "rtl";
  ctx.fillStyle = "#FFFFFF"; ctx.font = `700 ${S(21)}px ${FONT}`;
  ctx.fillText("للمعلم: امسح الرمز للإبلاغ عن عطل", cx, qy + qrSize + pad + S(38));
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = `400 ${S(18)}px ${FONT}`;
  ctx.fillText("في هذا الجهاز عبر بوابة المدرسة", cx, qy + qrSize + pad + S(66));

  // سطر التعليمات أسفل يسار اللوحة
  if (note?.trim()) {
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `400 ${S(22)}px ${FONT}`;
    ctx.fillText(note.trim(), px - S(48), h - bottomSafe - S(6));
  }
  return c;
}

/** تنزيل canvas صورةً باسم الملف */
export function downloadCanvas(canvas, name) {
  return new Promise((ok) => canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    ok();
  }, "image/png"));
}
