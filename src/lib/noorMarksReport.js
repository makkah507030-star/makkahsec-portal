// src/lib/noorMarksReport.js
/* =====================================================================
   قراءة «كشف رصد درجات مادة» المصدَّر من نور بصيغة Excel (EP_CourseMarksEntryReport):
   ملف لكل مادة في صف، وكل ورقة فيه فصل. في رأس الورقة الصف والفصل، وعنوانها
   «كشف رصد درجات مادة …»، ثم ثلاثة صفوف عناوين مدمجة: الفترة (فترة أولى، فترة ثانية،
   نهاية فصل) ← نوعها (تقييم مستمر، اختبارات قصيرة، مجموع) ← البند (المهام الأدائية…،
   تقويمات شفهية وتحريرية…)، ثم صف لكل طالب برقم هويته.
   تُقرأ الأعمدة بعناوينها لا بمواقعها، ويُعدّ «غائب» درجة مرصودة، ويُتجاهل «مجموع»
   لأن نور يحسبه. لا يُحفظ شيء من الملف: تُستخرج حالة الرصد لكل فصل وفترة فقط.
   ===================================================================== */
import { GRADE_NAMES } from "./schoolTime";

// توحيد الكتابة للمطابقة: الهمزات والتاء المربوطة والألف المقصورة والتطويل والمسافات
export const normAr = (s) => String(s ?? "")
  .replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .replace(/\s+/g, " ").trim();

const PERIOD_KEYS = { "فتره اولي": "period1", "فتره ثانيه": "period2", "نهايه فصل": "final" };

// اسم البند مختصرًا كما في صيغ الملاحظة الجاهزة
export const shortComp = (label) => /المهام/.test(label) ? "المهام الأدائية"
  : /تقويمات|شفهي|تحريري/.test(label) ? "التقويمات التحريرية والشفهية"
  : String(label).replace(/\(\s*\d+\s*\)/g, "").trim();

const text = (v) => String(v ?? "").trim();

/** يقرأ ورقة واحدة: { grade, classNo, subject, students, periods: { period1: [{ label, filled }] … } } أو null */
function readSheet(XLSX, ws) {
  if (!ws?.["!ref"]) return null;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const merges = ws["!merges"] ?? [];
  const at = (r, c) => text(ws[XLSX.utils.encode_cell({ r, c })]?.v);
  // نطاق الخلية: المدمجة تُعاد بنطاقها كاملًا وقيمتها في أول خلية منها
  const span = (r, c) => merges.find((m) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c)
    ?? { s: { r, c }, e: { r, c } };
  const label = (r, c) => { const m = span(r, c); return at(m.s.r, m.s.c); };

  // بيانات الرأس: القيمة يسار التسمية في الصف نفسه
  const head = {};
  let title = "";
  for (let r = range.s.r; r <= Math.min(range.e.r, 20); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = at(r, c);
      if (/كشف رصد درجات مادة/.test(v)) title = v.replace(/.*كشف رصد درجات مادة\s*/, "").trim();
      if (["الصف", "الفصل"].includes(v)) {
        for (let k = c - 1; k >= range.s.c; k--) { const x = at(r, k); if (x && x !== ":") { head[v] = x; break; } }
      }
    }
  }
  const grade = Number(Object.entries(GRADE_NAMES).find(([, n]) => normAr(n) === normAr(head["الصف"]))?.[0]) || null;
  const classNo = Number(head["الفصل"]) || null;
  if (!title || !grade || !classNo) return null;

  // صف عناوين الفترات، وعمود رقم الهوية
  let hr = -1, idCol = -1;
  for (let r = range.s.r; r <= range.e.r && hr < 0; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (PERIOD_KEYS[normAr(at(r, c))]) hr = r;
      if (at(r, c) === "رقم الهوية") idCol = c;
    }
  }
  if (hr < 0 || idCol < 0) return null;

  // طلاب الورقة: صفوف تحت العناوين فيها رقم هوية
  const studentRows = [];
  for (let r = hr + 3; r <= range.e.r; r++) if (/^\d{5,}$/.test(label(r, idCol))) studentRows.push(r);

  // بنود كل فترة: أعمدة الصف الثالث من العناوين داخل نطاق الفترة، دون «مجموع»
  const periods = {};
  const seen = new Set();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const pm = span(hr, c);
    const key = PERIOD_KEYS[normAr(at(pm.s.r, pm.s.c))];
    if (!key || seen.has(`${pm.s.c}`)) continue;
    seen.add(`${pm.s.c}`);
    const comps = [];
    for (let k = pm.s.c; k <= pm.e.c; k++) {
      if (label(hr + 1, k) === "مجموع") continue;
      const lm = span(hr + 2, k);
      if (lm.s.c !== k) continue;          // عمود داخل بند مدمج سبق
      const name = at(lm.s.r, lm.s.c);
      if (!name) continue;
      // قيمة الطالب في البند: أول خلية غير فارغة في أعمدته
      const filled = studentRows.filter((r) => {
        for (let x = lm.s.c; x <= lm.e.c; x++) if (at(r, x)) return true;
        return false;
      }).length;
      comps.push({ label: name, short: shortComp(name), filled });
    }
    periods[key] = comps;
  }
  return { subject: title, grade, classNo, students: studentRows.length, periods };
}

/** يقرأ ملف Excel كاملًا: ورقة لكل فصل. يُرجع { sheets, skipped } */
export async function readMarksReport(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheets = [];
  let skipped = 0;
  for (const n of wb.SheetNames) {
    const s = readSheet(XLSX, wb.Sheets[n]);
    if (s) sheets.push({ ...s, file: file.name }); else skipped++;
  }
  return { sheets, skipped };
}

/** حالة رصد الفصل في الفترة من بنودها: done أو partial بملاحظة الناقص أو none */
export function marksStatus(sheet, period) {
  const comps = sheet.periods[period] ?? [];
  const n = sheet.students;
  if (!comps.length || !n) return null;
  const total = comps.reduce((a, c) => a + c.filled, 0);
  if (total === 0) return { status: "none", note: null };
  if (comps.every((c) => c.filled >= n)) return { status: "done", note: null };
  const lines = comps.filter((c) => c.filled < n).map((c) => (c.filled === 0
    ? `لم يتم رصد ${c.short}`
    : `بعض الطلاب ليس لديهم درجات في ${c.short} (${n - c.filled} من ${n})`));
  return { status: "partial", note: lines.join("\n") };
}
