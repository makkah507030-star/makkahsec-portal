// تصدير مشهد إطارًا بإطار إلى MP4 (30 إطارًا/ث): node rec.mjs <المشهد> <ملف الخرج> [d=أطوال الصوت]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import path from "node:path";
const [,, scene, outFile, d] = process.argv;
const FPS = 30;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("file://" + path.resolve("scenes.html") + `?s=${scene}` + (d ? `&d=${d}` : ""));
await p.evaluate(() => document.fonts.ready);
await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
const total = await p.evaluate(() => window.TOTAL);
const n = Math.round(total * FPS);
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS), outFile]);
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => window.render(t), i / FPS);
  const buf = await p.screenshot({ type: "jpeg", quality: 93 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await b.close();
console.log(scene, n, "frames", total.toFixed(2) + "s");
