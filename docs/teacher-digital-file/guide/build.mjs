// يبني «دليل المعلم: ملف المعلم الرقمي» PDF من guide.html.
//   node docs/teacher-digital-file/guide/build.mjs [--no-shots]
// 1) يشغّل بيئة الشاشات (harness) ويلتقط الصور من الكود الحالي إلى shots/ (shots.mjs)،
//    إلا مع --no-shots فيستخدم الصور الموجودة.
// 2) يطبع guide.html بصفحات A4 إلى teacher-dfile-guide.pdf.
// يحتاج playwright: يُبحث عنه في node_modules ثم في /opt/node-tools، وكروميوم المثبّت إن وُجد.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { takeShots } from "./shots.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const PORT = 5196;

const pwPath = [path.join(root, "node_modules/playwright/index.mjs"), "/opt/node-tools/node_modules/playwright/index.mjs"].find(existsSync);
if (!pwPath) { console.error("لم يُعثر على playwright."); process.exit(1); }
const { chromium } = await import(pathToFileURL(pwPath).href);
const exe = ["/opt/pw-browsers/chromium"].find(existsSync);

if (!process.argv.includes("--no-shots")) {
  const vite = spawn("npx", ["vite", "--config", path.join(here, "harness/vite.config.mjs"), "--port", String(PORT), "--strictPort"],
    { cwd: root, stdio: "ignore", detached: true });
  try {
    const base = `http://localhost:${PORT}`;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${base}/panel.html`)).ok) break; } catch { /* لم يبدأ بعد */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log("الشاشات:", (await takeShots(chromium, base, exe)).join("، "));
  } finally {
    process.kill(-vite.pid);
  }
}

const b = await chromium.launch(exe ? { executablePath: exe } : {});
const p = await b.newPage();
await p.goto(pathToFileURL(path.join(here, "guide.html")).href);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
const out = path.join(here, "teacher-dfile-guide.pdf");
await p.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
await b.close();
console.log("الدليل:", out);
