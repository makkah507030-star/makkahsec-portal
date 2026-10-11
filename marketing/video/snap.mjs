// لقطات مراجعة: node snap.mjs <المشهد> <ث1,ث2,...> [d=أطوال]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import path from "node:path";
const [,, scene, times, d] = process.argv;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("file://" + path.resolve("scenes.html") + `?s=${scene}` + (d ? `&d=${d}` : ""));
await p.evaluate(() => document.fonts.ready);
await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
console.log(scene, "TOTAL", await p.evaluate(() => window.TOTAL.toFixed(2)));
for (const t of times.split(",")) {
  await p.evaluate((t) => window.render(+t), t);
  await p.screenshot({ path: `out/snap-${scene}-${t}.jpg`, type: "jpeg", quality: 85 });
}
await b.close();
