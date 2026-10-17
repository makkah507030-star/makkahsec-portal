// يبني «تقرير بوابة مكة الثانوية الرقمية» PDF من report.html.
//   node docs/portal-report/build.mjs [--png]
// مع --png تُحفظ صورة لكل صفحة في preview/ للمعاينة قبل الإرسال.
// يحتاج playwright: يُبحث عنه في node_modules ثم في /opt/node-tools، وكروميوم المثبّت إن وُجد.
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

const pwPath = [path.join(root, "node_modules/playwright/index.mjs"), "/opt/node-tools/node_modules/playwright/index.mjs"].find(existsSync);
if (!pwPath) { console.error("لم يُعثر على playwright."); process.exit(1); }
const { chromium } = await import(pathToFileURL(pwPath).href);
const exe = ["/opt/pw-browsers/chromium"].find(existsSync);

const b = await chromium.launch(exe ? { executablePath: exe } : {});
const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(path.join(here, "report.html")).href);
await p.evaluate(() => document.fonts.ready);

// تنبيه إن فاض محتوى صفحة عن حدودها
const over = await p.evaluate(() => [...document.querySelectorAll(".page")].map((pg, i) => {
  const limit = pg.getBoundingClientRect().bottom - 20 * 3.78; // فوق التذييل
  const kids = [...pg.children].filter((c) => !c.classList.contains("ftr"));
  const bottom = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom));
  return bottom > limit ? `${i + 1} (+${Math.round(bottom - limit)}px)` : null;
}).filter(Boolean));
if (over.length) console.warn("صفحات يفيض محتواها:", over.join("، "));

if (process.argv.includes("--png")) {
  const dir = path.join(here, "preview");
  mkdirSync(dir, { recursive: true });
  const els = await p.$$(".page");
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(dir, `p${String(i + 1).padStart(2, "0")}.png`) });
}

await p.pdf({ path: path.join(here, "makkahsec-portal-report.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
await b.close();
console.log("تم: docs/portal-report/makkahsec-portal-report.pdf");
