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

      const raw = event.body || "";
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

      // إعدادات العام الدراسي
      const setRes = await admin
        .from("settings").select("key, value").eq("key", "active_year").maybeSingle();
      const academicYear = setRes.data ? setRes.data.value : null;

      let saved = 0;
      let unmatched = 0;

      for (const line of lines) {
        // الصيغة: PIN <tab> DateTime <tab> Status <tab> Verify ...
        // ملاحظة: عمود DateTime (parts[1]) يُقرأ من سجل الوصول فقط
        // (لمعرفة أن السطر بصمة فعلية لا سطرًا فارغًا) — لا نستخدم
        // قيمته الزمنية إطلاقًا لأن ساعة الجهاز غير موثوقة، ونعتمد
        // بدلًا منها وقت استلام الخادم (riyadhNow) دائمًا.
        const parts = line.split("\t");
        if (parts.length < 2) continue;

        const uid = String(parts[0]).trim();
        const stampRaw = String(parts[1]).trim();
        if (!uid || !stampRaw) continue;

        const { attendDate, punchTime } = riyadhNow();

        // مطابقة الطالب برقمه على الجهاز.
        // القاعدة المعتمدة: device_uid = آخر ٩ خانات من رقم الهوية (والجهاز
        // لا يقبل أكثر من ٩ خانات، فهذا يناسبه). نطابق الرقم بعدة صور آمنة
        // (مطابقة تامة على أعمدة مفهرسة) لتفادي مشكلتين شائعتين:
        //   • الأصفار البادئة: بعض الأجهزة تحذفها (000064300 → 64300)،
        //     فنجرّب الرقم كما جاء، وبلا أصفار بادئة، ومكمّلًا لـ٩ بأصفار.
        //   • إدخال رقم الهوية كاملًا بدل آخر ٩ خانات (على جهاز يسمح بذلك).
        const variants = new Set([uid]);
        const bare = uid.replace(/^0+/, "");
        if (bare) { variants.add(bare); variants.add(bare.padStart(9, "0")); }
        const orExpr = [...variants]
          .flatMap((v) => [`device_uid.eq.${v}`, `national_id.eq.${v}`])
          .join(",");

        const stuRes = await admin
          .from("students")
          .select("id")
          .eq("is_active", true)
          .or(orExpr)
          .limit(1);

        const student = stuRes.data && stuRes.data[0];
        if (!student) {
          await admin.from("unmatched_logs").insert({
            device_uid: uid,
            punch_time: punchTime.toISOString(),
            device_serial: sn,
            resolved: false,
          });
          unmatched++;
          continue;
        }

        // أول بصمة في اليوم هي المعتمدة
        const existRes = await admin
          .from("daily_attendance")
          .select("id, punch_time")
          .eq("student_id", student.id)
          .eq("attend_date", attendDate)
          .maybeSingle();

        if (existRes.data) {
          // نحتفظ بالأبكر
          if (new Date(existRes.data.punch_time) > punchTime) {
            await admin.from("daily_attendance")
              .update({ punch_time: punchTime.toISOString(), device_serial: sn })
              .eq("id", existRes.data.id);
          }
        } else {
          await admin.from("daily_attendance").insert({
            student_id: student.id,
            attend_date: attendDate,
            punch_time: punchTime.toISOString(),
            source: "device",
            device_serial: sn,
            academic_year: academicYear,
          });
        }
        saved++;
      }

      // الجهاز يتوقع OK متبوعًا بعدد السجلات المستلمة
      return text(`OK: ${saved + unmatched}`);
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