// src/components/DutyReport.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import { DAY_NAMES } from "../lib/schoolTime";

/* =====================================================================
   تقرير المناوبة والإشراف — غلاف رسمي وجداول جاهزة للطباعة أو الحفظ PDF.
   ===================================================================== */

const GOV = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

const fmtG = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export function DutyPrintArea({ children }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #duty-print, #duty-print * { visibility: visible !important; }
          #duty-print { position: absolute; inset: 0; background: #fff; }
          #duty-print .sheet { box-shadow: none !important; break-after: page; margin: 0 !important; }
          #duty-print .sheet:last-child { break-after: auto; }
          #duty-print thead { display: table-header-group; }
          #duty-print tr { break-inside: avoid; }
          .no-print { display: none !important; }
        }
        @page { size: 210mm 297mm; margin: 0; }
      ` }} />
      <div id="duty-print">{children}</div>
    </>
  );
}

function Head() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] font-medium leading-[1.9] text-ink">
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
    </>
  );
}

function Sheet({ children, page, pages }) {
  return (
    <div className="sheet mx-auto flex bg-white text-ink"
         style={{ width: "210mm", minHeight: "297mm", flex: "0 0 auto",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <div className="flex w-full flex-col px-[14mm] pb-[12mm] pt-[13mm]">
        <Head />
        <div className="mt-4 flex-1">{children}</div>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[10px] text-faint">
          <span>بوابة مكة الثانوية الرقمية</span>
          <span className="num">صفحة {page} من {pages}</span>
          <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

const PER_PAGE = 26;

export default function DutyReport({ duty = [], supervision = [], term = "", issuedBy = "" }) {
  const dutyPages = Math.max(1, Math.ceil(duty.length / PER_PAGE));
  const total = dutyPages + (supervision.length ? 1 : 0);
  let page = 0;

  const byDay = [1, 2, 3, 4, 5].map((d) => ({
    d,
    teachers: supervision.filter((s) => s.day_of_week === d && s.kind === "teacher"),
    sups: supervision.filter((s) => s.day_of_week === d && s.kind === "supervisor"),
  }));

  return (
    <>
      {/* ——— جدول المناوبة ——— */}
      {Array.from({ length: dutyPages }).map((_, p) => {
        page += 1;
        const slice = duty.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
        return (
          <Sheet key={`d${p}`} page={page} pages={total}>
            {p === 0 && (
              <div className="mb-4 text-center">
                <span className="rounded-pill px-5 py-1.5 text-[12px] font-semibold"
                      style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
                  جدول المناوبة اليومية
                </span>
                {term && <p className="mt-2 text-[13px] text-muted">{term}</p>}
              </div>
            )}

            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {["م", "اليوم", "التاريخ", "هجري", "المناوب الأول", "المناوب الثاني", "التوقيع"].map((h) => (
                    <th key={h} className="border border-line px-2 py-1.5 text-center font-semibold text-mint-deep"
                        style={{ background: "#EDFAF2", ...INK }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((r, i) => (
                  <tr key={r.id}>
                    <td className="num border border-line px-1.5 py-1.5 text-center">{p * PER_PAGE + i + 1}</td>
                    <td className="border border-line px-1.5 py-1.5 text-center">{r.day_label || "—"}</td>
                    <td className="num border border-line px-1.5 py-1.5 text-center">{fmtG(r.duty_date)}</td>
                    <td className="num border border-line px-1.5 py-1.5 text-center text-[10.5px]">
                      {r.hijri_label || "—"}
                    </td>
                    <td className="border border-line px-1.5 py-1.5">{r.name_a || "—"}</td>
                    <td className="border border-line px-1.5 py-1.5">{r.name_b || "—"}</td>
                    <td className="border border-line px-1.5 py-1.5" style={{ minWidth: "22mm" }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {p === dutyPages - 1 && <Signatures issuedBy={issuedBy} />}
          </Sheet>
        );
      })}

      {/* ——— جدول الإشراف ——— */}
      {supervision.length > 0 && (() => {
        page += 1;
        return (
          <Sheet key="sup" page={page} pages={total}>
            <div className="mb-4 text-center">
              <span className="rounded-pill px-5 py-1.5 text-[12px] font-semibold"
                    style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
                جدول الإشراف اليومي
              </span>
              {term && <p className="mt-2 text-[13px] text-muted">{term}</p>}
            </div>

            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {["اليوم", "المعلمون المشرفون", "المشرف المتابع", "التوقيع"].map((h) => (
                    <th key={h} className="border border-line px-2 py-1.5 text-center font-semibold text-mint-deep"
                        style={{ background: "#EDFAF2", ...INK }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byDay.map(({ d, teachers, sups }) => (
                  <tr key={d}>
                    <td className="border border-line px-2 py-2 text-center font-semibold">{DAY_NAMES[d]}</td>
                    <td className="border border-line px-2 py-2 leading-[2]">
                      {teachers.length ? teachers.map((t) => t.person_name).join(" · ") : "—"}
                    </td>
                    <td className="border border-line px-2 py-2 text-center">
                      {sups.length ? sups.map((t) => t.person_name).join(" · ") : "—"}
                    </td>
                    <td className="border border-line px-2 py-2" style={{ minWidth: "24mm" }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Signatures issuedBy={issuedBy} />
          </Sheet>
        );
      })()}
    </>
  );
}

function Signatures({ issuedBy }) {
  return (
    <div className="mt-10 grid grid-cols-2 gap-8 text-center">
      <div>
        <p className="text-[12px] text-muted">وكيل الشؤون التعليمية</p>
        <div className="h-9" />
        <div className="mx-auto h-px w-44 bg-line" />
        <p className="mt-1.5 text-[12.5px] font-semibold">{issuedBy || "…"}</p>
      </div>
      <div>
        <p className="text-[12px] text-muted">مدير المدرسة</p>
        <div className="h-9" />
        <div className="mx-auto h-px w-44 bg-line" />
        <p className="mt-1.5 text-[12.5px] font-semibold">عبدالله بن حسن سليمان الفيفي</p>
      </div>
    </div>
  );
}
