// src/pages/lab/labFile.js
// يجمع ملف المعمل في ملف HTML واحد يعمل دون إنترنت: حزمة المشغّل وتنسيقه (من بناء
// vite.lab.config.js المنشور مع الموقع) والخطوط مضمّنة، وبيانات الحصة في window.__LAB__.

const toDataUri = async (url) => {
  const blob = await (await fetch(url)).blob();
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(r.result); r.onerror = fail;
    r.readAsDataURL(blob);
  });
};

export async function buildLabFile(data) {
  const page = await (await fetch("/lab-player.html", { cache: "no-store" })).text();
  const js = page.match(/<script[^>]*src="(\/lab-player\/[^"]+\.js)"/)?.[1];
  const css = page.match(/<link[^>]*href="(\/lab-player\/[^"]+\.css)"/)?.[1];
  if (!js || !css) throw new Error("ملف المعمل يُبنى مع نشر الموقع، ولا يتوفر في نسخة التطوير.");
  const [code, style] = await Promise.all([js, css].map((u) => fetch(u).then((r) => r.text())));

  // الخطوط من /fonts تُضمَّن، فيظهر خط البوابة على أجهزة المعمل دون إنترنت
  const fonts = [...new Set(style.match(/\/fonts\/[^)"']+\.woff2/g) ?? [])];
  const uris = await Promise.all(fonts.map(toDataUri));
  const css2 = fonts.reduce((s, f, i) => s.split(f).join(uris[i]), style);

  const json = JSON.stringify({ ...data, origin: location.origin }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${data.title ?? `معمل الحاسب الآلي · فصل ${data.class_no}`}</title>
<style>${css2}</style>
<script>window.__LAB__ = ${json};</script>
</head><body><div id="root"></div>
<script type="module">${code.replace(/<\/script/gi, "<\\/script")}</script>
</body></html>`;
}

export function downloadText(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/html;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
