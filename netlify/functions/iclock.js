// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  Netlify Function: iclock  — نقطة استقبال أجهزة البصمة (ZKTeco ADMS)
//
//  الجهاز يتصل بالمسارات التالية:
//    GET  /iclock/cdata?SN=...&options=all      → المصافحة وإعدادات الجهاز
//    POST /iclock/cdata?SN=...&table=ATTLOG     → سجلات البصمات
//    GET  /iclock/getrequest?SN=...             → استعلام عن أوامر
//    GET  /iclock/rtdata?SN=...&type=time       → طلب الوقت (نردّ OK فقط — انظر أدناه)
//    POST /iclock/devicecmd?SN=...              → نتيجة تنفيذ أمر
//
//  الردود نص عادي (text/plain) بصيغة يفهمها الجهاز.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// فرق التوقيت: أجهزة ZKTeco ترسل وقتًا محليًا بلا منطقة زمنية
const TZ_OFFSET = "+03:00"; // توقيت السعودية

// ترويسة Date تُرسل مع كل رد: بعض إصدارات ZKTeco تضبط ساعتها منها مباشرة
const text = (body, status = 200) => ({
  statusCode: status,
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    Date: new Date().toUTCString(),
  },
  body: String(body),
});

// كل كم دقيقة تُعاد مزامنة ساعة الجهاز حتى لو لم يُعد تشغيله
const RESYNC_MINUTES = 60;

/**
 * أمر ضبط ساعة الجهاز بتوقيت الرياض (بروتوكول ZKTeco ADMS).
 *
 * الجهاز بلا بطارية ساعة، فيعود لتاريخ خاطئ بعد كل انقطاع كهرباء ويرفض
 * البصمات على شاشته برسالة خطأ في التوقيت. لذا يرسل الخادم ساعته الصحيحة
 * للجهاز بعد كل تشغيل، ثم كل ساعة.
 * صيغة القيمة المعتمدة عند ZKTeco: ثوانٍ مرمّزة منذ 2000 بشهور من 31 يومًا.
 */
function setClockCommand() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, Number(x.value)]));
  const hour = p.hour % 24; // بعض المتصفحات تعيد 24 لمنتصف الليل
  const encoded =
    ((p.year - 2000) * 12 * 31 + (p.month - 1) * 31 + (p.day - 1)) * 86400 +
    (hour * 60 + p.minute) * 60 + p.second;
  const id = Math.floor(Date.now() / 1000) % 100000000;
  return `C:${id}:SET OPTIONS DateTime=${encoded}`;
}

/**
 * وقت استلام الخادم بتوقيت الرياض — لا نعتمد على ساعة الجهاز نفسه.
 *
 * سبب هذا القرار: جهاز البصمة الحالي بلا بطارية داخلية (RTC)، فتُعاد
 * ساعته تلقائيًا لتاريخ افتراضي خاطئ (غالبًا سنة 2000) عند كل انقطاع
 * كهرباء — وهذا يحدث يوميًا في هذه المدرسة (الجهاز يُطفأ آخر اليوم).
 * فبدل رفض كل البصمات بسبب "فترة زمنية غير صالحة"، نعتمد لحظة وصول
 * الطلب لخادمنا، إلا إذا كان تاريخ الجهاز هو اليوم (ساعته مضبوطة من الخادم).
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
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  return { attendDate, punchTime, minutes };
}

/**
 * سجل تشخيصي لاتصالات الأجهزة في جدول device_requests — يُقرأ من Supabase
 * بلا حاجة لسجلات Netlify. لا يُسجَّل الاستعلام الدوري عن الأوامر حين لا
 * يوجد أمر (كل دقيقة لكل جهاز)، ويُحذف ما مضى عليه أسبوع عند كل مصافحة.
 * أي خطأ في التسجيل يُتجاهل كي لا يتعطل استقبال البصمات.
 */
export const handler = async (event) => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const res = await handle(event, admin);
  try {
    const params = event.queryStringParameters || {};
    const path = (event.path || "").toLowerCase();
    const quiet = path.includes("/getrequest") && res.body === "OK";
    if (!quiet) {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf-8")
        : (event.body || "");
      await admin.from("device_requests").insert({
        serial_no: (params.SN || params.sn || "").trim() || null,
        method: event.httpMethod,
        path,
        query: new URLSearchParams(params).toString().slice(0, 500),
        body_lines: raw ? raw.split("\n").filter((l) => l.trim()).length : 0,
        body_head: raw.slice(0, 500) || null,
        status: res.statusCode,
        reply: String(res.body).slice(0, 300),
      });
      if (path.includes("/cdata") && event.httpMethod === "GET") {
        await admin.from("device_requests").delete()
          .lt("at", new Date(Date.now() - 7 * 86400000).toISOString());
      }
    }
  } catch (e) {
    console.error("iclock: request log failed:", e);
  }
  return res;
};

async function handle(event, admin) {

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
      .select("*") // «*» كي لا يتعطل الجهاز إن لم يُضف عمود time_synced_at بعد
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
      // المصافحة تعني أن الجهاز شُغّل للتو (وساعته غالبًا خاطئة):
      // نمسح وقت آخر مزامنة ليُضبط وقته في أول استعلام عن الأوامر
      await admin.from("devices").update({ time_synced_at: null }).eq("serial_no", sn);
      // الجهاز يتوقع إعداداته في الرد
      const reply = [
        `GET OPTION FROM: ${sn}`,
        "Stamp=9999",
        "OpStamp=9999",
        "ErrorDelay=60",
        "Delay=60",
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
      // وقت البصمة: وقت الجهاز إن كان تاريخه اليوم ووقته معقولًا (ساعته
      // مضبوطة من الخادم)، وإلا وقت استلام الخادم. هذا يحفظ الوقت الصحيح
      // حين يرسل الجهاز بصمات متأخرة (انقطاع اتصال أو إعادة إرسال سجله).
      const { attendDate, punchTime } = riyadhNow();
      const serverMs = punchTime.getTime();
      const rawUids = [];
      const timeByUid = new Map(); // رقم المستخدم → أبكر وقت بصمة (ms)
      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length < 2) continue;
        const uid = String(parts[0]).trim();
        if (!uid) continue;
        rawUids.push(uid);
        let ms = serverMs;
        const dt = String(parts[1]).trim();
        if (dt.startsWith(attendDate)) {
          const dev = new Date(dt.replace(" ", "T") + TZ_OFFSET).getTime();
          if (!isNaN(dev) && dev <= serverMs + 2 * 60000 && dev >= serverMs - 12 * 3600000) ms = dev;
        }
        if (!timeByUid.has(uid) || ms < timeByUid.get(uid)) timeByUid.set(uid, ms);
      }

      // لا بصمات صالحة — نؤكّد الاستلام فورًا كي لا يعيد الجهاز الإرسال
      if (!rawUids.length) return text("OK: 0");

      const riyadhMin = (ms) => {
        const d = new Date(ms + 3 * 3600000);
        return d.getUTCHours() * 60 + d.getUTCMinutes();
      };

      // إعدادات العام الدراسي والتوقيت المفعّل (استعلام واحد)
      const { data: setRows } = await admin
        .from("settings").select("key, value").in("key", ["active_year", "active_season"]);
      const setting = Object.fromEntries((setRows || []).map((r) => [r.key, r.value]));
      const academicYear = setting.active_year ?? null;

      // البصمة تتوقف عن التسجيل مع بداية الحصة الأولى: ما بعدها لا يُسجَّل،
      // ومن لم يبصم وحضر الحصص يُحسب في التقارير متأخرًا بلا وقت.
      // نردّ OK كي لا يعيد الجهاز إرسال الدفعة.
      const { data: p1 } = await admin
        .from("period_times").select("start_time")
        .eq("season", setting.active_season ?? "summer").eq("kind", "period").eq("period_no", 1)
        .maybeSingle();
      // الإغلاق يُقاس بوقت البصمة نفسها، فالبصمة الصباحية التي تصل متأخرة تُقبل
      if (p1?.start_time) {
        const [h, m] = String(p1.start_time).split(":").map(Number);
        const closeMin = h * 60 + (m || 0);
        for (const [uid, ms] of timeByUid) if (riyadhMin(ms) >= closeMin) timeByUid.delete(uid);
        if (!timeByUid.size) {
          console.log(`iclock: ${rawUids.length} punches ignored after period 1 start (${p1.start_time})`);
          return text(`OK: ${rawUids.length}`);
        }
      }

      // صور الرقم الآمنة (الأصفار البادئة / الهوية الكاملة)
      const variantsOf = (uid) => {
        const s = new Set([uid]);
        const bare = uid.replace(/^0+/, "");
        if (bare) { s.add(bare); s.add(bare.padStart(9, "0")); }
        return [...s];
      };

      const uniqUids = [...timeByUid.keys()];
      const allVariants = [...new Set(uniqUids.flatMap(variantsOf))];

      const chunk = (arr, n) => {
        const out = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };

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
      const timeBySid = new Map();
      const unmatchedUids = [];
      for (const uid of uniqUids) {
        const sid = resolve(uid);
        if (sid) {
          studentIds.add(sid);
          const ms = timeByUid.get(uid);
          if (!timeBySid.has(sid) || ms < timeBySid.get(sid)) timeBySid.set(sid, ms);
        } else unmatchedUids.push(uid);
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
          punch_time: new Date(timeBySid.get(id)).toISOString(),
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
          punch_time: new Date(timeByUid.get(u)).toISOString(),
          device_serial: sn,
          resolved: false,
        }));
        await admin.from("unmatched_logs").insert(rows);
      }

      // الجهاز يتوقع OK متبوعًا بعدد السجلات المستلمة — نردّه فورًا
      return text(`OK: ${rawUids.length}`);
    }

    // ---------- طلب الوقت من الجهاز (rtdata) ----------
    // لا نردّ بالوقت هنا: أجهزة المدرسة (CGDQ…) تقرأ الرقم بصيغة ZKTeco المرمّزة لا
    // بثواني 1970، فيصير تاريخها 2055 وترفض البصمات «الفترة الزمنية غير صالحة».
    // ضبط الساعة يكفيه أمر SET OPTIONS DateTime الذي تقبله كل الأجهزة (Return=0).
    if (path.includes("/rtdata")) {
      return text("OK");
    }

    // ---------- 3) استعلام الجهاز عن الأوامر ----------
    if (path.includes("/getrequest")) {
      let needSync;
      if ("time_synced_at" in device) {
        const last = device.time_synced_at ? new Date(device.time_synced_at).getTime() : 0;
        needSync = Date.now() - last > RESYNC_MINUTES * 60 * 1000;
      } else {
        // العمود غير موجود بعد: نضبط الساعة كل عشر دقائق تقريبًا
        needSync = new Date().getUTCMinutes() % 10 === 0;
      }
      if (needSync) {
        await admin.from("devices")
          .update({ time_synced_at: new Date().toISOString() })
          .eq("serial_no", sn);
        const cmd = setClockCommand();
        console.log(`iclock: clock sync sent to ${sn} → ${cmd}`);
        return text(cmd);
      }
      return text("OK");
    }

    // ---------- 4) نتيجة تنفيذ أمر ----------
    if (path.includes("/devicecmd")) {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf-8")
        : (event.body || "");
      console.log(`iclock: devicecmd result from ${sn}: ${raw.slice(0, 200)}`);
      return text("OK");
    }

    return text("OK");
  } catch (e) {
    console.error("iclock error:", e);
    return text("ERROR: " + String(e), 500);
  }
}
