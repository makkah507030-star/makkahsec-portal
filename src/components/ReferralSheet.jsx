// src/components/ReferralSheet.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import PrintPortal from "./PrintPortal.jsx";

/* =====================================================================
   ورقة إحالة الطالب — ملف واحد يوثّق المسار كاملًا:
   المعلم ← وكيل شؤون الطلاب ← الموجه الطلابي ← الإقفال ← ولي الأمر.
   كل مرحلة بتوقيع صاحبها وتاريخها، عدا ولي الأمر فيؤكّد استلامه.
   ===================================================================== */

const GOV = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

export const SHEET_W = 794;   // A4 عمودي بدقة الشاشة

const fmt = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  let h = "";
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",
      { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
    const g = (t) => parts.find((x) => x.type === t)?.value ?? "";
    h = `${g("day")}/${g("month")}/${String(g("year")).replace(/\D/g, "")}هـ`;
  } catch { /* تجاهل */ }
  return `${h} (${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()})`;
};

// الطباعة عبر PrintPortal: صفحة A4 عمودية ثابتة، بلا إزاحة ولا صفحات زائدة
export function ReferralPrintArea({ children }) {
  return (
    <PrintPortal id="ref-print"
                 extraCss="#ref-print .stage { break-inside: avoid; }">
      {children}
    </PrintPortal>
  );
}

function Stage({ n, title, who, at, sig, children, tone = "mint" }) {
  const c = tone === "gold"
    ? { bg: "#FCF5E6", fg: "#7E6318", bd: "#F0E3C4" }
    : { bg: "#EDFAF2", fg: "#3E6350", bd: "#D4EADD" };

  return (
    <div className="stage mt-3 rounded-[10px] border" style={{ borderColor: c.bd }}>
      <div className="flex items-center justify-between gap-3 rounded-t-[9px] px-3 py-1.5"
           style={{ background: c.bg, ...INK }}>
        <p className="text-[12.5px] font-bold" style={{ color: c.fg }}>
          <span className="num">{n}.</span> {title}
        </p>
        <p className="num text-[10.5px]" style={{ color: c.fg }}>{fmt(at)}</p>
      </div>

      <div className="px-3 py-2.5">
        {children}

        <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-line pt-2">
          <p className="text-[11px] text-muted">
            الاسم: <span className="font-semibold text-ink">{who || "—"}</span>
          </p>
          <div className="text-center">
            {sig ? (
              <img src={sig} alt="" className="mx-auto h-10 w-auto object-contain" />
            ) : (
              <div className="h-10" />
            )}
            <div className="mx-auto h-px w-32 bg-line" />
            <p className="mt-0.5 text-[10px] text-faint">التوقيع</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value }) => (
  <p className="text-[12px] leading-[1.9]">
    <span className="text-muted">{label}: </span>
    <span className="whitespace-pre-line font-medium text-ink">{value || "—"}</span>
  </p>
);

export default function ReferralSheet({ r, stampUrl }) {
  if (!r) return null;

  return (
    <div className="sheet mx-auto bg-white text-ink"
         style={{ width: "210mm", minHeight: "297mm",
                  padding: "13mm 14mm 12mm", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* الرأس */}
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

      {/* العنوان */}
      <div className="mt-4 text-center">
        <span className="rounded-pill px-5 py-1.5 text-[12px] font-semibold"
              style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
          نموذج إحالة طالب
        </span>
        <p className="num mt-2 text-[11px] text-faint">{r.serial}</p>
      </div>

      {/* بيانات الطالب */}
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-[10px] border border-line px-3 py-2.5">
        <Field label="الطالب" value={r.student_name} />
        <Field label="الصف والفصل" value={r.class_label} />
        <Field label="تاريخ الإحالة" value={fmt(r.referral_date)} />
      </div>

      {/* ① المعلم */}
      <Stage n="١" title="إحالة المعلم" who={r.teacher_name} at={r.teacher_at} sig={r.teacher_sig}>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="المادة" value={r.subject} />
          <Field label="الحصة" value={r.period_no ? `الحصة ${r.period_no}` : ""} />
        </div>
        <Field label="سبب التحويل" value={r.reason} />
        <Field label="ما تم عمله بخصوص المشكلة" value={r.done_in_class} />
      </Stage>

      {/* ② وكيل شؤون الطلاب */}
      <Stage n="٢" title="وكيل شؤون الطلاب" who={r.deputy_name} at={r.deputy_at} sig={r.deputy_sig}>
        <Field label="ما تم عمله والملاحظات" value={r.deputy_note} />
        {r.counselor_name && (
          <Field label="أُحيل إلى" value={r.counselor_name} />
        )}
      </Stage>

      {/* ③ الموجه الطلابي */}
      <Stage n="٣" title="الموجه الطلابي" who={r.counselor_name} at={r.counselor_at} sig={r.counselor_sig}>
        <Field label="الإجراء المتخذ والملاحظات" value={r.counselor_note} />
        {r.return_note && (
          <p className="mt-1.5 rounded-sm2 px-2.5 py-1.5 text-[11px]"
             style={{ background: "#FCF5E6", color: "#7E6318", ...INK }}>
            <b>أُعيدت للموجه: </b>{r.return_note}
          </p>
        )}
      </Stage>

      {/* ④ الإقفال */}
      {r.closed_at && (
        <Stage n="٤" title="اعتماد وإقفال الإحالة" who={r.deputy_name}
               at={r.closed_at} sig={r.deputy_sig}>
          <Field label="قرار الإقفال" value={r.close_note} />
        </Stage>
      )}

      {/* ⑤ ولي الأمر */}
      {(r.guardian_ack_at || r.status === "with_guardian") && (
        <Stage n="٥" title="إقرار ولي الأمر" tone="gold"
               who={r.guardian_ack_at ? "ولي أمر الطالب" : ""}
               at={r.guardian_ack_at} sig={null}>
          <Field label="تأكيد الاستلام"
                 value={r.guardian_ack_at ? "أقرّ ولي الأمر باطّلاعه على الإحالة." : "بانتظار تأكيد ولي الأمر"} />
          <Field label="رد ولي الأمر" value={r.guardian_note} />
        </Stage>
      )}

      {/* الختم والتذييل */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="text-[10px] text-faint">
          <p>بوابة مكة الثانوية الرقمية</p>
          <p className="num" dir="ltr">makkahsec.com</p>
        </div>
        {stampUrl && <img src={stampUrl} alt="" className="h-16 w-auto object-contain opacity-90" />}
        <div className="text-center">
          <p className="text-[11px] text-muted">مدير المدرسة</p>
          <div className="h-8" />
          <div className="mx-auto h-px w-40 bg-line" />
          <p className="mt-1 text-[11.5px] font-semibold">عبدالله بن حسن سليمان الفيفي</p>
        </div>
      </div>
    </div>
  );
}
