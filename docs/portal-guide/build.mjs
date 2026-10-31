// يبني دليلَي بوابة مكة الثانوية الرقمية PDF بهوية التقارير الرسمية (components/report):
//   node docs/portal-guide/build.mjs [--theme=official]
// يشغّل بيئة الدليل (harness)، ويطبع ?doc=org و?doc=proc صفحاتِ A4 إلى هذا المجلد.
// الإجراءات من src/pages/Help.jsx، والأقسام والأدوار والصلاحيات من الكود نفسه، فيُعاد البناء بعد أي تعديل فيها.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const PORT = 5197;
const theme = process.argv.find((a) => a.startsWith("--theme="))?.split("=")[1] === "official" ? "official" : "light";

const pwPath = [path.join(root, "node_modules/playwright/index.mjs"), "/opt/node-tools/node_modules/playwright/index.mjs"].find(existsSync);
const { chromium } = await import(pwPath ? pathToFileURL(pwPath).href : "playwright");
const exe = ["/opt/pw-browsers/chromium"].find(existsSync);

const vite = spawn("npx", ["vite", "--config", path.join(here, "harness/vite.config.mjs"), "--port", String(PORT), "--strictPort"],
  { cwd: root, stdio: "ignore", detached: true });
try {
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* لم يبدأ بعد */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const [doc, name] of [["org", "الدليل-التنظيمي"], ["proc", "الدليل-الإجرائي"]]) {
    const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
    await p.goto(`${base}/?doc=${doc}&theme=${theme}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(800);
    const over = await p.evaluate(() => [...document.querySelectorAll(".pg-sheets .mr-body")].filter((e) => e.scrollHeight - e.clientHeight > 2).length);
    if (over) console.warn(`تنبيه: ${over} صفحة فيها محتوى مقصوص في ${name}`);
    const out = path.join(here, `${name}${theme === "official" ? "-رسمية" : ""}.pdf`);
    await p.pdf({ path: out, width: "210mm", height: "297mm", printBackground: true, preferCSSPageSize: true });
    console.log(name, await p.evaluate(() => window.__pages), "صفحة ←", path.relative(root, out));
  }
  await b.close();
} finally {
  process.kill(-vite.pid);
}
