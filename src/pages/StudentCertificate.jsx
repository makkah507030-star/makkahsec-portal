// src/pages/StudentCertificate.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { GRADE_NAMES, todayISO } from "../lib/schoolTime";
import { fmtHijri } from "../lib/dates";
import { PRINCIPAL_NAME } from "../lib/exportUtils";
import StudentPicker from "../components/StudentPicker.jsx";
import PrintPortal from "../components/PrintPortal.jsx";
import PrincipalSign from "../components/PrincipalSign.jsx";
import moeLogo from "../assets/moe-logo.png";
import { trackUsage, useUsageCounts } from "../lib/usage.js";
import UsageBadge from "../components/UsageBadge.jsx";

/* =====================================================================
   شهادة تعريف طالب منتظم — على صيغة شهادة نظام نور: تُملأ من بيانات
   الطالب في البوابة (الاسم مقسّمًا، والهوية، والجنسية، والصف، والقسم)،
   وتُطبع بختم المدرسة وتوقيع المدير.
   ===================================================================== */

const TRACK = { common_year: "السنة المشتركة", general_track: "المسار العام" };
const TO_PRESETS = ["من يهمه الأمر", "المديرية العامة للجوازات", "إدارة الأحوال المدنية", "إدارة التعليم", "السفارة"];
const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

// العام الدراسي: سنة بدايته الهجرية - التي تليها (1448 - 1449)، ويبدأ العام في أغسطس
const schoolYear = (now = new Date()) => {
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  let h = 1448;
  try {
    h = parseInt(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" })
      .format(new Date(start, 7, 20)).replace(/\D/g, ""), 10);
  } catch { /* تجاهل */ }
  return `${h} - ${h + 1}`;
};
// التاريخ الهجري يومًا/شهرًا/سنة كما في الشهادة الرسمية
const hijriDMY = (d) => fmtHijri(d, false).split("/").reverse().join("/");
// الأرقام والتواريخ داخل نص عربي: تُعزل لتبقى بترتيبها
const Ltr = ({ children }) => <span className="num" style={{ unicodeBidi: "isolate", direction: "ltr", display: "inline-block" }}>{children}</span>;

/** الاسم في أربع خانات: «عبد» وما بعدها كلمة واحدة، وما زاد يُضم للخانة الأخيرة */
export function splitName(full) {
  const words = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  const tokens = [];
  for (let i = 0; i < words.length; i++) {
    if ((words[i] === "عبد" || words[i] === "ابو" || words[i] === "أبو") && words[i + 1]) {
      tokens.push(`${words[i]} ${words[i + 1]}`); i++;
    } else tokens.push(words[i]);
  }
  // «بن» لا تُعدّ خانة
  const parts = tokens.filter((t) => t !== "بن" && t !== "بنت");
  if (parts.length <= 4) return [...parts, "", "", "", ""].slice(0, 4);
  return [parts[0], parts[1], parts[2], parts.slice(3).join(" ")];
}

export default function StudentCertificate() {
  const usage = useUsageCounts();
  const [student, setStudent] = useState(null);
  const [info, setInfo] = useState(null);
  const [to, setTo] = useState(TO_PRESETS[0]);
  const [no, setNo] = useState("");
  // الجنسية تُختار يدويًا: سعودي / غير سعودي (تُقترح من أول رقم في الهوية: 1 = سعودي)
  const [nationality, setNationality] = useState("سعودي");
  const [date, setDate] = useState(todayISO());
  const [year, setYear] = useState(schoolYear());
  const [stamp, setStamp] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("school_assets").select("path").eq("key", "stamp").maybeSingle();
      if (data?.path) {
        const { data: su } = await supabase.storage.from("form-assets").createSignedUrl(data.path, 3600);
        setStamp(su?.signedUrl ?? null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!student) { setInfo(null); return; }
    let alive = true;
    (async () => {
      const [{ data: s }, { data: v }] = await Promise.all([
        supabase.from("students").select("national_id, full_name").eq("id", student.student_id).maybeSingle(),
        supabase.from("v_active_students").select("track, grade, class_no").eq("student_id", student.student_id).maybeSingle(),
      ]);
      if (!alive) return;
      setInfo({ ...student, ...(v ?? {}), ...(s ?? {}) });
      setNationality(String(s?.national_id ?? "").startsWith("1") ? "سعودي" : "غير سعودي");
    })();
    return () => { alive = false; };
  }, [student]);

  const cert = info && { ...info, nationality, to: to.trim() || "من يهمه الأمر", no: no.trim(), date, year };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-ink">شهادة تعريف طالب منتظم</h1>
            <UsageBadge map={usage} category="certificate" itemKey="student-certificate" />
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            اختر الطالب، فتُملأ الشهادة من بياناته في البوابة، ثم اطبعها بختم المدرسة وتوقيع المدير.
          </p>
        </div>
        <button className="btn-primary shrink-0" disabled={!cert} onClick={() => { trackUsage("certificate", "student-certificate", "print"); window.print(); }}>طباعة / حفظ PDF</button>
      </div>

      <section className="no-print card space-y-3 p-4">
        <div>
          <label className="text-xs text-muted">الطالب</label>
          <div className="mt-1"><StudentPicker value={student} onChange={setStudent} /></div>
        </div>
        <div>
          <label className="text-xs text-muted">تُقدَّم إلى</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TO_PRESETS.map((t) => (
              <button key={t} type="button" onClick={() => setTo(t)}
                className={`rounded-pill px-3 py-1 text-xs font-medium ${to === t
                  ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>{t}</button>
            ))}
          </div>
          <input className="field mt-1.5 w-full" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted">العام الدراسي</label>
            <input className="field mt-1 w-full" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">الرقم (اختياري)</label>
            <input className="field mt-1 w-full" value={no} onChange={(e) => setNo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">التاريخ</label>
            <input type="date" className="field mt-1 w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted">الجنسية</label>
          <div className="mt-1.5 flex gap-1.5">
            {["سعودي", "غير سعودي"].map((n) => (
              <button key={n} type="button" onClick={() => setNationality(n)}
                className={`rounded-pill px-4 py-1.5 text-sm font-medium ${nationality === n
                  ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>{n}</button>
            ))}
          </div>
        </div>
      </section>

      {cert ? <Preview cert={cert} stamp={stamp} /> : (
        <p className="no-print card px-4 py-8 text-center text-sm text-muted">اختر الطالب لتظهر الشهادة.</p>
      )}

      {cert && (
        <PrintPortal id="cert-print">
          <CertificateSheet c={cert} stamp={stamp} />
        </PrintPortal>
      )}
    </div>
  );
}

function Preview({ cert, stamp }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const fit = () => { const w = box.current?.clientWidth ?? 0; if (w) setScale(Math.min(1, (w - 2) / 794)); };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={box} className="no-print overflow-hidden rounded-card border border-line bg-white">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: 794, height: 1123 * scale }}>
        <CertificateSheet c={cert} stamp={stamp} />
      </div>
    </div>
  );
}

/* ------------------------------ الورقة ------------------------------ */
export function CertificateSheet({ c, stamp }) {
  const [n1, n2, n3, n4] = splitName(c.full_name);
  const th = "border border-[#B9D3C4] px-2 py-1.5 text-center text-[12.5px] font-bold";
  const td = "border border-[#B9D3C4] px-2 py-2 text-center text-[13.5px] font-medium";
  const head = { background: "#EDFAF2", color: "#3E6350", ...INK };
  return (
    <div className="sheet mx-auto bg-white text-ink"
         style={{ width: "210mm", minHeight: "297mm", padding: "14mm 15mm", fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                  display: "flex", flexDirection: "column" }}>
      {/* الترويسة */}
      <div className="grid grid-cols-3 items-start gap-4">
        <div className="text-[12px] font-semibold leading-[1.9]">
          <div>المملكة العربية السعودية</div>
          <div>وزارة التعليم</div>
          <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
          <div className="text-mint-deep">مدرسة مكة الثانوية - مسارات</div>
        </div>
        <div className="flex justify-center"><img src={moeLogo} alt="" className="h-20 w-auto" /></div>
        <div className="mr-auto text-[12px] leading-[1.9]">
          <div><span className="text-muted">العام الدراسي: </span><b><Ltr>{c.year}</Ltr> هـ</b></div>
          <div><span className="text-muted">الرقم: </span><b className="num">{c.no || "...................."}</b></div>
          <div><span className="text-muted">التاريخ: </span><b><Ltr>{hijriDMY(c.date)}</Ltr></b></div>
        </div>
      </div>
      <div className="mt-3 h-px w-full" style={{ background: "linear-gradient(90deg,transparent,#3E6350 50%,transparent)", ...INK }} />

      <h1 className="mt-6 text-center text-[22px] font-bold text-mint-deep">شهادة تعريف طالب منتظم</h1>

      <table className="mt-6 w-full border-collapse">
        <tbody>
          <tr style={head}>{["الاسم الأول", "الاسم الثاني", "الاسم الثالث", "الاسم الرابع"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
          <tr>{[n1, n2, n3, n4].map((x, i) => <td key={i} className={td}>{x || "—"}</td>)}</tr>
          <tr style={head}>{["الجنسية", "رقم الهوية", "الصف", "القسم"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
          <tr>
            <td className={td}>{c.nationality || "—"}</td>
            <td className={`${td} num`}>{c.national_id || "—"}</td>
            <td className={td}>{GRADE_NAMES[c.grade] ?? "—"}</td>
            <td className={td}>{TRACK[c.track] ?? c.track ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8 space-y-3 px-1 text-[15px] leading-[2.1]">
        <p className="font-bold">تشهد إدارة مدرسة مكة الثانوية - مسارات</p>
        <p>بأن الطالب الموضحة بياناته أعلاه هو أحد الطلاب المنتظمين في المدرسة للعام الدراسي <b><Ltr>{c.year}</Ltr> هـ</b>.</p>
        <p>وقد أُعطي هذه الشهادة بناءً على طلبه لتقديمها إلى <b>{c.to}</b>.</p>
        <p className="pt-2 text-center font-bold">والله الموفق ،،،</p>
      </div>

      <div className="mt-10 flex items-end justify-between gap-6">
        <div className="w-40 text-center">
          {stamp ? <img src={stamp} alt="" className="mx-auto h-24 w-auto object-contain opacity-90" />
                 : <p className="text-[12px] text-faint">الختم</p>}
        </div>
        <div className="text-center">
          <p className="text-[13px] font-bold text-muted">مدير المدرسة</p>
          <PrincipalSign height="h-12" />
          <div className="mx-auto h-px w-48 bg-line" />
          <p className="mt-1 text-[14px] font-bold">{PRINCIPAL_NAME}</p>
        </div>
      </div>

      <div className="mt-auto flex justify-between border-t border-line pt-2 text-[10.5px] text-faint">
        <Ltr>{hijriDMY(c.date)}</Ltr>
        <span>بوابة مكة الثانوية الرقمية</span>
        <span className="num" dir="ltr">makkahsec.com</span>
      </div>
    </div>
  );
}
