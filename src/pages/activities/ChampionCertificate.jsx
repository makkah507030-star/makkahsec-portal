// src/pages/activities/ChampionCertificate.jsx
// شهادة بطل دوري المادة (طالب) أو بطل كأس المادة (شهادة لكل عضو في المجموعة)، ورقة A4 أفقية
// تُطبع من أدوات الصف في نهاية الفصل الدراسي.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import moeLogo from "../../assets/moe-logo.png";
import schoolLogo from "../../assets/logo-full-mint.png";

const TERMS = { 1: "الأول", 2: "الثاني", 3: "الثالث" };

function Sheet({ name, kind, group, subject, classLabel, points, teacher, term, year }) {
  return (
    <div className="sheet" style={{ width: "297mm", height: "210mm", padding: "12mm", boxSizing: "border-box", background: "#fff", pageBreakAfter: "always", fontFamily: "IBM Plex Sans Arabic, Tahoma" }} dir="rtl">
      <div style={{ height: "100%", border: "3mm double #3E6350", borderRadius: "4mm", padding: "10mm 16mm", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <img src={schoolLogo} alt="" style={{ height: "18mm" }} />
          <img src={moeLogo} alt="" style={{ height: "18mm" }} />
        </div>
        <div style={{ fontSize: "44pt", marginTop: "4mm" }}>🏆</div>
        <p style={{ fontSize: "30pt", fontWeight: 700, color: "#3E6350", margin: "2mm 0" }}>
          {kind === "cup" ? "شهادة بطل كأس المادة" : "شهادة بطل دوري المادة"}
        </p>
        <p style={{ fontSize: "16pt", color: "#444", margin: "4mm 0 2mm" }}>تُهدي مدرسة مكة الثانوية هذه الشهادة إلى الطالب</p>
        <p style={{ fontSize: "34pt", fontWeight: 700, color: "#101010", margin: "2mm 0", borderBottom: "1mm solid #89D7AD", padding: "0 12mm 2mm" }}>{name}</p>
        <p style={{ fontSize: "16pt", color: "#333", lineHeight: 1.9, margin: "4mm 0", maxWidth: "220mm" }}>
          {kind === "cup"
            ? <>لفوز مجموعته «{group}» ببطولة كأس مادة {subject}</>
            : <>لتتويجه بطلًا لدوري مادة {subject}</>}
          {" "}في {classLabel}، خلال الفصل الدراسي {TERMS[term] ?? term} لعام {year}هـ، بمجموع <b>{points}</b> نقطة.
          <br />تمنياتنا له بدوام التفوق والتميز.
        </p>
        <div style={{ marginTop: "auto", display: "flex", width: "100%", justifyContent: "space-between", fontSize: "13pt", color: "#333" }}>
          <div>معلم المادة<br /><b>{teacher}</b></div>
          <div>مدير المدرسة<br /><span style={{ color: "#999" }}>................................</span></div>
        </div>
      </div>
    </div>
  );
}

export default function ChampionCertificate({ names, kind, group, subject, classLabel, points, onClose }) {
  const { profile } = useSession();
  const [term, setTerm] = useState({ year: "", term: "" });
  useEffect(() => {
    supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]).then(({ data }) => {
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      setTerm({ year: m.active_year ?? "", term: m.active_term ?? "" });
    });
  }, []);
  // المعاينة على الشاشة: الورقة (297 مم ≈ 1123 بكسل) مصغّرة بعرض الصندوق
  const box = useRef(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 1123)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const props = { kind, group, subject, classLabel, points, teacher: profile?.full_name ?? "", term: term.term, year: term.year };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="mx-auto max-w-4xl space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <p className="flex-1 text-sm font-semibold text-ink">
            {names.length === 1 ? "شهادة واحدة" : `${names.length} شهادات (${names.join("، ")})`}
          </p>
          <button type="button" className="btn-primary" onClick={() => window.print()}>طباعة</button>
          <button type="button" className="btn-ghost" onClick={onClose}>إغلاق</button>
        </div>
        <div ref={box} className="overflow-hidden rounded-card bg-white" style={{ aspectRatio: "297 / 210" }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: "297mm" }}>
            <Sheet name={names[0]} {...props} />
          </div>
        </div>
      </div>
      <PrintPortal id="champion-print" landscape>
        <div id="champion-print">{names.map((n) => <Sheet key={n} name={n} {...props} />)}</div>
      </PrintPortal>
    </div>
  );
}
