// يحوّل video.html إلى MP4 طولي 1080×1920: إطار لكل 1/24 ثانية بـ seek(t)، ثم ffmpeg.
// الاستعمال: node render.mjs <مسار-playwright> <مجلد-إطارات-مؤقت> <ملف-الإخراج.mp4>
// يولّد المؤثرات بـ sfx.py ويدمجها في الفيديو (بلا موسيقى).
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const [pw, tmp, out] = process.argv.slice(2);
const { chromium } = await import(pw);
const FPS = 24;
mkdirSync(tmp, { recursive: true });
const page = fileURLToPath(new URL("./video.html", import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await p.goto("file://" + page);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
const total = await p.evaluate(() => window.TOTAL);
for (let i = 0; i < total * FPS; i++) {
  await p.evaluate((t) => window.seek(t), i / FPS);
  await p.screenshot({ path: `${tmp}/f${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
}
await b.close();
const sfx = `${tmp}/sfx.wav`;
execFileSync("python3", [fileURLToPath(new URL("./sfx.py", import.meta.url)), sfx]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${tmp}/f%05d.jpg`, "-i", sfx,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
  "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out]);
console.log("done", out);
