// لقطات أدلة المستخدمين: node docs/user-guides/shots/shoot.mjs [as] [route...]
// يشغّل البوابة ببيانات تجريبية ويلتقط الصفحات إلى ../img/<as>/
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.resolve(import.meta.dirname);
const root = path.resolve(here, "../../..");
const PORT = 5199;
export const SHOTS = (await import("./list.mjs")).SHOTS;
const BOOT = "academic_calendar users teachers admin_roles custom_roles guardians announcement_banners rpc:my_notifications outreach_recipients school_assets settings rpc:referrals_auto_close rpc:ach_is_member rpc:media_card_me rpc:sci_teacher_labs rpc:cult_me rpc:acc_me rpc:my_department cult_team maintenance_state form_documents plc_sessions pd_reports exchange_visits perf_reviews rpc:my_noor_grade_due guidance_inquiry_items doc_acks staff_notes improvement_goals quiz_plans circular_recipients acc_meetings teacher_hidden_tabs teacher_granted_tabs".split(" ");
const [as = "teacher", ...only] = process.argv.slice(2);
const vite = spawn("npx", ["vite", "--config", path.join(here, "vite.config.mjs"), "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "ignore", detached: true });
try {
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* */ } await new Promise((r) => setTimeout(r, 1000)); }
  const b = await chromium.launch();
  const out = path.join(here, "img", as); mkdirSync(out, { recursive: true });
  const list = (SHOTS[as] ?? []).filter((s) => !only.length || only.includes(s.name));
  for (const s of list) { try {
    const ctx = await b.newContext({ viewport: s.wide ? { width: 1280, height: 860 } : { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ar-SA", timezoneId: "Asia/Riyadh" });
    const p = await ctx.newPage();
    await p.clock.install({ time: new Date(s.time ?? "2026-11-10T09:20:00+03:00") });
    if (!s.push) await p.addInitScript(() => { delete window.PushManager; });
    await p.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style");
      st.textContent = '.bg-late.text-white:has(a[href="/contact?type=suggestion"]){display:none!important}';
      document.head.appendChild(st);
    }));
    p.on("pageerror", (e) => console.log("  خطأ:", s.name, e.message));
    // late: صفحة تُسجَّل بعد تحميل صلاحيات الحساب، فتُفتح من الرئيسية بالتنقل داخل البوابة
    await p.goto(`${base}${s.late ? "/" : s.to}${!s.late && s.to.includes("?") ? "&" : "?"}as=${as}`);
    if (s.late) { await p.waitForTimeout(400); await p.clock.runFor(2500);
      await p.evaluate((to) => { history.pushState({}, "", to); dispatchEvent(new PopStateEvent("popstate")); }, s.to); }
    await p.waitForTimeout(400); await p.clock.runFor(2500);
    await p.waitForLoadState("networkidle").catch(() => null);
    await p.evaluate(() => document.fonts.ready);
    if (s.act) await s.act(p);
    await p.waitForTimeout(300);
    const file = path.join(out, s.name + ".png");
    if (s.sel) await p.locator(s.sel).first().screenshot({ path: file });
    else await p.screenshot({ path: file, fullPage: !!s.full });
    const q = await p.evaluate((pre) => Object.keys(window.__q ?? {}).filter((k) => !pre.includes(k)).join(" "), BOOT);
    console.log("✓", s.name, "|", q);
    await ctx.close();
  } catch (e) { console.log("✗", s.name, e.message.split("\n")[0]); } }
  await b.close();
} finally { process.kill(-vite.pid); }
