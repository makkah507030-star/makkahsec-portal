// src/components/FormReport.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   تقرير النماذج الصادرة — غلاف رسمي + جدول بالمستندات.
   يُطبع بمقاس A4 عمودي، ويُحفظ PDF من نافذة الطباعة.
   ===================================================================== */

const GOV_LINES = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

const STATUS_AR = {
  issued: "صادر",
  approved: "معتمد",
  pending: "بانتظار الاعتماد",
  rejected: "مُعاد للتعديل",
  awaiting_reply: "بانتظار رد المستفيد",
  replied: "وصل الرد",
};

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

export function ReportPrintArea({ children }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #report-root, #report-root * { visibility: visible !important; }
          #report-root { position: absolute; inset: 0; background: #fff; }
          #report-root .sheet { box-shadow: none !important; break-after: page; margin: 0 !important; }
          #report-root .sheet:last-child { break-after: auto; }
          #report-root thead { display: table-header-group; }
          #report-root tr { break-inside: avoid; }
          .no-print { display: none !important; }
        }
        @page reportroot { size: A4 portrait; margin: 0; }
        @media print { #report-root { page: reportroot; } }
      ` }} />
      <div id="report-root">{children}</div>
    </>
  );
}

function Head() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-[11px] font-medium leading-[1.9] text-ink">
        {GOV_LINES.map((l) => <div key={l}>{l}</div>)}
        <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
      </div>
      <div className="flex items-center gap-4">
        <img src={moeLogo} alt="" className="h-10 w-auto" />
        <img src={logoIcon} alt="" className="h-10 w-auto" />
      </div>
    </div>
  );
}

function Rule() {
  return (
    <div className="h-px w-full" style={{
      background: "linear-gradient(90deg, transparent 0%, #3E635022 12%, #3E6350 50%, #3E635022 88%, transparent 100%)",
      ...INK }} />
  );
}

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  let h = "";
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",
      { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
    const g = (t) => parts.find((x) => x.type === t)?.value ?? "";
    h = `${g("day")}/${g("month")}/${String(g("year")).replace(/\D/g, "")}هـ`;
  } catch { /* تجاهل */ }
  return `${h} (${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}م)`;
};

/* ----------------------------- الغلاف ----------------------------- */
function Cover({ title, dept, rows, from, to, issuedBy, ack }) {
  const counts = rows.reduce((a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a; }, {});
  const ackSummary = ack ? {
    sent: rows.filter((r) => r.sent_at).length,
    acked: rows.filter((r) => r.reply_at).length,
    pending: rows.filter((r) => r.sent_at && !r.reply_at).length,
  } : null;
  const issuers = [...new Set(rows.map((r) => r.issuer_name).filter(Boolean))];

  return (
    <div className="sheet mx-auto flex bg-white text-ink"
         style={{ width: "210mm", height: "297mm", flex: "0 0 auto",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <div className="relative flex h-full w-full flex-col px-[20mm] pb-[16mm] pt-[16mm]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[70mm]"
             style={{ background: "linear-gradient(180deg,#EDFAF2 0%,#F7FCF9 60%,#FFFFFF 100%)", ...INK }} />

        <div className="relative">
          <Head />
          <div className="mt-3"><Rule /></div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center text-center">
          <span className="rounded-pill px-5 py-1.5 text-[12px] font-semibold"
                style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
            تقرير النماذج الصادرة
          </span>

          <h1 className="mt-5 text-[32px] font-bold leading-tight text-mint-deep">{title}</h1>
          {dept && <p className="mt-1.5 text-[15px] text-muted">{dept}</p>}

          <div className="mt-8 grid w-full max-w-[120mm] grid-cols-2 gap-3">
            <div className="rounded-card border border-line px-4 py-4">
              <p className="num text-[30px] font-bold leading-none text-mint-deep">{rows.length}</p>
              <p className="mt-1.5 text-[12px] text-muted">إجمالي المستندات</p>
            </div>
            <div className="rounded-card border border-line px-4 py-4">
              <p className="num text-[30px] font-bold leading-none text-mint-deep">{issuers.length}</p>
              <p className="mt-1.5 text-[12px] text-muted">عدد المُصدِرين</p>
            </div>
          </div>

          {ackSummary && (
            <div className="mt-4 grid w-full max-w-[120mm] grid-cols-3 gap-3">
              <div className="rounded-card border border-line px-3 py-3">
                <p className="num text-[22px] font-bold leading-none text-mint-deep">{ackSummary.sent}</p>
                <p className="mt-1.5 text-[11px] text-muted">أُرسل إليهم</p>
              </div>
              <div className="rounded-card border border-line px-3 py-3">
                <p className="num text-[22px] font-bold leading-none text-mint-deep">{ackSummary.acked}</p>
                <p className="mt-1.5 text-[11px] text-muted">اطّلعوا وأقرّوا</p>
              </div>
              <div className="rounded-card border border-line px-3 py-3">
                <p className="num text-[22px] font-bold leading-none text-warning">{ackSummary.pending}</p>
                <p className="mt-1.5 text-[11px] text-muted">بانتظار الإقرار</p>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {Object.entries(counts).map(([k, n]) => (
              <span key={k} className="rounded-pill border border-line px-3 py-1 text-[11.5px] text-muted">
                {STATUS_AR[k] ?? k}: <span className="num font-semibold text-ink">{n}</span>
              </span>
            ))}
          </div>

          <p className="num mt-8 text-[13px] text-muted">
            الفترة: {from ? fmt(from) : "من البداية"} — {to ? fmt(to) : "حتى اليوم"}
          </p>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 items-end gap-6">
            <div className="text-center">
              <p className="text-[12px] text-muted">أعدّ التقرير</p>
              <div className="h-10" />
              <div className="mx-auto h-px w-44 bg-line" />
              <p className="mt-1 text-[13px] font-semibold text-ink">{issuedBy || "…"}</p>
            </div>
            <div className="text-center">
              <p className="text-[12px] text-muted">مدير المدرسة</p>
              <div className="h-10" />
              <div className="mx-auto h-px w-44 bg-line" />
              <p className="mt-1 text-[13px] font-semibold text-ink">…</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 text-[10.5px] text-faint">
            <span>بوابة مكة الثانوية الرقمية</span>
            <span className="num">تاريخ الإصدار: {fmt(new Date().toISOString())}</span>
            <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- صفحات الجدول ------------------------- */
const PER_PAGE = 18;

function TablePage({ title, rows, startIndex, page, pages, ack }) {
  const heads = ack
    ? ["م", "رقم الإصدار", "المستفيد", "أُرسل إليه", "اطّلع وأقرّ", "وقّع", "ملاحظات"]
    : ["م", "رقم الإصدار", "التاريخ", "المستفيد", "المُصدِر", "الحالة", "ملاحظات"];
  return (
    <div className="sheet mx-auto flex bg-white text-ink"
         style={{ width: "210mm", height: "297mm", flex: "0 0 auto",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <div className="flex h-full w-full flex-col px-[15mm] pb-[14mm] pt-[14mm]">
        <Head />
        <div className="mt-3"><Rule /></div>

        <p className="mt-4 text-[15px] font-bold text-ink">{title}</p>

        <table className="mt-2 w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {heads.map((h) => (
                <th key={h} className="border border-line px-2 py-1.5 text-center font-semibold text-mint-deep"
                    style={{ background: "#EDFAF2", ...INK }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="num border border-line px-1.5 py-1.5 text-center">{startIndex + i + 1}</td>
                <td className="num border border-line px-1.5 py-1.5 text-center">{r.serial}</td>
                {ack ? (
                  <>
                    <td className="border border-line px-1.5 py-1.5">{r.recipient || "—"}</td>
                    <td className="num border border-line px-1.5 py-1.5 text-center text-[10.5px]">
                      {r.sent_at ? fmt(r.sent_at) : "لم يُرسل"}
                    </td>
                    <td className="num border border-line px-1.5 py-1.5 text-center text-[10.5px]">
                      {r.reply_at ? fmt(r.reply_at) : "—"}
                    </td>
                    <td className="border border-line px-1.5 py-1.5 text-center">
                      {r.signed ? "✓" : "—"}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="num border border-line px-1.5 py-1.5 text-center text-[10.5px]">
                      {fmt(r.created_at)}
                    </td>
                    <td className="border border-line px-1.5 py-1.5">{r.recipient || "—"}</td>
                    <td className="border border-line px-1.5 py-1.5">{r.issuer_name || "—"}</td>
                    <td className="border border-line px-1.5 py-1.5 text-center text-[10.5px]">
                      {STATUS_AR[r.status] ?? r.status}
                    </td>
                  </>
                )}
                <td className="border border-line px-1.5 py-1.5" style={{ minWidth: "26mm" }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[10.5px] text-faint">
          <span>بوابة مكة الثانوية الرقمية</span>
          <span className="num">صفحة {page} من {pages}</span>
          <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

export default function FormReport({ title, dept, rows, from, to, issuedBy, ack }) {
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  return (
    <>
      <Cover title={title} dept={dept} rows={rows} from={from} to={to} issuedBy={issuedBy} ack={ack} />
      {Array.from({ length: pages }).map((_, p) => (
        <TablePage key={p} title={title} ack={ack}
                   rows={rows.slice(p * PER_PAGE, (p + 1) * PER_PAGE)}
                   startIndex={p * PER_PAGE} page={p + 1} pages={pages} />
      ))}
    </>
  );
}
