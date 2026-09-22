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
        @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 0; }
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

function Foot({ serial, hairline = true }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${hairline ? "border-t border-line pt-2.5" : ""} text-[10.5px] text-faint`}>
      <span>بوابة مكة الثانوية الرقمية</span>
      {serial && <span className="num">رقم المستند: {serial}</span>}
      <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
    </div>
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

function Signatures({ source, issuerUrl, issuerName, issuerRole, principalUrl, principalName, stampUrl }) {
  if (source === "none" && !stampUrl) return null;
  const showIssuer = source === "issuer" || source === "both";
  const showPrincipal = source === "principal" || source === "both";
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
function Corner({ pos }) {
  const m = {
    tr: "top-[4mm] right-[4mm]",
    tl: "top-[4mm] left-[4mm] rotate-90",
    br: "bottom-[4mm] right-[4mm] -rotate-90",
    bl: "bottom-[4mm] left-[4mm] rotate-180",
  }[pos];
  return (
    <svg viewBox="0 0 64 64" className={`pointer-events-none absolute ${m} h-14 w-14`} fill="none"
         strokeLinecap="round">
      <path d="M4 26 V10 a6 6 0 0 1 6-6 h16" stroke="#3E6350" strokeWidth="1.4" />
      <path d="M12 30 V16 a4 4 0 0 1 4-4 h14" stroke="#89D7AD" strokeWidth="1.2" />
      <circle cx="9" cy="9" r="1.6" fill="#3E6350" stroke="none" />
    </svg>
  );
}

function Certificate(p) {
  const { v, doc, template } = p;
  return (
    <div className="relative h-full">
      {/* إطار خطّي مزدوج بلا تعبئة — لا يستهلك حبرًا */}
      <div className="absolute inset-[7mm] border border-mint-deep" />
      <div className="absolute inset-[9mm] border border-[#CCF2DB]" />
      <Corner pos="tr" /><Corner pos="tl" /><Corner pos="br" /><Corner pos="bl" />

      <div className="relative flex h-full flex-col px-[22mm] py-[14mm]">
        <Head small />

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-[38px] font-bold leading-none text-mint-deep">شهادة شكر وتقدير</h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-px w-16 bg-[#CCF2DB]" />
            <span className="h-1.5 w-1.5 rotate-45 bg-mint" />
            <span className="h-px w-16 bg-[#CCF2DB]" />
          </div>

          <p className="mt-6 text-[15px] text-muted">تتقدّم مدرسة مكة الثانوية بالشكر والتقدير إلى</p>
          <p className="mt-2 text-[32px] font-bold leading-tight text-ink">{v.recipient || "…"}</p>
          {(v.class_label || v.job) && (
            <p className="mt-1 text-[14px] text-mint-hover">{v.class_label || v.job}</p>
          )}

          <p className="mx-auto mt-5 max-w-[58ch] text-[15.5px] leading-[2.1] text-ink">
            {v.reason || "…"}
          </p>

          <p className="num mt-5 text-[13px] text-muted">{v.date || ""}</p>
        </div>

        <Signatures
          source={template.signature_source}
          issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
          principalUrl={p.principalSigUrl} principalName={p.principalName}
          stampUrl={p.stampUrl}
        />

        <div className="mt-4"><Foot serial={doc?.serial} hairline={false} /></div>
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
      <div className="border-b-2 border-mint-deep pb-3"><Head /></div>

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
        />
      </div>
      <div className="mt-4"><Foot serial={doc?.serial} /></div>
    </div>
  );
}

/* --------------------------- نموذج إداري --------------------------- */
function Administrative(p) {
  const { v, doc, template } = p;
  return (
    <div className="flex h-full flex-col p-[16mm]">
      <div className="border-b-2 border-mint-deep pb-3"><Head /></div>
      <h1 className="mt-5 text-center text-[21px] font-bold text-ink">{template.title}</h1>

      <div className="mt-5 flex-1 space-y-2">
        {(template.fields ?? []).map((f) => (
          <div key={f.name} className="flex gap-3 border-b border-line py-2">
            <span className="w-44 shrink-0 text-[13px] text-muted">{f.label}</span>
            <span className="whitespace-pre-line text-[14px] text-ink">{v[f.name] || "—"}</span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Signatures
          source={template.signature_source}
          issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
          principalUrl={p.principalSigUrl} principalName={p.principalName}
          stampUrl={p.stampUrl}
        />
      </div>
      <div className="mt-4"><Foot serial={doc?.serial} /></div>
    </div>
  );
}

export default function FormSheet({
  template, values, doc, sigUrl, stampUrl, principalSigUrl, principalName, scale = 1,
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
            principalSigUrl={principalSigUrl} principalName={principalName} />
    </div>
  );
}
