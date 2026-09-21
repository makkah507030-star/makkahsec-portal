// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  Netlify Function: iclock  — نقطة استقبال أجهزة البصمة (ZKTeco ADMS)
//
//  الجهاز يتصل بالمسارات التالية:
//    GET  /iclock/cdata?SN=...&options=all      → المصافحة وإعدادات الجهاز
//    POST /iclock/cdata?SN=...&table=ATTLOG     → سجلات البصمات
//    GET  /iclock/getrequest?SN=...             → استعلام عن أوامر
//    POST /iclock/devicecmd?SN=...              → نتيجة تنفيذ أمر
//
//  الردود نص عادي (text/plain) بصيغة يفهمها الجهاز.
// =====================================================================

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// فرق التوقيت: أجهزة ZKTeco ترسل وقتًا محليًا بلا منطقة زمنية
const TZ_OFFSET = "+03:00"; // توقيت السعودية

const text = (body, status = 200) => ({
  statusCode: status,
  headers: { "Content-Type": "text/plain; charset=utf-8" },
  body: String(body),
});

/**
 * وقت استلام الخادم بتوقيت الرياض — لا نعتمد على ساعة الجهاز نفسه.
 *
 * سبب هذا القرار: جهاز البصمة الحالي بلا بطارية داخلية (RTC)، فتُعاد
 * ساعته تلقائيًا لتاريخ افتراضي خاطئ (غالبًا سنة 2000) عند كل انقطاع
 * كهرباء — وهذا يحدث يوميًا في هذه المدرسة (الجهاز يُطفأ آخر اليوم).
 * فبدل رفض كل البصمات بسبب "فترة زمنية غير صالحة"، نتجاهل الطابع
 * الزمني الذي يرسله الجهاز تمامًا، ونعتمد فقط على لحظة وصول الطلب
 * لخادمنا — وهي دقيقة دائمًا بغض النظر عن حالة الجهاز.
 */
function riyadhNow() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const attendDate = `${parts.year}-${parts.month}-${parts.day}`;
  const punchTime = new Date(
    `${attendDate}T${parts.hour}:${parts.minute}:${parts.second}${TZ_OFFSET}`
  );
  return { attendDate, punchTime };
}

exports.handler = async (event) => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const params = event.queryStringParameters || {};
  const sn = (params.SN || params.sn || "").trim();
  const path = (event.path || "").toLowerCase();

  // كل طلب بلا رقم تسلسلي يُرفض
  if (!sn) return text("ERROR: missing SN", 400);

  // تسجيل تشخيصي — يظهر في Netlify Logs، يفيد عند أي التباس مستقبلي
  console.log(`iclock: SN received = "${sn}" (length: ${sn.length}) | path=${path}`);

  try {
    // ---------- التحقق أن الجهاز مسجّل ومفعّل ----------
    const devRes = await admin
      .from("devices")
      .select("serial_no, is_active")
      .eq("serial_no", sn)
      .maybeSingle();

    // فشل الاستعلام نفسه (اتصال بقاعدة البيانات، صلاحية، إلخ) —
    // هذا مختلف تمامًا عن "الجهاز غير موجود"، ويجب ألا يُعامَل كذلك
    if (devRes.error) {
      console.error("iclock: device lookup failed:", devRes.error);
      return text("ERROR: database lookup failed — " + devRes.error.message, 500);
    }

    const device = devRes.data;
    if (!device) {
      // جهاز غير معروف: نسجّله معطّلاً ليضيفه المسؤول يدويًا
      await admin.from("devices").insert({
        serial_no: sn,
        label: "جهاز غير معرّف",
        is_active: false,
        last_seen: new Date().toISOString(),
      });
      return text("ERROR: device not registered", 403);
    }

    if (device.is_active === false) {
      await admin.from("devices").update({ last_seen: new Date().toISOString() })
        .eq("serial_no", sn);
      return text("ERROR: device disabled", 403);
    }

    // تحديث آخر اتصال
    await admin.from("devices")
      .update({ last_seen: new Date().toISOString() })
      .eq("serial_no", sn);

    // ---------- 1) المصافحة ----------
    if (path.includes("/cdata") && event.httpMethod === "GET") {
      // الجهاز يتوقع إعداداته في الرد
      const reply = [
        `GET OPTION FROM: ${sn}`,
        "Stamp=9999",
        "OpStamp=9999",
        "ErrorDelay=30",
        "Delay=10",
        "TransTimes=00:00;14:00",
        "TransInterval=1",
        "TransFlag=1000000000",
        "TimeZone=3",
        "Realtime=1",
        "Encrypt=0",
      ].join("\n");
      return text(reply);
    }

    // ---------- 2) استقبال سجلات البصمات ----------
    if (path.includes("/cdata") && event.httpMethod === "POST") {
      const table = (params.table || "").toUpperCase();

      // جداول أخرى (OPERLOG وغيرها) نؤكد استلامها فقط
      if (table && table !== "ATTLOG") {
        return text("OK");
      }

      // Netlify قد يمرّر الجسم مُرمّزًا base64 — نفكّه عند اللزوم
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf-8")
        : (event.body || "");
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

      // ==========================================================
      //  معالجة دُفعية (Bulk) — حاسمة للأداء:
      //  الجهاز يرسل الدفعة كاملة (قد تصل لمئات البصمات) ويتوقّع ردّ
      //  OK خلال ثوانٍ قليلة؛ وإلا اعتبرها فشلت وأعاد إرسال نفس الدفعة
      //  بلا نهاية (حلقة 504). لذلك نستبدل الاستعلامات المتسلسلة لكل
      //  سطر (٣ لكل بصمة = مئات الجولات) بعددٍ ثابت من الاستعلامات
      //  الدُفعية (٣–٤ فقط) مهما كان حجم الدفعة.
      // ==========================================================

      // صيغة السطر: PIN <tab> DateTime <tab> Status <tab> Verify ...
      // نقرأ العمود الأول (رقم المستخدم) فقط؛ طابع الجهاز الزمني يُتجاهل
      // (ساعته غير موثوقة) ونعتمد وقت استلام الخادم.
      const rawUids = [];
      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length < 2) continue;
        const uid = String(parts[0]).trim();
        if (uid) rawUids.push(uid);
      }

      // لا بصمات صالحة — نؤكّد الاستلام فورًا كي لا يعيد الجهاز الإرسال
      if (!rawUids.length) return text("OK: 0");

      const { attendDate, punchTime } = riyadhNow();
      const punchIso = punchTime.toISOString();

      // صور الرقم الآمنة (الأصفار البادئة / الهوية الكاملة)
      const variantsOf = (uid) => {
        const s = new Set([uid]);
        const bare = uid.replace(/^0+/, "");
        if (bare) { s.add(bare); s.add(bare.padStart(9, "0")); }
        return [...s];
      };

      const uniqUids = [...new Set(rawUids)];
      const allVariants = [...new Set(uniqUids.flatMap(variantsOf))];

      const chunk = (arr, n) => {
        const out = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };

      // إعدادات العام الدراسي (استعلام واحد)
      const setRes = await admin
        .from("settings").select("value").eq("key", "active_year").maybeSingle();
      const academicYear = setRes.data ? setRes.data.value : null;

      // (1) جلب كل الطلاب المطابقين دفعةً واحدة — مقسّم لدُفَع آمنة الطول
      const byKey = new Map(); // كل صورة رقم → معرّف الطالب
      for (const part of chunk(allVariants, 150)) {
        const list = part.join(",");
        const { data: studs, error: stuErr } = await admin
          .from("students")
          .select("id, device_uid, national_id")
          .eq("is_active", true)
          .or(`device_uid.in.(${list}),national_id.in.(${list})`);
        if (stuErr) {
          console.error("iclock: students bulk lookup failed:", stuErr);
          return text("ERROR: student lookup failed — " + stuErr.message, 500);
        }
        (studs || []).forEach((s) => {
          if (s.device_uid != null) byKey.set(String(s.device_uid), s.id);
          if (s.national_id != null) byKey.set(String(s.national_id), s.id);
        });
      }

      const resolve = (uid) => {
        for (const v of variantsOf(uid)) if (byKey.has(v)) return byKey.get(v);
        return null;
      };

      const studentIds = new Set();
      const unmatchedUids = [];
      for (const uid of uniqUids) {
        const sid = resolve(uid);
        if (sid) studentIds.add(sid);
        else unmatchedUids.push(uid);
      }

      // (2) البصمات الموجودة اليوم لهؤلاء الطلاب (أول بصمة هي المعتمدة)
      const existing = new Set();
      for (const part of chunk([...studentIds], 200)) {
        const { data: ex } = await admin
          .from("daily_attendance")
          .select("student_id")
          .eq("attend_date", attendDate)
          .in("student_id", part);
        (ex || []).forEach((r) => existing.add(r.student_id));
      }

      // (3) إدراج البصمات الجديدة دفعةً واحدة
      const toInsert = [...studentIds]
        .filter((id) => !existing.has(id))
        .map((id) => ({
          student_id: id,
          attend_date: attendDate,
          punch_time: punchIso,
          source: "device",
          device_serial: sn,
          academic_year: academicYear,
        }));
      if (toInsert.length) {
        const { error: insErr } = await admin.from("daily_attendance").insert(toInsert);
        if (insErr) console.error("iclock: attendance bulk insert failed:", insErr);
      }

      // (4) الأرقام غير المطابقة — للمراجعة (دفعة واحدة، بلا تكرار)
      if (unmatchedUids.length) {
        const rows = [...new Set(unmatchedUids)].map((u) => ({
          device_uid: u,
          punch_time: punchIso,
          device_serial: sn,
          resolved: false,
        }));
        await admin.from("unmatched_logs").insert(rows);
      }

      // الجهاز يتوقع OK متبوعًا بعدد السجلات المستلمة — نردّه فورًا
      return text(`OK: ${rawUids.length}`);
    }

    // ---------- 3) استعلام الجهاز عن الأوامر ----------
    if (path.includes("/getrequest")) {
      return text("OK");
    }

    // ---------- 4) نتيجة تنفيذ أمر ----------
    if (path.includes("/devicecmd")) {
      return text("OK");
    }

    return text("OK");
  } catch (e) {
    console.error("iclock error:", e);
    return text("ERROR: " + String(e), 500);
  }
};
