// بناء دليل الدعم الفني: node docs/lab-guides/support-src/build.cjs (يتطلب Playwright)
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("file://" + path.join(__dirname, "guide.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const over = await p.evaluate(() => [...document.querySelectorAll(".pg")].map((s, i) => [i + 1, s.scrollHeight > s.clientHeight + 1]).filter((x) => x[1]).map((x) => x[0]));
  if (over.length) console.log("صفحات زائدة الطول:", over);
  await p.pdf({ path: path.join(__dirname, "..", "lab-guide-support.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
