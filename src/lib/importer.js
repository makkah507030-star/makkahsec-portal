/**
 * قراءة ملفات الاستيراد داخل المتصفح — الملف لا يُرفع لأي خادم.
 * القاعدة الحاكمة: لا نعتمد على موقع ثابت للعناوين ولا لترتيب الأعمدة.
 */
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/* التنظيف                                                             */
/* ------------------------------------------------------------------ */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** تحويل الأرقام العربية والفارسية إلى لاتينية */
export function toLatinDigits(v) {
  if (v == null) return "";
  return String(v).replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_DIGITS.indexOf(d);
    return i > -1 ? String(i) : String(FA_DIGITS.indexOf(d));
  });
}

/** إزالة المسافات الزائدة والمخفية */
export function cleanText(v) {
  if (v == null) return "";
  return String(v)
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "") // محارف اتجاه مخفية
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * تنظيف رقم الهوية — مفتوح الطول:
 * هوية وطنية / إقامة / رقم حدود / رقم مؤقت
 */
/** توحيد النص العربي: إزالة التشكيل وتوحيد الهمزات والتاء المربوطة */
export function normalizeArabic(v) {
  if (v == null) return "";
  return String(v)
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** حذف رقم الصف من نهاية اسم المادة: "الرياضيات 1" ← "الرياضيات" */
export function stripGradeSuffix(v) {
  return String(v ?? "").replace(/\s*[0-9\u0660-\u0669]+\s*$/, "").trim();
}

export function cleanIdentity(v) {
  const s = toLatinDigits(v).replace(/[^0-9A-Za-z]/g, "");
  if (!s) return "";
  return s;
}

/** توحيد الجوال إلى 966XXXXXXXXX */
export function cleanMobile(v) {
  let m = toLatinDigits(v).replace(/[^0-9]/g, "");
  if (!m) return "";
  if (m.startsWith("00966")) m = m.slice(2);
  if (m.length === 10 && m.startsWith("0")) m = "966" + m.slice(1);
  if (m.length === 9 && m.startsWith("5")) m = "966" + m;
  if (m.length === 12 && m.startsWith("966")) return m;
  return ""; // غير صالح
}

/* ------------------------------------------------------------------ */
/* قراءة الملف                                                         */
/* ------------------------------------------------------------------ */

/**
 * يقرأ أول ورقة تحتوي صف عناوين يطابق الأعمدة المطلوبة.
 * raw:false يجبر القراءة كنص، فلا يفسد Excel أرقام الهويات.
 */
export async function readSheet(file, requiredHeaders) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const headerIdx = findHeaderRow(grid, requiredHeaders);
    if (headerIdx === -1) continue;

    const headers = grid[headerIdx].map((h) => cleanText(h));
    const rows = [];

    for (let r = headerIdx + 1; r < grid.length; r++) {
      const raw = grid[r];
      if (!raw || raw.every((c) => cleanText(c) === "")) continue;

      const obj = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = raw[i] ?? "";
      });
      obj.__row = r + 1; // رقم الصف في الملف كما يراه المستخدم
      rows.push(obj);
    }

    return { sheetName: name, headers, rows };
  }

  throw new Error(
    `لم يُعثر على صف عناوين يحتوي: ${requiredHeaders.join(" ، ")}. ` +
      `تأكد أنك تستخدم القالب الموحّد.`
  );
}

function findHeaderRow(grid, requiredHeaders) {
  const limit = Math.min(grid.length, 30); // العناوين لا تكون بعد الصف 30
  for (let r = 0; r < limit; r++) {
    const cells = (grid[r] ?? []).map((c) => cleanText(c).toLowerCase());
    const ok = requiredHeaders.every((h) => cells.includes(h.toLowerCase()));
    if (ok) return r;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* تعريف الملفات المدعومة                                              */
/* ------------------------------------------------------------------ */

export const IMPORT_TYPES = {
  classes: {
    label: "الفصول",
    required: ["class_no", "grade", "track"],
    optional: [],
  },
  teachers: {
    label: "المعلمون",
    required: ["national_id", "teacher_name", "mobile"],
    optional: ["specialization"],
  },
  students: {
    label: "الطلاب وأولياء الأمور",
    required: [
      "national_id", "student_name", "grade", "class_no",
      "status", "guardian_name", "guardian_mobile",
    ],
    // guardian_id: نور لا يوفّره — الجوال هو المعرّف
    // identity_type: يُستنتج من أول رقم إن تُرك فارغًا
    optional: ["guardian_id", "identity_type", "relation", "birth_date", "nationality"],
  },
  schedule: {
    label: "الجدول الدراسي",
    required: ["teacher_id", "subject", "class_no", "day", "period"],
    optional: [],
  },
};

// الأحد = 1 … الخميس = 5
const DAY_MAP = {
  "الأحد": 1, "الاحد": 1, "الأحَد": 1,
  "الاثنين": 2, "الإثنين": 2, "الاثنين ": 2,
  "الثلاثاء": 3,
  "الأربعاء": 4, "الاربعاء": 4,
  "الخميس": 5,
};

// أقصى عدد حصص لكل يوم
const DAY_MAX_PERIODS = { 1: 7, 2: 7, 3: 6, 4: 6, 5: 6 };

const TRACK_MAP = {
  "السنة المشتركة": "common_year",
  "المسار العام": "general_track",
  common_year: "common_year",
  general_track: "general_track",
};

const IDENTITY_MAP = {
  "هوية": "national", "هوية وطنية": "national",
  "إقامة": "iqama", "اقامة": "iqama",
  "حدود": "border", "رقم حدود": "border",
  "مؤقت": "temporary", "رقم مؤقت": "temporary",
};

/**
 * استنتاج نوع الهوية من أول رقم حين لا يُذكر صراحة.
 * 1 = هوية وطنية | 2 = إقامة | غير ذلك = مؤقت (يُراجَع يدويًا)
 */
export function guessIdentityType(nid) {
  const s = String(nid ?? "");
  if (!s) return "temporary";
  if (s.startsWith("1")) return "national";
  if (s.startsWith("2")) return "iqama";
  return "temporary";
}

const STATUS_MAP = {
  "مستمر": "active", "منقول": "transferred", "منقطع": "withdrawn",
};

/* ------------------------------------------------------------------ */
/* التحقق من الصفوف                                                    */
/* ------------------------------------------------------------------ */

/**
 * يعيد { valid, rejected } — كل صف مرفوض يحمل سبب رفضه.
 * يكشف أيضًا التكرار داخل الملف نفسه.
 */
export function validateRows(type, rows) {
  const valid = [];
  const rejected = [];
  const seen = new Map();

  for (const row of rows) {
    const errors = [];
    let out = { __row: row.__row };

    if (type === "classes") {
      const no = parseInt(toLatinDigits(row.class_no), 10);
      const grade = parseInt(toLatinDigits(row.grade), 10);
      const track = TRACK_MAP[cleanText(row.track)];

      if (!Number.isInteger(no) || no < 1) errors.push("رقم الفصل غير صالح");
      if (![1, 2, 3].includes(grade)) errors.push("الصف يجب أن يكون 1 أو 2 أو 3");
      if (!track) errors.push("المسار غير معروف");

      out = { ...out, class_no: no, grade, track };
      dedupe(seen, String(no), row.__row, errors, "رقم الفصل مكرر في الملف");
    }

    if (type === "teachers") {
      const nid = cleanIdentity(row.national_id);
      const name = cleanText(row.teacher_name);
      const mobile = cleanMobile(row.mobile);

      if (!nid) errors.push("رقم الهوية مفقود أو غير صالح");
      if (!name) errors.push("اسم المعلم مفقود");
      if (row.mobile && !mobile) errors.push("رقم الجوال غير صالح");

      out = {
        ...out,
        national_id: nid,
        full_name: name,
        mobile: mobile || null,
        specialization: cleanText(row.specialization) || null,
      };
      dedupe(seen, nid, row.__row, errors, "رقم الهوية مكرر في الملف");
    }

    if (type === "students") {
      const nid = cleanIdentity(row.national_id);
      // النوع اختياري: يُستنتج من أول رقم — 1 هوية وطنية، 2 إقامة
      const idType =
        IDENTITY_MAP[cleanText(row.identity_type)] ?? guessIdentityType(nid);
      const name = cleanText(row.student_name);
      const grade = parseInt(toLatinDigits(row.grade), 10);
      const classNo = parseInt(toLatinDigits(row.class_no), 10);
      const status = STATUS_MAP[cleanText(row.status)];
      const gid = cleanIdentity(row.guardian_id);
      const gname = cleanText(row.guardian_name);
      const gmobile = cleanMobile(row.guardian_mobile);

      if (!nid) errors.push("رقم هوية الطالب مفقود أو غير صالح");
      if (!name) errors.push("اسم الطالب مفقود");
      if (![1, 2, 3].includes(grade)) errors.push("الصف غير صالح");
      if (!Number.isInteger(classNo)) errors.push("رقم الفصل غير صالح");
      if (!status) errors.push("حالة القيد غير معروفة");
      if (!gname) errors.push("اسم ولي الأمر مفقود");
      if (!gmobile) errors.push("جوال ولي الأمر غير صالح");

      out = {
        ...out,
        national_id: nid,
        identity_type: idType,
        full_name: name,
        grade,
        class_no: classNo,
        status,
        guardian_id: gid || null,
        guardian_name: gname,
        guardian_mobile: gmobile,
        relation: cleanText(row.relation) || null,
        birth_date: cleanText(row.birth_date) || null,
        nationality: cleanText(row.nationality) || null,
      };
      dedupe(seen, nid, row.__row, errors, "رقم هوية الطالب مكرر في الملف");
    }

    if (type === "schedule") {
      const tid = cleanIdentity(row.teacher_id);
      const subject = cleanText(row.subject);
      const classNo = parseInt(toLatinDigits(row.class_no), 10);
      const day = DAY_MAP[cleanText(row.day)];
      const period = parseInt(toLatinDigits(row.period), 10);

      if (!tid) errors.push("رقم هوية المعلم مفقود");
      if (!subject) errors.push("اسم المادة مفقود");
      if (!Number.isInteger(classNo)) errors.push("رقم الفصل غير صالح");
      if (!day) errors.push("اليوم غير معروف (الأحد إلى الخميس)");
      if (!Number.isInteger(period) || period < 1) {
        errors.push("رقم الحصة غير صالح");
      } else if (day && period > DAY_MAX_PERIODS[day]) {
        errors.push(
          `يوم ${cleanText(row.day)} فيه ${DAY_MAX_PERIODS[day]} حصص فقط`
        );
      }

      out = { ...out, teacher_nid: tid, subject_name: subject,
              class_no: classNo, day_of_week: day, period_no: period };

      // تعارض داخل الملف: نفس الفصل في نفس اليوم والحصة
      dedupe(seen, `C${classNo}|${day}|${period}`, row.__row, errors,
             "تعارض: الفصل له حصة أخرى في نفس الوقت");
      // تعارض المعلم: في فصلين بنفس الوقت
      dedupe(seen, `T${tid}|${day}|${period}`, row.__row, errors,
             "تعارض: المعلم لديه حصة أخرى في نفس الوقت");
    }

    if (errors.length) rejected.push({ ...out, __errors: errors });
    else valid.push(out);
  }

  return { valid, rejected };
}

function dedupe(seen, key, rowNo, errors, msg) {
  if (!key) return;
  if (seen.has(key)) errors.push(`${msg} (الصف ${seen.get(key)})`);
  else seen.set(key, rowNo);
}


/* ------------------------------------------------------------------ */
/* قراءة ملف "الجدول الذكي"                                            */
/* ------------------------------------------------------------------ */

/**
 * بنية الملف:
 *  - Courses : row_id | classroom_name | name | teacher_name | odd_classes
 *  - Cells   : classroom_name | cell_number | course_row_id | activate
 *  - Workdays: per_day_classes  (مثال: {"1":7,"2":7,"3":6,"4":6,"5":6})
 *
 * cell_number من 0 إلى 34  →  اليوم = (cell / 7) + 1 ، الحصة = (cell % 7) + 1
 * الأحد = 1 … الخميس = 5
 */
export async function readSmartSchedule(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", raw: false });

  const need = ["Courses", "Cells"];
  for (const n of need) {
    if (!wb.SheetNames.includes(n)) {
      throw new Error(
        `هذا ليس ملف الجدول الذكي — الورقة "${n}" غير موجودة. ` +
          `صدّر الملف من الجدول الذكي بصيغة xlsx.`
      );
    }
  }

  const sheet = (n) =>
    XLSX.utils.sheet_to_json(wb.Sheets[n], { raw: false, defval: "" });

  // عدد الحصص لكل يوم
  let perDay = { 1: 7, 2: 7, 3: 6, 4: 6, 5: 6 };
  if (wb.SheetNames.includes("Workdays")) {
    const wd = sheet("Workdays")[0];
    try {
      const parsed = JSON.parse(wd?.per_day_classes ?? "{}");
      if (Object.keys(parsed).length) {
        perDay = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [Number(k), Number(v)])
        );
      }
    } catch {
      /* نُبقي الافتراضي */
    }
  }
  const slots = Math.max(...Object.values(perDay));

  // المقررات
  const courses = new Map();
  for (const c of sheet("Courses")) {
    const id = cleanText(c.row_id);
    if (!id) continue;
    courses.set(id, {
      classNo: parseInt(toLatinDigits(c.classroom_name), 10),
      subject: cleanText(c.name),
      teacher: cleanText(c.teacher_name),
    });
  }

  // الخلايا المفعّلة
  const out = [];
  let rowNo = 1;
  for (const cell of sheet("Cells")) {
    rowNo++;
    if (cleanText(cell.activate) !== "1") continue;

    const course = courses.get(cleanText(cell.course_row_id));
    if (!course) continue;

    const n = parseInt(toLatinDigits(cell.cell_number), 10);
    if (!Number.isInteger(n)) continue;

    const day = Math.floor(n / slots) + 1;
    const period = (n % slots) + 1;
    if (day < 1 || day > 5) continue;
    if (period > (perDay[day] ?? slots)) continue;

    out.push({
      __row: rowNo,
      class_no: course.classNo,
      subject_name: course.subject,
      teacher_name: course.teacher,
      day_of_week: day,
      period_no: period,
    });
  }

  if (!out.length) {
    throw new Error("لم يُعثر على أي حصة مفعّلة في الملف.");
  }
  return out;
}
