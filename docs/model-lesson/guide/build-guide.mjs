// يطبع دليل الحصة النموذجية PDF من guide.html (A4):  node docs/model-lesson/guide/build-guide.mjs
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const pw = [path.join(root, "node_modules/playwright/index.mjs"), "/opt/node-tools/node_modules/playwright/index.mjs"].find(existsSync);
const { chromium } = await import(pathToFileURL(pw).href);
const exe = ["/opt/pw-browsers/chromium"].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const p = await b.newPage();
await p.goto(pathToFileURL(path.join(here, "guide.html")).href);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(600);
const out = path.join(here, "model-lesson-guide.pdf");
await p.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
await b.close();
console.log(out);
