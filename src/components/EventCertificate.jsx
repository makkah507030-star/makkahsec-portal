// src/components/EventCertificate.jsx
import moeLogo from "../assets/moe-logo.png";
import logoIcon from "../assets/icon-mint.png";
import slogan from "../assets/national-day-slogan.webp";
import { fmtGreg, fmtHijri } from "../lib/dates";
import BidiDate from "./BidiDate.jsx";

/* =====================================================================
   شهادة الحدث — ورقة A4 أفقية، شهادة لكل طالب.
   • قالب «اليوم الوطني» بهوية «عزّنا بطبعنا»: الأخضر الداكن وإطار المربعات.
   • بقية القوالب بتصميم رسمي موحّد بألوان البوابة.
   • نص الشهادة بالصيغة الرسمية المعتمدة، بمتغيرات تُستبدل عند الطباعة.
   • التوقيع لمنظّم الحدث (منفّذ البرنامج).
   ===================================================================== */

export const CERT_TEMPLATES = [
  { k: "national", t: "اليوم الوطني" },
  { k: "classic", t: "كلاسيكي" }, { k: "gold", t: "ذهبي" },
  { k: "medal", t: "وسام" }, { k: "modern", t: "حديث" }, { k: "ornate", t: "مزخرف" },
];

/** هل الحدث عن اليوم الوطني؟ — لاختيار قالبه تلقائيًا */
export const isNationalDay = (e) =>
  /اليوم\s*الوطني|وطني/.test(`${e?.title ?? ""} ${e?.category ?? ""}`);

/** رقم ذكرى اليوم الوطني من سنة الحدث: 2026 ← 96 */
export const nationalDayNo = (iso) => (Number(String(iso ?? "").slice(0, 4)) || new Date().getFullYear()) - 1930;

/* الصيغة: ما قبل {الطالب} سطر تمهيدي، والاسم سطر بارز، وما بعده نص الشهادة،
   وكل سطر جديد بعده سطر ختامي — على نسق قالب الشهادات المعتمد في المدرسة. */
export const defaultCertText = (e) =>
  isNationalDay(e)
    ? "تشهد مدرسة مكة الثانوية بأن الطالب {الطالب}\n" +
      "قد شارك في «{الحدث}» المُقام بتاريخ {التاريخ}، " +
      "احتفاءً بذكرى اليوم الوطني {الذكرى} للمملكة العربية السعودية.\n" +
      "سائلين الله أن يديم على وطننا عزّه وأمنه ورخاءه"
    : "تشهد مدرسة مكة الثانوية بأن الطالب {الطالب}\n" +
      "قد شارك في «{الحدث}» المُقام بتاريخ {التاريخ}.\n" +
      "مع تمنياتنا له بالتوفيق والسداد";

export const DEFAULT_CERT_TITLE = "شهادة مشاركة";

/** استبدال المتغيرات بقيمها داخل سطر */
function fill(text, vals) {
  return String(text ?? "").split(/(\{[^{}]+\})/g).filter(Boolean).map((seg, i) => {
    const m = seg.match(/^\{([^{}]+)\}$/);
    return <span key={i}>{m && m[1] in vals ? vals[m[1]] : seg}</span>;
  });
}

/** تقسيم الصيغة: تمهيد قبل الاسم، ثم النص، ثم الأسطر الختامية */
function splitText(text) {
  const t = String(text ?? "");
  const at = t.indexOf("{الطالب}");
  const intro = at >= 0 ? t.slice(0, at).trim() : "";
  const rest = (at >= 0 ? t.slice(at + "{الطالب}".length) : t).split("\n").map((l) => l.trim()).filter(Boolean);
  return { intro, hasName: at >= 0, body: rest[0] ?? "", closing: rest.slice(1) };
}

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

const THEMES = {
  national: { ink: "#08191D", accent: "#0E8C4E", soft: "#E9F5EE", frame: "#0F363C" },
  classic:  { ink: "#23372C", accent: "#3E6350", soft: "#EDFAF2", frame: "#3E6350" },
  gold:     { ink: "#3B2F12", accent: "#A8842C", soft: "#FBF5E6", frame: "#A8842C" },
  medal:    { ink: "#1E2E48", accent: "#2E5597", soft: "#EEF3FB", frame: "#2E5597" },
  modern:   { ink: "#1F2A2E", accent: "#0F8C8C", soft: "#E8F6F6", frame: "#0F8C8C" },
  ornate:   { ink: "#3A1E2A", accent: "#8C3B5A", soft: "#F8EEF2", frame: "#8C3B5A" },
};

/* شريط مربعات بأسلوب هوية اليوم الوطني — ألوان ثابتة الترتيب ليبقى متطابقًا في كل طباعة */
function PixelStrip({ cols = 4, rows = 44, size = 4.8 }) {
  const DARK = "#08191D", TEAL = "#0F363C", GREEN = "#0E8C4E";
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 1) continue;                 // رقعة شطرنج كالشعار
      const fill = c % 2 === 0 && r % 4 < 2 ? GREEN : (r + c * 3) % 5 === 0 ? GREEN : TEAL;
      cells.push(<rect key={`${r}-${c}`} x={c * size} y={r * size} width={size} height={size} fill={fill} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${cols * size} ${rows * size}`} preserveAspectRatio="xMidYMid slice"
         style={{ width: "100%", height: "100%", display: "block", ...INK }}>
      <rect width="100%" height="100%" fill={DARK} />
      {cells}
    </svg>
  );
}

/* توقيع واحد: الصفة، ثم صورة التوقيع، ثم الاسم تحت خط رفيع — كقالب النماذج */
function Sign({ url, name, role }) {
  return (
    <div className="text-center" style={{ minWidth: "58mm" }}>
      <p style={{ fontSize: "10pt", color: "#6B7A72" }}>{role}</p>
      <div className="flex items-center justify-center" style={{ height: "16mm" }}>
        {url && <img src={url} alt="" style={{ maxHeight: "16mm", maxWidth: "50mm", objectFit: "contain" }} />}
      </div>
      <div className="mx-auto" style={{ height: "0.25mm", width: "45mm", background: "#DDE5E0" }} />
      <p style={{ marginTop: "1.2mm", fontSize: "11pt", fontWeight: 600 }}>{name || "…"}</p>
    </div>
  );
}

const Rule = ({ color }) => (
  <div style={{ height: "0.3mm", width: "100%", ...INK,
                background: `linear-gradient(90deg,transparent,${color}22 12%,${color} 50%,${color}22 88%,transparent)` }} />
);

export default function EventCertificate({ event, participant, sigUrl, stampUrl, principalUrl, principalName, serial }) {
  const tpl = THEMES[event?.cert_template] ? event.cert_template : "classic";
  const th = THEMES[tpl];
  const national = tpl === "national";
  const date = event?.event_date ? `${event.event_date}T12:00:00` : null;

  const vals = {
    "الطالب": participant?.student_name ?? "",
    "الصف": participant?.class_label ?? "",
    "الحدث": event?.title ?? "",
    "المكان": event?.venue ?? "",
    "التاريخ": date ? (
      <>
        <BidiDate value={fmtHijri(date, false)} suffix="هـ" /> الموافق{" "}
        <BidiDate value={fmtGreg(date)} suffix="م" />
      </>
    ) : "",
    "الذكرى": String(nationalDayNo(event?.event_date)),
  };
  const { intro, hasName, body, closing } =
    splitText(defaultCertText(event));   // الصيغة الرسمية دائمًا — يُتجاهل أي نص محفوظ قديم
  const title = event?.cert_title?.trim() || DEFAULT_CERT_TITLE;

  return (
    <div className="sheet relative overflow-hidden bg-white"
         style={{ width: "297mm", height: "210mm", fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                  color: "#1F2A24", breakAfter: "page", ...INK }}>
      {/* الإطار */}
      {national ? (
        <>
          <div className="absolute inset-y-0 right-0" style={{ width: "16mm" }}><PixelStrip /></div>
          <div className="absolute inset-y-0 left-0" style={{ width: "16mm", transform: "scaleX(-1)" }}><PixelStrip /></div>
          <div className="absolute" style={{ inset: "8mm 22mm", border: `0.4mm solid ${th.frame}33`, borderRadius: "2mm" }} />
        </>
      ) : (
        <div className="absolute" style={{ inset: "8mm", border: `0.4mm solid ${th.frame}40`, borderRadius: "2mm" }} />
      )}

      <div className="absolute flex flex-col" style={{ inset: national ? "13mm 29mm 11mm" : "14mm 17mm 11mm" }}>
        {/* الترويسة */}
        <div className="flex items-start justify-between">
          <div style={{ fontSize: "9.5pt", lineHeight: 1.8, fontWeight: 500 }}>
            <div>المملكة العربية السعودية</div>
            <div>وزارة التعليم</div>
            <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
            <div style={{ color: th.accent, fontWeight: 600 }}>مدرسة مكة الثانوية</div>
          </div>
          {national && (
            <div className="text-center">
              <img src={slogan} alt="عزّنا بطبعنا" style={{ height: "20mm", width: "auto", display: "block" }} />
              <div style={{ fontSize: "12pt", fontWeight: 700, color: th.accent, marginTop: "1.2mm", lineHeight: 1.2 }}>
                اليوم الوطني السعودي <span className="num">{vals["الذكرى"]}</span>
              </div>
            </div>
          )}
          <div className="flex items-center" style={{ gap: "4mm" }}>
            <img src={logoIcon} alt="" style={{ height: "11mm", width: "auto" }} />
            <img src={moeLogo} alt="" style={{ height: "11mm", width: "auto" }} />
          </div>
        </div>
        <div style={{ marginTop: "3mm" }}><Rule color={th.accent} /></div>

        {/* المتن */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div style={{ fontSize: "30pt", fontWeight: 700, color: th.accent, lineHeight: 1.2 }}>{title}</div>
          <div className="flex items-center" style={{ gap: "2mm", marginTop: "3mm" }}>
            <div style={{ width: "22mm", height: "0.3mm", background: `${th.accent}55` }} />
            <div style={{ width: "1.6mm", height: "1.6mm", transform: "rotate(45deg)", background: th.accent }} />
            <div style={{ width: "22mm", height: "0.3mm", background: `${th.accent}55` }} />
          </div>

          {intro && <p style={{ marginTop: "6mm", fontSize: "12.5pt", color: "#4A5A52" }}>{fill(intro, vals)}</p>}
          {hasName && (
            <p style={{ marginTop: "3mm", fontSize: "26pt", fontWeight: 700, lineHeight: 1.3 }}>{vals["الطالب"]}</p>
          )}
          {body && (
            <p style={{ marginTop: "4mm", fontSize: "13pt", lineHeight: 1.95, maxWidth: "205mm" }}>{fill(body, vals)}</p>
          )}
          {closing.map((l, i) => (
            <p key={i} style={{ marginTop: i ? "1mm" : "5mm", fontSize: "12pt", color: th.accent, fontWeight: 500 }}>
              {fill(l, vals)}
            </p>
          ))}
        </div>

        {/* التواقيع: المنظّم يمينًا، والختم وسطًا، والمدير يسارًا */}
        <div className="grid items-end" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "6mm" }}>
          <div className="justify-self-start">
            <Sign url={sigUrl} name={event?.organizer_name} role={event?.organizer_role || "منفّذ البرنامج"} />
          </div>
          <div className="justify-self-center" style={{ minHeight: "22mm" }}>
            {stampUrl && <img src={stampUrl} alt="" style={{ height: "22mm", width: "auto", opacity: 0.9 }} />}
          </div>
          <div className="justify-self-end">
            <Sign url={principalUrl} name={principalName} role="مدير المدرسة" />
          </div>
        </div>

        {/* التذييل */}
        <div style={{ marginTop: "4mm" }}><Rule color={th.accent} /></div>
        <div className="flex items-center justify-between" style={{ marginTop: "2mm", fontSize: "8.5pt", color: "#8A968F" }}>
          <span>بوابة مكة الثانوية الرقمية</span>
          {serial && <span>رقم الشهادة: <bdi dir="ltr" className="num">{serial}</bdi></span>}
          <span dir="ltr" style={{ fontWeight: 600, color: th.accent }}>makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}
