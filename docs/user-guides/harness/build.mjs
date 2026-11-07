// يبني أدلة المستخدمين PDF: node docs/user-guides/harness/build.mjs [teacher ...]
// يطبع guide.html?g=<key> إلى docs/user-guides/<file>.pdf. اللقطات قبله بـ shoot.mjs.
import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { GUIDES } from "./guides.js";
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.resolve(import.meta.dirname);
const root = path.resolve(here, "../../..");
const PORT = 5198;
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GUIDES);
const vite = spawn("npx", ["vite", "--config", path.join(here, "vite.config.mjs"), "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "ignore", detached: true });
try {
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* */ } await new Promise((r) => setTimeout(r, 1000)); }
  const b = await chromium.launch();
  for (const k of keys) {
    const p = await b.newPage();
    p.on("pageerror", (e) => console.log("خطأ:", e.message));
    await p.goto(`${base}/guide.html?g=${k}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await p.waitForTimeout(500);
    const out = path.join(here, "..", GUIDES[k].file + ".pdf");
    await p.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
    console.log("✓", path.relative(root, out));
  }
  await b.close();
} finally { process.kill(-vite.pid); }
