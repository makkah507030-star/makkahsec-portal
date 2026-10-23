// api/_adapter.js
// =====================================================================
//  تشغيل دوال Netlify كما هي على Vercel.
//  كل ملف في api/ يستورد دالته من netlify/functions ويمرّرها هنا، فيبقى
//  منطق كل دالة في مكان واحد ويعمل على المنصتين أثناء الانتقال.
//  الملفات التي تبدأ بشرطة سفلية في api/ لا يعدّها Vercel دوالّ.
// =====================================================================

// عنوان الموقع الذي تستدعي به الدوال المجدولة دالة الإشعارات (Netlify يضبطه وحده)
process.env.URL ??= process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "";

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

export function toVercel(handler, { cron = false } = {}) {
  return async (req, res) => {
    // الدوال المجدولة: لا يستدعيها إلا Vercel نفسه بالسر CRON_SECRET
    if (cron && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      res.statusCode = 401;
      return res.end("unauthorized");
    }

    const url = new URL(req.url, "http://localhost");
    // المسار الأصلي قبل إعادة التوجيه (مثل /iclock/cdata) يصل في __path
    const path = url.searchParams.get("__path") || url.pathname;
    url.searchParams.delete("__path");
    const body = ["GET", "HEAD"].includes(req.method) ? Buffer.alloc(0) : await readBody(req);

    const event = {
      httpMethod: req.method,
      path,
      rawUrl: `https://${req.headers.host}${path}${url.search}`,
      headers: req.headers,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: body.length ? body.toString("utf-8") : null,
      isBase64Encoded: false,
    };

    try {
      const r = (await handler(event)) || {};
      res.statusCode = r.statusCode || 200;
      for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
      const out = r.body == null ? "" : r.body;
      res.end(r.isBase64Encoded ? Buffer.from(out, "base64") : out);
    } catch (e) {
      console.error("[adapter]", e?.message || e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
  };
}
