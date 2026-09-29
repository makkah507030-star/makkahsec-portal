// src/components/EventReportSheet.jsx
import moeLogo from "../assets/moe-logo.png";
import logoIcon from "../assets/icon-mint.png";
import { fmtGreg, fmtHijri } from "../lib/dates";
import BidiDate from "./BidiDate.jsx";

/* =====================================================================
   تقرير تنفيذ الحدث — ورقة A4 عمودية بهوية المدرسة.
   بيانات الحدث وأعداده تُملأ آليًا، ووصف التنفيذ والنتائج والتوصيات
   والصور يكتبها المنظّم، ثم قائمة الحاضرين والتواقيع.
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const ACCENT = "#3E6350";

const Rule = () => (
  <div style={{ height: "0.3mm", ...INK,
                background: `linear-gradient(90deg,transparent,${ACCENT}22 12%,${ACCENT} 50%,${ACCENT}22 88%,transparent)` }} />
);

function Heading({ children }) {
  return (
    <p style={{ fontSize: "11.5pt", fontWeight: 700, color: ACCENT, margin: "5mm 0 1.8mm", breakAfter: "avoid" }}>{children}</p>
  );
}

/** قسم قصير (عنوان ونص) لا يُقسم بين صفحتين، فلا يبقى عنوان وحده أسفل الصفحة */
function Section({ title, children }) {
  return (
    <div style={{ breakInside: "avoid" }}>
      <Heading>{title}</Heading>
      {children}
    </div>
  );
}

/** الترويسة — تتكرر أعلى كل صفحة مطبوعة */
function Letterhead() {
  return (
    <>
      <div className="flex items-start justify-between">
        <div style={{ fontSize: "9pt", lineHeight: 1.7, fontWeight: 500 }}>
          <div>المملكة العربية السعودية</div>
          <div>وزارة التعليم</div>
          <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
          <div style={{ color: ACCENT, fontWeight: 600 }}>مدرسة مكة الثانوية</div>
        </div>
        <div className="flex items-center" style={{ gap: "4mm" }}>
          <img src={logoIcon} alt="" style={{ height: "11mm", width: "auto" }} />
          <img src={moeLogo} alt="" style={{ height: "11mm", width: "auto" }} />
        </div>
      </div>
      <div style={{ margin: "2.5mm 0 4mm" }}><Rule /></div>
    </>
  );
}

/** التذييل — يتكرر أسفل كل صفحة مطبوعة */
function Footer() {
  return (
    <div style={{ paddingTop: "4mm" }}>
      <Rule />
      <div className="flex items-center justify-between" style={{ marginTop: "2mm", fontSize: "8.5pt", color: "#8A968F" }}>
        <span>بوابة مكة الثانوية الرقمية</span>
        <span>تاريخ التقرير: <BidiDate value={fmtHijri(new Date(), false)} suffix="هـ" /></span>
        <span dir="ltr" style={{ fontWeight: 600, color: ACCENT }}>makkahsec.com</span>
      </div>
    </div>
  );
}

function Sign({ url, name, role }) {
  return (
    <div className="text-center" style={{ minWidth: "55mm" }}>
      <p style={{ fontSize: "9.5pt", color: "#6B7A72" }}>{role}</p>
      <div className="flex items-center justify-center" style={{ height: "14mm" }}>
        {url && <img src={url} alt="" style={{ maxHeight: "14mm", maxWidth: "45mm", objectFit: "contain" }} />}
      </div>
      <div className="mx-auto" style={{ height: "0.25mm", width: "42mm", background: "#DDE5E0" }} />
      <p style={{ marginTop: "1mm", fontSize: "10.5pt", fontWeight: 600 }}>{name || "…"}</p>
    </div>
  );
}

/** 08:00 ← «8:00 ص» بترتيب صحيح داخل النص العربي */
function Time12({ t }) {
  const [h, m] = String(t).split(":").map(Number);
  return <BidiDate value={`${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} `} suffix={h < 12 ? "ص" : "م"} />;
}

export default function EventReportSheet({ event: e, stats, attended, photos, sigUrl, stampUrl, principalName, principalUrl }) {
  const date = e?.event_date ? `${e.event_date}T12:00:00` : null;
  const info = [
    ["رقم الحدث", <span className="num">{e.serial}</span>],
    ["التصنيف", e.category || "—"],
    ["التاريخ", date ? <><BidiDate value={fmtHijri(date, false)} suffix="هـ" /> الموافق <BidiDate value={fmtGreg(date)} suffix="م" /></> : "—"],
    ["الوقت", e.start_time
      ? <>من <Time12 t={e.start_time} />{e.end_time && <> إلى <Time12 t={e.end_time} /></>}</>
      : "—"],
    ["المكان", e.venue || "—"],
    ["المنظّم", `${e.organizer_name ?? ""}${e.organizer_role ? ` — ${e.organizer_role}` : ""}`],
  ];
  const cell = { border: "0.25mm solid #DDE5E0", padding: "1.6mm 2.5mm" };
  const para = { fontSize: "10.5pt", lineHeight: 1.9, whiteSpace: "pre-line" };

  const has = (v) => typeof v === "string" && v.trim() !== "";

  /* الترويسة في thead والتذييل في tfoot: المتصفح يكرّرهما أعلى كل صفحة
     وأسفلها عند الطباعة، والهوامش من ‏@page (في Events.jsx) فلا يلتصق
     محتوى الصفحات التالية بحافة الورقة. */
  return (
    <div className="sheet bg-white"
         style={{ width: "100%", color: "#1F2A24", fontFamily: "'IBM Plex Sans Arabic', sans-serif", ...INK }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><td style={{ padding: 0 }}><Letterhead /></td></tr></thead>
        <tfoot><tr><td style={{ padding: 0 }}><Footer /></td></tr></tfoot>
        <tbody><tr><td style={{ padding: 0, verticalAlign: "top" }}>

      <div className="text-center" style={{ marginTop: "1mm" }}>
        <span style={{ background: "#EDFAF2", color: ACCENT, borderRadius: "10mm", padding: "1.5mm 6mm",
                       fontSize: "11pt", fontWeight: 600, ...INK }}>
          تقرير تنفيذ حدث
        </span>
        <p style={{ marginTop: "3.5mm", fontSize: "17pt", fontWeight: 700 }}>{e.title}</p>
      </div>

      {/* بيانات الحدث */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "5mm", fontSize: "10pt" }}>
        <tbody>
          {[0, 2, 4].map((i) => (
            <tr key={i}>
              {[info[i], info[i + 1]].map(([k, v]) => (
                <td key={k} style={{ ...cell, width: "50%" }}>
                  <span style={{ color: "#6B7A72" }}>{k}: </span>{v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {has(e.description) && <Section title="نبذة عن الحدث"><p style={para}>{e.description.trim()}</p></Section>}
      {has(e.goals) && <Section title="الأهداف"><p style={para}>{e.goals.trim()}</p></Section>}

      {/* الأعداد */}
      <Section title="المشاركة">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: "2mm" }}>
          {stats.map(([k, v]) => (
            <div key={k} className="text-center" style={{ border: "0.25mm solid #DDE5E0", borderRadius: "1.5mm", padding: "2mm 1mm" }}>
              <p className="num" style={{ fontSize: "15pt", fontWeight: 700, color: ACCENT }}>{v}</p>
              <p style={{ fontSize: "8.5pt", color: "#6B7A72" }}>{k}</p>
            </div>
          ))}
        </div>
      </Section>

      {has(e.report_summary) && <Section title="وصف التنفيذ"><p style={para}>{e.report_summary.trim()}</p></Section>}

      {photos.length > 0 && (
        <Section title="صور من التنفيذ">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "3mm" }}>
            {photos.map((u) => (
              <img key={u} src={u} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: "1.5mm" }} />
            ))}
          </div>
        </Section>
      )}

      {has(e.report_outcomes) && <Section title="النتائج والأثر"><p style={para}>{e.report_outcomes.trim()}</p></Section>}
      {has(e.report_recommendations) && <Section title="التوصيات"><p style={para}>{e.report_recommendations.trim()}</p></Section>}

      {/* الحاضرون */}
      {attended.length > 0 && (
        <>
          <Heading>الطلاب الحاضرون (<span className="num">{attended.length}</span>)</Heading>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
            <thead>
              <tr style={{ background: "#EDFAF2", ...INK }}>
                <th style={{ ...cell, width: "10mm" }}>م</th>
                <th style={{ ...cell, textAlign: "right" }}>اسم الطالب</th>
                <th style={{ ...cell, textAlign: "right", width: "60mm" }}>الصف والفصل</th>
              </tr>
            </thead>
            <tbody>
              {attended.map((p, i) => (
                <tr key={p.id} style={{ breakInside: "avoid" }}>
                  <td className="num" style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
                  <td style={cell}>{p.student_name}</td>
                  <td style={cell}>{p.class_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* التواقيع */}
      <div className="grid items-end" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "6mm", marginTop: "10mm", breakInside: "avoid" }}>
        <div className="justify-self-start">
          <Sign url={sigUrl} name={e.organizer_name} role={e.organizer_role || "منظّم الحدث"} />
        </div>
        <div className="justify-self-center" style={{ minHeight: "20mm" }}>
          {stampUrl && <img src={stampUrl} alt="" style={{ height: "20mm", width: "auto", opacity: 0.9 }} />}
        </div>
        <div className="justify-self-end">
          {/* توقيع المدير يظهر بعد اعتماده الحدث */}
          <Sign url={principalUrl} name={principalName} role="مدير المدرسة" />
        </div>
      </div>

        </td></tr></tbody>
      </table>
    </div>
  );
}
