// src/components/GuestCertificate.jsx
import moeLogo from "../assets/moe-logo.png";
import iconWhite from "../assets/icon-white.png";

/* =====================================================================
   شهادة شكر الضيوف والمتعاونين — للمحاضرين والمدربين ومنفّذي الأحداث
   الذين يفدون إلى المدرسة بمهام محددة.

   بروح هوية البوابة (كقوالب الاستوديو): لوح جانبي بأخضر الهوية الداكن،
   عليه الخطوط القطرية ومكعبات الشعار المائلة، وشعار البوابة الأبيض،
   و«شكر وتقدير» بالنعناعي، وصفة الضيف شارة نعناعية. والمتن على ورقة فاتحة
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

/** صفات الضيوف الجاهزة — تظهر بطاقات في النماذج والحدث */
export const GUEST_ROLES = ["محاضر ضيف", "مدرب", "منفّذ فعالية", "متحدث", "مقدّم ورشة عمل", "شريك مجتمعي"];

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

/**
 * متن الشهادة — يملأ الورقة التي يوضع فيها (297×210 مم).
 * name: اسم الضيف · role: صفته · entity: جهته · text: نص الشكر
 * activity: البرنامج أو الحدث · dateText: تاريخه · closing: الخاتمة
 * issuer: {url,name,role} يمينًا · principal: {url,name} يسارًا · stampUrl وسطًا
 */
export function GuestCertificateBody({
  name, role, entity, text, activity, dateText, closing, serial,
  issuer, principal, stampUrl,
}) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#fff",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif", color: C.ink, ...INK }}>
      {/* الورقة الفاتحة داخل هامش آمن ٨ مم: توهّج نعناعي وخطوط قطرية خفيفة */}
      <div style={{ position: "absolute", inset: "8mm", borderRadius: "5mm", overflow: "hidden", ...INK,
                    background: "radial-gradient(ellipse 70% 60% at 0% 100%, #DDF3E6 0%, transparent 60%), linear-gradient(160deg, #FFFFFF 0%, #FAFDFB 55%, #F2FAF5 100%)" }}>
        <div style={{ position: "absolute", inset: 0, ...INK,
                      background: "repeating-linear-gradient(135deg, rgba(62,99,80,.035) 0 0.4mm, transparent 0.4mm 6mm)" }} />
        <div style={cube({ left: "-62mm", bottom: "-48mm", background: "rgba(62,99,80,.06)" })} />
        <div style={cube({ left: "-50mm", bottom: "-84mm", background: "rgba(62,99,80,.045)" })} />
        {/* شريط التقدّم أسفل الورقة */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "1.6mm", background: "rgba(137,215,173,.3)", ...INK }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, left: "22%", background: C.mint, ...INK }} />
        </div>
      </div>

      {/* اللوح الجانبي الداكن (يمين الورقة) */}
      <div style={{ position: "absolute", top: "8mm", bottom: "8mm", right: "8mm", width: "76mm",
                    borderRadius: "5mm", overflow: "hidden", ...INK,
                    background: "radial-gradient(ellipse 90% 55% at 95% 0%, #2f5240 0%, transparent 60%), linear-gradient(160deg, #284836 0%, #193326 42%, #12261c 72%, #0e1f17 100%)" }}>
        <div style={{ position: "absolute", inset: 0, ...INK,
                      background: "repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 0.4mm, transparent 0.4mm 6mm)" }} />
        <div style={{ position: "absolute", width: "80mm", height: "80mm", borderRadius: "50%", left: "-20mm", top: "70mm",
                      background: "rgba(96,150,118,.35)", filter: "blur(18mm)" }} />
        <div style={cube({ left: "-58mm", bottom: "-58mm", background: "rgba(120,170,140,.14)" })} />
        <div style={cube({ left: "-48mm", bottom: "-92mm", background: "rgba(120,170,140,.1)" })} />

        <div style={{ position: "absolute", inset: "12mm 9mm 11mm", display: "flex", flexDirection: "column",
                      justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
            <img src={iconWhite} alt="" style={{ width: "11mm", height: "11mm", objectFit: "contain" }} />
            <div style={{ lineHeight: 1.35 }}>
              <div style={{ fontSize: "10pt", fontWeight: 700, color: "#fff" }}>بوابة مكة الثانوية الرقمية</div>
              <div style={{ fontSize: "8.5pt", color: "#A9BCB1" }}>مدرسة مكة الثانوية</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "54pt", fontWeight: 700, lineHeight: 0.95, color: C.mint }}>شكر</div>
            <div style={{ fontSize: "30pt", fontWeight: 700, lineHeight: 1.25, color: "#fff" }}>وتقدير</div>
            <div style={{ marginTop: "4mm", width: "34mm", height: "1.2mm", borderRadius: "1mm",
                          background: "rgba(137,215,173,.25)", position: "relative", ...INK }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "70%", borderRadius: "1mm", background: C.mint, ...INK }} />
            </div>
            {role && (
              <div style={{ marginTop: "7mm", display: "inline-block", padding: "1.8mm 5.5mm", borderRadius: "10mm",
                            background: C.mint, color: C.onMint, fontSize: "12.5pt", fontWeight: 700, ...INK }}>
                {role}
              </div>
            )}
          </div>

          <div>
            {serial && (
              <div style={{ display: "inline-block", border: "0.35mm dashed rgba(255,255,255,.3)", borderRadius: "2.5mm",
                            padding: "1.2mm 3.5mm", fontSize: "8.5pt", color: "#A9BCB1" }}>
                رقم الشهادة{" "}
                <bdi dir="ltr" className="num" style={{ color: C.mint, fontWeight: 700, letterSpacing: "0.2mm" }}>{serial}</bdi>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* المتن */}
      <div style={{ position: "absolute", top: "15mm", bottom: "13mm", left: "18mm", right: "96mm",
                    display: "flex", flexDirection: "column" }}>
        {/* الترويسة الحكومية */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ fontSize: "9pt", lineHeight: 1.75, fontWeight: 500, color: C.text2 }}>
            <div>المملكة العربية السعودية</div>
            <div>وزارة التعليم</div>
            <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
            <div style={{ color: C.deep, fontWeight: 700 }}>مدرسة مكة الثانوية</div>
          </div>
          <img src={moeLogo} alt="وزارة التعليم" style={{ height: "12mm", width: "auto" }} />
        </div>
        <div style={{ marginTop: "3mm", height: "0.35mm", ...INK,
                      background: `linear-gradient(90deg, transparent, ${C.deep}22 12%, ${C.deep} 50%, ${C.deep}22 88%, transparent)` }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontSize: "12.5pt", color: C.text2 }}>
            تتقدّم مدرسة مكة الثانوية بخالص الشكر وعظيم الامتنان إلى
          </p>
          <p style={{ marginTop: "2.5mm", fontSize: "29pt", fontWeight: 700, lineHeight: 1.25, color: C.ink }}>
            {name || "…"}
          </p>
          {entity && (
            <p style={{ marginTop: "1.5mm", fontSize: "12.5pt", fontWeight: 600, color: C.accent }}>{entity}</p>
          )}

          {text && (
            <p style={{ marginTop: "4.5mm", maxWidth: "172mm", fontSize: "13pt", lineHeight: 2, whiteSpace: "pre-line" }}>
              {text}
            </p>
          )}

          {(activity || dateText) && (
            <div style={{ marginTop: "4.5mm", alignSelf: "flex-start", display: "flex", maxWidth: "172mm",
                          border: `0.35mm solid ${C.card}`, background: "rgba(255,255,255,.85)", borderRadius: "4mm",
                          overflow: "hidden", ...INK }}>
              {[activity && ["program", "البرنامج", activity], dateText && ["calendar", "التاريخ", dateText]]
                .filter(Boolean).map(([ic, k, val], i) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: "2.8mm", padding: "2.4mm 4.5mm",
                                        borderRight: i ? `0.3mm solid ${C.div}` : "none" }}>
                    <span style={{ width: "9mm", height: "9mm", borderRadius: "2.5mm", background: C.mint, color: C.onMint,
                                   display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...INK }}>
                      {ICON[ic]}
                    </span>
                    <span>
                      <span style={{ display: "block", fontSize: "8.5pt", color: C.text2 }}>{k}</span>
                      <span className={ic === "calendar" ? "num" : undefined}
                            style={{ display: "block", fontSize: "11.5pt", fontWeight: 700, whiteSpace: "nowrap" }}>{val}</span>
                    </span>
                  </div>
                ))}
            </div>
          )}

          <p style={{ marginTop: "4.5mm", fontSize: "12.5pt", fontWeight: 600, color: C.deep }}>
            {closing || "سائلين الله له دوام التوفيق والسداد"}
          </p>
        </div>

        {/* التواقيع: المُصدِر يمينًا، والختم وسطًا، والمدير يسارًا */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: "4mm" }}>
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

        <div style={{ marginTop: "3mm", display: "flex", justifyContent: "flex-end", fontSize: "9pt" }}>
          <span dir="ltr" style={{ fontWeight: 700, color: C.accent }}>makkahsec.com</span>
        </div>
      </div>
    </div>
  );
}

/** ورقة كاملة A4 أفقية — للطباعة المتتابعة في الحدث */
export default function GuestCertificate(props) {
  return (
    <div className="sheet relative bg-white"
         style={{ width: "297mm", height: "210mm", breakAfter: "page", ...INK }}>
      <GuestCertificateBody {...props} />
    </div>
  );
}
