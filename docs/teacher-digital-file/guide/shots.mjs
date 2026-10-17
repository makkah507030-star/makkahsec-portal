// يلتقط شاشات دليل المعلم من الكود الحالي ببيانات تجريبية (harness)، بعرض جوال 390 وبدقة مضاعفة.
// يُستدعى من build.mjs بعد تشغيل خادم harness، ويحفظ الصور في shots/.
// لإضافة شاشة: أضف سطرًا في SHOTS أدناه، واستخدم اسمها في guide.html.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (n) => path.join(here, "shots", `${n}.png`);

export async function takeShots(chromium, base, exe) {
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = async (url, opts = {}) => {
    const p = await b.newPage({ viewport: { width: 390, height: opts.h ?? 844 }, deviceScaleFactor: 2 });
    // الشاهد التجريبي: رابط مؤقت إلى ملف PDF محلي بدل دالة Netlify
    await p.route("**/.netlify/functions/dfile-doc", (r) => r.fulfill({
      contentType: "application/json", body: JSON.stringify({ url: `${base}/sample.pdf?token=x` }) }));
    await p.goto(`${base}/${url}`);
    await p.waitForTimeout(2500);
    return p;
  };
  // قسم من لوحة المعلم بعنوانه
  const block = (p, title) => p.locator("div.card", { has: p.locator("h2", { hasText: title }) }).first();
  const shoot = async (loc, name) => { await loc.scrollIntoViewIfNeeded(); await loc.page().waitForTimeout(600); await loc.screenshot({ path: out(name) }); };
  const done = [];

  // 1) قبل التفعيل
  let p = await page("panel.html?new", { h: 520 });
  await p.screenshot({ path: out("activate") }); done.push("activate");
  await p.close();

  // 2) لوحة المعلم: أعلى الصفحة ثم كل قسم
  p = await page("panel.html", { h: 900 });
  await p.screenshot({ path: out("panel-top") }); done.push("panel-top");
  const BLOCKS = [
    ["opinions", "آراء الإدارة"], ["data", "بياناتك"], ["madrasati", "منصة مدرستي"], ["activities", "الأنشطة"], ["records", "السجلات والنماذج"],
    ["sections", "ماذا يرى الزائر؟"], ["sentences", "قراءة في 30 ثانية"], ["wins", "إنجازات أخرى"],
    ["distribution", "توزيع المنهج"],
  ];
  for (const [n, t] of BLOCKS) { await shoot(block(p, t), n); done.push(n); }
  // رابط ملفك: البطاقة والأزرار، ثم واتساب، ثم سجل الزوار
  const share = block(p, "رابط ملفك");
  await shoot(share.locator("div.space-y-4 > *").first(), "share-card"); done.push("share-card");
  await shoot(share.locator("div.rounded-card", { hasText: "المشاركة عبر واتساب" }).first(), "share-wa"); done.push("share-wa");
  await shoot(share.locator("div.space-y-2", { hasText: "من اطّلع على ملفك" }).last(), "share-log"); done.push("share-log");
  // المعاينة كما يراها الزائر
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.getByRole("button", { name: "معاينة كما يراها الزائر" }).click();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: out("preview") }); done.push("preview");
  await p.close();

  // 3) صفحة الزائر
  p = await page("public.html");
  await p.screenshot({ path: out("visitor-welcome") }); done.push("visitor-welcome");
  await p.getByRole("button", { name: "تخطٍّ" }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out("visitor-report") }); done.push("visitor-report");
  // زر «اكتب ملاحظتك» الثابت يُخفى في صور الأقسام، ويعود لصورة الملاحظة
  const noteBtn = await p.addStyleTag({ content: "button.fixed { visibility: hidden !important; }" });
  // الأقسام المطوية في التقرير: #df-elements و#df-docs
  const fold = async (id) => { const x = p.locator(`#df-${id} summary`); await x.scrollIntoViewIfNeeded(); await x.click(); await p.waitForTimeout(1800); };
  await shoot(p.locator("#df-records"), "visitor-records"); done.push("visitor-records");
  await fold("elements");
  await shoot(p.locator("#df-elements"), "visitor-elements"); done.push("visitor-elements");
  await fold("docs");
  await shoot(p.locator("#df-docs"), "visitor-docs"); done.push("visitor-docs");
  await p.locator(".df-doc").first().click();
  await p.waitForTimeout(3000);
  await p.screenshot({ path: out("visitor-doc-view") }); done.push("visitor-doc-view");
  await p.keyboard.press("Escape");
  await noteBtn.evaluate((el) => el.remove());
  await p.getByText("اكتب ملاحظتك للمعلم").click();
  await p.locator("textarea").fill("ملف منظم ومميز، بارك الله فيك. أقترح إضافة نماذج من أوراق العمل في قسم الشواهد.");
  await p.getByRole("button", { name: "حفظ الملاحظة" }).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: out("visitor-note") }); done.push("visitor-note");
  await p.close();

  await b.close();
  return done;
}
