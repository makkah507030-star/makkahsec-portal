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

/* خمسة قوالب للإطار — يختارها المُصدِر، فلا تتشابه شهادات الطالب الواحد.
   الذهبي #B8912F مع أخضر الهوية، وكلها خطوط رفيعة توفّر الحبر. */
export const CERT_THEMES = [
  { key: "classic", label: "الكلاسيكي",  accent: "#3E6350", hint: "إطار مزدوج بأخضر الهوية" },
  { key: "gold",    label: "الذهبي",     accent: "#B8912F", hint: "خط ذهبي وزخرفة ركنية" },
  { key: "medal",   label: "الوسام",     accent: "#B8912F", hint: "وسام ذهبي أعلى الشهادة" },
  { key: "modern",  label: "الحديث",     accent: "#3E6350", hint: "شريط جانبي وخطوط نظيفة" },
  { key: "ornate",  label: "المزخرف",    accent: "#6AA786", hint: "حافة بمعيّنات متتابعة" },
];

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

/* زخرفة الركن: ثلاثة أقواس مستوحاة من طبقات شعار المدرسة */
function Corner({ pos, c1, c2, c3, dot }) {
  const m = {
    tr: "top-[6mm] right-[6mm]",
    tl: "top-[6mm] left-[6mm] -scale-x-100",
    br: "bottom-[6mm] right-[6mm] -scale-y-100",
    bl: "bottom-[6mm] left-[6mm] -scale-100",
  }[pos];
  return (
    <svg viewBox="0 0 90 90" className={`pointer-events-none absolute ${m} h-[22mm] w-[22mm]`}
         fill="none" strokeLinecap="round" strokeLinejoin="round" style={INK}>
      <path d="M6 40 V14 a8 8 0 0 1 8-8 h26" stroke={c1} strokeWidth="1.6" />
      <path d="M13 44 V19 a6 6 0 0 1 6-6 h25" stroke={c2} strokeWidth="1.1" />
      <path d="M20 48 V24 a4 4 0 0 1 4-4 h24" stroke={c3} strokeWidth="0.9" />
      <path d="M9 9 l4 4 -4 4 -4 -4 z" fill={dot} />
    </svg>
  );
}

/* حافة بمعيّنات متتابعة — للقالب المزخرف */
function DiamondEdge({ vertical, color }) {
  const n = vertical ? 13 : 19;
  return (
    <div className={`pointer-events-none absolute flex ${vertical ? "flex-col" : ""} items-center justify-between`}
         style={vertical
           ? { top: "14mm", bottom: "14mm", [`${"left"}`]: undefined }
           : { left: "14mm", right: "14mm" }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rotate-45" style={{ background: color, ...INK }} />
      ))}
    </div>
  );
}

/* وسام دائري بطبقات الشعار — للقالب "الوسام" */
function Medal({ color }) {
  return (
    <svg viewBox="0 0 64 64" className="h-[18mm] w-[18mm]" fill="none" style={INK}>
      <circle cx="32" cy="32" r="29" stroke={color} strokeWidth="1.3" />
      <circle cx="32" cy="32" r="24" stroke="#CCF2DB" strokeWidth="1" />
      <path d="M32 16 L45 22 L32 28 L19 22 Z" fill="#3E6350" />
      <path d="M32 26 L45 32 L32 38 L19 32 Z" fill="#6AA786" />
      <path d="M32 36 L45 42 L32 48 L19 42 Z" fill="#89D7AD" />
    </svg>
  );
}

function Frame({ theme }) {
  if (theme === "gold") {
    return (
      <>
        <div className="absolute inset-[7mm] border-[1.5px]" style={{ borderColor: "#B8912F", ...INK }} />
        <div className="absolute inset-[9.5mm] border" style={{ borderColor: "#3E6350", ...INK }} />
        <div className="absolute inset-[11mm] border" style={{ borderColor: "#EADFBF", ...INK }} />
        <Corner pos="tr" c1="#B8912F" c2="#D8BC72" c3="#3E6350" dot="#B8912F" />
        <Corner pos="tl" c1="#B8912F" c2="#D8BC72" c3="#3E6350" dot="#B8912F" />
        <Corner pos="br" c1="#B8912F" c2="#D8BC72" c3="#3E6350" dot="#B8912F" />
        <Corner pos="bl" c1="#B8912F" c2="#D8BC72" c3="#3E6350" dot="#B8912F" />
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
    return (
      <>
        {/* شريط جانبي متدرّج على حافة اليمين */}
        <div className="absolute inset-y-0 right-0 w-[14mm]"
             style={{ background: "linear-gradient(180deg,#3E6350 0%,#6AA786 55%,#89D7AD 100%)", ...INK }} />
        <div className="absolute inset-y-[10mm] right-[17mm] w-px" style={{ background: "#CCF2DB", ...INK }} />
        <div className="absolute bottom-[10mm] left-[10mm] right-[17mm] h-px"
             style={{ background: "#CCF2DB", ...INK }} />
        <div className="absolute top-[10mm] left-[10mm] right-[17mm] h-px"
             style={{ background: "#CCF2DB", ...INK }} />
      </>
    );
  }
  if (theme === "ornate") {
    return (
      <>
        <div className="absolute inset-[7mm] border" style={{ borderColor: "#3E6350", ...INK }} />
        <div className="absolute inset-[12mm] border" style={{ borderColor: "#CCF2DB", ...INK }} />
        <div className="absolute inset-x-[7mm] top-[9.5mm]"><DiamondEdge color="#B8912F" /></div>
        <div className="absolute inset-x-[7mm] bottom-[9.5mm]"><DiamondEdge color="#B8912F" /></div>
        <Corner pos="tr" c1="#3E6350" c2="#6AA786" c3="#B8912F" dot="#3E6350" />
        <Corner pos="tl" c1="#3E6350" c2="#6AA786" c3="#B8912F" dot="#3E6350" />
        <Corner pos="br" c1="#3E6350" c2="#6AA786" c3="#B8912F" dot="#3E6350" />
        <Corner pos="bl" c1="#3E6350" c2="#6AA786" c3="#B8912F" dot="#3E6350" />
      </>
    );
  }
  // الكلاسيكي
  return (
    <>
      <div className="absolute inset-[7mm] border-[1.5px] border-mint-deep" style={INK} />
      <div className="absolute inset-[9.5mm] border border-[#CCF2DB]" style={INK} />
      <Corner pos="tr" c1="#3E6350" c2="#6AA786" c3="#89D7AD" dot="#3E6350" />
      <Corner pos="tl" c1="#3E6350" c2="#6AA786" c3="#89D7AD" dot="#3E6350" />
      <Corner pos="br" c1="#3E6350" c2="#6AA786" c3="#89D7AD" dot="#3E6350" />
      <Corner pos="bl" c1="#3E6350" c2="#6AA786" c3="#89D7AD" dot="#3E6350" />
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
    : theme === "modern" ? "none"
    : "linear-gradient(180deg,#EDFAF2 0%,#F7FCF9 55%,#FFFFFF 100%)";

  return (
    <div className="relative h-full overflow-hidden">
      {gradient !== "none" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[62mm]"
             style={{ background: gradient, ...INK }} />
      )}

      <Frame theme={theme} />

      <div className={`relative flex h-full flex-col pb-[13mm] pt-[13mm] ${
        theme === "modern" ? "pl-[20mm] pr-[26mm]" : "px-[22mm]"}`}>
        <Head small />

        <div className="mt-3 text-center">
          {theme === "medal" && (
            <div className="mb-2 flex justify-center"><Medal color={accent} /></div>
          )}
          <h1 className="text-[38px] font-bold leading-none"
              style={{ color: theme === "gold" ? "#3E6350" : "#3E6350" }}>
            شهادة شكر وتقدير
          </h1>
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span className="h-px w-20" style={{ background: accent, opacity: .45, ...INK }} />
            <span className="h-1.5 w-1.5 rotate-45" style={{ background: accent, ...INK }} />
            <span className="h-px w-20" style={{ background: accent, opacity: .45, ...INK }} />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[15px] text-muted">تتقدّم مدرسة مكة الثانوية بالشكر والتقدير إلى</p>
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
          source={template.signature_source}
          issuerUrl={p.sigUrl} issuerName={doc?.signature_name} issuerRole={doc?.signature_role}
          principalUrl={p.principalSigUrl} principalName={p.principalName}
          stampUrl={p.stampUrl}
        />

        <div className="mt-3"><Foot serial={doc?.serial} hairline={false} /></div>
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
