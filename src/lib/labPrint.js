// src/lib/labPrint.js
// بدائل مطبوعة لرمز البلاغ حين لا يصل الجهاز لسطح المكتب: ملصق صغير لكل جهاز
// (24 ملصقًا في ورقة A4)، ولوحة بلاغ عامة للمعمل تفتح النموذج مع رسم المعمل
// لاختيار الجهاز. تُفتح في تبويب مستقل يطبع نفسه (يعمل على الحاسب والجوال).
import QRCode from "qrcode";
import { reportUrl } from "./lab.js";

const qr = (url, width) => QRCode.toDataURL(url, {
  margin: 0, width, errorCorrectionLevel: "M", color: { dark: "#1F3A2D", light: "#FFFFFF" },
});
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BASE_CSS = `
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "IBM Plex Sans Arabic", Tahoma, sans-serif; color: #1F3A2D; }
  .num { direction: ltr; unicode-bidi: embed; font-variant-numeric: tabular-nums; }
`;

// خط البوابة من public/fonts بروابط كاملة (التبويب الجديد بلا ملفات CSS البوابة)
const RANGES = { arabic: "U+0600-06FF,U+0750-077F,U+200C-200E,U+FB50-FDFF,U+FE70-FEFF", latin: "U+0000-00FF,U+2000-206F" };
const fontFaces = () => [400, 700].map((w) => ["arabic", "latin"].map((sub) =>
  `@font-face{font-family:"IBM Plex Sans Arabic";font-weight:${w};src:url(${window.location.origin}/fonts/ibm-plex-sans-arabic-${w}-${sub}.woff2) format("woff2");unicode-range:${RANGES[sub]};}`
).join("")).join("");

// يُفتح التبويب فورًا ضمن نقرة المستخدم (وإلا حجبه المتصفح)، ثم يُكتب المحتوى بعد تجهيز الرموز
async function openPrint(title, css, makeBody) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write('<!doctype html><html lang="ar" dir="rtl"><body style="font-family:sans-serif;text-align:center;padding:40px">جارٍ التجهيز…</body></html>');
  const body = await makeBody();
  w.document.open();
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${fontFaces()}${BASE_CSS}${css}</style></head>
<body>${body}<script>
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    Promise.all([].slice.call(document.images).map(function (i) { return i.complete ? 0 : new Promise(function (r) { i.onload = i.onerror = r; }); }))
      .then(function () { setTimeout(function () { window.print(); }, 200); });
  });
</script></body></html>`);
  w.document.close();
  return true;
}

/** ورقة ملصقات: 3 أعمدة × 8 صفوف، لكل جهاز رقمه ورمزه */
export function printStickers(devices, labName) {
  const cells = () => Promise.all(devices.map(async (d) => `
    <div class="st">
      <img src="${await qr(reportUrl(d.seat_no), 300)}" alt="">
      <div class="tx">
        <p class="n num">${d.seat_no}</p>
        <p class="c num">${esc(d.code)}</p>
        <p class="h">بلاغ عطل — للمعلم</p>
      </div>
    </div>`));
  return openPrint(`ملصقات أجهزة ${labName}`, `
    .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; }
    .st { height: 33mm; border: 0.3mm dashed #9DB5A8; border-radius: 3mm; padding: 2.5mm;
          display: flex; align-items: center; gap: 3mm; break-inside: avoid; }
    .st img { width: 27mm; height: 27mm; }
    .tx p { margin: 0; line-height: 1.15; }
    .n { font-size: 26pt; font-weight: 700; }
    .c { font-size: 9pt; color: #3E6350; font-weight: 700; }
    .h { font-size: 7.5pt; color: #5B6F64; margin-top: 1mm !important; }
  `, async () => `<div class="sheet">${(await cells()).join("")}</div>`);
}

/** لوحة A4 تُعلَّق في المعمل: رمز واحد يفتح البلاغ مع اختيار الجهاز من الرسم */
export function printReportPoster(labName) {
  return openPrint(`لوحة البلاغ — ${labName}`, `
    @page { margin: 0; }
    .pg { height: 297mm; padding: 22mm 18mm; display: flex; flex-direction: column; align-items: center; text-align: center;
          background: linear-gradient(160deg, #10231A, #1F3A2D 55%, #33604A); color: #fff;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sc { font-size: 16pt; font-weight: 700; margin: 0; }
    .lb { font-size: 13pt; color: #89D7AD; margin: 2mm 0 0; }
    h1 { font-size: 34pt; margin: 18mm 0 4mm; }
    .sub { font-size: 14pt; color: rgba(255,255,255,.75); margin: 0 0 12mm; }
    .qr { background: #fff; border-radius: 8mm; padding: 8mm; }
    .qr img { width: 110mm; height: 110mm; display: block; }
    ol { text-align: right; font-size: 13pt; line-height: 1.9; margin: 14mm auto 0; max-width: 150mm; color: rgba(255,255,255,.9); }
  `, async () => `<div class="pg">
      <p class="sc">مدرسة مكة الثانوية</p>
      <p class="lb">${esc(labName)}</p>
      <h1>بلاغ عطل جهاز</h1>
      <p class="sub">للمعلم — حين لا يعمل الجهاز أو لا يظهر رمزه على الشاشة</p>
      <div class="qr"><img src="${await qr(reportUrl(0), 900)}" alt=""></div>
      <ol>
        <li>امسح الرمز بجوالك وسجّل الدخول للبوابة.</li>
        <li>اختر الجهاز من رسم المعمل (الترقيم يبدأ من يمين المعلم).</li>
        <li>حدّد نوع العطل وأرسل البلاغ إلى محضر المعمل.</li>
      </ol>
    </div>`);
}

/** لوحة قواعد السلامة للتعليق في المعمل (A3 أو A4) */
export function printRulesPoster(items, labName, size = "A3") {
  const big = size === "A3";
  return openPrint(`قواعد السلامة — ${labName}`, `
    @page { size: ${size}; margin: 0; }
    .pg { height: ${big ? 420 : 297}mm; padding: ${big ? 22 : 14}mm ${big ? 20 : 14}mm; display: flex; flex-direction: column;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hd { background: linear-gradient(135deg, #10231A, #1F3A2D 60%, #33604A); color: #fff; border-radius: 6mm;
          padding: ${big ? 12 : 8}mm; text-align: center; }
    .hd .sc { margin: 0; font-size: ${big ? 18 : 13}pt; font-weight: 700; }
    .hd .lb { margin: 1.5mm 0 0; color: #89D7AD; font-size: ${big ? 14 : 11}pt; }
    .hd h1 { margin: ${big ? 6 : 4}mm 0 0; font-size: ${big ? 44 : 30}pt; }
    .rules { list-style: none; padding: 0; margin: ${big ? 12 : 8}mm 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: ${big ? 6 : 4}mm; flex: 1; grid-auto-rows: 1fr; }
    .rules li { display: flex; gap: ${big ? 5 : 3.5}mm; align-items: center; border: 0.4mm solid #D6E4DC; border-radius: 4mm;
                padding: ${big ? 6 : 4}mm; background: #F5FAF7; break-inside: avoid; }
    .rules .n { flex: none; width: ${big ? 14 : 10}mm; height: ${big ? 14 : 10}mm; border-radius: 50%; background: #3E6350; color: #fff;
                display: grid; place-items: center; font-weight: 700; font-size: ${big ? 18 : 13}pt; }
    .rules p { margin: 0; font-size: ${big ? 20 : 13}pt; line-height: 1.6; color: #1F3A2D; font-weight: 700; }
    .ft { margin-top: ${big ? 10 : 6}mm; text-align: center; font-size: ${big ? 13 : 10}pt; color: #5B6F64; }
  `, async () => `<div class="pg">
      <div class="hd"><p class="sc">مدرسة مكة الثانوية</p><p class="lb">${esc(labName)}</p><h1>قواعد السلامة والتعليمات</h1></div>
      <ol class="rules">${items.map((t, i) => `<li><span class="n num">${i + 1}</span><p>${esc(t)}</p></li>`).join("")}</ol>
      <p class="ft">أقرّ كل طالب بقراءة هذه القواعد والالتزام بها عبر بوابة المدرسة.</p>
    </div>`);
}
