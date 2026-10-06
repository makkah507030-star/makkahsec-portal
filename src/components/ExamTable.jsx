// src/components/ExamTable.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import { DAY_NAMES } from "../lib/schoolTime";
import PrintPortal from "./PrintPortal.jsx";
import PrincipalSign from "./PrincipalSign.jsx";
import { PRINCIPAL_NAME } from "../lib/exportUtils.js";
import { useSchoolStamp } from "../lib/principalSignature";

/* =====================================================================
   جدول اختبارات قابل للطباعة — بهوية المدرسة، مقاس A4 عمودي.
   ===================================================================== */

const GOV = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

// التاريخ سطران: الهجري فوق والميلادي تحته، فلا يلتبس على الطالب
const dates = (s) => {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  let h = "";
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",
      { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
    const g = (t) => parts.find((x) => x.type === t)?.value ?? "";
    h = `${g("day")}/${g("month")}/${String(g("year")).replace(/\D/g, "")}`;
  } catch { /* تجاهل */ }
  return { h, g: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` };
};

function DateCell({ value }) {
  const d = dates(value);
  if (!d) return "—";
  return (
    <>
      {d.h && <span className="block text-[12px] font-semibold text-ink">{d.h}</span>}
      <span className="block text-[10.5px] text-muted">{d.g}</span>
    </>
  );
}

// الطباعة عبر PrintPortal: صفحة A4 عمودية ثابتة، بلا إزاحة ولا صفحات زائدة
export function ExamPrintArea({ children }) {
  return (
    <PrintPortal id="exam-print"
                 extraCss="#exam-print tr, #exam-print tbody { break-inside: avoid; }">
      {children}
    </PrintPortal>
  );
}

// ترتيب الجدول: بالتاريخ (أو الأسبوع ثم اليوم)، ثم الحصة
const order = (a, b) =>
  (a.exam_date && b.exam_date ? a.exam_date.localeCompare(b.exam_date) : 0) ||
  ((a.exam_week ?? 1) - (b.exam_week ?? 1)) ||
  ((a.day_of_week ?? 0) - (b.day_of_week ?? 0)) ||
  ((a.period_no ?? 0) - (b.period_no ?? 0));

export default function ExamTable({ title, subtitle, rows = [], note, final = false, deputy = "", deputySig = null }) {
  // عمود الأسبوع يظهر فقط إذا امتدّت الاختبارات أسبوعين
  const twoWeeks = rows.some((r) => (r.exam_week ?? 1) > 1);

  // اليوم الواحد صف واحد: تُدمج خلايا اليوم والتاريخ، وتحتها مواده بحصصها
  const days = [];
  [...rows].sort(order).forEach((r) => {
    const k = `${r.exam_week ?? 1}|${r.day_of_week ?? ""}|${r.exam_date ?? ""}`;
    const last = days[days.length - 1];
    if (last?.key === k) last.items.push(r); else days.push({ key: k, items: [r] });
  });
  const cell = "border border-line px-2 py-2 text-center";
  const stamp = useSchoolStamp();

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
              {[...(twoWeeks ? ["الأسبوع"] : []), "اليوم", "التاريخ", "المادة",
                final ? "الفترة" : "الحصة"].map((h) => (
                <th key={h} className="border border-line px-2 py-2 text-center font-semibold text-mint-deep"
                    style={{ background: "#EDFAF2", ...INK }}>{h}</th>
              ))}
            </tr>
          </thead>
          {/* كل يوم في tbody مستقل لا ينقسم بين صفحتين */}
          {days.map((d, di) => {
            const head = d.items[0];
            const span = d.items.length;
            // الأيام بالتناوب أبيض ورمادي فاتح، ليميز الطالب كل يوم بمواده
            return (
              <tbody key={d.key} style={{ breakInside: "avoid", ...(di % 2 ? { background: "#F1F3F2", ...INK } : {}) }}>
                {d.items.map((r, i) => (
                  <tr key={r.id ?? i}>
                    {i === 0 && (
                      <>
                        {twoWeeks && (
                          <td rowSpan={span} className={cell}>{(head.exam_week ?? 1) === 2 ? "الثاني" : "الأول"}</td>
                        )}
                        <td rowSpan={span} className={`${cell} font-semibold`}>{DAY_NAMES[head.day_of_week] ?? "—"}</td>
                        <td rowSpan={span} className={`${cell} num leading-[1.5]`}><DateCell value={head.exam_date} /></td>
                      </>
                    )}
                    <td className={`${cell} font-medium`}>{r.subject_name || "—"}</td>
                    <td className={`${cell} num`}>
                      {final ? (r.period_no === 2 ? "الثانية" : "الأولى") : r.period_no ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          {rows.length === 0 && (
            <tbody>
              <tr><td colSpan={twoWeeks ? 5 : 4} className="border border-line px-2 py-6 text-center text-faint">
                لم تُحدَّد اختبارات بعد
              </td></tr>
            </tbody>
          )}
        </table>

        {note && (
          <p className="mt-4 rounded-[10px] px-3 py-2.5 text-[11.5px] leading-relaxed"
             style={{ background: "#EDFAF2", color: "#2F5544", ...INK }}>
            <b>ملاحظة: </b>{note}
          </p>
        )}

        <div className="mt-auto">
          {/* التوقيعان على الجانبين، والختم بينهما */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-6 pt-8 text-center">
            <div>
              <p className="text-[12px] text-muted">وكيل شؤون الطلاب</p>
              <div className="flex h-14 items-end justify-center">
                {deputySig && <img src={deputySig} alt="" className="h-full w-auto max-w-[45mm] object-contain" />}
              </div>
              <div className="mx-auto h-px w-44 bg-line" />
              <p className="mt-1.5 text-[12.5px] font-semibold">{deputy || "…"}</p>
            </div>
            <div className="flex w-[32mm] items-center justify-center self-center">
              {stamp && <img src={stamp} alt="" className="h-[28mm] w-auto object-contain opacity-90" style={INK} />}
            </div>
            <div>
              <p className="text-[12px] text-muted">مدير المدرسة</p>
              <PrincipalSign height="h-14" />
              <div className="mx-auto h-px w-44 bg-line" />
              <p className="mt-1.5 text-[12.5px] font-semibold">{PRINCIPAL_NAME}</p>
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
