// تصدير المنشور إلى PDF (A4) وPNG عالي الدقة للطباعة: node render.mjs [اسم الملف دون الامتداد]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import path from "node:path";
import fs from "node:fs";
const name = process.argv[2] || "student-access";
fs.mkdirSync("out", { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 3 });
await p.goto("file://" + path.resolve(name + ".html"));
await p.evaluate(() => document.fonts.ready);
const over = await p.evaluate(() => {
  const f = document.querySelector("footer").getBoundingClientRect().top;
  const last = [...document.querySelectorAll(".extra")].at(-1).getBoundingClientRect().bottom;
  return Math.round(last - f);
});
console.log("تداخل المحتوى مع التذييل (يجب أن يكون سالبًا):", over);
await p.screenshot({ path: `out/${name}.png` });
await p.pdf({ path: `out/${name}.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
await b.close();
