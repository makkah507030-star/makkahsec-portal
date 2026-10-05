/**
 * وسيط بصمة ZKTeco — بوابة مكة الثانوية الرقمية
 * ==================================================
 *
 * الغرض:
 *   بعض أجهزة البصمة القديمة لا تدعم HTTPS، بينما موقعنا
 *   (makkahsec.com عبر Netlify) يتطلبه إلزاميًا.
 *
 *   هذا البرنامج يعمل كوسيط: يستقبل من الأجهزة عبر HTTP
 *   العادي (كما اعتادت)، ثم يمرّر البيانات فورًا إلى
 *   makkahsec.com عبر HTTPS من جهة هذا الحاسوب.
 *
 * التشغيل:
 *   1) ثبّت الاعتماديات مرة واحدة:   npm install
 *   2) شغّل الوسيط:                  npm start
 *   3) اضبط كل جهاز بصمة على:
 *        عنوان مركز الخدمة = عنوان IP هذا الحاسوب
 *        المنفذ            = 8090   (أو كما هو مضبوط أدناه)
 *        تفعيل اسم Domain  = OFF
 *        تفعيل بروكسي      = OFF
 *
 * ملاحظة: هذا الحاسوب يجب أن يبقى يعمل ومتصلًا بالإنترنت
 *         خلال فترة البصمة الصباحية.
 * ==================================================
 */

const http = require("http");
const https = require("https");

// ---------------------------------------------------------
// الإعدادات — لا حاجة لتعديل شيء عادةً
// ---------------------------------------------------------
const LOCAL_PORT = 8090;                 // المنفذ الذي تستمع عليه الأجهزة محليًا
const TARGET_HOST = "makkahsec.com";     // خادم البوابة (HTTPS)
const TARGET_PORT = 443;

// ---------------------------------------------------------
// السجل — لمتابعة ما يحدث لحظيًا في نافذة الطرفية
// ---------------------------------------------------------
function log(...args) {
  const stamp = new Date().toLocaleString("ar-SA", { hour12: true });
  console.log(`[${stamp}]`, ...args);
}

// ---------------------------------------------------------
// الخادم المحلي — يستقبل من الأجهزة
// ---------------------------------------------------------
const server = http.createServer((req, res) => {
  const chunks = [];

  req.on("data", (c) => chunks.push(c));

  req.on("end", () => {
    const body = Buffer.concat(chunks);

    log(`استقبال ${req.method} ${req.url} من ${req.socket.remoteAddress} (${body.length} بايت)`);

    // تمرير الطلب كما هو إلى makkahsec.com عبر HTTPS
    const forwardHeaders = { ...req.headers };
    forwardHeaders.host = TARGET_HOST;

    const forwardReq = https.request(
      {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: req.url,
        method: req.method,
        headers: forwardHeaders,
      },
      (forwardRes) => {
        const respChunks = [];
        forwardRes.on("data", (c) => respChunks.push(c));
        forwardRes.on("end", () => {
          const respBody = Buffer.concat(respChunks);
          log(`رد من الخادم: ${forwardRes.statusCode} — ${respBody.toString("utf8").slice(0, 120)}`);

          res.writeHead(forwardRes.statusCode, forwardRes.headers);
          res.end(respBody);
        });
      }
    );

    forwardReq.on("error", (err) => {
      log("⚠ تعذّر الاتصال بالخادم:", err.message);
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ERROR: bridge could not reach makkahsec.com");
    });

    forwardReq.write(body);
    forwardReq.end();
  });
});

server.listen(LOCAL_PORT, "0.0.0.0", () => {
  log("=".repeat(60));
  log("وسيط بصمة ZKTeco يعمل الآن ✅");
  log(`يستمع على المنفذ: ${LOCAL_PORT}`);
  log(`يمرّر البيانات إلى: https://${TARGET_HOST}`);
  log("اضبط كل جهاز بصمة على عنوان IP هذا الحاسوب + المنفذ أعلاه");
  log("لا تغلق هذه النافذة أثناء فترة البصمة الصباحية");
  log("=".repeat(60));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    log(`⚠ المنفذ ${LOCAL_PORT} مستخدم من برنامج آخر. أغلقه أو غيّر LOCAL_PORT أعلى الملف.`);
  } else {
    log("⚠ خطأ في تشغيل الوسيط:", err.message);
  }
  process.exit(1);
});
