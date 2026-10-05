// src/components/GuestCertificate.jsx
import moeLogo from "../assets/moe-logo.png";
import logoIcon from "../assets/icon-mint.png";

/* =====================================================================
   شهادة شكر الضيوف والمتعاونين — للمحاضرين والمدربين ومنفّذي الأحداث
   الذين يفدون إلى المدرسة بمهام محددة.

   تصميم مستقل عن بقية الشهادات: لا إطار محيط، بل شريط جانبي بنقش النجمة
   الثمانية بخطوط رفيعة، يحمل شعار المدرسة في وسام و«شكر وتقدير» وصفة الضيف،
   والمتن على يساره مُحاذى لبداية السطر لا موسّطًا، وبطاقة للبرنامج وتاريخه.

   تُستعمل في النماذج (قالب guest_appreciation) وفي مرحلة الشهادات بالحدث.
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

const C = {
  deep: "#23372C",
  green: "#3E6350",
  gold: "#B8912F",
  goldSoft: "#EADFBF",
  mint: "#CCF2DB",
  soft: "#EDFAF2",
  muted: "#5E6E66",
  faint: "#8A968F",
};

/** صفات الضيوف الجاهزة — تظهر بطاقات في النماذج والحدث */
export const GUEST_ROLES = ["محاضر ضيف", "مدرب", "منفّذ فعالية", "متحدث", "مقدّم ورشة عمل", "شريك مجتمعي"];

/** «لـ» قبل المهمة: «لتقديم…»، ومع «ال»: «للإشراف…» */
export const forTask = (task) => {
  const t = String(task ?? "").trim();
  if (!t) return "لإسهامه المتميّز";
  return t.startsWith("ال") ? `لل${t.slice(2)}` : `ل${t}`;
};

/* نقش النجمة الثمانية: مربعان متراكبان بخط رفيع، يتكرران */
function StarLattice({ id, color = C.green, opacity = 0.16 }) {
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block", ...INK }}>
      <defs>
        <pattern id={id} width="14mm" height="14mm" patternUnits="userSpaceOnUse" viewBox="0 0 20 20">
          <g fill="none" stroke={color} strokeWidth="0.45" opacity={opacity}>
            <rect x="5" y="5" width="10" height="10" />
            <rect x="5" y="5" width="10" height="10" transform="rotate(45 10 10)" />
            <circle cx="10" cy="10" r="1.6" />
            <path d="M0 0 L3 3 M20 0 L17 3 M0 20 L3 17 M20 20 L17 17" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* نجمة ثمانية كبيرة باهتة خلف المتن */
function BigStar({ size = "118mm" }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size, display: "block", ...INK }}>
      <g fill="none" stroke={C.gold} strokeWidth="0.35" opacity="0.22">
        <rect x="18" y="18" width="64" height="64" />
        <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
        <rect x="28" y="28" width="44" height="44" />
        <rect x="28" y="28" width="44" height="44" transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r="12" />
      </g>
    </svg>
  );
}

/* وسام الشعار: حلقة ذهبية وحلقة نعناعية وشعار المدرسة */
function Seal() {
  return (
    <div style={{ position: "relative", width: "30mm", height: "30mm", ...INK }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `0.5mm solid ${C.gold}`, background: "#fff" }} />
      <div style={{ position: "absolute", inset: "1.8mm", borderRadius: "50%", border: `0.25mm dashed ${C.gold}` }} />
      <div style={{ position: "absolute", inset: "3.6mm", borderRadius: "50%", border: `0.3mm solid ${C.mint}` }} />
      <img src={logoIcon} alt="" style={{ position: "absolute", inset: 0, margin: "auto", height: "14mm", width: "auto" }} />
    </div>
  );
}

function Sign({ url, name, role }) {
  return (
    <div style={{ textAlign: "center", minWidth: "52mm" }}>
      <p style={{ fontSize: "9.5pt", color: C.faint }}>{role}</p>
      <div style={{ height: "15mm", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {url && <img src={url} alt="" style={{ maxHeight: "15mm", maxWidth: "46mm", objectFit: "contain" }} />}
      </div>
      <div style={{ height: "0.25mm", width: "42mm", margin: "0 auto", background: "#DDE5E0" }} />
      <p style={{ marginTop: "1.2mm", fontSize: "10.5pt", fontWeight: 600, color: C.deep }}>{name || "…"}</p>
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
  issuer, principal, stampUrl, patternId = "gc-lattice",
}) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#fff",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif", color: C.deep, ...INK }}>
      {/* الشريط الجانبي (يمين الورقة) */}
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "80mm",
                    background: `linear-gradient(180deg, ${C.soft} 0%, #F6FCF8 60%, #FFFFFF 100%)`, ...INK }}>
        <StarLattice id={patternId} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "0.6mm", background: C.gold, ...INK }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "1.6mm", width: "0.25mm", background: C.green, opacity: 0.5, ...INK }} />

        <div style={{ position: "absolute", inset: "16mm 10mm 14mm", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "space-between", textAlign: "center" }}>
          <Seal />

          <div>
            <div style={{ fontSize: "46pt", fontWeight: 700, lineHeight: 1, color: C.green }}>شكر</div>
            <div style={{ fontSize: "23pt", fontWeight: 600, lineHeight: 1.3, color: C.gold, marginTop: "1mm" }}>وتقدير</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.6mm", marginTop: "4mm" }}>
              <span style={{ width: "12mm", height: "0.3mm", background: `${C.gold}88` }} />
              <span style={{ width: "1.8mm", height: "1.8mm", transform: "rotate(45deg)", border: `0.3mm solid ${C.gold}` }} />
              <span style={{ width: "12mm", height: "0.3mm", background: `${C.gold}88` }} />
            </div>
          </div>

          <div>
            {role && (
              <div style={{ display: "inline-block", padding: "1.6mm 5mm", borderRadius: "10mm",
                            border: `0.35mm solid ${C.green}`, background: "#fff",
                            fontSize: "11.5pt", fontWeight: 600, color: C.green }}>
                {role}
              </div>
            )}
            {serial && (
              <p style={{ marginTop: "5mm", fontSize: "8.5pt", color: C.faint }}>
                رقم الشهادة <bdi dir="ltr" className="num">{serial}</bdi>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* نجمة كبيرة باهتة خلف المتن */}
      <div style={{ position: "absolute", left: "-46mm", top: "-40mm" }}><BigStar /></div>

      {/* المتن */}
      <div style={{ position: "absolute", top: "13mm", bottom: "10mm", left: "16mm", right: "94mm",
                    display: "flex", flexDirection: "column" }}>
        {/* الترويسة */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ fontSize: "9pt", lineHeight: 1.75, fontWeight: 500, color: C.muted }}>
            <div>المملكة العربية السعودية</div>
            <div>وزارة التعليم</div>
            <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
            <div style={{ color: C.green, fontWeight: 700 }}>مدرسة مكة الثانوية</div>
          </div>
          <img src={moeLogo} alt="وزارة التعليم" style={{ height: "12mm", width: "auto" }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontSize: "12.5pt", color: C.muted }}>
            تتقدّم مدرسة مكة الثانوية بخالص الشكر وعظيم الامتنان إلى
          </p>
          <p style={{ marginTop: "3mm", fontSize: "29pt", fontWeight: 700, lineHeight: 1.25, color: C.deep }}>
            {name || "…"}
          </p>
          <div style={{ marginTop: "2.5mm", display: "flex", alignItems: "center", gap: "1.5mm" }}>
            <span style={{ width: "30mm", height: "0.7mm", background: C.gold, ...INK }} />
            <span style={{ width: "6mm", height: "0.7mm", background: C.green, ...INK }} />
          </div>
          {entity && (
            <p style={{ marginTop: "3mm", fontSize: "12pt", fontWeight: 500, color: C.green }}>{entity}</p>
          )}

          {text && (
            <p style={{ marginTop: "5mm", maxWidth: "175mm", fontSize: "13pt", lineHeight: 2, whiteSpace: "pre-line" }}>
              {text}
            </p>
          )}

          {(activity || dateText) && (
            <div style={{ marginTop: "5mm", display: "flex", alignSelf: "flex-start", maxWidth: "175mm",
                          borderRight: `1mm solid ${C.gold}`, background: "#FBF8EF", ...INK }}>
              {activity && (
                <div style={{ padding: "2.2mm 5mm" }}>
                  <div style={{ fontSize: "8.5pt", color: C.faint }}>البرنامج</div>
                  <div style={{ fontSize: "11.5pt", fontWeight: 600 }}>{activity}</div>
                </div>
              )}
              {dateText && (
                <div style={{ padding: "2.2mm 5mm", borderRight: activity ? `0.25mm solid ${C.goldSoft}` : "none" }}>
                  <div style={{ fontSize: "8.5pt", color: C.faint }}>التاريخ</div>
                  <div className="num" style={{ fontSize: "11.5pt", fontWeight: 600, whiteSpace: "nowrap" }}>{dateText}</div>
                </div>
              )}
            </div>
          )}

          <p style={{ marginTop: "5mm", fontSize: "12.5pt", fontWeight: 600, color: C.gold }}>
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

        <div style={{ marginTop: "3mm", display: "flex", justifyContent: "space-between", fontSize: "8pt", color: C.faint }}>
          <span>بوابة مكة الثانوية الرقمية</span>
          <span dir="ltr" style={{ fontWeight: 600, color: C.green }}>makkahsec.com</span>
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
