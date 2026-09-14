import * as XLSX from "xlsx";

// اسم مدير المدرسة — يظهر في ترويسة وتذييل التقارير المطبوعة
export const PRINCIPAL_NAME = "عبدالله بن حسن سلمان الفيفي";

// وكيل شؤون الطلاب — يظهر في تقارير الطلاب وأولياء الأمور
export const STUDENT_DEPUTY_NAME = "فهد بن نايف المعبدي";

/**
 * تصدير بيانات إلى ملف Excel
 * @param {Array<Object>} rows - الصفوف (كائنات جاهزة بعناوين عربية)
 * @param {string} fileName - اسم الملف بدون امتداد
 * @param {string} sheetName - اسم ورقة العمل
 */
export function exportToExcel(rows, fileName = "تقرير", sheetName = "البيانات") {
  if (!rows?.length) return;

  const ws = XLSX.utils.json_to_sheet(rows);

  // عرض الأعمدة تلقائيًا حسب أطول قيمة
  const keys = Object.keys(rows[0]);
  ws["!cols"] = keys.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...rows.map((r) => String(r[k] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  // اتجاه الورقة من اليمين لليسار
  ws["!views"] = [{ RTL: true }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}-${stamp}.xlsx`);
}

/**
 * طباعة جدول بترويسة المدرسة (يفتح نافذة طباعة يمكن الحفظ منها كـ PDF)
 * @param {Object} opts
 * @param {string} opts.title - عنوان التقرير
 * @param {string} [opts.subtitle] - سطر فرعي (الفلاتر المطبّقة مثلاً)
 * @param {string[]} opts.headers - عناوين الأعمدة
 * @param {Array<Array>} opts.rows - الصفوف كمصفوفات
 * @param {string} [opts.logoUrl] - رابط شعار المدرسة
 * @param {string} [opts.moeLogoUrl] - رابط شعار وزارة التعليم
 * @param {{title:string,name:string}} [opts.secondSignature] - توقيع إضافي (يمين)
 */
export function printReport({
  title, subtitle, headers, rows, logoUrl, moeLogoUrl, secondSignature,
}) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة.");
    return;
  }

  const today = new Date().toLocaleDateString("ar-SA");

  const html = `
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "IBM Plex Sans Arabic", system-ui, sans-serif;
    margin: 0; padding: 24px; color: #101010;
  }
  .head {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    border-bottom: 2px solid #3E6350; padding-bottom: 12px; margin-bottom: 6px;
  }
  .head .side { display: flex; align-items: center; }
  .head .moe img    { height: 56px; width: auto; }
  .head .school img { height: 48px; width: auto; }
  .head .txt { flex: 1; text-align: center; }
  .head h1 { margin: 0; font-size: 16px; color: #3E6350; font-weight: 700; }
  .head h2 { margin: 2px 0 0; font-size: 13px; color: #3E6350; font-weight: 600; }
  .head p  { margin: 2px 0 0; font-size: 11px; color: #6B6B6B; }
  .meta {
    display: flex; justify-content: space-between;
    font-size: 11px; color: #6B6B6B; margin-bottom: 14px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    background: #EDFAF2; color: #3E6350; font-weight: 600;
    border: 1px solid #CCF2DB; padding: 7px 8px; text-align: right;
  }
  tbody td { border: 1px solid #E6E6E6; padding: 6px 8px; }
  tbody tr:nth-child(even) { background: #FAFAFA; }
  tfoot td {
    border: none; padding-top: 14px; font-size: 11px; color: #6B6B6B;
  }
  .sign {
    margin-top: 34px; display: flex; justify-content: space-between;
    page-break-inside: avoid;
  }
  .sign.one { justify-content: flex-end; }
  .sign-box { text-align: center; min-width: 230px; }
  .sign-title { margin: 0; font-size: 11px; color: #6B6B6B; }
  .sign-name  { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #101010; }
  .sign-line  { margin: 22px 0 0; font-size: 11px; color: #6B6B6B; }
  @media print {
    body { padding: 0; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    @page { margin: 14mm; }
  }
</style>
</head>
<body>
  <div class="head">
    <div class="side moe">
      ${moeLogoUrl ? `<img src="${moeLogoUrl}" alt="وزارة التعليم" />` : ""}
    </div>
    <div class="txt">
      <h1>المملكة العربية السعودية — وزارة التعليم</h1>
      <h2>مدرسة مكة الثانوية</h2>
      <p>بوابة مكة الثانوية الرقمية</p>
    </div>
    <div class="side school">
      ${logoUrl ? `<img src="${logoUrl}" alt="شعار المدرسة" />` : ""}
    </div>
  </div>

  <div class="meta">
    <span><strong>${title}</strong>${subtitle ? ` — ${subtitle}` : ""}</span>
    <span>تاريخ الطباعة: ${today} · عدد السجلات: ${rows.length}</span>
  </div>

  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>

  <div class="sign ${secondSignature ? "" : "one"}">
    ${secondSignature ? `
    <div class="sign-box">
      <p class="sign-title">${secondSignature.title}</p>
      <p class="sign-name">${secondSignature.name}</p>
      <p class="sign-line">التوقيع: ..............................</p>
    </div>` : ""}
    <div class="sign-box">
      <p class="sign-title">مدير المدرسة</p>
      <p class="sign-name">${PRINCIPAL_NAME}</p>
      <p class="sign-line">التوقيع: ..............................</p>
    </div>
  </div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();

  // انتظر تحميل الخط والشعار قبل فتح نافذة الطباعة
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };
}
