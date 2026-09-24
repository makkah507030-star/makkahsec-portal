// src/components/FormSheet.jsx
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

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

export function PrintArea({ landscape, children }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #print-root, #print-root * { visibility: visible !important; }
          #print-root { position: absolute; inset: 0; background: #fff; }
          #print-root .sheet { box-shadow: none !important; transform: none !important;
                               break-after: page; margin: 0 !important; }
          #print-root .sheet:last-child { break-after: auto; }
          .no-print { display: none !important; }
        }
        @page { size: ${landscape ? "297mm 210mm" : "210mm 297mm"}; margin: 0; }
      ` }} />
      <div id="print-root">{children}</div>
    </>
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
          <Sign url={replyUrl} name={replyName} role="توقيع المستفيد" />
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

/* --------------------------- نموذج إداري --------------------------- */
function Administrative(p) {
  const { v, doc, template } = p;
  return (
    <div className="flex h-full flex-col p-[16mm]">
      <Head />
      <div className="mt-3"><Rule color="#3E6350" thick /></div>
      <h1 className="mt-5 text-center text-[21px] font-bold text-ink">{template.title}</h1>

      <div className="mt-5 flex-1 space-y-2">
        {(template.fields ?? []).map((f) =>
          f.type === "table" ? (
            <BlankTable key={f.name} field={f} value={v[f.name]} />
          ) : f.type === "duty_schedule" ? (
            <DutyScheduleBlock key={f.name} field={f} value={v[f.name]} />
          ) : (
            <div key={f.name} className="flex gap-3 border-b border-line py-2">
              <span className="w-44 shrink-0 text-[13px] text-muted">{f.label}</span>
              <span className="whitespace-pre-line text-[14px] text-ink">{v[f.name] || "—"}</span>
            </div>
          ),
        )}
      </div>

      <div className="mt-4">
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
  const Body = template.category === "certificate" ? Certificate
             : template.category === "official"    ? Official
             : Administrative;

  return (
    <div
      className="sheet mx-auto bg-white text-ink shadow-[0_18px_50px_-28px_rgba(16,16,16,.5)]"
      style={{
        width: landscape ? "297mm" : "210mm",
        height: landscape ? "210mm" : "297mm",
        flex: "0 0 auto",
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top center",
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
      }}
    >
      <Body template={template} v={values ?? {}} doc={doc}
            sigUrl={sigUrl} stampUrl={stampUrl}
            principalSigUrl={principalSigUrl} principalName={principalName}
            replySigUrl={replySigUrl} replySigName={replySigName} />
    </div>
  );
}
