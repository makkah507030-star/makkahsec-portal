/* =====================================================================
   قراءة ملف توزيع المنهج (Excel أو PDF) وتحويله إلى أسابيع:
   [{ n: رقم الأسبوع, t: "دروس الأسبوع" }]. القراءة تقريبية لاختلاف شكل الملفات،
   فيراجع المعلم البطاقات ويصحّحها قبل الحفظ (لوحة ملف المعلم الرقمي).
   المكتبتان تُحمّلان عند الرفع فقط لثقلهما.
   ===================================================================== */
import { loadPdfjs } from "./pdfjs.js";

const ORD = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const norm = (s) => String(s ?? "").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();
const ORDN = ORD.map(norm);
const toLatin = (s) => s.replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c));

/* رقم الأسبوع من نص مثل «الأسبوع الثالث عشر» أو «الأسبوع 13» أو «أسبوع ١٣» */
export function weekNo(text) {
  const s = toLatin(norm(text));
  const m = s.match(/(?:ال)?اسبوع\s*:?\s*(\d{1,2}|[^\s]+(?:\s+عشر)?)/);
  if (!m) return null;
  const v = m[1];
  if (/^\d+$/.test(v)) return Number(v);
  const [w, teen] = v.split(" ");
  const base = w === "الحادي" ? 1 : ORDN.indexOf(w) + 1;
  if (base < 1) return null;
  return teen === "عشر" ? 10 + base : base;
}

/* يحذف كلمة الأسبوع والتواريخ، ويُبقي من النص الأجزاء التي فيها كلام (حرفان فأكثر) */
const DATE = /[0-9٠-٩]{1,4}(\s*[/\-.]\s*[0-9٠-٩]{1,4}){1,2}\s*(هـ|م)?/g;
function clean(text) {
  return String(text ?? "")
    .replace(/(?:ال)?[أا]سبوع\s*:?\s*(\d{1,2}|[^\s،,]+(?:\s+عشر)?)/g, "")
    .replace(DATE, " ")
    .split(/[،,|\n]| - | – /)
    .map((x) => x.replace(/\s+/g, " ").trim().replace(/^(من|إلى|الى|حتى)\s+|\s+(من|إلى|الى|حتى)$/g, ""))
    .filter((x) => (x.match(/[\u0621-\u064Aa-zA-Z]/g) ?? []).length >= 2)
    .join("، ");
}

function merge(rows) {
  const by = new Map();
  rows.forEach(({ n, t }) => {
    const c = clean(t);
    if (!n || n > 30 || !c) return;
    by.set(n, by.has(n) ? `${by.get(n)}، ${c}` : c);
  });
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([n, t]) => ({ n, t }));
}

async function fromExcel(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const out = [];
  wb.SheetNames.forEach((name) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });
    let cur = null;
    rows.forEach((row) => {
      const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
      if (!cells.length) return;
      const wi = cells.findIndex((c) => weekNo(c));
      if (wi >= 0) {
        cur = weekNo(cells[wi]);
        out.push({ n: cur, t: cells.filter((_, i) => i !== wi).join("، ") });
      } else if (cur) {
        out.push({ n: cur, t: cells.join("، ") });   // خلايا مدموجة: تكملة الأسبوع السابق
      }
    });
  });
  return merge(out);
}

async function fromPdf(file) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];
  let cur = null;
  for (let p = 1; p <= pdf.numPages; p++) {
    const items = (await (await pdf.getPage(p)).getTextContent()).items.filter((it) => it.str?.trim());
    // سطور: عناصر متقاربة الارتفاع، من اليمين إلى اليسار
    const lines = [];
    items.forEach((it) => {
      const y = Math.round(it.transform[5] / 4);
      let l = lines.find((x) => Math.abs(x.y - y) <= 1);
      if (!l) { l = { y, parts: [] }; lines.push(l); }
      l.parts.push({ x: it.transform[4], w: it.width ?? 0, s: it.str });
    });
    lines.sort((a, b) => b.y - a.y).forEach((l) => {
      // بعض الملفات تُخرج العربية حرفًا حرفًا بأشكال العرض: نرتّبها من اليمين، ونضع مسافة
      // حيث تتباعد الحروف فقط، ثم نردّ الأشكال إلى حروفها (NFKC)
      const ps = l.parts.sort((a, b) => b.x - a.x);
      const text = ps.reduce((acc, p, i) => {
        const gap = i ? ps[i - 1].x - (p.x + p.w) : 0;
        return acc + (i && gap > 1.5 ? " " : "") + p.s;
      }, "").normalize("NFKC");
      const n = weekNo(text);
      if (n) { cur = n; out.push({ n, t: text }); } else if (cur) out.push({ n: cur, t: text });
    });
  }
  return merge(out);
}

/* يعيد { weeks, error } — error رسالة للمعلم إن تعذّرت القراءة */
export async function readDistribution(file) {
  const name = (file?.name ?? "").toLowerCase();
  try {
    const weeks = /\.(xlsx|xls|csv)$/.test(name) ? await fromExcel(file)
      : /\.pdf$/.test(name) ? await fromPdf(file) : null;
    if (weeks === null) return { weeks: [], error: "الملف المقبول Excel أو PDF. احفظ ملف Word بصيغة PDF ثم ارفعه." };
    if (!weeks.length) return { weeks: [], error: "لم أجد أسابيع في الملف (مثل «الأسبوع الأول»). اكتب الدروس يدويًا في البطاقات." };
    return { weeks, error: "" };
  } catch {
    return { weeks: [], error: "تعذّرت قراءة الملف. جرّب ملفًا آخر أو اكتب الدروس يدويًا." };
  }
}
