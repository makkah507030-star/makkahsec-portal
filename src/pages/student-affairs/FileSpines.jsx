// كعب ملفات شؤون الطلاب — شرائط تُطبع وتُلصق على ظهر ملفات الحفظ،
// بهوية البوابة: الأخضر العميق وشعار المدرسة وخط IBM Plex Sans Arabic.
import { useEffect, useState } from "react";
import logoWhite from "../../assets/icon-white.png";
import moeLogo from "../../assets/moe-logo.png";
import PrintPortal from "../../components/PrintPortal.jsx";
import { fmtHijri } from "../../lib/dates.js";
import { Pill } from "./shared.jsx";

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const DEEP = "#3E6350";
const MINT = "#89D7AD";
const TINT = "#EDFAF2";

// ملفات وكالة شؤون الطلاب المعتادة — تُعدَّل أو يُضاف غيرها من الشاشة
const DEFAULT_FILES = [
  "سجل الغياب اليومي",
  "التأخر الصباحي",
  "الإنذارات ومحاضر الغياب",
  "الاستئذان والخروج المبكر",
  "الأعذار والتقارير الطبية",
  "غياب الحصص ومتابعة التحضير",
  "المخالفات السلوكية",
  "إحالات الطلاب",
  "دراسة الحالة",
  "المراسلات مع أولياء الأمور",
  "التعاميم والتعليمات",
  "الإحصاءات والتقارير الدورية",
];

/* المقاسان: العريض لملفات الحفظ الكبيرة (Box File) والرفيع لملفات الكبس.
   الطول 275مم يملأ A4 عموديًا، وعدد الكعوب في الورقة حسب العرض. */
const SIZES = {
  wide:   { label: "عريض 7.5 سم", w: 75, perPage: 2 },
  narrow: { label: "رفيع 3.8 سم", w: 38, perPage: 5 },
};
const H = 275;

const STORE = "sa-file-spines";
const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "null"); } catch { return null; }
};

const currentYear = () => `${fmtHijri(new Date()).slice(0, 4)}هـ`;
let seq = 0;
const row = (title, on = true) => ({ id: `f${Date.now()}${seq++}`, title, note: "", on });

export default function FileSpines() {
  const saved = load();
  const [files, setFiles] = useState(() => saved?.files ?? DEFAULT_FILES.map((t) => row(t)));
  const [year, setYear] = useState(saved?.year ?? currentYear());
  const [size, setSize] = useState(saved?.size ?? "wide");

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ files, year, size })); } catch { /* المتصفح يمنع التخزين */ }
  }, [files, year, size]);

  const set = (id, patch) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const chosen = files
    .map((f, i) => ({ ...f, no: i + 1 }))
    .filter((f) => f.on && f.title.trim());
  const allOn = files.length > 0 && files.every((f) => f.on);
  const { w, perPage } = SIZES[size];
  const pages = [];
  for (let i = 0; i < chosen.length; i += perPage) pages.push(chosen.slice(i, i + perPage));

  const reset = () => {
    if (!window.confirm("إعادة قائمة الملفات الافتراضية؟ تُحذف التعديلات والإضافات.")) return;
    setFiles(DEFAULT_FILES.map((t) => row(t)));
    setYear(currentYear());
  };

  const print = async () => {
    const imgs = [...document.querySelectorAll("#spine-print img")];
    await Promise.all(imgs.map((i) => (i.complete ? null
      : new Promise((r) => { i.onload = r; i.onerror = r; }))));
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-4">
        <div>
          <h2 className="text-base font-bold text-ink">كعب الملفات</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            شرائط تُلصق على ظهر ملفات شؤون الطلاب. حدّد الملفات، وعدّل عناوينها أو أضف غيرها،
            ثم اطبع وقصّ على الخط المتقطّع. رقم الملف هو ترتيبه في القائمة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted">المقاس</span>
            {Object.entries(SIZES).map(([k, s]) => (
              <Pill key={k} on={size === k} onClick={() => setSize(k)}>{s.label}</Pill>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            العام الدراسي
            <input value={year} onChange={(e) => setYear(e.target.value)}
                   className="w-28 rounded-sm2 border border-line px-3 py-2 text-sm text-ink" />
          </label>
        </div>

        <div className="overflow-hidden rounded-card border border-line">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-3 py-2">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={allOn}
                     onChange={() => setFiles((fs) => fs.map((f) => ({ ...f, on: !allOn })))} />
              تحديد الكل
            </label>
            <span className="text-xs text-muted">المحدد: <span className="num">{chosen.length}</span></span>
          </div>
          <ul className="divide-y divide-line">
            {files.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <input type="checkbox" checked={f.on} onChange={() => set(f.id, { on: !f.on })} />
                <span className="num w-7 text-center text-xs font-semibold text-mint-deep">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input value={f.title} onChange={(e) => set(f.id, { title: e.target.value })}
                       placeholder="عنوان الملف"
                       className="min-w-[12rem] flex-1 rounded-sm2 border border-line px-2.5 py-1.5 text-sm text-ink" />
                <input value={f.note} onChange={(e) => set(f.id, { note: e.target.value })}
                       placeholder="سطر إضافي (اختياري)، مثل: الصف الأول"
                       className="min-w-[10rem] flex-1 rounded-sm2 border border-line px-2.5 py-1.5 text-sm text-ink" />
                <button onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))}
                        aria-label="حذف" title="حذف"
                        className="rounded-sm2 px-2 py-1 text-sm text-faint hover:bg-danger-light hover:text-danger">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFiles((fs) => [...fs, row("")])}
                  className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
            + إضافة ملف
          </button>
          <button onClick={reset}
                  className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-muted hover:bg-canvas">
            استعادة القائمة الافتراضية
          </button>
          <button onClick={print} disabled={!chosen.length}
                  className="rounded-sm2 bg-mint-deep px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
            طباعة / PDF ({pages.length} {pages.length === 1 ? "ورقة" : "أوراق"})
          </button>
        </div>
      </div>

      {/* المعاينة: الكعوب نفسها بمقاسها الحقيقي مصغّرة */}
      {chosen.length > 0 ? (
        <div className="card overflow-x-auto p-4">
          <p className="mb-3 text-sm font-semibold text-ink">المعاينة</p>
          <div className="flex flex-wrap justify-center gap-3" style={{ zoom: 0.5 }}>
            {chosen.map((f) => <Spine key={f.id} file={f} year={year} w={w} />)}
          </div>
        </div>
      ) : (
        <p className="card p-6 text-center text-sm text-muted">حدّد ملفًا واحدًا على الأقل.</p>
      )}

      <PrintPortal id="spine-print"
                   extraCss="#spine-print .sheet { break-after: page; } #spine-print .sheet:last-child { break-after: auto; }">
        {pages.map((p, i) => (
          <div key={i} className="sheet mx-auto flex items-center justify-center bg-white"
               style={{ width: "210mm", height: "297mm", overflow: "hidden" }}>
            {p.map((f) => <Spine key={f.id} file={f} year={year} w={w} />)}
          </div>
        ))}
      </PrintPortal>
    </div>
  );
}

/* كعب واحد: رأس أخضر بشعار المدرسة، ثم رقم الملف، والعنوان عموديًا بخط كبير،
   ثم العام الدراسي، وفي الأسفل اسم البوابة. الإطار المتقطّع دليل القص. */
function Spine({ file, year, w }) {
  const narrow = w < 50;
  const title = file.title.trim();
  // حجم العنوان يصغر مع طوله ليبقى في عمود واحد (~150مم متاحة)
  const titlePt = Math.max(narrow ? 14 : 18, Math.min(narrow ? 26 : 44, 400 / (title.length * 0.55)));
  const no = String(file.no).padStart(2, "0");

  return (
    <div className="flex flex-col bg-white text-ink"
         style={{ width: `${w}mm`, height: `${H}mm`, flex: "0 0 auto",
                  outline: "0.3mm dashed #C3C3C3", outlineOffset: "-0.15mm",
                  fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      {/* الرأس */}
      <div className="flex flex-col items-center justify-center text-center text-white"
           style={{ background: DEEP, height: narrow ? "46mm" : "58mm", padding: "0 3mm", ...INK }}>
        <img src={logoWhite} alt="" style={{ height: narrow ? "17mm" : "20mm", width: "auto" }} />
        <div style={{ fontSize: narrow ? "8pt" : "12pt", fontWeight: 700, marginTop: "2.5mm", lineHeight: 1.3 }}>
          مدرسة مكة الثانوية
        </div>
        <div style={{ fontSize: narrow ? "7pt" : "9.5pt", color: MINT, marginTop: "1mm", ...INK }}>
          {narrow ? "شؤون الطلاب" : "وكالة شؤون الطلاب"}
        </div>
      </div>

      {/* شرطتا الشعار المائلتان */}
      <svg viewBox="0 0 100 14" preserveAspectRatio="none" style={{ width: "100%", height: "5mm", display: "block" }}>
        <path d="M0 0 L50 9 L100 0 L100 4 L50 13 L0 4 Z" fill={MINT} style={INK} />
      </svg>

      {/* رقم الملف */}
      <div className="flex justify-center" style={{ marginTop: "4mm" }}>
        <div className="num flex items-center justify-center rounded-full font-bold"
             style={{ width: narrow ? "13mm" : "16mm", height: narrow ? "13mm" : "16mm",
                      border: `0.6mm solid ${DEEP}`, color: DEEP, fontSize: narrow ? "13pt" : "17pt" }}>
          {no}
        </div>
      </div>

      {/* العنوان عموديًا */}
      <div className="flex min-h-0 flex-1 items-center justify-center" style={{ padding: "4mm 0", gap: "2mm" }}>
        <div style={{ writingMode: "vertical-rl", fontSize: `${titlePt}pt`, fontWeight: 700,
                      lineHeight: 1.15, textAlign: "center", maxHeight: "100%" }}>
          {title}
        </div>
        {file.note?.trim() && (
          <div style={{ writingMode: "vertical-rl", fontSize: narrow ? "9pt" : "12pt", color: "#6B6B6B",
                        textAlign: "center", maxHeight: "100%" }}>
            {file.note.trim()}
          </div>
        )}
      </div>

      {/* العام الدراسي */}
      <div className="text-center" style={{ background: TINT, margin: "0 3mm", borderRadius: "2.5mm",
                                            padding: "2mm 1mm", ...INK }}>
        <div style={{ fontSize: narrow ? "6.5pt" : "8.5pt", color: "#6B6B6B" }}>العام الدراسي</div>
        <div dir="rtl" style={{ fontSize: narrow ? "10pt" : "13pt", fontWeight: 700, color: DEEP,
                                fontVariantNumeric: "tabular-nums" }}>{year}</div>
      </div>

      {/* الذيل */}
      <div className="flex flex-col items-center" style={{ padding: "3mm 2mm 4mm", gap: "1.5mm" }}>
        {!narrow && <img src={moeLogo} alt="" style={{ height: "9mm", width: "auto" }} />}
        <div style={{ height: "0.5mm", width: "60%", background: MINT, borderRadius: "1mm", ...INK }} />
        <div style={{ fontSize: narrow ? "5.5pt" : "7pt", color: "#A9A9A9", textAlign: "center", lineHeight: 1.4 }}>
          بوابة مكة الثانوية الرقمية
        </div>
      </div>
    </div>
  );
}
