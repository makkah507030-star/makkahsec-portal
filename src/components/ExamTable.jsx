// src/components/ExamTable.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import { DAY_NAMES } from "../lib/schoolTime";

/* =====================================================================
   جدول اختبارات قابل للطباعة — بهوية المدرسة، مقاس A4 عمودي.
   ===================================================================== */

const GOV = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

const fmt = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  let h = "";
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",
      { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
    const g = (t) => parts.find((x) => x.type === t)?.value ?? "";
    h = `${g("day")}/${g("month")}/${String(g("year")).replace(/\D/g, "")}هـ`;
  } catch { /* تجاهل */ }
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}${h ? ` (${h})` : ""}`;
};

export function ExamPrintArea({ children }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #exam-print, #exam-print * { visibility: visible !important; }
          #exam-print { position: absolute; inset: 0; background: #fff; }
          #exam-print .sheet { box-shadow: none !important; margin: 0 !important; }
          #exam-print tr { break-inside: avoid; }
          .no-print { display: none !important; }
        }
        @page examprint { size: A4 portrait; margin: 0; }
        @media print { #exam-print { page: examprint; } }
      ` }} />
      <div id="exam-print">{children}</div>
    </>
  );
}

export default function ExamTable({ title, subtitle, rows = [], note, final = false, deputy = "" }) {
  // عمود الأسبوع يظهر فقط إذا امتدّت الاختبارات أسبوعين
  const twoWeeks = rows.some((r) => (r.exam_week ?? 1) > 1);
  return (
    <div className="sheet mx-auto flex bg-white text-ink"
         style={{ width: "210mm", minHeight: "297mm",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <div className="flex w-full flex-col px-[15mm] pb-[12mm] pt-[13mm]">

        <div className="flex items-start justify-between gap-4">
          <div className="text-[11px] font-medium leading-[1.9]">
            {GOV.map((l) => <div key={l}>{l}</div>)}
            <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
          </div>
          <div className="flex items-center gap-4">
            <img src={moeLogo} alt="" className="h-10 w-auto" />
            <img src={logoIcon} alt="" className="h-10 w-auto" />
          </div>
        </div>
        <div className="mt-2.5 h-px w-full" style={{
          background: "linear-gradient(90deg,transparent,#3E635022 12%,#3E6350 50%,#3E635022 88%,transparent)",
          ...INK }} />

        <div className="mt-5 text-center">
          <span className="rounded-pill px-5 py-1.5 text-[12.5px] font-semibold"
                style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
            {title}
          </span>
          {subtitle && <p className="mt-2.5 text-[16px] font-bold text-ink">{subtitle}</p>}
        </div>

        <table className="mt-5 w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {["م", "المادة", ...(twoWeeks ? ["الأسبوع"] : []), "اليوم", "التاريخ",
                final ? "الفترة" : "الحصة"].map((h) => (
                <th key={h} className="border border-line px-2 py-2 text-center font-semibold text-mint-deep"
                    style={{ background: "#EDFAF2", ...INK }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i}>
                <td className="num border border-line px-2 py-2 text-center">{i + 1}</td>
                <td className="border border-line px-2 py-2 font-medium">{r.subject_name || "—"}</td>
                {twoWeeks && (
                  <td className="border border-line px-2 py-2 text-center">
                    {(r.exam_week ?? 1) === 2 ? "الثاني" : "الأول"}
                  </td>
                )}
                <td className="border border-line px-2 py-2 text-center">
                  {DAY_NAMES[r.day_of_week] ?? "—"}
                </td>
                <td className="num border border-line px-2 py-2 text-center text-[11px]">
                  {fmt(r.exam_date)}
                </td>
                <td className="num border border-line px-2 py-2 text-center">
                  {final ? (r.period_no === 2 ? "الثانية" : "الأولى") : r.period_no ?? "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={twoWeeks ? 6 : 5} className="border border-line px-2 py-6 text-center text-faint">
                لم تُحدَّد اختبارات بعد
              </td></tr>
            )}
          </tbody>
        </table>

        {note && (
          <p className="mt-4 rounded-[10px] px-3 py-2.5 text-[11.5px] leading-relaxed"
             style={{ background: "#EDFAF2", color: "#2F5544", ...INK }}>
            <b>ملاحظة: </b>{note}
          </p>
        )}

        <div className="mt-auto">
          <div className="grid grid-cols-2 gap-8 pt-8 text-center">
            <div>
              <p className="text-[12px] text-muted">وكيل شؤون الطلاب</p>
              <div className="h-8" />
              <div className="mx-auto h-px w-44 bg-line" />
              <p className="mt-1.5 text-[12.5px] font-semibold">{deputy || "…"}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted">مدير المدرسة</p>
              <div className="h-8" />
              <div className="mx-auto h-px w-44 bg-line" />
              <p className="mt-1.5 text-[12.5px] font-semibold">عبدالله بن حسن سليمان الفيفي</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[10px] text-faint">
            <span>بوابة مكة الثانوية الرقمية</span>
            <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
