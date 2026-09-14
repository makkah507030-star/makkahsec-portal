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

exports.handler = async (event) => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const params = event.queryStringParameters || {};
  const sn = (params.SN || params.sn || "").trim();
  const path = (event.path || "").toLowerCase();

  // كل طلب بلا رقم تسلسلي يُرفض
  if (!sn) return text("ERROR: missing SN", 400);

  try {
    // ---------- التحقق أن الجهاز مسجّل ومفعّل ----------
    const devRes = await admin
      .from("devices")
      .select("serial_no, is_active")
      .eq("serial_no", sn)
      .maybeSingle();

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
        const parts = line.split("\t");
        if (parts.length < 2) continue;

        const uid = String(parts[0]).trim();
        const stamp = String(parts[1]).trim(); // 2026-09-14 07:12:33
        if (!uid || !stamp) continue;

        const punchTime = new Date(stamp.replace(" ", "T") + TZ_OFFSET);
        if (isNaN(punchTime.getTime())) continue;

        const attendDate = stamp.slice(0, 10);

        // مطابقة الطالب برقمه في الجهاز
        const stuRes = await admin
          .from("students")
          .select("id")
          .eq("device_uid", uid)
          .eq("is_active", true)
          .maybeSingle();

        if (!stuRes.data) {
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
          .eq("student_id", stuRes.data.id)
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
            student_id: stuRes.data.id,
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
