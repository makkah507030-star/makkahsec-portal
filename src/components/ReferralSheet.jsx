// src/components/ReferralSheet.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import PrintPortal from "./PrintPortal.jsx";
import PrincipalSign from "./PrincipalSign.jsx";
import { PRINCIPAL_NAME, STUDENT_DEPUTY_NAME } from "../lib/exportUtils.js";
import { degreeName, violationPhrase, BEHAVIOR_SOURCE } from "../lib/behavior.js";
import { fmtDate } from "../lib/dates";

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
  return fmtDate(ts);
};

// الطباعة عبر PrintPortal: صفحة A4 عمودية ثابتة، بلا إزاحة ولا صفحات زائدة
export function ReferralPrintArea({ children }) {
  return (
    <PrintPortal id="ref-print"
                 extraCss="#ref-print .stage { break-inside: avoid; } #ref-print .sheet + .sheet { break-before: page; }">
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

export default function ReferralSheet({ r, stampUrl, guardianView = false }) {
  if (!r) return null;
  if (r.kind === "behavior") return <BehaviorSheets r={r} stampUrl={stampUrl} guardianView={guardianView} />;

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
          <PrincipalSign height="h-8" />
          <div className="mx-auto h-px w-40 bg-line" />
          <p className="mt-1 text-[11.5px] font-semibold">{PRINCIPAL_NAME}</p>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   إحالة مخالفة سلوكية — على نماذج دليل السلوك والمواظبة 1447:
   • نموذج (7) «سري: إحالة طالب» من وكيل شؤون الطلاب للموجه الطلابي،
     ومعه إجراء الموجه واعتماد الوكيل.
   • نموذج (9) «سري: إشعار ولي أمر الطالب بمشكلة سلوكية» بعد الاعتماد،
     وهو ما يظهر لولي الأمر والطالب.
   ===================================================================== */

/** عدد صفحات الملف — لتحجيم المعاينة المصغّرة */
export const sheetPages = (r, guardianView = false) =>
  r?.kind === "behavior" && !guardianView && r.closed_at ? 2 : 1;

/** أسطر خطاب الإحالة — للمعاينة قبل الإرسال وللنموذج نفسه */
export function behaviorLetter(r) {
  return [
    `المكرم الموجه الطلابي${r.counselor_name ? ` / ${r.counselor_name}` : ""}`,
    "السلام عليكم ورحمة الله وبركاته، وبعد:",
    `نحيل إليكم الطالب / ${r.student_name}، بالصف / ${r.class_label}، ذا المشكلة السلوكية من الدرجة (${degreeName(r.violation_degree)})، وهي: ${violationPhrase(r.violation_text)}${r.violation_date ? `، وذلك بتاريخ ${fmt(r.violation_date)}` : ""}.`,
    "يرجى منكم متابعة الطالب ودراسة حالته، ووضع الحلول التربوية والعلاجية المناسبة، مع إعادة النموذج لوكيل شؤون الطلاب بعد الإجراء للاعتماد والإرسال لولي الأمر.",
    "وتقبلوا وافر التحية والتقدير،،،",
  ];
}

const lines = (t) => String(t ?? "").split(/\n+/).map((x) => x.replace(/^[\s\-–•\d.)]+/, "").trim()).filter(Boolean);

function Head({ title, serial, secret = true }) {
  return (
    <>
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
        background: "linear-gradient(90deg,transparent,#3E635022 12%,#3E6350 50%,#3E635022 88%,transparent)", ...INK }} />
      <div className="mt-4 text-center">
        {secret && <p className="text-[12px] font-bold tracking-wide text-absent">سري</p>}
        <span className="mt-1 inline-block rounded-pill px-5 py-1.5 text-[13px] font-bold"
              style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>{title}</span>
        {serial && <p className="num mt-1.5 text-[11px] text-faint">{serial}</p>}
      </div>
    </>
  );
}

function SignRow({ title, name, sig, at, stampUrl }) {
  return (
    <div className="mt-4 flex items-end justify-between gap-4">
      <div className="w-40 text-center">
        {stampUrl ? <img src={stampUrl} alt="" className="mx-auto h-16 w-auto object-contain opacity-90" />
                  : <p className="text-[11px] text-faint">الختم</p>}
      </div>
      <div className="text-center">
        <p className="text-[11px] text-muted">{title}</p>
        {sig ? <img src={sig} alt="" className="mx-auto h-10 w-auto object-contain" /> : <div className="h-10" />}
        <div className="mx-auto h-px w-44 bg-line" />
        <p className="mt-1 text-[12px] font-semibold">{name || "—"}</p>
        {at && <p className="num text-[10.5px] text-faint">{fmt(at)}</p>}
      </div>
    </div>
  );
}

const Foot = () => (
  <div className="mt-auto flex items-end justify-between pt-4 text-[10px] text-faint">
    <p>{BEHAVIOR_SOURCE}</p>
    <p className="num" dir="ltr">makkahsec.com</p>
  </div>
);

const SHEET_STYLE = { width: "210mm", minHeight: "297mm", padding: "13mm 14mm 12mm",
                      fontFamily: "'IBM Plex Sans Arabic', sans-serif", display: "flex", flexDirection: "column" };

function BehaviorSheets({ r, stampUrl, guardianView }) {
  const steps = lines(r.counselor_note);
  const notice = Boolean(r.closed_at);
  return (
    <>
      {!guardianView && (
        <div className="sheet mx-auto bg-white text-ink" style={SHEET_STYLE}>
          <Head title="إحالة طالب" serial={r.serial} />
          <div className="mt-5 space-y-1.5 px-1">
            {behaviorLetter(r).map((l, i) => (
              <p key={i} className={`text-[13.5px] leading-[2.1] ${i === 0 ? "font-bold" : ""} ${i === 1 || i === 4 ? "text-center" : ""}`}>{l}</p>
            ))}
          </div>
          {r.deputy_note && <Field label="ملاحظات الوكيل" value={r.deputy_note} />}
          <SignRow title="وكيل شؤون الطلاب" name={r.deputy_name || STUDENT_DEPUTY_NAME} sig={r.deputy_sig} at={r.deputy_at} stampUrl={stampUrl} />

          <Stage n="١" title="إجراء الموجه الطلابي" who={r.counselor_name} at={r.counselor_at} sig={r.counselor_sig}>
            <Field label="دراسة الحالة والحلول التربوية والعلاجية" value={r.counselor_note} />
            {r.return_note && (
              <p className="mt-1.5 rounded-sm2 px-2.5 py-1.5 text-[11px]" style={{ background: "#FCF5E6", color: "#7E6318", ...INK }}>
                <b>أُعيدت للموجه: </b>{r.return_note}
              </p>
            )}
          </Stage>
          {r.closed_at && (
            <Stage n="٢" title="اعتماد وكيل شؤون الطلاب والإرسال لولي الأمر" who={r.deputy_name} at={r.closed_at} sig={r.deputy_sig}>
              <Field label="الاعتماد" value={r.close_note} />
            </Stage>
          )}
          <Foot />
        </div>
      )}

      {(notice || guardianView) && (
        <div className="sheet mx-auto bg-white text-ink" style={SHEET_STYLE}>
          <Head title="إشعار ولي أمر الطالب بمشكلة سلوكية" serial={r.serial} />
          <div className="mt-5 space-y-1 px-1 text-[13.5px] leading-[2.1]">
            <p className="font-bold">المكرم ولي أمر الطالب / {r.student_name}</p>
            <p>بالصف / {r.class_label}</p>
            <p className="text-center">السلام عليكم ورحمة الله وبركاته، وبعد:</p>
            <p>نشعركم بأن الطالب قام بمشكلة سلوكية من الدرجة ({degreeName(r.violation_degree)})،
              وهي: {violationPhrase(r.violation_text)}{r.violation_date ? `، بتاريخ ${fmt(r.violation_date)}` : ""}.</p>
            <p>وقد قُرّرت الإجراءات التالية حياله وفق ما ورد في قواعد السلوك والمواظبة:</p>
            <ol className="list-inside list-decimal pr-2">
              {(steps.length ? steps : ["متابعة الطالب ودراسة حالته من قبل الموجه الطلابي."]).map((x, i) => <li key={i}>{x}</li>)}
            </ol>
            <p>لذا يرجى منكم المتابعة والتعاون مع المدرسة بما يسهم في انضباط سلوك ابنكم.</p>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="w-40 text-center">
              {stampUrl ? <img src={stampUrl} alt="" className="mx-auto h-16 w-auto object-contain opacity-90" />
                        : <p className="text-[11px] text-faint">الختم</p>}
            </div>
            <div className="text-center">
              <p className="text-[11px] text-muted">مدير المدرسة</p>
              <PrincipalSign height="h-10" />
              <div className="mx-auto h-px w-44 bg-line" />
              <p className="mt-1 text-[12px] font-semibold">{PRINCIPAL_NAME}</p>
              {r.closed_at && <p className="num text-[10.5px] text-faint">{fmt(r.closed_at)}</p>}
            </div>
          </div>

          <Stage n="١" title="إقرار ولي الأمر" tone="gold" who={r.guardian_ack_at ? "ولي أمر الطالب" : ""} at={r.guardian_ack_at} sig={null}>
            <Field label="تأكيد الاستلام"
                   value={r.guardian_ack_at ? "أقرّ ولي الأمر بالاطّلاع على الإشعار." : "بانتظار تأكيد ولي الأمر"} />
            <Field label="رد ولي الأمر" value={r.guardian_note} />
          </Stage>
          <Foot />
        </div>
      )}
    </>
  );
}

// مشتركة مع نماذج السلوك والمواظبة (BehaviorSheet)
export { Head as OfficialHead, Foot as GuideFoot, SHEET_STYLE, fmt as fmtDual, Field as SheetField };
