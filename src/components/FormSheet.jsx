import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   ورقة النموذج القابلة للطباعة — نفس هوية المدرسة:
   الرأس الرسمي (البيانات يمينًا والشعاران يسارًا بارتفاع واحد)،
   ثم محتوى يختلف بحسب تصنيف النموذج، ثم التوقيع والختم والرقم التسلسلي.

   تُغلَّف بـ id="print-root" فتُطبع وحدها دون واجهة البوابة.
   ===================================================================== */

const GOV_LINES = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

export const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #print-root, #print-root * { visibility: visible !important; }
  #print-root { position: fixed; inset: 0; z-index: 9999; background: #fff; }
  .no-print { display: none !important; }
}
`;

function Head({ compact }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b-2 border-mint-deep pb-3">
      <div className="text-[11.5px] font-medium leading-[1.95] text-ink">
        {GOV_LINES.map((l) => <div key={l}>{l}</div>)}
        <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
      </div>
      <div className="flex items-center gap-4">
        <img src={moeLogo} alt="وزارة التعليم" className={compact ? "h-10 w-auto" : "h-12 w-auto"} />
        <img src={logoIcon} alt="مدرسة مكة الثانوية" className={compact ? "h-10 w-auto" : "h-12 w-auto"} />
      </div>
    </div>
  );
}

function SignBlock({ doc, sigUrl, stampUrl, principalSigUrl }) {
  const src = doc?.signature_source ?? "issuer";
  if (src === "none" && !stampUrl) return null;

  const One = ({ url, name, role }) => (
    <div className="min-w-[190px] text-center">
      <p className="text-[12.5px] text-muted">{role}</p>
      {url
        ? <img src={url} alt="" className="mx-auto my-1 h-14 w-auto object-contain" />
        : <div className="h-14" />}
      <p className="text-[13.5px] font-semibold text-ink">{name}</p>
    </div>
  );

  return (
    <div className="mt-6 flex items-end justify-between gap-6">
      <div className="flex gap-10">
        {(src === "issuer" || src === "both") && (
          <One url={sigUrl} name={doc?.signature_name ?? ""} role={doc?.signature_role ?? "المُصدِر"} />
        )}
        {(src === "principal" || src === "both") && (
          <One url={principalSigUrl} name={doc?.principal_name ?? ""} role="مدير المدرسة" />
        )}
      </div>
      {stampUrl && <img src={stampUrl} alt="" className="h-24 w-auto object-contain opacity-90" />}
    </div>
  );
}

function Footer({ serial }) {
  return (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-[11px] text-faint">
      <span className="flex items-center gap-2">
        <img src={logoIcon} alt="" className="h-4 w-auto" />
        بوابة مكة الثانوية الرقمية
      </span>
      {serial && <span className="num">رقم المستند: {serial}</span>}
      <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
    </div>
  );
}

/* ----------------------------- شهادة ----------------------------- */
function Certificate({ template, v, doc, sigUrl, stampUrl, principalSigUrl }) {
  return (
    <div className="relative flex h-full flex-col border-[6px] border-mint-deep p-10"
         style={{ outline: "2px solid #89D7AD", outlineOffset: "-16px" }}>
      <Head compact />

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-[40px] font-bold leading-tight text-mint-deep">شهادة شكر وتقدير</h1>
        <p className="mt-4 text-[16px] text-muted">تتقدّم مدرسة مكة الثانوية بالشكر والتقدير إلى</p>
        <p className="mt-3 text-[34px] font-bold text-ink">{v.recipient || "…"}</p>
        {v.job && <p className="mt-1 text-[15px] text-muted">{v.job}</p>}
        {v.class_label && <p className="mt-1 text-[15px] text-muted">{v.class_label}</p>}
        <p className="mx-auto mt-5 max-w-[62ch] text-[16px] leading-[2] text-ink">
          {v.reason || "…"}
        </p>
        <p className="num mt-4 text-[13px] text-muted">{v.date || ""}</p>
      </div>

      <SignBlock doc={doc} sigUrl={sigUrl} stampUrl={stampUrl} principalSigUrl={principalSigUrl} />
      <Footer serial={doc?.serial} />
    </div>
  );
}

/* ------------------------ تعميم أو خطاب رسمي ------------------------ */
function Official({ template, v, doc, sigUrl, stampUrl, principalSigUrl }) {
  const isLetter = template.key === "official_letter";
  return (
    <div className="flex h-full flex-col">
      <Head />

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
        <>
          <h1 className="mt-5 text-[22px] font-bold text-ink">{v.title || ""}</h1>
        </>
      )}

      <div className="mt-4 flex-1 whitespace-pre-line text-[14.5px] leading-[2] text-ink">
        {v.body || ""}
      </div>

      {v.alert && (
        <div className="my-3 flex gap-3 rounded-card border border-[#F0E3C4] bg-[#FCF5E6] px-4 py-3 text-[13.5px] leading-[1.8] text-warning">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm2 bg-[#F6EAD0] font-bold">!</span>
          <span className="whitespace-pre-line">{v.alert}</span>
        </div>
      )}

      {v.action && (
        <div className="my-3 rounded-card border border-[#D4EADD] bg-mint-tint px-4 py-3">
          <p className="text-[14px] font-semibold text-mint-deep">المطلوب</p>
          <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-[1.8] text-muted">{v.action}</p>
        </div>
      )}

      <SignBlock doc={doc} sigUrl={sigUrl} stampUrl={stampUrl} principalSigUrl={principalSigUrl} />
      <Footer serial={doc?.serial} />
    </div>
  );
}

/* --------------------------- نموذج إداري --------------------------- */
function Administrative({ template, v, doc, sigUrl, stampUrl, principalSigUrl }) {
  const fields = template.fields ?? [];
  return (
    <div className="flex h-full flex-col">
      <Head />
      <h1 className="mt-5 text-center text-[21px] font-bold text-ink">{template.title}</h1>

      <div className="mt-5 flex-1 space-y-2">
        {fields.map((f) => (
          <div key={f.name} className="flex gap-3 border-b border-line py-2">
            <span className="w-44 shrink-0 text-[13px] text-muted">{f.label}</span>
            <span className="whitespace-pre-line text-[14px] text-ink">{v[f.name] || "—"}</span>
          </div>
        ))}
      </div>

      <SignBlock doc={doc} sigUrl={sigUrl} stampUrl={stampUrl} principalSigUrl={principalSigUrl} />
      <Footer serial={doc?.serial} />
    </div>
  );
}

export default function FormSheet({ template, values, doc, sigUrl, stampUrl, principalSigUrl, scale = 1 }) {
  if (!template) return null;
  const landscape = template.orientation === "landscape";
  const v = values ?? {};
  const Body = template.category === "certificate" ? Certificate
             : template.category === "official"    ? Official
             : Administrative;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        ${PRINT_CSS}
        @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 0; }
      ` }} />
      <div
        id="print-root"
        className="mx-auto bg-white text-ink shadow-[0_18px_50px_-28px_rgba(16,16,16,.5)]"
        style={{
          width: landscape ? "297mm" : "210mm",
          minHeight: landscape ? "210mm" : "297mm",
          padding: landscape ? "12mm" : "16mm 15mm",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top center",
          fontFamily: "'IBM Plex Sans Arabic', sans-serif",
        }}
      >
        <Body template={template} v={v} doc={doc}
              sigUrl={sigUrl} stampUrl={stampUrl} principalSigUrl={principalSigUrl} />
      </div>
    </>
  );
}
