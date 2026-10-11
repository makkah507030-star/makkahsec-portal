// src/components/InquirySheet.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import PrintPortal from "./PrintPortal.jsx";
import { fmtHijri } from "../lib/dates";
import { LEVELS } from "../lib/guidanceInquiry";
import { PRINCIPAL_NAME, STUDENT_DEPUTY_NAME } from "../lib/signers.js";
import { usePrincipalSignature } from "../lib/principalSignature";
import { useSignatureByName } from "../lib/userSignatures.js";
import { levelBand } from "../lib/gradeBands.js";

/* =====================================================================
   ورقة «استمارة توضيح مستوى الطالب التحصيلي والسلوكي» — على نمط النموذج
   الورقي للتوجيه الطلابي، بإطار خطّي يوفّر حبر الطابعة.
   sigs: روابط التوقيعات { [مسار]: رابط موقّع }
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const GREEN = "#3E6350";
const cell = "border border-[#9DB5A6] px-1.5 py-1";
const TH = { background: "#EDFAF2", ...INK };
const weekday = (iso) => new Intl.DateTimeFormat("ar-SA", { weekday: "long" }).format(new Date(iso));

// طباعة الورقة وحدها: تُصغَّر 90% ويأخذ ارتفاعها مساحة الصفحة المتاحة، فتبقى صفحة واحدة
// حتى حين يضيف المتصفح هوامشه ورأسه وتذييله (كما في PrintArea بـ FormSheet.jsx)
export function InquiryPrintArea({ children }) {
  return (
    <PrintPortal id="inquiry-print"
                 extraCss={`#inquiry-print .sheet { zoom: 0.9; height: calc(100vh / 0.9) !important; margin: 0 auto !important; }
                   @supports (-webkit-touch-callout: none) { #inquiry-print .sheet { zoom: 0.86; height: 297mm !important; } }`}>
      {children}
    </PrintPortal>
  );
}

function Mark({ on }) {
  return <span className="text-[13px] font-bold">{on ? "✓" : ""}</span>;
}

// لون المستوى (ممتاز أخضر، جيد فيروزي، ضعيف أحمر): عنوان العمود، والخانة المختارة
const levelStyle = (t, on = true) => {
  const b = on ? levelBand(t) : null;
  return b ? { background: b.bg, color: b.text, fontWeight: 700, ...INK } : undefined;
};

/* توقيع معلم المادة: المحفوظ مع تعبئته، وإلا توقيعه من «توقيعي» بعد أن يعبّئ */
function TeacherSig({ url, name, filled }) {
  const u = useSignatureByName(filled ? name : "", url);
  return u ? <img src={u} alt="" className="mx-auto max-h-[8mm] w-auto object-contain" /> : null;
}

function Sign({ role, name, url, signed = true }) {
  // صورة التوقيع بعد أن يوقّع صاحبه فقط: المحفوظة، وإلا من «توقيعي» باسمه
  url = useSignatureByName(signed ? name : "", url);
  return (
    <div className="min-w-[170px] text-center">
      <p className="text-[12px] text-muted">{role}</p>
      <div className="grid h-12 place-items-center">
        {url && <img src={url} alt="" className="max-h-12 w-auto object-contain" />}
      </div>
      <div className="mx-auto h-px w-40 bg-line" />
      <p className="mt-1 text-[12.5px] font-semibold text-ink">{name || "…"}</p>
    </div>
  );
}

export default function InquirySheet({ inq, items, sigs = {}, scale = 1 }) {
  const date = inq.created_at;
  const principal = usePrincipalSignature();
  return (
    <div className="sheet mx-auto bg-white text-ink shadow-[0_18px_50px_-28px_rgba(16,16,16,.5)]"
         style={{ width: "210mm", height: "297mm", flex: "0 0 auto", position: "relative",
                  transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: "top center",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <div className="flex h-full flex-col px-[14mm] pb-[10mm] pt-[12mm]">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[11px] font-medium leading-[1.9]">
            <div>المملكة العربية السعودية</div>
            <div>وزارة التعليم</div>
            <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
            <div className="font-bold text-mint-deep">مدرسة مكة الثانوية — التوجيه الطلابي</div>
          </div>
          <div className="flex items-center gap-4">
            <img src={moeLogo} alt="وزارة التعليم" className="h-11 w-auto" />
            <img src={logoIcon} alt="مدرسة مكة الثانوية" className="h-11 w-auto" />
          </div>
        </div>
        <div className="mt-3 h-[2px] w-full" style={{ background: GREEN, ...INK }} />

        <div className="mt-3 flex justify-between text-[12px]">
          <span>التاريخ: <b className="num">{fmtHijri(date)}</b></span>
          <span>اليوم: <b>{weekday(date)}</b></span>
        </div>
        <h1 className="mx-auto mt-3 rounded-sm2 border border-ink px-6 py-1.5 text-center text-[17px] font-bold">
          استمارة توضيح مستوى الطالب التحصيلي والسلوكي
        </h1>
        <p className="mt-3 text-[12.5px] font-semibold">
          عزيزي المعلم نرجو تعبئة النموذج التالي بما يتناسب مع مستوى الطالب السلوكي والتحصيلي:
        </p>
        <div className="mt-2 flex justify-between text-[13px]">
          <span>اسم الطالب: <b>{inq.student_name}</b></span>
          <span>الصف: <b>{inq.class_label}</b></span>
        </div>

        <table className="mt-3 w-full border-collapse text-center text-[12px]">
          <thead>
            <tr>
              <th rowSpan={2} className={cell} style={TH}>المادة</th>
              <th colSpan={3} className={cell} style={TH}>مستوى الطالب التحصيلي</th>
              <th colSpan={3} className={cell} style={TH}>مستوى الطالب السلوكي</th>
              <th rowSpan={2} className={cell} style={TH}>معلم المادة</th>
              <th rowSpan={2} className={`${cell} w-[22mm]`} style={TH}>التوقيع</th>
            </tr>
            <tr>
              {[...LEVELS, ...LEVELS].map((l, i) => <th key={i} className={`${cell} w-[13mm] font-medium`} style={levelStyle(l.t) ?? TH}>{l.t}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td className={`${cell} text-right font-semibold`}>{x.subject}</td>
                {LEVELS.map((l) => <td key={`a${l.k}`} className={cell} style={levelStyle(l.t, x.academic === l.k)}><Mark on={x.academic === l.k} /></td>)}
                {LEVELS.map((l) => <td key={`b${l.k}`} className={cell} style={levelStyle(l.t, x.behavior === l.k)}><Mark on={x.behavior === l.k} /></td>)}
                <td className={`${cell} text-[11.5px]`}>{x.teacher_name ?? ""}</td>
                <td className={`${cell} h-[9mm]`}>
                  <TeacherSig url={x.sig ? sigs[x.sig] : null} name={x.teacher_name} filled={!!x.filled_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.some((x) => x.note) && (
          <div className="mt-2 space-y-0.5 text-[11.5px]">
            {items.filter((x) => x.note).map((x) => (
              <p key={x.id}><b>ملاحظة معلم {x.subject}:</b> {x.note}</p>
            ))}
          </div>
        )}

        <table className="mt-3 w-full border-collapse text-[12.5px]">
          <tbody>
            <tr>
              <th className={`${cell} w-[42mm] text-right`} style={TH}>رأي الموجه الطلابي</th>
              <td className={`${cell} h-[14mm] whitespace-pre-line`}>{inq.counselor_note ?? ""}</td>
            </tr>
            <tr>
              <th className={`${cell} text-right`} style={TH}>رأي وكيل شؤون الطلاب</th>
              <td className={`${cell} h-[14mm] whitespace-pre-line`}>{inq.deputy_note ?? ""}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-auto flex items-end justify-between pt-4">
          <Sign role="الموجه الطلابي" name={inq.counselor_name} url={sigs[inq.counselor_sig]} signed={!!inq.counselor_at} />
          {/* اسم الوكيل من «أسماء الموقّعين» حتى يبدي رأيه، وتوقيعه بعدها */}
          <Sign role="وكيل شؤون الطلاب" name={inq.deputy_name || STUDENT_DEPUTY_NAME} url={sigs[inq.deputy_sig]} signed={!!inq.deputy_at} />
          <Sign role="مدير المدرسة" name={principal.name || PRINCIPAL_NAME} url={principal.url} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[10.5px] text-faint">
          <span>بوابة مكة الثانوية الرقمية</span>
          <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}
