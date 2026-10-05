// src/components/FormSheet.jsx
import { Fragment } from "react";
import logoIcon from "../assets/icon-mint.png";
import { noEra } from "../lib/dates";
import moeLogo from "../assets/moe-logo.png";
import PrintPortal from "./PrintPortal.jsx";
import { RATING_LEVELS, itemPoints, overallLabel, ratingLabel, rubricScore } from "../lib/rubric.js";
import { PRINCIPAL_NAME } from "../lib/signers.js";

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

const rubricFields = (template) => (template.fields ?? []).filter((f) => f.type === "rubric");
export const isRubricDoc = (template, v) =>
  rubricFields(template).some((f) => v && Object.prototype.hasOwnProperty.call(v, f.name));

// اليوم من الجزء الميلادي للتاريخ المحفوظ «03/03/1448 - 14/09/2026»
function weekdayOf(dateStr) {
  const m = String(dateStr ?? "").match(/(\d{2})\/(\d{2})\/((?:19|20)\d{2})/);
  if (!m) return "";
  return WEEKDAYS[new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).getUTCDay()] ?? "";
}

function VisitHead({ title, sub }) {
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

      {/* طريقة التقييم — كما في الاستمارة الورقية */}
      <div className="mt-5 space-y-3">
        {rubrics.map((f) => (
          <div key={f.name} className={`${cellB} rounded-[4px] px-4 pb-4 pt-0`}>
            <p className="-mx-4 mb-3 inline-block rounded-bl-[4px] px-4 py-1 text-[13px] font-bold text-ink" style={TH}>
              {f.label}
            </p>
            <p className="text-center text-[13px] font-semibold text-ink">{f.note}</p>
          </div>
        ))}
      </div>

      {/* ملخّص النتيجة */}
      <p className="mt-5 text-[13px] font-semibold text-mint-deep">نتيجة التقييم</p>
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
              {pct != null ? `${Math.round(got * 10) / 10}%` : ""}
            </td>
            <td className={`${cellB} px-2 py-1.5 text-center font-bold text-mint-deep`} style={TH}>
              {allRated ? overallLabel(pct) : anyRated ? <span className="text-[10.5px] font-normal text-muted">قُدِّر <N>{rated}</N> من <N>{count}</N></span> : ""}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        يُقدَّر كل عنصر من <N>5</N>:{" "}
        {RATING_LEVELS.map((l, i) => (
          <span key={l.v}><span className="num">{l.v}</span> {l.label}{i < RATING_LEVELS.length - 1 ? "، " : ""}</span>
        ))}
        ؛ ودرجة العنصر = وزنه × تقديره ÷ <N>5</N>
      </p>
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

function supportVisitPages(p) {
  const { template, v, doc } = p;
  const rubrics = rubricFields(template);
  const total = 2 + rubrics.length;
  const pages = [];
  pages.push(<>
    <VisitHead title={template.title} sub="وفق بنود الأداء الوظيفي" />
    <VisitInfoPage template={template} v={v} rubrics={rubrics} doc={doc} principalName={p.principalName} />
  </>);
  rubrics.forEach((f) => pages.push(<>
    <VisitHead title={template.title} sub={v.recipient ? `المعلم: ${v.recipient}` : ""} />
    <RubricPage field={f} value={v[f.name]} />
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
  const landscape = template.orientation === "landscape";
  // المستندات المحفوظة قبل توحيد التاريخ: «03/03/1448هـ (14/09/2026م)» تُعرض «03/03/1448 - 14/09/2026»
  const v = Object.fromEntries(Object.entries(values ?? {}).map(([k, x]) => [k,
    typeof x === "string"
      ? noEra(x).replace(/(\d{2}\/\d{2}\/1[34]\d\d)\s*\((\d{2}\/\d{2}\/(?:19|20)\d\d)\)/g, "$1 - $2")
      : x]));
  const Body = template.key === "student_admission" ? StudentAdmission
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
