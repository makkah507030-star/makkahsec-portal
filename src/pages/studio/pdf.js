/* =====================================================================
   ملف PDF من صور JPEG — صفحة لكل صورة تملأ الصفحة بمقاسها الحقيقي.
   يُستعمل للطباعة من الجوال: متصفحات الجوال تطبع صفحة الويب بهوامش
   وألوان غير منضبطة، أما ملف PDF فيُطبع بمقاسه الصحيح من أي جهاز.
   مكتوب يدويًا (صيغة PDF 1.4 مع ترميز DCTDecode) بلا مكتبة خارجية.
   ===================================================================== */

const MM = 72 / 25.4; // نقطة PDF لكل مليمتر

/** يقرأ أبعاد صورة JPEG من مقطع SOF */
function jpegSize(b) {
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  throw new Error("صورة JPEG غير صالحة");
}

const dataUrlBytes = (url) => Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));

/**
 * @param {string[]} jpegs  صور JPEG بصيغة data URL
 * @param {{w:number,h:number}} pageMm  مقاس الصفحة بالمليمتر
 * @returns {Blob}
 */
export function jpegsToPdf(jpegs, pageMm) {
  const W = (pageMm.w * MM).toFixed(2), H = (pageMm.h * MM).toFixed(2);
  const enc = new TextEncoder();
  const parts = []; const offsets = []; let len = 0;
  const push = (x) => { const u = typeof x === "string" ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = jpegs.length;
  // 1 الفهرس، 2 الصفحات، ثم لكل صفحة: الصفحة والصورة والمحتوى
  const pageIds = jpegs.map((_, i) => 3 + i * 3);
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));
  jpegs.forEach((url, i) => {
    const p = pageIds[i], img = p + 1, cnt = p + 2;
    const bytes = dataUrlBytes(url); const { w, h } = jpegSize(bytes);
    obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] `
      + `/Resources << /XObject << /Im${i} ${img} 0 R >> >> /Contents ${cnt} 0 R >>`));
    obj(img, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB `
        + `/BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
      push(bytes); push("\nendstream");
    });
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(cnt, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  });
  const xref = len; const total = 3 + n * 3;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) push(`${String(offsets[k]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
