// src/pages/guidance/MonthlyReport.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../lib/session.jsx";
import { todayISO } from "../../lib/schoolTime";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import PrintPortal from "../../components/PrintPortal.jsx";
import Loader from "../../components/Loader.jsx";
import Scaled from "../studio/Scaled.jsx";
import { useFontsReady, academicYearLabel, TERM_LABEL } from "../studio/lib";
import { jpegsToPdf } from "../studio/pdf";
import { iosFit, isTouchDevice, rasterSheets } from "../studio/raster";
import { loadMonthly, loadWarningSnapshot } from "./monthlyData";
import MonthlyReportDoc, { reportInfo, reportPages } from "./MonthlyReportDoc.jsx";

/* =====================================================================
   تبويب «التقرير الشهري» في التوجيه الطلابي: تقرير مصمّم بهوية استوديو
   البوابة — غلاف، وملخص بمؤشرات ورسوم، والحالات والجلسات، والبرامج بصورها،
   والتواصل والنماذج، ثم ملاحظات الموجه والتوقيعات والختم.
   يُطبع من الحاسب مباشرة، ومن الجوال ملف PDF بمقاس A4 الصحيح.
   ===================================================================== */

const A4 = { w: 794, h: 1123 };
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

// ملاحظات الموجه تُحفظ في المتصفح لكل صف وشهر حتى الطباعة
const notesKey = (grade, month) => `guidance-report-notes:${grade}:${month}`;
const readNotes = (k) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeNotes = (k, v) => {
  try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* تخزين محجوب */ }
};

export default function MonthlyReport({ grade, me }) {
  const { session, adminRoles } = useSession();
  const uid = session?.user?.id;
  const isCounselor = adminRoles.includes(`counselor_${grade}`);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [theme, setTheme] = useState("light");
  const [d, setD] = useState(null);
  const [warn, setWarn] = useState(null);
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState(() => readNotes(notesKey(grade, todayISO().slice(0, 7))));
  const [sigs, setSigs] = useState({ counselor: null, principal: null, stamp: null });
  const fontsReady = useFontsReady();

  useEffect(() => {
    let live = true;
    setD(null); setErr("");
    setNotes(readNotes(notesKey(grade, month)));
    loadMonthly({ grade, month, uid, isCounselor })
      .then((x) => { if (live) setD(x); })
      .catch((e) => { if (live) setErr(e?.message ?? String(e)); });
    return () => { live = false; };
  }, [grade, month, uid, isCounselor]);

  // الإنذار المبكر لحظي لا يتغير بالشهر
  useEffect(() => {
    let live = true;
    loadWarningSnapshot(grade).then((w) => { if (live) setWarn(w); });
    return () => { live = false; };
  }, [grade]);

  const counselor = (isCounselor ? me : d?.counselorName) || me || "";
  useEffect(() => {
    let live = true;
    Promise.all([counselor ? signatureByName(counselor) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([c, p, s]) => { if (live) setSigs({ counselor: c, principal: p?.url ?? null, stamp: s }); });
    return () => { live = false; };
  }, [counselor]);

  const info = useMemo(() => d && reportInfo({
    d, grade, counselor,
    yearLabel: academicYearLabel(new Date(`${month}-15T12:00:00`)), termLabel: TERM_LABEL[d.term] ?? "",
  }), [d, grade, counselor, month]);

  const docProps = d && info ? { d, warn, theme, info, notes, sigs } : null;
  const doc = docProps && <MonthlyReportDoc {...docProps} />;
  const fileTitle = info ? `التقرير الشهري للموجه الطلابي - ${info.grade} - ${info.month}` : "التقرير الشهري";

  /* ——— الطباعة: الحاسب مباشرة، والجوال ملف PDF من صور الأوراق (كاستوديو البوابة) ——— */
  const mobile = useMemo(() => isTouchDevice(), []);
  const liveRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [printImgs, setPrintImgs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const capture = useCallback(async () => {
    const imgs = await rasterSheets(liveRef.current, A4);
    setPrintImgs(imgs);
    if (imgs?.length) {
      const blob = jpegsToPdf(imgs, { w: 210, h: 297 });
      setPdf((old) => { if (old?.url) URL.revokeObjectURL(old.url); return { blob, url: URL.createObjectURL(blob), name: `${fileTitle}.pdf` }; });
    }
  }, [fileTitle]);

  useEffect(() => {
    if (!mobile || !d || !fontsReady) return;
    setPdf(null); setPrintImgs(null);
    const t = setTimeout(() => { capture().catch((e) => console.error("rasterSheets:", e)); }, 1500);
    return () => clearTimeout(t);
  }, [mobile, d, warn, theme, notes, sigs, fontsReady, capture]);

  const printNow = () => {
    setMsg("");
    if (!mobile) {
      const prev = document.title;
      document.title = fileTitle;
      window.print();
      setTimeout(() => { document.title = prev; }, 500);
      return;
    }
    if (!pdf) {
      setBusy(true);
      capture().then(() => setMsg("الملف جاهز — اضغط «طباعة / حفظ PDF» مرة أخرى."))
        .catch((e) => setMsg(`تعذّر تجهيز الملف: ${e.message ?? e}`)).finally(() => setBusy(false));
      return;
    }
    const file = new File([pdf.blob], pdf.name, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: pdf.name }).catch((e) => {
        if (e?.name !== "AbortError") setMsg("افتح الملف من رابط «فتح ملف PDF» ثم اطبعه.");
      });
    } else setMsg("افتح الملف من رابط «فتح ملف PDF» ثم اطبعه من قائمة المتصفح.");
  };

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>;

  return (
    <div className="space-y-3">
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" className="field num w-auto" value={month} max={todayISO().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <div className="flex gap-1.5">
            <button className={pill(theme === "light")} onClick={() => setTheme("light")}>ملوّنة</button>
            <button className={pill(theme === "official")} onClick={() => setTheme("official")}>رسمية موفّرة للحبر</button>
          </div>
          <button className="btn-primary mr-auto px-4 py-1.5 text-xs" disabled={!d || busy} onClick={printNow}>
            {busy ? "جارٍ تجهيز الملف…" : "طباعة / حفظ PDF"}
          </button>
        </div>
        {mobile && pdf && <a href={pdf.url} target="_blank" rel="noreferrer" className="block text-xs text-mint-deep underline">فتح ملف PDF</a>}
        {msg && <p className="text-xs text-mint-deep">{msg}</p>}
        <div>
          <label className="text-xs text-muted">ملاحظات الموجه وتوصياته (تظهر في الصفحة الأخيرة، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
          <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes}
                    placeholder="مثل: تكثيف برامج التهيئة للاختبارات، والتواصل مع أولياء أمور المتغيبين…"
                    onChange={(e) => { setNotes(e.target.value); writeNotes(notesKey(grade, month), e.target.value); }} />
        </div>
        <p className="text-[11.5px] text-muted">التقرير أرقام مجمّعة من سجلات البوابة دون أسماء الطلاب. النماذج: {isCounselor ? "كل ما أصدرته أنت من البوابة في الشهر." : "نماذج قسم التوجيه لطلاب الصف."}</p>
      </div>

      {!doc || !fontsReady ? <Loader /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportPages(docProps).map((p, i) => (
            <div key={i}>
              <Scaled w={A4.w} h={A4.h}>{p}</Scaled>
              <p className="mt-1.5 text-center text-[11px] text-muted">صفحة <span className="num">{i + 1}</span></p>
            </div>
          ))}
        </div>
      )}

      {/* نسخة حيّة خارج الشاشة تُلتقط منها صور ملف PDF على الجوال */}
      {mobile && doc && (
        <div ref={liveRef} aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>{doc}</div>
      )}

      {doc && (
        <PrintPortal id="guidance-monthly-print"
          extraCss={`#guidance-monthly-print .sheet { break-after: page; } #guidance-monthly-print .sheet:last-child { break-after: auto; }
            #guidance-monthly-print img.ios-print { zoom: 1 !important; margin: 0 auto !important; break-inside: avoid; }`}>
          {printImgs
            ? printImgs.map((src, i) => <img key={i} className="sheet ios-print" src={src} alt="" style={{ display: "block", margin: "0 auto", ...iosFit(A4) }} />)
            : doc}
        </PrintPortal>
      )}
    </div>
  );
}
