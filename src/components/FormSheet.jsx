// src/components/FormSheet.jsx
import { Fragment } from "react";
import logoIcon from "../assets/icon-mint.png";
import { noEra } from "../lib/dates";
import moeLogo from "../assets/moe-logo.png";
import PrintPortal from "./PrintPortal.jsx";
import { OFFICIAL_LEVELS, RATING_LEVELS, gradeTone, itemPoints, officialLabel, overallLabel, ratingLabel, rubricScore, weightedRating } from "../lib/rubric.js";
import { PRINCIPAL_NAME } from "../lib/signers.js";
import { GuestCertificateBody } from "./GuestCertificate.jsx";
import { toHijri } from "./DateField.jsx";

/* =====================================================================
   ورقة النموذج القابلة للطباعة — هوية مدرسة مكة الثانوية.
   الإطار خطّي لا مساحات مصمتة، حفاظًا على حبر الطابعة.

   تُلف الأوراق داخل <PrintArea> فتُطبع وحدها، ويمكن أن تحوي
   أكثر من ورقة فتُطبع كلها دفعة واحدة، كل واحدة في صفحة.
   ===================================================================== */

const GOV_LINES = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

export const SHEET_PX = { portrait: 794, landscape: 1123 };

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

// الطباعة عبر PrintPortal: صفحة A4 بالاتجاه المحدد ثابتة، بلا إزاحة ولا صفحات زائدة
export function PrintArea({ landscape, children }) {
  return (
    <PrintPortal id="print-root" landscape={landscape}
                 extraCss="#print-root .sheet { break-after: page; } #print-root .sheet:last-child { break-after: auto; }">
      {children}
    </PrintPortal>
  );
}

function Head({ small }) {
  const h = small ? "h-9" : "h-11";
  return (
    <div className="flex items-start justify-between gap-4">
      <div className={`${small ? "text-[10.5px]" : "text-[11.5px]"} font-medium leading-[1.9] text-ink`}>
        {GOV_LINES.map((l) => <div key={l}>{l}</div>)}
        <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
      </div>
      <div className="flex items-center gap-4">
        <img src={moeLogo} alt="وزارة التعليم" className={`${h} w-auto`} />
        <img src={logoIcon} alt="مدرسة مكة الثانوية" className={`${h} w-auto`} />
      </div>
    </div>
  );
}

/* فاصل متدرّج: لونه في الوسط ويخفت عند الجانبين */
function Rule({ color = "#3E6350", thick = false, className = "" }) {
  return (
    <div className={`w-full ${thick ? "h-[2px]" : "h-px"} ${className}`}
         style={{
           background: `linear-gradient(90deg, transparent 0%, ${color}22 12%, ${color} 50%, ${color}22 88%, transparent 100%)`,
           ...INK,
         }} />
  );
}

function Foot({ serial, hairline = true, color = "#3E6350" }) {
  return (
    <>
      {hairline && <div className="mb-2.5"><Rule color={color} /></div>}
      <div className="flex items-center justify-between gap-3 text-[10.5px] text-faint">
      <span>بوابة مكة الثانوية الرقمية</span>
      {serial && <span className="num">رقم المستند: {serial}</span>}
        <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
      </div>
    </>
  );
}

/* توقيع واحد: الصفة، ثم صورة التوقيع، ثم الاسم تحت خط رفيع */
function Sign({ url, name, role }) {
  return (
    <div className="min-w-[180px] text-center">
      <p className="text-[12px] text-muted">{role}</p>
      <div className="grid h-14 place-items-center">
        {url && <img src={url} alt="" className="max-h-14 w-auto object-contain" />}
      </div>
      <div className="mx-auto h-px w-40 bg-line" />
      <p className="mt-1 text-[13px] font-semibold text-ink">{name || "…"}</p>
    </div>
  );
}

/* عدد مرفقات الإفادة — المرفقات نفسها لا تُطبع، تُحفظ في البوابة */
function ReplyFilesNote({ v }) {
  const n = v?.reply_files?.length ?? 0;
  if (!n) return null;
  return (
    <p className="mt-2 text-[12px] text-muted">
      مرفقات الإفادة: <b className="num text-ink">{n}</b> (محفوظة في البوابة الرقمية)
    </p>
  );
}

function Signatures({ source, issuerUrl, issuerName, issuerRole, principalUrl, principalName,
                     stampUrl, center, replyUrl, replyName }) {
  if (source === "none" && !stampUrl) return null;
  const showIssuer = source === "issuer" || source === "both";
  const showPrincipal = source === "principal" || source === "both";

  // التوسيط في الشهادات فقط — الرسميات تبقى على اليسار كما هو معتاد
  if (center && showIssuer !== showPrincipal) {
    const one = showIssuer
      ? <Sign url={issuerUrl} name={issuerName} role={issuerRole || "المعلم"} />
      : <Sign url={principalUrl} name={principalName} role="مدير المدرسة" />;
    return (
      <div className="grid grid-cols-3 items-end gap-4">
        <div className="justify-self-start">
          {stampUrl && <img src={stampUrl} alt="" className="h-20 w-auto object-contain opacity-90" />}
        </div>
        <div className="justify-self-center">{one}</div>
        <div />
      </div>
    );
  }

  // توقيع المستفيد على ردّه — يظهر مع توقيع المُصدِر
  if (replyUrl || replyName) {
    return (
      <div className="grid grid-cols-3 items-end gap-4">
        <div className="justify-self-start">
          {showIssuer && <Sign url={issuerUrl} name={issuerName} role={issuerRole || "المُصدِر"} />}
          {!showIssuer && showPrincipal && (
            <Sign url={principalUrl} name={principalName} role="مدير المدرسة" />
          )}
        </div>
        <div className="justify-self-center">
          {stampUrl && <img src={stampUrl} alt="" className="h-20 w-auto object-contain opacity-90" />}
        </div>
        <div className="justify-self-end">
          {/* بلا صورة توقيع: إقرار باسم صاحبه، كما في موافقات أولياء الأمور */}
          <Sign url={replyUrl} name={replyName}
                role={replyUrl ? "توقيع المستفيد" : "إقرار المستفيد"} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 items-end gap-4">
      {/* في التخطيط من اليمين لليسار: المُصدِر يمينًا، والختم وسطًا، والمدير يسارًا */}
      <div className="justify-self-start">
        {showIssuer && <Sign url={issuerUrl} name={issuerName} role={issuerRole || "المعلم"} />}
      </div>
      <div className="justify-self-center">
        {stampUrl && <img src={stampUrl} alt="" className="h-20 w-auto object-contain opacity-90" />}
      </div>
      <div className="justify-self-end">
        {showPrincipal && <Sign url={principalUrl} name={principalName} role="مدير المدرسة" />}
      </div>
    </div>
  );
}

/* ----------------------------- الشهادة ----------------------------- */

/* خمسة قوالب للإطار — يختارها المُصدِر، فلا تتشابه شهادات الطالب الواحد.
   الذهبي #B8912F مع أخضر الهوية، وكلها خطوط رفيعة توفّر الحبر. */
export const CERT_THEMES = [
  { key: "classic", label: "الكلاسيكي",  accent: "#3E6350", hint: "إطار مزدوج بأخضر الهوية" },
  { key: "gold",    label: "الذهبي",     accent: "#B8912F", hint: "ثلاثة خطوط ذهبية وخضراء" },
  { key: "medal",   label: "الوسام",     accent: "#B8912F", hint: "شعار المدرسة داخل وسام ذهبي" },
  { key: "modern",  label: "الحديث",     accent: "#3E6350", hint: "بلا إطار — مساحة مفتوحة وشريط سفلي" },
  { key: "ornate",  label: "المزخرف",    accent: "#B8912F", hint: "ثلاثة إطارات متداخلة" },
];

/* وسام دائري يحمل شعار المدرسة الرسمي — للقالب "الوسام" */
function Medal({ color }) {
  return (
    <span className="relative grid h-[20mm] w-[20mm] place-items-center">
      <span className="absolute inset-0 rounded-full border-[1.5px]"
            style={{ borderColor: color, ...INK }} />
      <span className="absolute inset-[2.2mm] rounded-full border"
            style={{ borderColor: "#CCF2DB", ...INK }} />
      <img src={logoIcon} alt="" className="h-[11mm] w-auto object-contain" />
    </span>
  );
}

function Frame({ theme }) {
  if (theme === "gold") {
    return (
      <>
        <div className="absolute inset-[7mm] border-[1.5px]" style={{ borderColor: "#B8912F", ...INK }} />
        <div className="absolute inset-[9.5mm] border" style={{ borderColor: "#3E6350", ...INK }} />
        <div className="absolute inset-[11mm] border" style={{ borderColor: "#EADFBF", ...INK }} />
      </>
    );
  }
  if (theme === "medal") {
    return (
      <>
        <div className="absolute inset-[8mm] rounded-[6mm] border-[1.5px]"
             style={{ borderColor: "#3E6350", ...INK }} />
        <div className="absolute inset-[10mm] rounded-[5mm] border"
             style={{ borderColor: "#B8912F", ...INK }} />
      </>
    );
  }
  if (theme === "modern") {
    // بلا إطار محيط: مساحة بيضاء مفتوحة، والشريط يوضع تحت التواقيع داخل المحتوى
    return null;
  }
  if (theme === "ornate") {
    return (
      <>
        <div className="absolute inset-[7mm] border" style={{ borderColor: "#3E6350", ...INK }} />
        <div className="absolute inset-[11mm] border" style={{ borderColor: "#B8912F", ...INK }} />
        <div className="absolute inset-[13mm] border" style={{ borderColor: "#CCF2DB", ...INK }} />
      </>
    );
  }
  // الكلاسيكي
  return (
    <>
      <div className="absolute inset-[7mm] border-[1.5px] border-mint-deep" style={INK} />
      <div className="absolute inset-[9.5mm] border border-[#CCF2DB]" style={INK} />
    </>
  );
}

function Certificate(p) {
  const { v, doc, template } = p;
  const theme = v.theme || "classic";
  const t = CERT_THEMES.find((x) => x.key === theme) ?? CERT_THEMES[0];
  const accent = t.accent;
  const gradient = theme === "gold" || theme === "medal"
    ? "linear-gradient(180deg,#FAF5E8 0%,#FCFAF4 55%,#FFFFFF 100%)"
    : "linear-gradient(180deg,#EDFAF2 0%,#F7FCF9 55%,#FFFFFF 100%)";

  return (
    <div className="relative h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[55mm]"
           style={{ background: gradient, ...INK }} />

      <Frame theme={theme} />

      <div className="relative flex h-full flex-col px-[22mm] pb-[11mm] pt-[13mm]">
        <Head small />
        <div className="mt-3"><Rule color={accent} /></div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {theme === "medal" && (
            <div className="mb-3 flex justify-center"><Medal color={accent} /></div>
          )}

          <h1 className="text-[38px] font-bold leading-none text-mint-deep">شهادة شكر وتقدير</h1>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="h-px w-16" style={{ background: accent, opacity: .45, ...INK }} />
            <span className="h-1.5 w-1.5 rotate-45" style={{ background: accent, ...INK }} />
            <span className="h-px w-16" style={{ background: accent, opacity: .45, ...INK }} />
          </div>

          <p className="mt-7 text-[15px] text-muted">تتقدّم مدرسة مكة الثانوية بالشكر والتقدير إلى</p>
          <p className="mt-2 text-[32px] font-bold leading-tight text-ink">{v.recipient || "…"}</p>
          {(v.class_label || v.job) && (
            <p className="mt-1 text-[14px] text-mint-hover">{v.class_label || v.job}</p>
          )}

          <p className="mx-auto mt-4 max-w-[58ch] text-[15.5px] leading-[2.1] text-ink">
            {v.reason || "…"}
          </p>

          <p className="mt-4 text-[16px] font-semibold" style={{ color: accent }}>
            {v.closing || "مع تمنياتنا له بالتوفيق والسداد"}
          </p>

          <p className="num mt-3 text-[13px] text-muted">{v.date || ""}</p>
        </div>

        <ReplyFilesNote v={v} />
        <Signatures
          center
          source={template.signature_source}
          issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
          principalUrl={p.principalSigUrl} principalName={p.principalName}
          stampUrl={p.stampUrl}
          replyUrl={p.replySigUrl} replyName={p.replySigName}
        />

        {theme === "modern" && (
          <div className="-mx-[22mm] mt-7 h-[5mm]"
               style={{ background: "linear-gradient(90deg,#3E6350 0%,#6AA786 50%,#89D7AD 100%)", ...INK }} />
        )}

        <div className={theme === "modern" ? "mt-4" : "mt-8"}>
          <Foot serial={doc?.serial} hairline={false} />
        </div>
      </div>
    </div>
  );
}

/* شهادة شكر الضيوف والمتعاونين — تصميمها المستقل في GuestCertificate */
export const isGuestCert = (template) => template?.key === "guest_appreciation";

/* اتجاه الورقة: شهادة الضيوف عمودية دائمًا أيًّا كان المحفوظ في القالب */
export const sheetLandscape = (template) => !isGuestCert(template) && template?.orientation === "landscape";

function GuestCert(p) {
  const { v, doc, template } = p;
  const src = template.signature_source;
  return (
    <GuestCertificateBody
      name={v.recipient} entity={v.entity}
      text={v.reason} activity={v.activity} dateText={v.date} closing={v.closing}
      serial={doc?.serial}
      issuer={src === "issuer" || src === "both"
        ? { url: p.sigUrl, name: doc?.signature_name, role: doc?.signature_role } : null}
      principal={src === "principal" || src === "both"
        ? { url: p.principalSigUrl, name: p.principalName } : null}
      stampUrl={p.stampUrl}
    />
  );
}

/* ------------------------ تعميم أو خطاب رسمي ------------------------ */
function Official(p) {
  const { v, doc, template } = p;
  const isLetter = template.key === "official_letter";
  return (
    <div className="flex h-full flex-col p-[16mm]">
      <Head />
      <div className="mt-3"><Rule color="#3E6350" thick /></div>

      <div className="flex flex-wrap gap-6 pt-3 text-[12.5px] text-muted">
        {v.number && <span>الرقم: <b className="num text-ink">{v.number}</b></span>}
        {v.date && <span>التاريخ: <b className="num text-ink">{v.date}</b></span>}
        {v.attachments && <span>المشفوعات: <b className="text-ink">{v.attachments}</b></span>}
        {v.audience && <span>الموجَّه إليهم: <b className="text-ink">{v.audience}</b></span>}
      </div>

      {isLetter ? (
        <>
          <p className="mt-5 text-[15px] font-semibold text-ink">
            {v.recipient ? `سعادة ${v.recipient}` : ""}
          </p>
          <p className="mt-1 text-[15px] text-ink">
            الموضوع: <span className="font-semibold">{v.subject || ""}</span>
          </p>
        </>
      ) : (
        <h1 className="mt-5 text-[22px] font-bold text-ink">{v.title || ""}</h1>
      )}

      <div className="mt-4 flex-1 whitespace-pre-line text-[14.5px] leading-[2] text-ink">
        {v.body || ""}
      </div>

      {v.alert && (
        <div className="my-3 flex gap-3 rounded-card border border-[#F0E3C4] px-4 py-3 text-[13.5px] leading-[1.8] text-warning">
          <span className="font-bold">!</span>
          <span className="whitespace-pre-line">{v.alert}</span>
        </div>
      )}

      {v.action && (
        <div className="my-3 rounded-card border border-[#D4EADD] px-4 py-3">
          <p className="text-[14px] font-semibold text-mint-deep">المطلوب</p>
          <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-[1.8] text-muted">{v.action}</p>
        </div>
      )}

      <div className="mt-4">
        <ReplyFilesNote v={v} />
        <Signatures
          source={template.signature_source}
          issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
          principalUrl={p.principalSigUrl} principalName={p.principalName}
          stampUrl={p.stampUrl}
          replyUrl={p.replySigUrl} replyName={p.replySigName}
        />
      </div>
      <div className="mt-7"><Foot serial={doc?.serial} /></div>
    </div>
  );
}

/* جدول حصر: أعمدة معرَّفة وصفوف فارغة تُملأ بخط اليد بعد الطباعة */
function BlankTable({ field, value }) {
  const cols = field.columns ?? [];
  const rows = Math.max(1, Number(value?.rows ?? field.rows ?? 10));
  const data = Array.isArray(value?.cells) ? value.cells : [];
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[13px] font-semibold text-mint-deep">{field.label}</p>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i}
                  className="border border-line bg-[#EDFAF2] px-2 py-1.5 text-center font-semibold text-mint-deep"
                  style={INK}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {cols.map((_, c) => (
                <td key={c} className="h-7 border border-line px-2 align-middle text-ink">
                  {c === 0 && !data[r]?.[c] ? <span className="num text-faint">{r + 1}</span> : (data[r]?.[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* جدول الموظف في المناوبة والإشراف — يُملأ عند الإصدار ويُطبع في الورقة */
function DutyScheduleBlock({ field, value }) {
  const duty = Array.isArray(value?.duty) ? value.duty : [];
  const sup = Array.isArray(value?.supervision) ? value.supervision : [];

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[13px] font-semibold text-mint-deep">{field.label}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[11.5px] font-semibold text-ink">أيام المناوبة</p>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {["اليوم", "التاريخ", "هجري", "مع"].map((h) => (
                  <th key={h} className="border border-line px-1.5 py-1 text-center font-semibold text-mint-deep"
                      style={{ background: "#EDFAF2", ...INK }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {duty.length === 0 && (
                <tr><td colSpan={4} className="border border-line px-2 py-2 text-center text-faint">
                  لا مناوبات مسندة
                </td></tr>
              )}
              {duty.map((r, i) => (
                <tr key={i}>
                  <td className="border border-line px-1.5 py-1 text-center">{r.day}</td>
                  <td className="num border border-line px-1.5 py-1 text-center">{r.date}</td>
                  <td className="num border border-line px-1.5 py-1 text-center">{r.hijri}</td>
                  <td className="border border-line px-1.5 py-1">{r.partner || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="mb-1 text-[11.5px] font-semibold text-ink">الإشراف الأسبوعي</p>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {["اليوم", "الصفة"].map((h) => (
                  <th key={h} className="border border-line px-1.5 py-1 text-center font-semibold text-mint-deep"
                      style={{ background: "#EDFAF2", ...INK }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sup.length === 0 && (
                <tr><td colSpan={2} className="border border-line px-2 py-2 text-center text-faint">
                  لا إشراف مسند
                </td></tr>
              )}
              {sup.map((r, i) => (
                <tr key={i}>
                  <td className="border border-line px-1.5 py-1 text-center">{r.day}</td>
                  <td className="border border-line px-1.5 py-1 text-center">{r.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
            الإشراف يتكرر أسبوعيًا طوال الفصل الدراسي.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- قبول طالب ----------------------------
   خطاب إلى المدرسة المنقول منها الطالب: بياناته في جدول، ثم الموافقة على قبوله
   وما يُطلب في ملفه. المتطلبات الأساسية ثابتة، وتُضاف إليها «متطلبات إضافية». */
const ADMISSION_NEEDS = [
  "المقررات الدراسية (الكتب).",
  "نقل ملفه في نظام نور إلى مدرستنا.",
];

function StudentAdmission(p) {
  const { v, doc, template } = p;
  const needs = [
    ...ADMISSION_NEEDS,
    ...String(v.extra ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
  ];
  const cell = "border border-line px-3 py-2";
  const head = `${cell} bg-[#EDFAF2] text-center text-[12.5px] font-semibold text-mint-deep`;
  return (
    <div className="flex h-full flex-col p-[16mm]">
      <Head />
      <div className="mt-3"><Rule color="#3E6350" thick /></div>

      <div className="flex flex-wrap justify-between gap-6 pt-3 text-[12.5px] text-muted">
        <span>الرقم: <b className="num text-ink">{doc?.serial || "…"}</b></span>
        {v.date && <span>التاريخ: <b className="num text-ink">{v.date}</b></span>}
      </div>

      <h1 className="mt-4 text-center text-[24px] font-bold text-mint-deep">{template.title}</h1>

      {v.from_school && (
        <p className="mt-4 flex justify-between text-[15px] font-semibold text-ink">
          <span>المكرم مدير {v.from_school}</span>
          <span>المحترم</span>
        </p>
      )}

      <table className="mt-4 w-full border-collapse text-[13.5px]" style={INK}>
        <thead>
          <tr>
            <th className={head}>اسم الطالب</th>
            <th className={head}>رقم الهوية / الإقامة</th>
            <th className={head}>الصف الدراسي</th>
            <th className={head}>العام الدراسي</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-center text-ink">
            <td className={`${cell} font-semibold`}>{v.recipient || "…"}</td>
            <td className={`${cell} num`}>{v.national_id || "…"}</td>
            <td className={cell}>{v.grade || "…"}</td>
            <td className={`${cell} num`}>{v.academic_year || "…"}</td>
          </tr>
          {v.notes && (
            <tr>
              <td className={head}>ملاحظات</td>
              <td colSpan={3} className={`${cell} whitespace-pre-line text-ink`}>{v.notes}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-6 flex-1 text-[15px] leading-[2.1] text-ink">
        <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
        <p className="mt-1">
          لا مانع لدينا من قبول الطالب المشار إليه أعلاه
          {v.grade ? <> في الصف <b>{v.grade}</b></> : null}
          {v.academic_year ? <> للعام الدراسي <b className="num">{v.academic_year}</b></> : null}،
          لذا نأمل التكرم بإرسال ملفه إلينا بالطريقة الرسمية المتبعة، على أن يشمل ما يلي:
        </p>
        <ol className="mt-1 space-y-0.5 pr-6">
          {needs.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="num font-semibold text-mint-deep">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-center text-[16px] font-bold">وتقبلوا فائق التحية والتقدير،،،</p>
      </div>

      <div className="mt-4">
        <Signatures
          source={template.signature_source}
          issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
          principalUrl={p.principalSigUrl} principalName={p.principalName}
          stampUrl={p.stampUrl}
        />
      </div>
      <div className="mt-7"><Foot serial={doc?.serial} /></div>
    </div>
  );
}

/* ------------------ استمارة دعم وتطوير الهيئة التعليمية ------------------
   على نمط «الملاحظة الصفية وفق بنود الأداء الوظيفي»، أربع صفحات:
   ١) بيانات الزيارة وطريقة التقييم وملخّص النتيجة
   ٢-٣) جدول بنود كل قسم (rubric): العنصر ووزنه وأمثلته وشواهده، والتحقق والتقدير
   ٤) جوانب الدعم والتطوير والتواقيع
   المستند الذي صدر قبل إضافة البنود يبقى بشكله القديم (Administrative). */
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const TH = { background: "#EDFAF2", ...INK };
const cellB = "border border-[#9DB5A6]";
// الرقم وحده داخل num (اتجاهه من اليسار) — حتى لا تنقلب «٨ من ١٠» في السطر العربي
const N = ({ children }) => <span className="num">{children}</span>;

// القيمة نصًّا للطباعة — الكائنات (كجدول البنود) لا تُعرض نصًا فتنهار الصفحة
const asText = (x) => (x == null || typeof x === "object" ? "" : x);

const allRubrics = (template) => (template.fields ?? []).filter((f) => f.type === "rubric");
const filled = (x) => !!x && typeof x === "object" && Object.keys(x).length > 0;
// المستند السابق يُطبع بجداوله القديمة (legacy) إن كانت فيه قيمها، والجديد بالجداول الحالية
const rubricFields = (template, v) => {
  const all = allRubrics(template);
  const legacy = all.filter((f) => f.legacy), current = all.filter((f) => !f.legacy);
  const oldDoc = legacy.some((f) => filled(v?.[f.name])) && !current.some((f) => filled(v?.[f.name]));
  return oldDoc ? legacy : current;
};
export const isRubricDoc = (template, v) =>
  allRubrics(template).some((f) => v && Object.prototype.hasOwnProperty.call(v, f.name));

// اليوم من الجزء الميلادي للتاريخ المحفوظ «03/03/1448 - 14/09/2026»
function weekdayOf(dateStr) {
  const m = String(dateStr ?? "").match(/(\d{2})\/(\d{2})\/((?:19|20)\d{2})/);
  if (!m) return "";
  return WEEKDAYS[new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).getUTCDay()] ?? "";
}

function VisitHead({ title, sub, compact = false }) {
  // صفحات العناصر: ترويسة مختصرة بسطر واحد لتتسع العناصر الأربعة كالنموذج الورقي
  if (compact) return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[14px] font-bold text-ink">{title}</h1>
          {sub && <span className="text-[11px] font-semibold text-mint-deep">{sub}</span>}
        </div>
        <div className="flex items-center gap-3">
          <img src={moeLogo} alt="وزارة التعليم" className="h-7 w-auto" />
          <img src={logoIcon} alt="مدرسة مكة الثانوية" className="h-7 w-auto" />
        </div>
      </div>
      <div className="mt-1.5"><Rule color="#3E6350" thick /></div>
    </>
  );
  return (
    <>
      <Head small />
      <div className="mt-2.5"><Rule color="#3E6350" thick /></div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h1 className="text-[17px] font-bold text-ink">{title}</h1>
        {sub && <span className="text-[12px] font-semibold text-mint-deep">{sub}</span>}
      </div>
    </>
  );
}

function VisitFoot({ serial, page, total }) {
  return (
    <div className="mt-auto pt-3">
      <Foot serial={serial} />
      <p className="num mt-1 text-center text-[10px] text-faint">صفحة {page} من {total}</p>
    </div>
  );
}

/* خلفية الدرجة ولونها (لكل درجة لونها: 1 أحمر، 2 برتقالي، 3 ذهبي، 4 أزرق، 5 أخضر)؛ soft: الخلفية وحدها والنص كما هو */
function toneStyle(g, soft = false) {
  const t = gradeTone(g);
  if (!t) return undefined;
  return soft ? { background: t.bg, ...INK } : { background: t.bg, color: t.fg, ...INK };
}

/* ١) بيانات الزيارة، وطريقة تقييم كل قسم، وملخّص النتيجة */
function VisitInfoPage({ template, v, rubrics, doc, principalName }) {
  const byType = (t) => (template.fields ?? []).find((f) => f.type === t);
  const val = (f) => (f ? String(v[f.name] ?? "").trim() : "");
  const spec = (template.fields ?? []).find((f) => /التخصص/.test(f.label ?? ""));
  const date = val(byType("date"));
  const cls = val(byType("lesson_class"));
  const [grade, classNo] = cls.includes("—") ? cls.split("—").map((x) => x.trim()) : [cls, ""];

  const rows = [
    [["اسم المعلم", v.recipient], ["التخصص", val(spec)], ["رقم الزيارة", val(byType("visit_no"))]],
    [["اليوم", weekdayOf(date)], ["التاريخ", date], ["الحصة", val(byType("lesson_period"))]],
    [["الصف", grade], ["الفصل", classNo], ["المادة", val(byType("lesson_subject"))]],
    // الزائر هو مُصدِر التقرير: لكل وكيل معلموه الذين يزورهم
    [["الزائر (مُصدِر التقرير)", doc?.signature_name], ["صفته", doc?.signature_role], ["مدير المدرسة", principalName]],
  ];

  const scores = rubrics.map((f) => ({ f, ...rubricScore(f, v[f.name]) }));
  const got = scores.reduce((a, x) => a + x.points, 0);
  const max = scores.reduce((a, x) => a + x.max, 0);
  const anyRated = scores.some((x) => x.rated);
  // التقدير العام بعد تقدير العناصر كلها فقط — الدرجة الجزئية لا تُوصف
  const allRated = scores.length > 0 && scores.every((x) => x.rated === x.count);
  const rated = scores.reduce((a, x) => a + x.rated, 0), count = scores.reduce((a, x) => a + x.count, 0);
  const pct = anyRated && max ? Math.round((got / max) * 1000) / 10 : null;
  const official = rubrics.some((f) => f.style === "official");
  // النموذج المعتمد: مجموع التقديرات الموزونة (تقدير العنصر × وزنه) من 5، ومستواه بالتقريب لأقرب درجة
  const overall = Math.round(rubrics.reduce((a, f) => a + (f.items ?? [])
    .reduce((b, it, i) => b + (weightedRating(it, v[f.name]?.[i]) ?? 0), 0), 0) * 100) / 100;
  const overallLevel = Math.min(5, Math.max(1, Math.round(overall)));

  return (
    <>
      <table className="mt-4 w-full table-fixed border-collapse text-[12px]">
        <tbody>
          {rows.map((r, i) => (
            <Fragment key={i}>
              <tr>
                {r.map(([h]) => (
                  <th key={h} className={`${cellB} px-2 py-1.5 text-center font-semibold text-mint-deep`} style={TH}>{h}</th>
                ))}
              </tr>
              <tr>
                {r.map(([h, x]) => (
                  <td key={h} className={`${cellB} h-9 px-2 text-center text-[13px] font-semibold text-ink`}>{x || ""}</td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* طريقة التقييم — كما في الاستمارة الورقية القديمة؛ النموذج المعتمد بلا هذه الملاحظة */}
      {!official && <div className="mt-5 space-y-3">
        {rubrics.map((f) => (
          <div key={f.name} className={`${cellB} rounded-[4px] px-4 pb-4 pt-0`}>
            <p className="-mx-4 mb-3 inline-block rounded-bl-[4px] px-4 py-1 text-[13px] font-bold text-ink" style={TH}>
              {f.label}
            </p>
            <p className="text-center text-[13px] font-semibold text-ink">{f.note}</p>
          </div>
        ))}
      </div>}

      {/* ملخّص النتيجة */}
      <p className="mt-5 text-[13px] font-semibold text-mint-deep">نتيجة التقييم</p>
      {official ? (
        // كجدول «نموذج تقييم أداء المعلم» المعتمد: العنصر ووزنه ودرجة تقديره (1–5) ودرجته الموزونة
        <table className="mt-1.5 w-full table-fixed border-collapse text-[11.5px]">
          <thead>
            <tr>
              {[["عناصر التقييم", "w-[46%]"], ["الوزن النسبي", ""], ["درجة التقدير", "w-[24%]"], ["التقدير الموزون", ""]].map(([h, w]) => (
                <th key={h} className={`${cellB} ${w} px-2 py-1.5 text-center font-semibold text-mint-deep`} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rubrics.flatMap((f) => (f.items ?? []).map((it, i) => {
              const e = v[f.name]?.[i];
              const wr = weightedRating(it, e);
              const tone = toneStyle(wr != null && e.score);
              return (
                <tr key={`${f.name}-${i}`}>
                  <td className={`${cellB} px-2 py-1 font-semibold`}>
                    <span className="num ml-1.5 text-mint-deep">{it.no ?? i + 1}</span>{it.title}
                  </td>
                  <td className={`num ${cellB} px-2 py-1 text-center`}>{it.weight}%</td>
                  <td className={`${cellB} px-2 py-1 text-center font-bold`} style={tone}>
                    {wr != null ? <><N>{e.score}</N> — {officialLabel(e.score)}</> : ""}
                  </td>
                  <td className={`num ${cellB} px-2 py-1 text-center font-bold`} style={tone}>{wr != null ? wr.toFixed(2) : ""}</td>
                </tr>
              );
            }))}
            <tr>
              <td className={`${cellB} px-2 py-1.5 font-bold`} style={TH}>التقدير العام للأداء</td>
              <td className={`num ${cellB} px-2 py-1.5 text-center font-bold`} style={TH}>{max}%</td>
              <td className={`${cellB} px-2 py-1.5 text-center font-bold`} style={allRated ? toneStyle(overallLevel) : TH}>
                {allRated ? <><N>{overallLevel}</N> — {officialLabel(overallLevel)}</>
                  : anyRated ? <span className="text-[10.5px] font-normal text-muted">قُدِّر <N>{rated}</N> من <N>{count}</N></span> : ""}
              </td>
              <td className={`num ${cellB} px-2 py-1.5 text-center text-[13.5px] font-bold`} style={allRated ? toneStyle(overallLevel) : TH}>
                {allRated ? <span dir="rtl"><N>{overall.toFixed(2)}</N> من <N>5</N></span> : ""}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
      <table className="mt-1.5 w-full table-fixed border-collapse text-[12px]">
        <thead>
          <tr>
            {["القسم", "الوزن النسبي", "الدرجة المحققة", "العناصر المقدَّرة"].map((h) => (
              <th key={h} className={`${cellB} px-2 py-1.5 text-center font-semibold text-mint-deep`} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scores.map((x) => (
            <tr key={x.f.name}>
              <td className={`${cellB} px-2 py-1.5 text-center font-semibold`}>{x.f.label}</td>
              <td className={`num ${cellB} px-2 py-1.5 text-center`}>{x.max}%</td>
              <td className={`num ${cellB} px-2 py-1.5 text-center font-bold`}>{x.rated ? `${x.points}%` : ""}</td>
              <td className={`${cellB} px-2 py-1.5 text-center text-muted`}><N>{x.rated}</N> من <N>{x.count}</N></td>
            </tr>
          ))}
          <tr>
            <td className={`${cellB} px-2 py-1.5 text-center font-bold`} style={TH}>المجموع</td>
            <td className={`num ${cellB} px-2 py-1.5 text-center font-bold`} style={TH}>{max}%</td>
            <td className={`num ${cellB} px-2 py-1.5 text-center text-[14px] font-bold text-mint-deep`} style={TH}>
              {pct == null ? "" : max === 100 ? `${Math.round(got * 10) / 10}%` : (
                // مجموع الأوزان ليس 100: الدرجة من المجموع ونسبتها المئوية
                <span dir="rtl" className="block">
                  <N>{Math.round(got * 10) / 10}</N> من <N>{max}</N>
                  <span className="block text-[10.5px] font-semibold"><N>{pct}</N>٪</span>
                </span>
              )}
            </td>
            <td className={`${cellB} px-2 py-1.5 text-center font-bold text-mint-deep`} style={TH}>
              {allRated ? overallLabel(pct) : anyRated ? <span className="text-[10.5px] font-normal text-muted">قُدِّر <N>{rated}</N> من <N>{count}</N></span> : ""}
            </td>
          </tr>
        </tbody>
      </table>
      )}
      {official ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          يُقدَّر كل عنصر بأحد مستويات سلّم التقدير الخمسة (<N>1</N>–<N>5</N>) الموصوفة في النموذج المعتمد، ويُضرب في وزنه النسبي
          فينتج التقدير الموزون؛ ومجموع التقديرات الموزونة هو التقدير العام للأداء من <N>5</N>، ومستواه بتقريبه لأقرب درجة.
        </p>
      ) : null}
      {official ? (
        // «مستويات التقدير العام للأداء» كما في آلية الاحتساب بالدليل الإرشادي (النسخة الثانية)
        <table className="mt-3 w-full table-fixed border-collapse text-[11.5px]">
          <tbody>
            <tr>
              <th className={`${cellB} w-[20%] px-2 py-1 text-center font-semibold text-mint-deep`} style={TH}>درجة التقدير</th>
              {OFFICIAL_LEVELS.map((l) => (
                <td key={l.v} className={`num ${cellB} px-2 py-1 text-center font-bold`} style={toneStyle(l.v)}>{l.v}</td>
              ))}
            </tr>
            <tr>
              <th className={`${cellB} px-2 py-1 text-center font-semibold text-mint-deep`} style={TH}>وصف التقدير</th>
              {OFFICIAL_LEVELS.map((l) => (
                <td key={l.v} className={`${cellB} px-1 py-1 text-center font-semibold`} style={toneStyle(l.v, true)}>{l.label}</td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : (
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        يُقدَّر كل عنصر من <N>5</N>:{" "}
        {RATING_LEVELS.map((l, i) => (
          <span key={l.v}><span className="num">{l.v}</span> {l.label}{i < RATING_LEVELS.length - 1 ? "، " : ""}</span>
        ))}
        ؛ ودرجة العنصر = وزنه × تقديره ÷ <N>5</N>
      </p>
      )}
    </>
  );
}

/* ٢-٣) جدول بنود القسم */
function RubricPage({ field, value }) {
  const items = field.items ?? [];
  const sc = rubricScore(field, value);
  const W = ["6mm", "27mm", "12mm", "37mm", "5mm", "40mm", "11mm", "20mm", "28mm"];
  const H = ["م", "العنصر", "الوزن النسبي", "أمثلة", "", field.evidence_label || "الشواهد", "التحقق", "التقييم", "ملاحظات"];
  const td = `${cellB} px-1.5 py-[3px] align-middle`;
  return (
    <>
      <p className="mt-4 text-[14px] font-bold text-ink">
        <span className="text-mint-deep">×</span> {field.label}
      </p>
      <table className="mt-2 w-full table-fixed border-collapse text-[10px] leading-[1.35]">
        <colgroup>{W.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead>
          <tr>
            {H.map((h, i) => (
              <th key={i} className={`${cellB} px-1 py-1.5 text-center text-[10.5px] font-semibold text-mint-deep`} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        {items.map((it, i) => {
          const e = value?.[i] ?? {};
          const n = Math.max(1, it.examples?.length ?? 0, it.evidence?.length ?? 0);
          const pts = itemPoints(it, e);
          return (
            <tbody key={i}>
              {/* فاصل بين العناصر كما في الاستمارة الورقية */}
              <tr><td colSpan={9} className="h-[2.5mm] p-0" /></tr>
              {Array.from({ length: n }).map((_, r) => (
                <tr key={r}>
                  {r === 0 && (
                    <>
                      <td rowSpan={n} className={`num ${td} text-center font-bold`}>{i + 1}</td>
                      <td rowSpan={n} className={`${td} text-center text-[10.5px] font-semibold`}>{it.title}</td>
                      <td rowSpan={n} className={`num ${td} text-center text-[11px] font-bold`}>{it.weight}%</td>
                    </>
                  )}
                  <td className={`${td} text-center`}>{it.examples?.[r] ?? ""}</td>
                  <td className={`num ${td} text-center font-bold`}>{r + 1}</td>
                  <td className={`${td} text-center`}>{it.evidence?.[r] ?? ""}</td>
                  <td className={`${td} text-center text-[12px] font-bold text-mint-deep`}>
                    {it.evidence?.[r] && e.check?.[r] ? "✓" : ""}
                  </td>
                  {r === 0 && (
                    <>
                      <td rowSpan={n} className={`${td} text-center`}>
                        {pts != null && (
                          <>
                            <div className="num text-[13px] font-bold text-ink">{e.score}<span className="text-[9px] font-normal text-muted"> / 5</span></div>
                            <div className="text-[9px] text-muted">{ratingLabel(e.score)}</div>
                            <div className="text-[9px] font-semibold text-mint-deep"><N>{pts}</N> من <N>{it.weight}</N></div>
                          </>
                        )}
                      </td>
                      <td rowSpan={n} className={`${td} whitespace-pre-line text-[9.5px]`}>{e.note ?? ""}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          );
        })}
        <tbody>
          <tr><td colSpan={9} className="h-[2.5mm] p-0" /></tr>
          <tr>
            <td colSpan={7} className={`${td} py-1.5 text-left text-[11px] font-bold`} style={TH}>مجموع القسم</td>
            <td colSpan={2} className={`${td} py-1.5 text-center text-[12px] font-bold text-mint-deep`} style={TH}>
              {sc.rated ? <N>{sc.points}%</N> : "—"} من <N>{sc.max}%</N>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

/* ٢-٤) عناصر «نموذج تقييم أداء المعلم» المعتمد: لكل عنصر تفسيره وسلّم تقديره
   الخمسة الموصوف، وعلامة على المستوى المختار، ومجالات التطوير */
const OFF = { green: "#3E6350", mint: "#CCF2DB", tint: "#EDFAF2" };
const vert = { writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap" };

function OfficialItem({ it, e }) {
  const score = Number(e?.score) || null;
  const wr = weightedRating(it, e);
  const td = `${cellB} px-1.5 py-[2px] align-middle`;
  return (
    <table className="w-full table-fixed border-collapse text-[8.6px] leading-[1.45]" style={{ breakInside: "avoid" }}>
      <colgroup>
        <col style={{ width: "9mm" }} /><col style={{ width: "6.5mm" }} /><col />
        <col style={{ width: "13mm" }} /><col style={{ width: "34mm" }} />
      </colgroup>
      <tbody>
        <tr>
          <td rowSpan={6} className={`${cellB} p-0 text-center text-[10px] font-bold text-white`}
              style={{ background: OFF.green, ...INK }}>
            <div className="mx-auto" style={vert}>{it.title} (<span className="num">{it.weight}</span>٪)</div>
          </td>
          <td className={`${cellB} p-0 text-center text-[9px] font-bold text-mint-deep`} style={{ background: OFF.mint, ...INK }}>
            <div className="mx-auto" style={vert}>التفسير</div>
          </td>
          <td className={`${td} py-[3px] text-ink`} style={{ background: "#FAFCFB", ...INK }}>
            <p className="font-semibold">{it.text}</p>
            {it.bullets?.length > 0 && (
              <ul className="mt-[1px] space-y-0 pr-1">
                {it.bullets.map((b, k) => <li key={k} className="font-semibold">❖ {b}</li>)}
              </ul>
            )}
          </td>
          <th className={`${cellB} text-center text-[10px] font-bold text-white`} style={{ background: OFF.green, ...INK }}>الدرجة</th>
          <th className={`${cellB} text-center text-[10px] font-bold text-white`} style={{ background: OFF.green, ...INK }}>مجالات التطوير</th>
        </tr>
        {it.levels.map((txt, k) => {
          const lv = k + 1, on = score === lv;
          return (
            <tr key={k}>
              {k === 0 && (
                <td rowSpan={5} className={`${cellB} p-0 text-center text-[9px] font-bold text-mint-deep`} style={{ background: OFF.mint, ...INK }}>
                  <div className="mx-auto" style={vert}>سلالم التقدير</div>
                </td>
              )}
              <td className={`${td} whitespace-pre-line ${on ? "font-bold text-ink" : "text-ink"}`} style={on ? toneStyle(lv, true) : undefined}>{txt}</td>
              <td className={`${td} text-center`} style={on ? toneStyle(lv) : undefined}>
                <span className="num text-[10px] font-bold">{lv}</span>{" "}
                <span className={`text-[11px] ${on ? "" : "text-faint"}`}>{on ? "☑" : "☐"}</span>
              </td>
              {k === 0 && (
                <td rowSpan={5} className={`${td} align-top whitespace-pre-line text-[9px]`} style={{ background: "#F7F7F7", ...INK }}>
                  {wr != null && (
                    <p className="mb-1 text-[9px] font-bold" style={{ color: gradeTone(score)?.fg }}>
                      <N>{score}</N> — {officialLabel(score)}
                      <span className="block font-semibold">التقدير الموزون: <N>{wr.toFixed(2)}</N></span>
                    </p>
                  )}
                  {e?.note ?? ""}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OfficialRubricPage({ entries }) {
  return (
    <>
      <p className="mt-3 text-[13px] font-bold text-ink">عناصر تقييم أداء المعلم</p>
      <div className="mt-1.5 space-y-[2.5mm]">
        {entries.map(({ it, e }) => <OfficialItem key={it.no} it={it} e={e} />)}
      </div>
    </>
  );
}

/* ٤) جوانب الدعم والتطوير: الحقول النصية الباقية */
const HEAD_TYPES = ["staff", "visit_no", "lesson_class", "lesson_subject", "lesson_period", "date", "rubric"];
function SupportPage({ template, v }) {
  const list = (template.fields ?? []).filter((f) =>
    !HEAD_TYPES.includes(f.type) && !f.legacy && !/التخصص/.test(f.label ?? "") &&
    !(f.hide_empty && !String(v[f.name] ?? "").trim()));
  return (
    <div className="mt-4 space-y-3">
      {list.map((f) => (
        <div key={f.name} className={`${cellB} rounded-[4px]`}>
          <p className="border-b border-[#9DB5A6] px-3 py-1.5 text-[12.5px] font-bold text-mint-deep" style={TH}>{f.label}</p>
          <p className="min-h-[18mm] whitespace-pre-line px-3 py-2 text-[12.5px] leading-[1.8] text-ink">{asText(v[f.name])}</p>
        </div>
      ))}
    </div>
  );
}

/* إقرار المعلم بالاطلاع: بعد إقراره في البوابة يظهر اسمه وتوقيعه وتاريخه،
   وقبله يبقى فارغًا ليوقَّع بخط اليد إن طُبعت الورقة */
function AckBox({ v, doc, sigUrl, name }) {
  const at = v.ack_at ?? doc?.reply_at ?? null;
  const date = at ? new Date(at) : null;
  const dateText = date
    ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
    : "";
  return (
    <div className={`${cellB} mt-4 rounded-[4px]`}>
      <p className="border-b border-[#9DB5A6] px-3 py-1.5 text-[12.5px] font-bold text-mint-deep" style={TH}>
        إقرار المعلم بالاطلاع
      </p>
      <div className="flex items-center justify-between gap-4 px-3 py-2.5">
        <p className="text-[12.5px] leading-[1.8] text-ink">
          اطلعت على ما ورد في هذه الاستمارة من تقييم وجوانب دعم وتطوير.
          {at && <span className="mr-2 inline-block rounded-pill px-2 text-[11px] font-semibold text-mint-deep" style={TH}>✓ أُقِرّ إلكترونيًا</span>}
        </p>
        <div className="grid shrink-0 grid-cols-3 gap-3 text-center text-[11px] text-muted">
          <div>
            <p>الاسم</p>
            <p className="mt-1 min-h-[16px] text-[12px] font-semibold text-ink">{at ? (name || doc?.recipient || v.recipient || "") : ""}</p>
          </div>
          <div>
            <p>التوقيع</p>
            <div className="mt-0.5 grid h-10 w-24 place-items-center">
              {at && sigUrl && <img src={sigUrl} alt="" className="max-h-10 w-auto object-contain" />}
            </div>
          </div>
          <div>
            <p>التاريخ</p>
            <p className="num mt-1 min-h-[16px] text-[12px] font-semibold text-ink">{dateText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// عناصر النموذج المعتمد بترقيمه (1–11)، موزعة على الصفحات بحسب طول سلالم تقديرها
const OFFICIAL_PAGES = [[1, 2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];
function officialChunks(rubrics, v) {
  const entries = rubrics.flatMap((f) => (f.items ?? []).map((it, i) => ({ it, e: v[f.name]?.[i] ?? {} })))
    .sort((a, b) => (a.it.no ?? 0) - (b.it.no ?? 0));
  const used = new Set();
  const pages = OFFICIAL_PAGES.map((nos) => entries.filter((x) => nos.includes(x.it.no) && used.add(x)));
  const rest = entries.filter((x) => !used.has(x));          // عناصر بلا ترقيم معروف
  return [...pages, rest].filter((pg) => pg.length);
}

function supportVisitPages(p) {
  const { template, v, doc } = p;
  const rubrics = rubricFields(template, v);
  const official = rubrics.some((f) => f.style === "official");
  // النموذج المعتمد: مجموع التقديرات الموزونة (تقدير العنصر × وزنه) من 5، ومستواه بالتقريب لأقرب درجة
  const overall = Math.round(rubrics.reduce((a, f) => a + (f.items ?? [])
    .reduce((b, it, i) => b + (weightedRating(it, v[f.name]?.[i]) ?? 0), 0), 0) * 100) / 100;
  const overallLevel = Math.min(5, Math.max(1, Math.round(overall)));
  const chunks = official ? officialChunks(rubrics, v) : rubrics;
  const total = 2 + chunks.length;
  const pages = [];
  pages.push(<>
    <VisitHead title={template.title} sub={official ? "وفق نموذج تقييم أداء المعلم" : "وفق بنود الأداء الوظيفي"} />
    <VisitInfoPage template={template} v={v} rubrics={rubrics} doc={doc} principalName={p.principalName} />
  </>);
  chunks.forEach((c) => pages.push(<>
    <VisitHead title={template.title} sub={v.recipient ? `المعلم: ${v.recipient}` : ""} compact={official} />
    {official ? <OfficialRubricPage entries={c} /> : <RubricPage field={c} value={v[c.name]} />}
  </>));
  pages.push(<>
    <VisitHead title={template.title} sub="جوانب الدعم والتطوير" />
    <SupportPage template={template} v={v} />
    <AckBox v={v} doc={doc} sigUrl={p.replySigUrl} name={p.replySigName} />
    <div className="mt-5">
      <ReplyFilesNote v={v} />
      {/* الوكيل الزائر يمينًا والمدير يسارًا؛ توقيع المعلم في مربع إقراره */}
      <Signatures
        source={template.signature_source}
        issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
        principalUrl={p.principalSigUrl} principalName={p.principalName}
        stampUrl={p.stampUrl}
      />
    </div>
  </>);
  return pages.map((content, i) => (
    <div key={i} className="flex h-full flex-col px-[12mm] pb-[8mm] pt-[11mm]">
      {content}
      <VisitFoot serial={doc?.serial} page={i + 1} total={total} />
    </div>
  ));
}

/* --------------------------- نموذج إداري --------------------------- */
/* =====================================================================
   نماذج الغياب والتأخر — نصّها وترتيبها حرفيًا كما في «الدليل الإجرائي لمدارس
   التعليم العام» (الإصدار الثالث، النماذج 18–21)، لحساسيتها النظامية. القيم من
   حقول المستند، وما لا قيمة له يبقى فراغًا يُكمل بخط اليد.
   ===================================================================== */
const ABS_META = {
  frm_late_notice:       { no: 18, name: "تنبيه على تأخر / انصراف",               code: "02-02" },
  frm_hours_deduction:   { no: 19, name: "قرار حسم مجموع ساعات تأخر وخروج مبكر", code: "02-03" },
  frm_absence_inquiry:   { no: 20, name: "مساءلة غياب",                           code: "02-04" },
  frm_absence_deduction: { no: 21, name: "قرار حسم غياب",                         code: "02-05" },
};
export const isAbsenceForm = (template) => Boolean(ABS_META[template?.key]);

const ABS_GREEN = "#5B8A6C", ABS_PALE = "#DFE7E1";
const hijriPart = (v) => String(v ?? "").match(/\d{2}\/\d{2}\/1[34]\d\d/)?.[0] ?? "";
const rangeOf = (v) => {
  const [a, b] = String(v ?? "").split(" إلى ");
  return [(a ?? "").replace(/^من\s*/, "").trim(), (b ?? "").trim()];
};
const hijriTs = (ts) => {
  if (!ts) return "";
  const h = toHijri(new Date(ts));
  return h.y ? `${String(h.d).padStart(2, "0")}/${String(h.m).padStart(2, "0")}/${h.y}` : "";
};
// مطابقة الصيغة بالنص المعتمد مع تجاهل المسافات وعلامات الترقيم
const normTxt = (t) => String(t ?? "").replace(/[\s.,،:؛]/g, "");
const sameTxt = (a, b) => normTxt(a) !== "" && normTxt(a) === normTxt(b);

function AbsHead({ meta }) {
  return (
    <>
      <Head small />
      <div className="mt-2"><Rule color="#3E6350" thick /></div>
      <div className="mt-2.5 rounded-[3px] px-3 py-1.5 text-[13px] font-bold text-white" style={{ background: ABS_GREEN, ...INK }}>
        نموذج رقم ( <span className="num">{meta.no}</span> )
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 text-[13px] font-bold text-ink">
        <span>اسم النموذج : {meta.name}</span>
        <span>رمز النموذج : ( و.م.ع.ن.-<span className="num" dir="ltr">{meta.code}</span> )</span>
      </div>
    </>
  );
}

const absCell = "border border-[#7FA08B] px-2 align-middle";
function SchoolRow() {
  return (
    <table className="mt-2.5 w-full border-collapse text-[12.5px]">
      <tbody><tr>
        <th className={`${absCell} w-[24%] py-1 text-right font-semibold text-white`} style={{ background: ABS_GREEN, ...INK }}>المدرسة</th>
        <td className={`${absCell} py-1 font-semibold text-ink`} style={{ background: ABS_PALE, ...INK }}>مدرسة مكة الثانوية</td>
      </tr></tbody>
    </table>
  );
}
// السجل المدني: خانة لكل رقم (النماذج 19–21)، أو خانة واحدة (النموذج 18)
function CivilRow({ value, boxes }) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 10).split("");
  return (
    <table className="mt-1.5 w-full border-collapse text-[12.5px]" style={{ tableLayout: "fixed" }}>
      <tbody><tr>
        <th className={`${absCell} w-[24%] py-1 text-right font-semibold text-white`} style={{ background: ABS_GREEN, ...INK }}>السجل المدني</th>
        {boxes
          ? Array.from({ length: 10 }, (_, i) => (
              <td key={i} dir="ltr" className={`${absCell} num py-1 text-center font-semibold text-ink`} style={{ background: ABS_PALE, ...INK }}>
                {/* الرقم يُقرأ من اليسار: الخانة الأولى من اليمين لآخر رقم */}
                {digits[9 - i] ?? ""}
              </td>))
          : <td className={`${absCell} py-1 text-right font-semibold text-ink`} style={{ background: ABS_PALE, ...INK }}>
              <span className="num">{value || ""}</span>
            </td>}
      </tr></tbody>
    </table>
  );
}
function EmpTable({ cols, extra }) {
  return (
    <table className="mt-1.5 w-full border-collapse text-[12px]">
      <thead><tr>
        {cols.map(([h]) => (
          <th key={h} className={`${absCell} py-1 text-center font-semibold text-white`} style={{ background: ABS_GREEN, ...INK }}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        <tr>
          {cols.map(([h, x]) => (
            <td key={h} className={`${absCell} h-8 text-center font-semibold text-ink`} style={{ background: ABS_PALE, ...INK }}>{x || ""}</td>
          ))}
        </tr>
        {extra}
      </tbody>
    </table>
  );
}

const Box = ({ on }) => (
  <span className="ml-1.5 inline-grid h-[13px] w-[13px] place-items-center border border-ink align-[-2px] text-[10px] font-bold leading-none">{on ? "✓" : ""}</span>
);
// قيمة داخل السطر، وإن خلت بقيت نقاطًا للكتابة باليد
const Fill = ({ children, w = "w-40" }) => (children
  ? <b className="mx-1 font-semibold text-ink">{children}</b>
  : <span className={`mx-1 inline-block ${w} border-b border-dotted border-ink/60 align-baseline`}>&nbsp;</span>);
const HDate = ({ d }) => (d
  ? <b className="mx-1 font-semibold text-ink"><span className="num">{d}</span>هـ</b>
  : <span className="mx-1 text-ink">&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;١٤هـ</span>);

/* سطر توقيع: الصفة والاسم، والتوقيع (صورته إن وُجدت)، والتاريخ */
function SigLine({ label, name, url, date }) {
  return (
    <div className="flex items-end justify-between gap-3 py-1 text-[13px] text-ink">
      <span className="min-w-0 flex-1">{label} :<Fill w="w-44">{name}</Fill></span>
      <span className="flex items-end">التوقيع
        <span className="mx-1 inline-grid h-10 w-32 place-items-end justify-items-center border-b border-dotted border-ink/60">
          {url && <img src={url} alt="" className="max-h-10 w-auto object-contain" />}
        </span>
      </span>
      <span>التاريخ :<HDate d={date} /></span>
    </div>
  );
}
function Dotted({ text, lines = 3 }) {
  return (
    <div className="mt-1 text-[13px] leading-[2.1] text-ink"
         style={{ backgroundImage: "linear-gradient(to bottom, transparent calc(100% - 1px), #9a9a9a calc(100% - 1px))",
                  backgroundSize: "100% 2.1em", minHeight: `${lines * 2.1}em`, ...INK }}>
      <span className="whitespace-pre-line font-semibold">{text || ""}</span>
    </div>
  );
}
const Copies = ({ list }) => (
  <div className="mt-3 space-y-0.5 text-[11.5px] text-ink">{list.map((l) => <p key={l}>{l}</p>)}</div>
);

function AbsenceForm(p) {
  const { v, doc, template } = p;
  const meta = ABS_META[template.key];
  const name = v.recipient ?? doc?.recipient ?? "";
  const spec = v.emp_spec ?? (template.key === "frm_late_notice" ? v.f4 : "");
  // «رقم الوظيفة والمرتبة» في المستندات السابقة حقل واحد (f4) في قراري الحسم 19 و21 فقط —
  // وفي غيرهما f4 حقل آخر (التخصص في 18، ومدة الغياب في 20)
  const combinedF4 = template.key === "frm_hours_deduction" || template.key === "frm_absence_deduction";
  const jobNo = v.emp_job_no || (combinedF4 ? v.f4 : "") || "";
  const replied = Boolean(doc?.reply_at);
  const replyName = replied ? (p.replySigName || name) : "";
  const P = (props) => <p className="text-[13px] leading-[1.95] text-ink" {...props} />;
  let body;

  if (template.key === "frm_late_notice") {
    const day = rangeOf(v.f5)[0];
    const [t1, t2] = rangeOf(v.f7);
    const kinds = ["تأخر عن الدوام", "عدم التواجد في مقر العمل", "انصراف مبكر قبل نهاية الدوام"];
    const other = v.f6 && !kinds.some((k) => sameTxt(k, v.f6)) ? v.f6 : "";
    const decided = Boolean(String(v.f10 ?? "").trim());
    body = (
      <>
        <SchoolRow />
        <CivilRow value={v.f3} />
        <EmpTable cols={[["الاسم", name], ["التخصص", spec], ["المستوى / المرتبة", v.emp_rank], ["رقم الوظيفة", jobNo], ["العمل الحالي", v.job]]} />
        <div className="mt-3 space-y-0.5">
          <P>المكرم المعلم /<Fill w="w-72">{name}</Fill> وفقه الله</P>
          <P>السلام عليكم ورحمة الله وبركاته <span className="mr-10">وبعد :</span></P>
          <P>إنه في يوم<Fill w="w-28">{weekdayOf(day)}</Fill> الموافق<HDate d={hijriPart(day)} /> اتضح ما يلي :</P>
          <P><Box on={sameTxt(kinds[0], v.f6)} />تأخركم من بداية العمل ، وحضوركم الساعة (<Fill w="w-20">{sameTxt(kinds[0], v.f6) ? t1 : ""}</Fill>)</P>
          <P><Box on={sameTxt(kinds[1], v.f6)} />عدم تواجدكم أثناء العمل من الساعة (<Fill w="w-20">{sameTxt(kinds[1], v.f6) ? t1 : ""}</Fill>) إلى الساعة (<Fill w="w-20">{sameTxt(kinds[1], v.f6) ? t2 : ""}</Fill>)</P>
          <P><Box on={sameTxt(kinds[2], v.f6)} />انصرافكم مبكراً قبل نهاية العمل من الساعة (<Fill w="w-20">{sameTxt(kinds[2], v.f6) ? t1 : ""}</Fill>)</P>
          {other && <P><Box on />{other}</P>}
          <P>عليه نأمل توضيح أسباب ذلك مع إرفاق ما يؤيد عذركم ،،، ولكم تحياتي</P>
          <SigLine label="مدير المدرسة" name={p.principalName} url={p.principalSigUrl} date={hijriTs(doc?.created_at)} />
          <P>المكرم / مدير مدرسة<Fill w="w-56">مكة الثانوية</Fill> وفقه الله</P>
          <P>السلام عليكم ورحمة الله وبركاته</P>
          <P>أفيدكم أن أسباب ذلك ما يلي</P>
          <Dotted text={v.f9} lines={3} />
          <SigLine label="الاسم" name={replyName} url={replied ? p.replySigUrl : null} date={hijriTs(doc?.reply_at)} />
          <P>رأي مدير المدرسة
            <span className="mr-8"><Box on={sameTxt("عذره مقبول", v.f10)} />عذره مقبول</span>
            <span className="mr-8"><Box on={sameTxt("عذره غير مقبول ويحسم عليه", v.f10)} />عذره غير مقبول ويحسم عليه</span>
          </P>
          {decided && !["عذره مقبول", "عذره غير مقبول ويحسم عليه"].some((k) => sameTxt(k, v.f10)) && <P className="text-[13px] font-semibold text-ink">{v.f10}</P>}
          {String(v.action_taken ?? "").trim() && <P>{v.action_taken}</P>}
          <SigLine label="مدير المدرسة" name={decided ? p.principalName : ""} url={decided ? p.principalSigUrl : null}
                   date={decided ? hijriTs(doc?.approved_at) : ""} />
        </div>
        <p className="mt-2 text-[11.5px] leading-[1.8] text-ink">
          ملاحظة : ترفق بطاقة المساءلة مع أصل القرار في حالة عدم قبول العذر لحفظها بملفه بالإدارة ، أصله الملف بالمدرسة.
        </p>
      </>
    );
  } else if (template.key === "frm_hours_deduction") {
    body = (
      <>
        <SchoolRow />
        <CivilRow value={v.f3} boxes />
        <EmpTable cols={[["الاسم", name], ["التخصص", spec], ["المستوى / المرتبة", v.emp_rank], ["رقم الوظيفة", jobNo], ["العمل الحالي", v.job]]} />
        <div className="mt-3 space-y-0.5 text-justify">
          <P>إن مدير المدرسة<Fill w="w-56">{p.principalName}</Fill></P>
          <P>بناء على صلاحياته ، وبناء على المادة ( <span className="num">21</span> ) من نظام الخدمة المدنية وبناءً على موافقة معالي الوزير على إعطاء بعض الصلاحيات لمديري المدارس بالقرار رقم <span className="num">1/1139</span> وتاريخ <span className="num">1431/3/17</span>هـ ، ولبلوغ ساعات التأخر عن العمل والخروج المبكر من العمل (<Fill w="w-16">{v.f5}</Fill>) ساعة ، وحيث إن عذره غير مقبول ، وبمقتضى النظام .</P>
          <P>يقرر ما يلي</P>
          <P>( <span className="num">1</span> ) حسم مدة الغياب الموضحة بعاليه وعددها (<Fill w="w-12">{v.f6}</Fill>) يوماً من راتبه .</P>
          <P>( <span className="num">2</span> ) على إدارة شؤون الموظفين ( تنفيذ الأنظمة ) تنفيذ إجراء الحسم واستبعادها من خدماته واصل القرار للملف بالإدارة مع الأساس لملفه .</P>
          <P className="text-center text-[13px] leading-[1.95] text-ink">والله الموفق</P>
        </div>
        <DecisionSign p={p} date={hijriPart(v.f8)} />
        <Copies list={["صورة / للموظفين لمتابعة تنفيذ الحسم ( تنفيذ الأنظمة )", "صورة / لمكتب التعليم", "صورة/ للملف بالمدرسة"]} />
      </>
    );
  } else if (template.key === "frm_absence_inquiry") {
    const [a, b] = rangeOf(v.f4);
    const opts = ["تحتسب له إجازة مرضية بعد التأكد من نظامية التقرير",
                  "يحتسب غيابه من رصيده للإجازات الاضطرارية لقبول عذره إذا كان رصيده يسمح وإلا يحسم عليه.",
                  "يعتمد الحسم لعدم قبول عذره"];
    const decided = Boolean(String(v.action_taken ?? "").trim());
    const other = decided && !opts.some((o) => sameTxt(o, v.action_taken)) ? v.action_taken : "";
    body = (
      <>
        <SchoolRow />
        <CivilRow value={v.f3} boxes />
        <EmpTable
          cols={[["الاسم", name], ["التخصص", spec], ["المستوى / المرتبة", v.emp_rank], ["الدرجة", v.emp_grade],
                 ["رقم الوظيفة", jobNo], ["العمل الحالي", v.job], ["عدد أيام الغياب", v.days_count]]}
          extra={
            <tr><td colSpan={7} className={`${absCell} py-2 text-[12.5px] text-ink`} style={{ background: ABS_PALE, ...INK }}>
              إنه في يوم<Fill w="w-20">{weekdayOf(a)}</Fill> الموافق<HDate d={hijriPart(a)} /> تغيبت عن العمل إلى يوم<Fill w="w-20">{weekdayOf(b)}</Fill> الموافق<HDate d={hijriPart(b)} />
            </td></tr>} />
        <div className="mt-2.5 space-y-0">
          <p className="text-[13px] font-bold text-[#3E6350]">( <span className="num">1</span> ) طلب الإفادة</p>
          <P>المكرم /<Fill w="w-72">{name}</Fill> وفقه الله</P>
          <P>السلام عليكم ورحمة الله وبركاته وبعد ،،،</P>
          <P className="text-justify text-[13px] leading-[1.95] text-ink">من خلال متابعة سجل العمل تبين غيابكم خلال الفترة الموضحة بعاليه ، آمل الإفادة عن أسباب ذلك وعليكم تقديم ما يؤيد عذركم خلال أسبوع من تاريخه ، علماً بأنه في حالة عدم الالتزام سيتم اتخاذ اللازم حسب التعليمات .</P>
          <SigLine label="اسم الرئيس المباشر" name={p.principalName} url={p.principalSigUrl} date={hijriPart(v.f7) || hijriTs(doc?.created_at)} />

          <p className="mt-1 text-[13px] font-bold text-[#3E6350]">( <span className="num">2</span> ) الإفادة</p>
          <P>المكرم / مدير المدرسة <span className="mr-24">وفقه الله</span></P>
          <P>السلام عليكم ورحمة الله وبركاته وبعد:</P>
          <P>أفيدكم أن غيابي كان للأسباب التالية :</P>
          <Dotted text={v.f5} lines={2} />
          <P>وسأقوم بتقديم ما يثبت ذلك خلال أسبوع من تاريخه</P>
          <SigLine label="اسم المعلم" name={replyName} url={replied ? p.replySigUrl : null} date={hijriTs(doc?.reply_at)} />

          <p className="mt-1 text-[13px] font-bold text-[#3E6350]">( <span className="num">3</span> ) مدير المدرسة :</p>
          {opts.map((o, i) => (
            <P key={i}><span className="ml-1">{["أ.", "ب.", "ج."][i]}</span><Box on={sameTxt(o, v.action_taken)} />{o}</P>
          ))}
          {other && <P className="text-[13px] font-semibold leading-[1.95] text-ink">{other}</P>}
          {String(v.f6 ?? "").trim() && <P>{v.f6}</P>}
          <SigLine label="اسم الرئيس المباشر" name={decided ? p.principalName : ""} url={decided ? p.principalSigUrl : null}
                   date={decided ? hijriTs(doc?.approved_at) : ""} />
        </div>
        <div className="mt-1.5 text-[11.5px] leading-[1.75] text-ink">
          <p className="font-bold text-[#3E6350]">ملحوظات هامة</p>
          <p><span className="num">1</span> - تستكمل الاستمارة من المدير المباشر وإصدار القرار بموجبه.</p>
          <p><span className="num">2</span> - إذا سبق إجازة نهاية الأسبوع غياب وألحقها غياب تحتسب مدة الغياب كاملة.</p>
          <p><span className="num">3</span> - يجب أن يوضح المتغيب أسباب غيابه فور تسلمه الاستمارة ويعيدها لمديره المباشر.</p>
          <p><span className="num">4</span> - يعطي المتغيب مدة أسبوع لتقديم ما يؤيد عذره فإذا انقضت المدة الزمنية تستكمل الاستمارة ويتم الحسم.</p>
        </div>
      </>
    );
  } else {
    const [a, b] = rangeOf(v.f6);
    const days = a ? <>من<HDate d={hijriPart(a)} />إلى<HDate d={hijriPart(b)} /></> : "";
    body = (
      <>
        <SchoolRow />
        <CivilRow value={v.f3} boxes />
        <EmpTable
          cols={[["الاسم", name], ["التخصص", spec], ["المستوى / المرتبة", v.emp_rank], ["الدرجة", v.emp_grade],
                 ["رقم الوظيفة", jobNo], ["عدد أيام الغياب", v.f5]]}
          extra={
            <tr>
              <th colSpan={2} className={`${absCell} py-1.5 text-right font-semibold text-white`} style={{ background: ABS_GREEN, ...INK }}>الأيام الواجب حسمها ليحدد التاريخ</th>
              <td colSpan={4} className={`${absCell} py-1.5 text-center font-semibold text-ink`} style={{ background: ABS_PALE, ...INK }}>{days}</td>
            </tr>} />
        <div className="mt-3 space-y-0.5 text-justify">
          <P>إن مدير المدرسة<Fill w="w-56">{p.principalName}</Fill></P>
          <P>بناء على صلاحياته ، وبناء على المادة ( <span className="num">21</span> ) من نظام الخدمة المدنية ، وبناء على موافقة معالي الوزير على إعطاء بعض الصلاحيات لمديري المدارس بالقرار رقم <span className="num">1/1139</span> وتاريخ <span className="num">1421/3/17</span>هـ ولغياب المعلم الموضح أسمه أعلاه ، حيث إن عذره غير مقبول ، وبمقتضى النظام .</P>
          <P>يقرر ما يلي :</P>
          <P>( <span className="num">1</span> ) حسم مدة الغياب الموضحة بعاليه وعددها (<Fill w="w-12">{v.f5}</Fill>) يوماً من راتبه .</P>
          <P>( <span className="num">2</span> ) على إدارة شؤون الموظفين تنفيذ إجراء الحسم واستبعادها من خدماته وأصل القرار لملفه بالإدارة مع الأساس لملفه (<Fill w="w-24" />)</P>
          <P>والله الموفق ،،،،،</P>
        </div>
        <DecisionSign p={p} date={hijriPart(v.f7)} />
        <div className="mt-3 text-[11.5px] leading-[1.8] text-ink">
          <p>ملاحظة / لن يتم استلام قرار الحسم بدون المساءلة</p>
          <p>صورة/ لشؤون الموظفين لمتابعة تنفيذ الحسم ( تنفيذ الأنظمة ) .</p>
          <p>صورة / لمكتب التعليم .</p>
          <p>صورة / لملفه بالمدرسة .</p>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col px-[14mm] pb-[10mm] pt-[11mm]">
      <AbsHead meta={meta} />
      <div className="flex-1">{body}</div>
      <ReplyFilesNote v={v} />
      <div className="mt-3"><Foot serial={doc?.serial} /></div>
    </div>
  );
}

/* «الرئيس المباشر» في قراري الحسم: الاسم والختم والتوقيع والتاريخ */
function DecisionSign({ p, date }) {
  return (
    <div className="mt-3 flex items-end justify-between gap-4 text-[13px] text-ink">
      <div className="space-y-1">
        <p className="font-semibold">الرئيس المباشر</p>
        <p>الاسم :<Fill w="w-48">{p.principalName}</Fill></p>
        <p>التاريخ :<HDate d={date} /></p>
      </div>
      <div className="flex items-end gap-8">
        <div className="text-center">
          <p>الختم</p>
          <div className="grid h-20 w-28 place-items-center">{p.stampUrl && <img src={p.stampUrl} alt="" className="max-h-20 w-auto object-contain opacity-90" />}</div>
        </div>
        <div className="text-center">
          <p>التوقيع</p>
          <div className="grid h-14 w-36 place-items-center border-b border-dotted border-ink/60">{p.principalSigUrl && <img src={p.principalSigUrl} alt="" className="max-h-14 w-auto object-contain" />}</div>
        </div>
      </div>
    </div>
  );
}

function Administrative(p) {
  const { v, doc, template } = p;
  return (
    <div className="flex h-full flex-col p-[16mm]">
      <Head />
      <div className="mt-3"><Rule color="#3E6350" thick /></div>
      <h1 className="mt-5 text-center text-[21px] font-bold text-ink">{template.title}</h1>

      <div className="mt-5 flex-1 space-y-2">
        {(template.fields ?? [])
          // حقل قديم أو اختياري الظهور: يُطبع حين تكون له قيمة فقط (مستندات صدرت قبل تعديل النموذج)
          .filter((f) => !(f.legacy || f.hide_empty) || String(v[f.name] ?? "").trim())
          .map((f) =>
          f.type === "table" ? (
            <BlankTable key={f.name} field={f} value={v[f.name]} />
          ) : f.type === "duty_schedule" ? (
            <DutyScheduleBlock key={f.name} field={f} value={v[f.name]} />
          ) : (
            <div key={f.name} className="flex gap-3 border-b border-line py-2">
              <span className="w-44 shrink-0 text-[13px] text-muted">{f.label}</span>
              <span className="whitespace-pre-line text-[14px] text-ink">{asText(v[f.name]) || "—"}</span>
            </div>
          ),
        )}
      </div>

      <div className="mt-4">
        <ReplyFilesNote v={v} />
        <Signatures
          source={template.signature_source}
          issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
          principalUrl={p.principalSigUrl} principalName={p.principalName}
          stampUrl={p.stampUrl}
          replyUrl={p.replySigUrl} replyName={p.replySigName}
        />
      </div>
      <div className="mt-7"><Foot serial={doc?.serial} /></div>
    </div>
  );
}

export default function FormSheet({
  template, values, doc, sigUrl, stampUrl, principalSigUrl, principalName,
  replySigUrl, replySigName, scale = 1,
}) {
  if (!template) return null;
  const landscape = sheetLandscape(template);
  // المستندات المحفوظة قبل توحيد التاريخ: «03/03/1448هـ (14/09/2026م)» تُعرض «03/03/1448 - 14/09/2026»
  const v = Object.fromEntries(Object.entries(values ?? {}).map(([k, x]) => [k,
    typeof x === "string"
      ? noEra(x).replace(/(\d{2}\/\d{2}\/1[34]\d\d)\s*\((\d{2}\/\d{2}\/(?:19|20)\d\d)\)/g, "$1 - $2")
      : x]));
  const Body = template.key === "student_admission" ? StudentAdmission
             : isAbsenceForm(template) ? AbsenceForm
             : isGuestCert(template) ? GuestCert
             : template.category === "certificate" ? Certificate
             : template.category === "official"    ? Official
             : Administrative;

  const sheetStyle = {
    width: landscape ? "297mm" : "210mm",
    height: landscape ? "210mm" : "297mm",
    flex: "0 0 auto",
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: "top center",
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
  };
  const sheetCls = "sheet mx-auto bg-white text-ink shadow-[0_18px_50px_-28px_rgba(16,16,16,.5)]";
  // اسم المدير: المحفوظ تحت توقيعه، وإلا اسمه في «أسماء الموقّعين»
  const props = { template, v, doc, sigUrl, stampUrl, principalSigUrl,
                  principalName: principalName || PRINCIPAL_NAME, replySigUrl, replySigName };

  // استمارة الزيارة بالبنود: عدة صفحات، كل صفحة ورقة مستقلة في الطباعة
  // تُعرف بوجود جدول بنود في حقولها، لا بمفتاح القالب (قد يختلف في قاعدة البيانات)
  if (isRubricDoc(template, v)) {
    return (
      <div className="space-y-4 print:space-y-0">
        {supportVisitPages(props).map((page, i) => (
          <div key={i} className={sheetCls} style={sheetStyle}>{page}</div>
        ))}
      </div>
    );
  }

  return (
    <div className={sheetCls} style={sheetStyle}>
      <Body {...props} />
    </div>
  );
}
