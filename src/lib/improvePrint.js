import { fmtDate } from "./dates";
import { printReport, exportStyledExcel, PRINCIPAL_NAME } from "./exportUtils";
import { EL_TITLE, SCORE_LABEL, SOURCE_LABEL, STATUS, LATE_AFTER, OPEN, dueState } from "./improve.js";
import { ELEMENTS } from "./dfile.js";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   طباعة حلقة التحسين وتصديرها (منفصلة عن improve.js حتى لا تدخل أدوات
   الطباعة في حزمة «بانتظار إجرائك»):
   • printGoal: خطة التطوير الفردية لتوصية واحدة، بتوقيع المعلم والمتابع والمدير.
   • printRecord: سجل التطوير للمعلم: كل توصياته في العام ونتيجتها.
   • printBoard / excelBoard: تقرير لوحة المدير، وكل التوصيات في جدول Excel.
   ===================================================================== */

const logos = () => ({
  logoUrl: new URL(logoIcon, window.location.origin).href,
  moeLogoUrl: new URL(moeLogo, window.location.origin).href,
});
const score = (v) => (v ? `${v} — ${SCORE_LABEL[v]}` : "غير مقدَّر");
const result = (g) => (g.status === "closed" ? (g.improved ? "تحسّن" : "لم يتحسّن، وفُتحت دورة تالية") : g.status === "cancelled" ? "أُلغيت" : "—");
const statusText = (g) => (dueState(g) === "late" ? "متأخرة المتابعة" : STATUS[g.status]?.t ?? "");
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");

/* محرك الطباعة يبدأ كل قسم بصفحة جديدة؛ فتُجمع جداول التقرير في قسم واحد يتدفّق عبر الصفحات */
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const block = ({ title, headers, rows }) =>
  `<p style="margin:14px 0 6px;font-size:12.5px;font-weight:700">${esc(title)}</p>`
  + `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
  + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const oneSection = (title, subtitle, blocks) => [{ title, subtitle, html: blocks.map(block).join("") }];

export function printGoal(g) {
  const teacher = g.teacher?.full_name ?? "";
  const title = g.cycle > 1 ? `خطة تطوير فردية — الدورة ${g.cycle} بدعم أعلى` : "خطة تطوير فردية";
  printReport({
    title,
    sections: oneSection(title, `${teacher} · ${EL_TITLE[g.element_key] ?? ""}`, [
      { title: "التوصية", headers: ["البند", "التفصيل"], rows: [
        ["المعلم", teacher],
        ["عنصر الأداء", EL_TITLE[g.element_key] ?? ""],
        ["المصدر", `${SOURCE_LABEL[g.source] ?? ""} في ${fmtDate(g.source_date)}`],
        ["خط الأساس", score(g.baseline)],
        ["التوصية", g.recommendation ?? ""],
      ] },
      { title: "الخطة والمتابعة", headers: ["البند", "التفصيل"], rows: [
        ["الإجراءات", g.plan_actions || "لم تُكتب بعد"],
        ["الدعم المطلوب", g.plan_support || "—"],
        ["موعد المتابعة", g.follow_up_date ? fmtDate(g.follow_up_date) : "—"],
        ["اعتماد الخطة", g.plan_approved_at ? fmtDate(g.plan_approved_at) : "لم تُعتمد بعد"],
        ["ما نفّذه المعلم", g.progress_note || "—"],
        ["الحالة", statusText(g)],
        ...(g.status === "closed" ? [["الأثر", `${score(g.baseline)} ← ${score(g.result_score)} · ${result(g)}`]] : []),
        ...(g.status === "cancelled" ? [["سبب الإلغاء", g.cancel_note ?? ""]] : []),
      ] },
    ]),
    note: "الأثر يُقاس آليًا من درجة البند نفسه في زيارة الدعم أو تقييم الأداء التالي.",
    ...logos(),
    signatures: [{ title: "المعلم", name: teacher }, { title: "المتابع", name: g.owner?.full_name ?? "" },
                 { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
  });
}

export function printRecord(goals, teacher, year) {
  const closed = goals.filter((g) => g.status === "closed");
  printReport({
    title: "سجل التطوير المهني",
    sections: oneSection("سجل التطوير المهني", `${teacher} · العام الدراسي ${year}`, [
      { title: "الخلاصة", headers: ["البند", "العدد"], rows: [
        ["توصيات التطوير", goals.length],
        ["خطط مفتوحة", goals.filter((g) => OPEN.includes(g.status)).length],
        ["قيس أثرها", closed.length],
        ["تحسّن فيها البند", `${closed.filter((g) => g.improved).length} (${pct(closed.filter((g) => g.improved).length, closed.length)})`],
      ] },
      { title: "التوصيات وخططها", headers: ["م", "عنصر الأداء", "المصدر", "خط الأساس", "الحالة", "بعد الخطة", "النتيجة"],
        rows: goals.map((g, i) => [i + 1, `${EL_TITLE[g.element_key] ?? ""}${g.cycle > 1 ? ` (الدورة ${g.cycle})` : ""}`,
          `${SOURCE_LABEL[g.source] ?? ""} ${fmtDate(g.source_date)}`, g.baseline ?? "—", statusText(g), g.result_score ?? "—", result(g)]) },
    ]),
    ...logos(),
    signatures: [{ title: "المعلم", name: teacher }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
  });
}

/* ملخص لكل معلم: المفتوح والمتأخر والمقيس والمتحسّن */
function byTeacher(rows) {
  const m = new Map();
  for (const g of rows) {
    const k = g.teacher?.full_name ?? "معلم";
    const x = m.get(k) ?? { name: k, all: 0, open: 0, late: 0, closed: 0, better: 0 };
    x.all++; if (OPEN.includes(g.status)) x.open++; if (dueState(g) === "late") x.late++;
    if (g.status === "closed") { x.closed++; if (g.improved) x.better++; }
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.late - a.late || b.open - a.open || a.name.localeCompare(b.name, "ar"));
}

export function printBoard(rows, quiz, year) {
  const closed = rows.filter((g) => g.status === "closed"), better = closed.filter((g) => g.improved).length;
  const late = rows.filter((g) => dueState(g) === "late");
  const need = ELEMENTS.map(([k, t]) => [t, rows.filter((g) => g.element_key === k && g.status !== "cancelled").length])
    .filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const qDone = (quiz ?? []).filter((r) => r.status === "done"), qMeasured = qDone.filter((r) => r.measured_at && r.impact?.n);
  const qN = qMeasured.reduce((a, r) => a + Number(r.impact.n), 0), qPass = qMeasured.reduce((a, r) => a + Number(r.impact.passed), 0);
  printReport({
    title: "تقرير حلقة التحسين",
    sections: oneSection("تقرير حلقة التحسين", `العام الدراسي ${year}`, [
      { title: "المؤشرات", headers: ["المؤشر", "القيمة"], rows: [
        ["توصيات مفتوحة", rows.filter((g) => OPEN.includes(g.status)).length],
        [`متأخرة المتابعة (أكثر من ${LATE_AFTER} أيام)`, late.length],
        ["مغلقة بقياس الأثر", closed.length],
        ["نسبة التحسّن", `${pct(better, closed.length)} (${better} من ${closed.length})`],
        ["خطط علاجية نُفّذت في دورة الاختبار", qDone.length],
        ["قيس أثرها باختبار تحقق", qMeasured.length],
        ["طلابها الذين بلغوا 60%", `${pct(qPass, qN)} (${qPass} من ${qN})`],
      ] },
      { title: "أكثر البنود احتياجًا", headers: ["عنصر الأداء", "عدد التوصيات"], rows: need.length ? need : [["لا توصيات", "—"]] },
      { title: "حسب المعلم", headers: ["المعلم", "التوصيات", "مفتوحة", "متأخرة", "قيس أثرها", "تحسّن"],
        rows: byTeacher(rows).map((x) => [x.name, x.all, x.open, x.late, x.closed, x.better]) },
      ...(late.length ? [{ title: "المتأخرة", headers: ["المعلم", "عنصر الأداء", "موعد المتابعة", "المتابع"],
        rows: late.map((g) => [g.teacher?.full_name ?? "", EL_TITLE[g.element_key] ?? "", fmtDate(g.follow_up_date), g.owner?.full_name ?? ""]) }] : []),
    ]),
    ...logos(),
  });
}

export function excelBoard(rows, year) {
  return exportStyledExcel({
    title: "توصيات حلقة التحسين",
    subtitle: `العام الدراسي ${year}`,
    headers: ["المعلم", "عنصر الأداء", "الدورة", "المصدر", "التاريخ", "خط الأساس", "الحالة", "موعد المتابعة", "بعد الخطة", "النتيجة", "المتابع", "التوصية"],
    rows: rows.map((g) => [g.teacher?.full_name ?? "", EL_TITLE[g.element_key] ?? "", g.cycle, SOURCE_LABEL[g.source] ?? "",
      fmtDate(g.source_date), g.baseline ?? "", statusText(g), g.follow_up_date ? fmtDate(g.follow_up_date) : "",
      g.result_score ?? "", result(g), g.owner?.full_name ?? "", g.recommendation ?? ""]),
    fileName: "حلقة-التحسين",
    sheetName: "التوصيات",
    signatures: [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }],
  });
}
