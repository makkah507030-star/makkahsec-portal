// src/components/GuestCertificate.jsx
import moeLogo from "../assets/moe-logo.png";
import iconWhite from "../assets/icon-white.png";

/* =====================================================================
   شهادة شكر الضيوف والمتعاونين — للمحاضرين والمدربين ومنفّذي الأحداث
   الذين يفدون إلى المدرسة بمهام محددة.

   ورقة A4 عمودية — تتميّز عن بقية الشهادات الأفقية، وتوافق حاملها العمودي.
   بروح هوية البوابة: شريط علوي بأخضر الهوية الداكن وخطوطه القطرية، فيه
   تكوين هندسي من طبقات شعار البوابة بخطوط نعناعية، ومقابله شعار البوابة
   و«شكر وتقدير» ورقم الشهادة. والمتن على ورقة فاتحة
   بتوهّج نعناعي، وبطاقة بيانات بأيقونات، وشريط التقدّم أسفلها.

   تُستعمل في النماذج (قالب guest_appreciation) وفي مرحلة الشهادات بالحدث.
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

const C = {
  ink: "#1C3328",
  deep: "#3E6350",
  accent: "#3E8A62",
  mint: "#89D7AD",
  light: "#CCF2DB",
  tint: "#EDFAF2",
  card: "#D5E7DC",
  div: "#E1EEE6",
  text2: "#5E7268",
  onMint: "#16301F",
};

/** «لـ» قبل المهمة: «لتقديم…»، ومع «ال»: «للإشراف…» */
export const forTask = (task) => {
  const t = String(task ?? "").trim();
  if (!t) return "لإسهامه المتميّز";
  return t.startsWith("ال") ? `لل${t.slice(2)}` : `ل${t}`;
};

const P = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8,
            strokeLinecap: "round", strokeLinejoin: "round", style: { width: "5mm", height: "5mm" } };
const ICON = {
  program:  <svg {...P}><rect x="3" y="3.5" width="18" height="11.5" rx="1.5"/><path d="M7 11l3-3 2.5 2 4-4M12 15v3M8 21l4-3 4 3"/></svg>,
  calendar: <svg {...P}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
};

/* مكعب الشعار المائل — كما في خلفيات الاستوديو */
const cube = (extra) => ({
  position: "absolute", width: "105mm", height: "105mm", borderRadius: "18mm",
  transform: "rotate(32deg) skewX(-14deg)", ...extra,
});

function Sign({ url, name, role }) {
  return (
    <div style={{ textAlign: "center", minWidth: "50mm" }}>
      <p style={{ fontSize: "9.5pt", color: C.text2 }}>{role}</p>
      <div style={{ height: "15mm", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {url && <img src={url} alt="" style={{ maxHeight: "15mm", maxWidth: "46mm", objectFit: "contain" }} />}
      </div>
      <div style={{ height: "0.25mm", width: "42mm", margin: "0 auto", background: C.card }} />
      <p style={{ marginTop: "1.2mm", fontSize: "10.5pt", fontWeight: 600, color: C.ink }}>{name || "…"}</p>
    </div>
  );
}

const DARK = "radial-gradient(ellipse 70% 90% at 100% 0%, #2f5240 0%, transparent 60%), linear-gradient(160deg, #284836 0%, #193326 42%, #12261c 72%, #0e1f17 100%)";
const LINES = { position: "absolute", inset: 0, ...INK,
  background: "repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 0.4mm, transparent 0.4mm 6mm)" };

function Serial({ serial }) {
  if (!serial) return null;
  return (
    <div style={{ border: "0.35mm dashed rgba(255,255,255,.3)", borderRadius: "2.5mm",
                  padding: "1.2mm 3.5mm", fontSize: "8.5pt", color: "#A9BCB1", whiteSpace: "nowrap" }}>
      رقم الشهادة{" "}
      <bdi dir="ltr" className="num" style={{ color: C.mint, fontWeight: 700, letterSpacing: "0.2mm" }}>{serial}</bdi>
    </div>
  );
}

function Brand({ size = 11 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
      <img src={iconWhite} alt="" style={{ width: `${size}mm`, height: `${size}mm`, objectFit: "contain" }} />
      <div style={{ lineHeight: 1.35 }}>
        <div style={{ fontSize: "10.5pt", fontWeight: 700, color: "#fff" }}>بوابة مكة الثانوية الرقمية</div>
        <div style={{ fontSize: "8.5pt", color: "#A9BCB1" }}>مدرسة مكة الثانوية</div>
      </div>
    </div>
  );
}

/* طبقات الشعار: معيّن مملوء وشيفرونان — بخطوط متدرجة */
function LogoLayers({ size = "86mm" }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size, display: "block", ...INK }}>
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <polygon points="50,14 90,34 50,54 10,34" stroke={C.mint} strokeWidth="1.1" fill="rgba(137,215,173,.10)" />
        <polyline points="10,48 50,68 90,48" stroke={C.mint} strokeWidth="1.1" opacity=".7" />
        <polyline points="10,62 50,82 90,62" stroke={C.mint} strokeWidth="1.1" opacity=".4" />
        <polygon points="50,22 74,34 50,46 26,34" stroke="rgba(255,255,255,.35)" strokeWidth=".5" />
      </g>
    </svg>
  );
}

/* الشريط العلوي: تكوين هندسي من طبقات شعار البوابة بخطوط نعناعية، والعنوان مقابله */
function TopBand({ serial }) {
  return (
    <div style={{ position: "absolute", top: "8mm", left: "8mm", right: "8mm", height: "96mm",
                  borderRadius: "5mm", overflow: "hidden", background: DARK, ...INK }}>
      <div style={LINES} />
      <div style={{ position: "absolute", left: "4mm", top: "6mm" }}><LogoLayers /></div>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "92mm", width: "0.3mm",
                    background: "linear-gradient(180deg, transparent, rgba(137,215,173,.5) 30%, rgba(137,215,173,.5) 70%, transparent)", ...INK }} />
      <div style={{ position: "absolute", top: "10mm", bottom: "9mm", right: "11mm", width: "92mm",
                    display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <Brand />
        <div>
          <div style={{ fontSize: "10pt", fontWeight: 600, color: "#A9BCB1", letterSpacing: "0.4mm" }}>شهادة</div>
          <div style={{ marginTop: "1mm", fontSize: "42pt", fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap" }}>
            <span style={{ color: C.mint }}>شكر</span> <span style={{ color: "#fff" }}>وتقدير</span>
          </div>
        </div>
        <div style={{ alignSelf: "flex-start" }}><Serial serial={serial} /></div>
      </div>
    </div>
  );
}

/**
 * متن الشهادة — يملأ الورقة التي يوضع فيها: A4 عمودية (210×297 مم).
 * name: اسم الضيف · entity: جهته · text: نص الشكر
 * activity: البرنامج أو الحدث · dateText: تاريخه · closing: الخاتمة
 * issuer: {url,name,role} يمينًا · principal: {url,name} يسارًا · stampUrl وسطًا
 */
export function GuestCertificateBody({
  name, entity, text, activity, dateText, closing, serial,
  issuer, principal, stampUrl,
}) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#fff",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif", color: C.ink, ...INK }}>
      {/* الورقة الفاتحة داخل هامش آمن ٨ مم: توهّج نعناعي وخطوط قطرية خفيفة */}
      <div style={{ position: "absolute", inset: "8mm", borderRadius: "5mm", overflow: "hidden", ...INK,
                    background: "radial-gradient(ellipse 80% 45% at 0% 100%, #DDF3E6 0%, transparent 60%), linear-gradient(170deg, #FFFFFF 0%, #FAFDFB 55%, #F2FAF5 100%)" }}>
        <div style={{ position: "absolute", inset: 0, ...INK,
                      background: "repeating-linear-gradient(135deg, rgba(62,99,80,.035) 0 0.4mm, transparent 0.4mm 6mm)" }} />
        <div style={cube({ left: "-70mm", bottom: "-40mm", background: "rgba(62,99,80,.06)" })} />
        <div style={cube({ left: "-55mm", bottom: "-80mm", background: "rgba(62,99,80,.045)" })} />
        {/* شريط التقدّم أسفل الورقة */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "1.6mm", background: "rgba(137,215,173,.3)", ...INK }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, left: "22%", background: C.mint, ...INK }} />
        </div>
      </div>

      <TopBand serial={serial} />

      {/* المتن */}
      <div style={{ position: "absolute", top: "112mm", bottom: "13mm", left: "19mm", right: "19mm",
                    display: "flex", flexDirection: "column" }}>
        {/* الترويسة الحكومية */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ fontSize: "8.5pt", lineHeight: 1.7, fontWeight: 500, color: C.text2 }}>
            <div>المملكة العربية السعودية · وزارة التعليم</div>
            <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
            <div style={{ color: C.deep, fontWeight: 700 }}>مدرسة مكة الثانوية</div>
          </div>
          <img src={moeLogo} alt="وزارة التعليم" style={{ height: "11mm", width: "auto" }} />
        </div>
        <div style={{ marginTop: "3mm", height: "0.35mm", ...INK,
                      background: `linear-gradient(90deg, transparent, ${C.deep}22 12%, ${C.deep} 50%, ${C.deep}22 88%, transparent)` }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontSize: "12pt", color: C.text2 }}>
            تتقدّم مدرسة مكة الثانوية بخالص الشكر وعظيم الامتنان إلى
          </p>
          <p style={{ marginTop: "2.5mm", fontSize: "25pt", fontWeight: 700, lineHeight: 1.3, color: C.ink }}>
            {name || "…"}
          </p>
          {entity && (
            <p style={{ marginTop: "1mm", fontSize: "12pt", fontWeight: 600, color: C.accent }}>{entity}</p>
          )}

          {text && (
            <p style={{ marginTop: "4.5mm", fontSize: "12.5pt", lineHeight: 2, whiteSpace: "pre-line" }}>
              {text}
            </p>
          )}

          {(activity || dateText) && (
            <div style={{ marginTop: "4.5mm", alignSelf: "stretch", display: "flex",
                          border: `0.35mm solid ${C.card}`, background: "rgba(255,255,255,.85)", borderRadius: "4mm",
                          overflow: "hidden", ...INK }}>
              {[activity && ["program", "البرنامج", activity], dateText && ["calendar", "التاريخ", dateText]]
                .filter(Boolean).map(([ic, k, val], i) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: "2.8mm", padding: "2.4mm 4mm",
                                        flex: ic === "program" ? 1 : "0 0 auto", minWidth: 0,
                                        borderRight: i ? `0.3mm solid ${C.div}` : "none" }}>
                    <span style={{ width: "9mm", height: "9mm", borderRadius: "2.5mm", background: C.mint, color: C.onMint,
                                   display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...INK }}>
                      {ICON[ic]}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "8.5pt", color: C.text2 }}>{k}</span>
                      <span className={ic === "calendar" ? "num" : undefined}
                            style={{ display: "block", fontSize: "11pt", fontWeight: 700,
                                     whiteSpace: ic === "calendar" ? "nowrap" : "normal" }}>{val}</span>
                    </span>
                  </div>
                ))}
            </div>
          )}

          <p style={{ marginTop: "4.5mm", fontSize: "12pt", fontWeight: 600, color: C.deep }}>
            {closing || "سائلين الله له دوام التوفيق والسداد"}
          </p>
        </div>

        {/* التواقيع: المُصدِر يمينًا، والختم وسطًا، والمدير يسارًا */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: "2mm" }}>
          <div style={{ justifySelf: "start" }}>
            {issuer && <Sign url={issuer.url} name={issuer.name} role={issuer.role || "منفّذ البرنامج"} />}
          </div>
          <div style={{ justifySelf: "center", minHeight: "20mm" }}>
            {stampUrl && <img src={stampUrl} alt="" style={{ height: "20mm", width: "auto", opacity: 0.9 }} />}
          </div>
          <div style={{ justifySelf: "end" }}>
            {principal && <Sign url={principal.url} name={principal.name} role="مدير المدرسة" />}
          </div>
        </div>

        <div style={{ marginTop: "3mm", display: "flex", justifyContent: "center", fontSize: "9pt" }}>
          <span dir="ltr" style={{ fontWeight: 700, color: C.accent }}>makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

/** ورقة كاملة A4 عمودية — للطباعة المتتابعة في الحدث */
export default function GuestCertificate(props) {
  return (
    <div className="sheet relative bg-white"
         style={{ width: "210mm", height: "297mm", breakAfter: "page", ...INK }}>
      <GuestCertificateBody {...props} />
    </div>
  );
}
