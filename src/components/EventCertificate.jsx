// src/components/EventCertificate.jsx
import moeLogo from "../assets/moe-logo.png";
import logoIcon from "../assets/icon-mint.png";
import slogan from "../assets/national-day-slogan.webp";
import { fmtGreg, fmtHijri } from "../lib/dates";

/* =====================================================================
   شهادة الحدث — ورقة A4 أفقية، شهادة لكل طالب.
   • قالب «اليوم الوطني» بهوية «عزّنا بطبعنا»: الأخضر الداكن وإطار المربعات.
   • بقية القوالب بتصميم رسمي موحّد بألوان البوابة.
   • نص الشهادة قابل للتعديل لكل حدث، بمتغيرات تُستبدل عند الطباعة.
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

export const CERT_VARS = [
  { k: "الطالب", d: "اسم الطالب" },
  { k: "الصف", d: "الصف والفصل" },
  { k: "الحدث", d: "عنوان الحدث" },
  { k: "المكان", d: "مكان التنفيذ" },
  { k: "التاريخ", d: "تاريخ الحدث هجريًا وميلاديًا" },
  { k: "الذكرى", d: "رقم ذكرى اليوم الوطني" },
];

export const defaultCertText = (e) =>
  isNationalDay(e)
    ? "تشهد إدارة مدرسة مكة الثانوية بأن الطالب/ {الطالب} من {الصف} قد شارك في «{الحدث}» " +
      "المُقام بتاريخ {التاريخ}، احتفاءً بذكرى اليوم الوطني {الذكرى} للمملكة العربية السعودية، " +
      "تعبيرًا عن اعتزازه بوطنه وانتمائه إليه. سائلين الله أن يديم على وطننا عزّه وأمنه ورخاءه."
    : "تشهد إدارة مدرسة مكة الثانوية بأن الطالب/ {الطالب} من {الصف} قد شارك في «{الحدث}» " +
      "المُقام بتاريخ {التاريخ}، متمنّين له دوام التميّز والتوفيق.";

export const DEFAULT_CERT_TITLE = "شهادة مشاركة";

/** استبدال المتغيرات بقيمها — يُرجع أجزاءً ليُبرز اسم الطالب */
function fillParts(text, vals) {
  return String(text ?? "").split(/(\{[^{}]+\})/g).filter(Boolean).map((seg, i) => {
    const m = seg.match(/^\{([^{}]+)\}$/);
    if (!m || !(m[1] in vals)) return <span key={i}>{seg}</span>;
    return m[1] === "الطالب"
      ? <b key={i} style={{ fontWeight: 700 }}>{vals[m[1]]}</b>
      : <span key={i}>{vals[m[1]]}</span>;
  });
}

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

const THEMES = {
  national: { ink: "#0B3B2E", accent: "#127A4A", soft: "#E9F5EE", frame: "#0B3B2E" },
  classic:  { ink: "#23372C", accent: "#3E6350", soft: "#EDFAF2", frame: "#3E6350" },
  gold:     { ink: "#3B2F12", accent: "#A8842C", soft: "#FBF5E6", frame: "#A8842C" },
  medal:    { ink: "#1E2E48", accent: "#2E5597", soft: "#EEF3FB", frame: "#2E5597" },
  modern:   { ink: "#1F2A2E", accent: "#0F8C8C", soft: "#E8F6F6", frame: "#0F8C8C" },
  ornate:   { ink: "#3A1E2A", accent: "#8C3B5A", soft: "#F8EEF2", frame: "#8C3B5A" },
};

/* شريط مربعات بأسلوب هوية اليوم الوطني — ألوان ثابتة الترتيب ليبقى متطابقًا في كل طباعة */
function PixelStrip({ cols = 4, rows = 44, size = 4.8 }) {
  const shades = ["#0B3B2E", "#127A4A", "#1F9B5E", "#0E5A3A", "#3DBB76", "#0B3B2E"];
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = (r * 7 + c * 13 + ((r * c) % 5)) % shades.length;
      if ((r + c) % 2 === 0 || v % 3 === 0) {
        cells.push(<rect key={`${r}-${c}`} x={c * size} y={r * size} width={size} height={size} fill={shades[v]} />);
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${cols * size} ${rows * size}`} preserveAspectRatio="none"
         style={{ width: "100%", height: "100%", display: "block", ...INK }}>
      <rect width="100%" height="100%" fill="#0B3B2E" />
      {cells}
    </svg>
  );
}

export default function EventCertificate({ event, participant, sigUrl, serial }) {
  const tpl = THEMES[event?.cert_template] ? event.cert_template : "classic";
  const th = THEMES[tpl];
  const national = tpl === "national";
  const date = event?.event_date ? `${event.event_date}T12:00:00` : null;

  const vals = {
    "الطالب": participant?.student_name ?? "",
    "الصف": participant?.class_label ?? "",
    "الحدث": event?.title ?? "",
    "المكان": event?.venue ?? "",
    "التاريخ": date ? `${fmtHijri(date)} الموافق ${fmtGreg(date)}م` : "",
    "الذكرى": String(nationalDayNo(event?.event_date)),
  };
  const text = event?.cert_text?.trim() ? event.cert_text : defaultCertText(event);
  const title = event?.cert_title?.trim() || DEFAULT_CERT_TITLE;

  return (
    <div className="sheet relative overflow-hidden bg-white"
         style={{ width: "297mm", height: "210mm", fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                  color: th.ink, breakAfter: "page", ...INK }}>
      {/* الإطار */}
      {national ? (
        <>
          <div className="absolute inset-y-0 right-0" style={{ width: "19mm" }}><PixelStrip /></div>
          <div className="absolute inset-y-0 left-0" style={{ width: "19mm", transform: "scaleX(-1)" }}><PixelStrip /></div>
          <div className="absolute" style={{ inset: "8mm 25mm", border: `0.6mm solid ${th.frame}`, borderRadius: "2mm" }} />
        </>
      ) : (
        <>
          <div className="absolute" style={{ inset: "8mm", border: `1.4mm solid ${th.frame}`, borderRadius: "2mm" }} />
          <div className="absolute" style={{ inset: "11mm", border: `0.3mm solid ${th.frame}`, borderRadius: "1.5mm" }} />
        </>
      )}

      <div className="absolute flex flex-col" style={{ inset: national ? "13mm 31mm 12mm" : "16mm 20mm 14mm" }}>
        {/* الترويسة */}
        <div className="flex items-start justify-between">
          <div style={{ fontSize: "10.5pt", lineHeight: 1.75, fontWeight: 500 }}>
            <div>المملكة العربية السعودية</div>
            <div>وزارة التعليم</div>
            <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
            <div style={{ fontWeight: 700, color: th.accent }}>مدرسة مكة الثانوية</div>
          </div>
          {national && (
            <img src={slogan} alt="عزّنا بطبعنا" style={{ height: "21mm", width: "auto", borderRadius: "1mm" }} />
          )}
          <div className="flex items-center" style={{ gap: "5mm" }}>
            <img src={moeLogo} alt="" style={{ height: "15mm", width: "auto" }} />
            <img src={logoIcon} alt="" style={{ height: "15mm", width: "auto" }} />
          </div>
        </div>

        {/* العنوان */}
        <div className="text-center" style={{ marginTop: national ? "7mm" : "9mm" }}>
          <div style={{ fontSize: "32pt", fontWeight: 700, color: th.accent, lineHeight: 1.3 }}>{title}</div>
          {national && (
            <div style={{ fontSize: "12.5pt", fontWeight: 600, marginTop: "1mm" }}>
              اليوم الوطني السعودي <span className="num">{vals["الذكرى"]}</span>
            </div>
          )}
          <div className="mx-auto" style={{ marginTop: "3mm", width: "60mm", height: "0.8mm", background: th.accent, borderRadius: "1mm" }} />
        </div>

        {/* النص */}
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center" style={{ fontSize: "15.5pt", lineHeight: 2.05, maxWidth: "215mm", fontWeight: 500 }}>
            {fillParts(text, vals)}
          </p>
        </div>

        {/* التذييل: رقم الشهادة والتوقيع */}
        <div className="flex items-end justify-between" style={{ fontSize: "10.5pt" }}>
          <div style={{ lineHeight: 1.8 }}>
            {serial && <div>رقم الشهادة: <span className="num">{serial}</span></div>}
            <div>تاريخ الإصدار: <span className="num">{fmtHijri(new Date())}</span></div>
          </div>
          <div className="text-center" style={{ minWidth: "70mm" }}>
            <div style={{ fontWeight: 600 }}>{event?.organizer_role || "منفّذ البرنامج"}</div>
            <div style={{ height: "17mm" }} className="flex items-center justify-center">
              {sigUrl && <img src={sigUrl} alt="" style={{ maxHeight: "17mm", maxWidth: "55mm", objectFit: "contain" }} />}
            </div>
            <div style={{ fontWeight: 700 }}>{event?.organizer_name ?? ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
