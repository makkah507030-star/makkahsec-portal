// xlsx-js-style: نسخة مجانية من SheetJS تدعم تنسيق الخلايا
// (مكتبة xlsx الأساسية تتجاهل الألوان والخطوط بصمت)
import XLSX from "xlsx-js-style";
import { fmtBoth, fmtTime12 } from "./dates";

// اسم مدير المدرسة — يظهر في ترويسة وتذييل التقارير المطبوعة
export const PRINCIPAL_NAME = "عبدالله بن حسن سلمان الفيفي";

// وكيل شؤون الطلاب — يظهر في تقارير الطلاب وأولياء الأمور
export const STUDENT_DEPUTY_NAME = "فهد بن نايف ماطر المعبدي";

// وكيل الشؤون التعليمية
export const ACADEMIC_DEPUTY_NAME = "فهد بن سعود حضرواي";

// مسؤول الدعم الفني للبوابة — يظهر في تقارير مركز الدعم والمساندة
export const TECH_SUPPORT_NAME = "محمد بن حسن الحازمي";

/* ألوان الهوية المستخدمة في التقارير المطبوعة */
const DEEP  = "#3E6350";
const MINT  = "#89D7AD";
const LIGHT = "#CCF2DB";
const TINT  = "#EDFAF2";
const INK   = "#101010";
const GRAY  = "#6B6B6B";
const ZEBRA = "#F4F4F4";

/**
 * تصدير بيانات إلى ملف Excel
 * @param {Array<Object>} rows - الصفوف (كائنات جاهزة بعناوين عربية)
 * @param {string} fileName - اسم الملف بدون امتداد
 * @param {string} sheetName - اسم ورقة العمل
 */
export function exportToExcel(rows, fileName = "تقرير", sheetName = "البيانات") {
  if (!rows?.length) return;

  const ws = XLSX.utils.json_to_sheet(rows);

  const keys = Object.keys(rows[0]);
  ws["!cols"] = keys.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...rows.map((r) => String(r[k] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  ws["!views"] = [{ RTL: true }];

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}-${stamp}.xlsx`);
}

/**
 * تصدير Excel بتنسيق يطابق تقارير PDF:
 * ترويسة رسمية، وعنوان، ورأس جدول ملوّن، وحدود، وتذييل بالتوقيعات.
 *
 * @param {Object} opts
 * @param {string}   opts.title
 * @param {string}   [opts.subtitle]
 * @param {string[]} opts.headers
 * @param {Array[]}  opts.rows
 * @param {string}   [opts.fileName]
 * @param {string}   [opts.sheetName]
 * @param {{title:string,name:string}[]} [opts.signatures]
 * @param {string}   [opts.note]
 */
export function exportStyledExcel({
  title,
  subtitle,
  headers,
  rows,
  fileName = "تقرير",
  sheetName = "التقرير",
  signatures,
  note,
}) {
  if (!headers?.length) return;

  const cols = headers.length;
  const aoa = [];

  // الترويسة الرسمية
  aoa.push(["المملكة العربية السعودية"]);
  aoa.push(["وزارة التعليم"]);
  aoa.push(["الإدارة العامة للتعليم بمنطقة مكة المكرمة"]);
  aoa.push(["مدرسة مكة الثانوية"]);
  aoa.push([]);

  // العنوان
  aoa.push([title]);
  if (subtitle) aoa.push([subtitle]);
  aoa.push([`تاريخ الإصدار: ${fmtBoth(new Date())}`]);
  aoa.push([]);

  const headRow = aoa.length;       // فهرس صف رأس الجدول
  aoa.push(headers);
  rows.forEach((r) => aoa.push(r));
  const lastRow = aoa.length - 1;

  // الملاحظة والتوقيعات
  if (note) { aoa.push([]); aoa.push([note]); }

  const signList = signatures?.length
    ? signatures
    : [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }];

  aoa.push([]);
  aoa.push([]);
  aoa.push(signList.map((s) => s.title));
  aoa.push(signList.map((s) => s.name));
  aoa.push(signList.map(() => "التوقيع: ....................."));

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // عرض الأعمدة
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map((r) => String(r[i] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 3, 9), 38) };
  });

  // دمج خلايا الترويسة والعنوان
  const merges = [];
  for (let r = 0; r < 4; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: cols - 1 } });
  }
  merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: cols - 1 } });
  if (subtitle) merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: cols - 1 } });
  merges.push({ s: { r: subtitle ? 7 : 6, c: 0 }, e: { r: subtitle ? 7 : 6, c: cols - 1 } });
  ws["!merges"] = merges;

  ws["!views"] = [{ RTL: true }];

  /* ---------- التنسيق ---------- */
  const border = {
    top:    { style: "thin", color: { rgb: "FFE6E6E6" } },
    bottom: { style: "thin", color: { rgb: "FFE6E6E6" } },
    left:   { style: "thin", color: { rgb: "FFE6E6E6" } },
    right:  { style: "thin", color: { rgb: "FFE6E6E6" } },
  };

  const setStyle = (r, c, style) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = { ...(ws[ref].s ?? {}), ...style };
  };

  // الترويسة
  for (let r = 0; r < 4; r++) {
    setStyle(r, 0, {
      font: { name: "Arial", sz: r === 3 ? 13 : 10, bold: r === 3, color: { rgb: "FF3E6350" } },
      alignment: { horizontal: "center", readingOrder: 2 },
    });
  }

  // العنوان
  setStyle(5, 0, {
    font: { name: "Arial", sz: 15, bold: true, color: { rgb: "FF101010" } },
    alignment: { horizontal: "center", readingOrder: 2 },
  });
  if (subtitle) {
    setStyle(6, 0, {
      font: { name: "Arial", sz: 10, color: { rgb: "FF6B6B6B" } },
      alignment: { horizontal: "center", readingOrder: 2 },
    });
  }
  setStyle(subtitle ? 7 : 6, 0, {
    font: { name: "Arial", sz: 9, color: { rgb: "FF6B6B6B" } },
    alignment: { horizontal: "center", readingOrder: 2 },
  });

  // رأس الجدول
  for (let c = 0; c < cols; c++) {
    setStyle(headRow, c, {
      font: { name: "Arial", sz: 11, bold: true, color: { rgb: "FF3E6350" } },
      fill: { patternType: "solid", fgColor: { rgb: "FFEDFAF2" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true, readingOrder: 2 },
      border: {
        top:    { style: "thin", color: { rgb: "FFCCF2DB" } },
        bottom: { style: "thin", color: { rgb: "FFCCF2DB" } },
        left:   { style: "thin", color: { rgb: "FFCCF2DB" } },
        right:  { style: "thin", color: { rgb: "FFCCF2DB" } },
      },
    });
  }

  // صفوف البيانات
  for (let r = headRow + 1; r <= lastRow; r++) {
    const zebra = (r - headRow) % 2 === 0;
    for (let c = 0; c < cols; c++) {
      setStyle(r, c, {
        font: { name: "Arial", sz: 10, color: { rgb: "FF101010" } },
        alignment: { horizontal: c === 0 ? "center" : "right", vertical: "center", readingOrder: 2 },
        border,
        ...(zebra ? { fill: { patternType: "solid", fgColor: { rgb: "FFFAFAFA" } } } : {}),
      });
    }
  }

  // التوقيعات
  const signTitleRow = aoa.length - 3;
  const signNameRow  = aoa.length - 2;
  const signLineRow  = aoa.length - 1;
  for (let c = 0; c < signList.length; c++) {
    setStyle(signTitleRow, c, {
      font: { name: "Arial", sz: 9, color: { rgb: "FF6B6B6B" } },
      alignment: { horizontal: "center", readingOrder: 2 },
    });
    setStyle(signNameRow, c, {
      font: { name: "Arial", sz: 11, bold: true, color: { rgb: "FF101010" } },
      alignment: { horizontal: "center", readingOrder: 2 },
    });
    setStyle(signLineRow, c, {
      font: { name: "Arial", sz: 9, color: { rgb: "FF6B6B6B" } },
      alignment: { horizontal: "center", readingOrder: 2 },
    });
  }

  // ارتفاع الصفوف
  ws["!rows"] = aoa.map((_, i) =>
    i === headRow ? { hpt: 26 } : i === 5 ? { hpt: 24 } : { hpt: 18 }
  );

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}-${stamp}.xlsx`);
}

/**
 * طباعة تقرير أو سجل متعدد الصفحات.
 *
 * يقبل شكلين:
 *   - جدول واحد : { headers | headerRows, rows }
 *   - عدة أقسام : { sections: [{ title, subtitle, headerRows, rows, tableClass }] }
 *     كل قسم يبدأ في صفحة جديدة.
 *
 * @param {Object} opts
 * @param {string}  opts.title
 * @param {string}  [opts.subtitle]
 * @param {string[]} [opts.headers]
 * @param {Array[]} [opts.headerRows]
 * @param {Array[]} [opts.rows]
 * @param {Array}   [opts.sections]
 * @param {string}  [opts.logoUrl]
 * @param {string}  [opts.moeLogoUrl]
 * @param {Object}  [opts.cover]      - { title, subtitle, rows: [[k,v]], groups, year }
 * @param {Array}   [opts.signatures] - [{ title, name }]
 * @param {boolean} [opts.hideSignatureLine]
 * @param {string}  [opts.note]
 * @param {string}  [opts.tableClass]
 * @param {boolean} [opts.landscape]
 */
export function printReport(opts) {
  const {
    title, subtitle, headers, headerRows, rows,
    sections, logoUrl, moeLogoUrl, cover,
    signatures, secondSignature, hideSignatureLine = false, hideSignatures = false,
    note, tableClass, landscape = false,
  } = opts;

  const now = new Date();
  const stampText = `${fmtBoth(now)} · ${fmtTime12(now)}`;

  /* ---------- التوقيعات ---------- */
  const signList = signatures?.length
    ? signatures
    : [
        ...(secondSignature ? [secondSignature] : []),
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ];

  const signBlock = hideSignatures ? "" : `
  <div class="sign ${signList.length === 1 ? "one" : signList.length >= 3 ? "three" : ""}">
    ${signList
      .map(
        (sg) => `
    <div class="sign-box">
      <p class="sign-title">${sg.title}</p>
      <p class="sign-name">${sg.name}</p>
      ${hideSignatureLine ? "" : `<p class="sign-line">التوقيع: ..........................</p>`}
    </div>`
      )
      .join("")}
  </div>`;

  /* ---------- الترويسة الرسمية ---------- */
  const headBlock = `
  <div class="head">
    <div class="side">${moeLogoUrl ? `<img src="${moeLogoUrl}" alt="" />` : ""}</div>
    <div class="txt">
      <p class="l1">المملكة العربية السعودية — وزارة التعليم</p>
      <p class="l2">مدرسة مكة الثانوية</p>
      <p class="l3">الإدارة العامة للتعليم بمنطقة مكة المكرمة</p>
    </div>
    <div class="side">${logoUrl ? `<img src="${logoUrl}" alt="" />` : ""}</div>
  </div>`;

  /* ---------- الغلاف ---------- */
  const coverBlock = cover
    ? `
  <section class="cover">
    ${headBlock}

    <div class="cover-body">
      <h1>${cover.title ?? title}</h1>
      ${cover.subtitle ? `<p class="cover-sub">${cover.subtitle}</p>` : ""}

      <div class="cover-card">
        ${(cover.rows ?? [])
          .map(
            (r) => `
        <div class="crow"><span class="k">${r[0]}:</span><span class="v">${r[1] ?? ""}</span></div>`
          )
          .join("")}
      </div>

      ${
        cover.groups?.length
          ? `
      <div class="cover-list">
        <p class="cover-list-title">${cover.groupsTitle ?? "المواد والفصول"}</p>
        <table class="mini">
          <thead><tr><th>م</th><th>المادة</th><th>الصف</th><th>الفصل</th></tr></thead>
          <tbody>
            ${cover.groups
              .map(
                (g, i) => `
            <tr><td>${i + 1}</td><td>${g.subject}</td><td>${g.grade}</td><td>${g.class_no}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`
          : ""
      }

      ${cover.year ? `<p class="cover-year">${cover.year}</p>` : ""}
    </div>

    <div class="cover-foot">
      <span>تاريخ الإصدار: ${stampText}</span>
      <span>بوابة مكة الثانوية الرقمية</span>
    </div>
  </section>`
    : "";

  /* ---------- بناء رأس جدول ---------- */
  const buildHead = (hRows, hFlat) =>
    hRows?.length
      ? hRows
          .map(
            (hr) =>
              `<tr>${hr
                .map((c) =>
                  typeof c === "object"
                    ? `<th${c.cls ? ` class="${c.cls}"` : ""}${
                        c.colspan ? ` colspan="${c.colspan}"` : ""
                      }${c.rowspan ? ` rowspan="${c.rowspan}"` : ""}>${c.text ?? ""}</th>`
                    : `<th>${c}</th>`
                )
                .join("")}</tr>`
          )
          .join("")
      : `<tr>${(hFlat ?? []).map((h) => `<th>${h}</th>`).join("")}</tr>`;

  const buildBody = (bRows) =>
    (bRows ?? [])
      .map(
        (r) =>
          `<tr>${r
            .map((c) =>
              c && typeof c === "object"
                ? `<td${c.cls ? ` class="${c.cls}"` : ""}${
                    c.colspan ? ` colspan="${c.colspan}"` : ""
                  }>${c.text ?? ""}</td>`
                : `<td>${c ?? ""}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

  /* ---------- الأقسام ---------- */
  const list = sections?.length
    ? sections
    : [{ title, subtitle, headers, headerRows, rows, tableClass, note }];

  const sectionsHtml = list
    .map(
      (sec, i) => `
  <section class="sheet${i > 0 || cover ? " newpage" : ""}">
    ${headBlock}

    <div class="meta">
      <span class="m-title">${sec.title ?? title}</span>
      ${sec.subtitle ? `<span class="m-sub">${sec.subtitle}</span>` : ""}
    </div>

    ${sec.html ?? ""}

    ${
      sec.headers || sec.rows
        ? `<table class="${sec.tableClass ?? tableClass ?? ""}">
      ${
        sec.colWidths?.length
          ? `<colgroup>${sec.colWidths.map((w) => `<col style="width:${w}" />`).join("")}</colgroup>`
          : ""
      }
      <thead>${buildHead(sec.headerRows, sec.headers)}</thead>
      <tbody>${buildBody(sec.rows)}</tbody>
    </table>`
        : ""
    }

    ${sec.note ?? note ? `<p class="note">${sec.note ?? note}</p>` : ""}
    ${signBlock}
  </section>`
    )
    .join("");

  /* ---------- الأنماط ---------- */
  const css = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
    color: ${INK}; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  section { padding: 0 2mm; }
  .newpage { page-break-before: always; }

  /* ترويسة */
  .head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border-bottom: 2px solid ${DEEP}; padding-bottom: 8px; margin-bottom: 10px;
  }
  .head .side { width: 88px; display: flex; align-items: center; justify-content: center; }
  .head .side img { max-height: 50px; max-width: 84px; }
  .head .txt { flex: 1; text-align: center; }
  .head .l1 { margin: 0; font-size: 10.5px; color: ${GRAY}; }
  .head .l2 { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: ${DEEP}; }
  .head .l3 { margin: 2px 0 0; font-size: 9.5px; color: ${GRAY}; }

  /* سطر التقرير */
  .meta {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 10px; margin-bottom: 8px;
  }
  .meta .m-title { font-size: 13px; font-weight: 700; color: ${INK}; }
  .meta .m-sub { font-size: 10.5px; color: ${GRAY}; }

  /* الجداول */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  thead th {
    background: ${LIGHT}; color: ${DEEP}; font-weight: 700;
    border: 1px solid ${MINT}; padding: 6px 4px; text-align: center;
    line-height: 1.35;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  tbody td {
    border: 1px solid #DDD; padding: 6px 4px; text-align: center;
  }
  tbody tr:nth-child(even) {
    background: ${ZEBRA};
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  /* صف إجمالي مميّز داخل جدول عادي */
  tbody td.total {
    background: ${TINT}; color: ${DEEP}; font-weight: 700;
    border-top: 2px solid ${MINT};
  }

  /* توسيط صارم لكل الخلايا ما عدا الاسم */
  table th, table td { text-align: center; vertical-align: middle; }
  table .name { text-align: right !important; }

  /* كشف رصد الدرجات */
  table.compact { font-size: 9.5px; table-layout: fixed; }
  table.compact thead th { padding: 5px 3px; font-size: 8.5px; line-height: 1.3; }
  table.compact tbody td { padding: 3px 3px; }
  table.compact .name {
    padding-right: 7px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }

  /* سجل المتابعة */
  table.follow { font-size: 9.5px; table-layout: fixed; }
  table.follow thead th { padding: 5px 2px; font-size: 8.5px; line-height: 1.3; }
  table.follow thead th.score {
    background: #fff; height: 38px; font-size: 10px; color: ${GRAY};
    font-weight: 600; letter-spacing: 1px; white-space: nowrap;
  }
  table.follow thead th.slot {
    background: #F7FBF9; font-weight: 600; font-size: 7.5px; color: ${GRAY};
    padding: 3px 1px;
  }
  table.follow thead th.total-h {
    background: #E4E4E4; color: ${INK}; border-color: #C9C9C9; font-weight: 700;
  }
  table.follow thead th.slot { border-color: ${MINT}; }
  table.follow tbody td { padding: 4px 2px; border-color: #DDD; }
  table.follow tbody td.slot { padding: 4px 1px; }
  table.follow .name {
    padding-right: 7px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  table.follow .total { background: ${ZEBRA}; }

  /* جدول تنبيهي — لقوائم الغياب/عدم التحضير */
  table.danger thead th {
    background: #FBE2E2; color: #A23B3B; border-color: #EBB8B8;
  }

  /* جدول إيجابي — لقوائم الحضور/الإنجاز */
  table.success thead th {
    background: #DFF3E6; color: #3E6350; border-color: #B9E6C9;
  }

  /* بطاقات إحصائية داخل التقرير المطبوع */
  .stat-tiles { display: flex; gap: 8px; margin-bottom: 14px; }
  .stat-tile {
    flex: 1; border: 1px solid ${MINT}; border-radius: 8px; padding: 10px 6px;
    text-align: center; background: ${TINT};
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .stat-tile .v { font-size: 20px; font-weight: 700; color: ${DEEP}; }
  .stat-tile .l { margin-top: 2px; font-size: 9.5px; color: ${GRAY}; }

  /* رسم بياني شريطي بسيط داخل التقرير المطبوع */
  .bar-chart { margin-bottom: 16px; }
  .bar-row { margin-bottom: 8px; page-break-inside: avoid; }
  .bar-row .bl {
    display: flex; justify-content: space-between; font-size: 10.5px;
    color: ${INK}; margin-bottom: 3px;
  }
  .bar-row .bl .n { color: ${GRAY}; }
  .bar-track { height: 9px; background: #EFEFEF; border-radius: 5px; overflow: hidden; }
  .bar-fill {
    height: 100%; border-radius: 5px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  /* الملاحظة والتوقيعات */
  .note {
    margin-top: 10px; font-size: 9.5px; color: ${GRAY}; line-height: 1.6;
    border-right: 3px solid ${LIGHT}; padding-right: 8px;
  }
  .sign {
    margin-top: 18px; display: flex; justify-content: space-between;
    page-break-inside: avoid;
  }
  .sign.one { justify-content: flex-end; }
  .sign.three { justify-content: space-around; }
  .sign-box { text-align: center; min-width: 170px; }
  .sign-title { margin: 0; font-size: 9.5px; color: ${GRAY}; }
  .sign-name { margin: 3px 0 0; font-size: 11px; font-weight: 700; color: ${INK}; }
  .sign-line { margin: 16px 0 0; font-size: 9.5px; color: ${GRAY}; }

  /* الغلاف */
  .cover { display: flex; flex-direction: column; min-height: 96vh; }
  .cover-body { flex: 1; text-align: center; padding-top: 6mm; }
  .cover h1 {
    margin: 0 0 6px; font-size: 26px; line-height: 1.35; font-weight: 700; color: ${DEEP};
    letter-spacing: -0.2px;
  }
  .cover-sub { margin: 0 0 18px; font-size: 14px; color: ${GRAY}; }
  .cover-card {
    max-width: 420px; margin: 0 auto 16px; text-align: right;
    border: 1px solid ${LIGHT}; border-radius: 10px; overflow: hidden;
  }
  .cover-card .crow {
    display: flex; justify-content: center; gap: 8px;
    padding: 9px 16px; font-size: 12px; border-bottom: 1px solid #EEF6F1;
  }
  .cover-card .crow:nth-child(odd) { background: ${TINT}; }
  .cover-card .crow:last-child { border-bottom: none; }
  .cover-card .k { color: ${GRAY}; }
  .cover-card .v { font-weight: 700; color: ${INK}; }

  .cover-list { max-width: 480px; margin: 0 auto; }
  .cover-list-title {
    margin: 0 0 8px; font-size: 11px; font-weight: 700; color: ${DEEP};
    text-align: center;
  }
  table.mini { font-size: 10px; margin: 0 auto; }
  table.mini th, table.mini td { text-align: center; }
  table.mini thead th { padding: 5px 4px; font-size: 9.5px; }
  table.mini tbody td { padding: 5px 4px; }

  .cover-year { margin-top: 16px; font-size: 11px; color: ${GRAY}; }
  .cover-foot {
    display: flex; justify-content: space-between;
    border-top: 1px solid ${LIGHT}; padding-top: 6px;
    font-size: 9.5px; color: ${GRAY};
  }

  @media print {
    section { padding: 0; }
    @page { margin: 10mm; ${landscape ? "size: A4 landscape;" : "size: A4 portrait;"} }
  }`;

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet" />
<style>${css}</style>
</head>
<body>
${coverBlock}
${sectionsHtml}
</body>
</html>`;

  /* ---------- الطباعة عبر إطار مخفي ----------
     تتفادى حاجب النوافذ المنبثقة، ولا تُظهر about:blank في التذييل. */
  const old = document.getElementById("__print_frame__");
  if (old) old.remove();

  const frame = document.createElement("iframe");
  frame.id = "__print_frame__";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;inset:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const run = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (e) {
      console.error("print failed:", e);
    }
    setTimeout(() => frame.remove(), 1500);
  };

  // انتظار تحميل الخطوط والصور
  if (doc.readyState === "complete") setTimeout(run, 500);
  else frame.onload = () => setTimeout(run, 500);
}
