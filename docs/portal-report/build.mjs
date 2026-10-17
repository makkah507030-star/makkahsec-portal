// يبني «تقرير بوابة مكة الثانوية الرقمية» PDF من report.html بنسختي طقم التقارير:
//   node docs/portal-report/build.mjs [--png]
// يُخرج makkahsec-portal-report.pdf (الملوّنة) وmakkahsec-portal-report-official.pdf (الرسمية).
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
for (const [theme, file] of [["light", "makkahsec-portal-report.pdf"], ["official", "makkahsec-portal-report-official.pdf"]]) {
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
  await p.goto(`${pathToFileURL(path.join(here, "report.html")).href}?theme=${theme}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForLoadState("networkidle");

  // تنبيه إن فاض محتوى صفحة عن إطارها (mr-body يخفي ما يزيد)
  const over = await p.evaluate(() => [...document.querySelectorAll(".sheet")].map((s, i) => {
    const body = s.querySelector(".mr-body") || s.querySelector(".stu-page");
    const extra = body.scrollHeight - body.clientHeight;
    return extra > 1 ? `${i + 1} (+${extra}px)` : null;
  }).filter(Boolean));
  if (over.length) console.warn(`${theme}: صفحات يفيض محتواها:`, over.join("، "));

  if (process.argv.includes("--png")) {
    const dir = path.join(here, "preview", theme);
    mkdirSync(dir, { recursive: true });
    const els = await p.$$(".sheet");
    for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(dir, `p${String(i + 1).padStart(2, "0")}.png`) });
  }
  await p.pdf({ path: path.join(here, file), printBackground: true, preferCSSPageSize: true });
  console.log(`تم: docs/portal-report/${file}`);
  await p.close();
}
await b.close();
