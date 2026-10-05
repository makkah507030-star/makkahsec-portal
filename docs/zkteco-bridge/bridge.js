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
  const stamp = new Date().toLocaleString("en-GB", { hour12: true });
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

    log(`Received ${req.method} ${req.url} from ${req.socket.remoteAddress} (${body.length} bytes)`);

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
          log(`Server replied: ${forwardRes.statusCode} - ${respBody.toString("utf8").slice(0, 120)}`);

          res.writeHead(forwardRes.statusCode, forwardRes.headers);
          res.end(respBody);
        });
      }
    );

    forwardReq.on("error", (err) => {
      log("WARNING: could not reach the server:", err.message);
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ERROR: bridge could not reach makkahsec.com");
    });

    forwardReq.write(body);
    forwardReq.end();
  });
});

server.listen(LOCAL_PORT, "0.0.0.0", () => {
  log("=".repeat(60));
  log("ZKTeco fingerprint bridge is RUNNING");
  log(`Listening on port: ${LOCAL_PORT}`);
  log(`Forwarding data to: https://${TARGET_HOST}`);
  log("Set every fingerprint device to this computer IP address + the port above");
  log("Do NOT close this window during the morning fingerprint period");
  log("=".repeat(60));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    log(`WARNING: port ${LOCAL_PORT} is used by another program. Close it or change LOCAL_PORT at the top of the file.`);
  } else {
    log("WARNING: bridge failed to start:", err.message);
  }
  process.exit(1);
});
