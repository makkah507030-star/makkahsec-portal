// src/components/report/ReportViewer.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PrintPortal from "../PrintPortal.jsx";
import Loader from "../Loader.jsx";
import Scaled from "../../pages/studio/Scaled.jsx";
import { useFontsReady } from "../../pages/studio/lib";
import { jpegsToPdf } from "../../pages/studio/pdf";
import { iosFit, isTouchDevice, rasterSheets } from "../../pages/studio/raster";

/* =====================================================================
   عارض التقارير المصمّمة (ReportKit.jsx): شريط بالنسخة (ملوّنة / رسمية)
   وزر الطباعة، ثم معاينة مصغّرة لكل صفحة.
   يُطبع من الحاسب مباشرة، ومن الجوال ملف PDF بمقاس A4 من صور الأوراق
   (كاستوديو البوابة): متصفحات الجوال لا تطبع الصفحة بألوانها ومقاسها.
   ===================================================================== */

const A4 = { w: 794, h: 1123 };
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

/** pages: أوراق التقرير (عناصر React) أو null أثناء التحميل — تُحفظ بـ useMemo في الصفحة،
 *  لأن تغيّرها يعيد تجهيز ملف PDF على الجوال
 *  theme/setTheme: النسخة، fileTitle: اسم ملف PDF، controls: أدوات إضافية في الشريط، children: تحت الشريط */
export default function ReportViewer({ id, pages, theme, setTheme, fileTitle, controls, children }) {
  const fontsReady = useFontsReady();
  const mobile = useMemo(() => isTouchDevice(), []);
  const android = useMemo(() => /Android/i.test(navigator.userAgent), []);
  const linkText = android ? "تنزيل ملف PDF" : "فتح ملف PDF";
  const liveRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [printImgs, setPrintImgs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const urls = useRef([]);
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const capture = useCallback(async () => {
    const imgs = await rasterSheets(liveRef.current, A4);
    setPrintImgs(imgs);
    if (imgs?.length) {
      const blob = jpegsToPdf(imgs, { w: 210, h: 297 });
      // الروابط تبقى صالحة حتى مغادرة الصفحة: إلغاء الرابط عند كل تحديث للتقرير (توقيع يُحمَّل،
      // ملاحظة تُكتب) كان يُفشل فتحه في تبويب لم يُحمَّل بعد («فشل تحميل مستند PDF»)
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setPdf({ blob, url, name: `${fileTitle}.pdf` });
    }
  }, [fileTitle]);

  // على الجوال يُجهَّز الملف مسبقًا بعد آخر تغيير: المشاركة يجب أن تُستدعى فور اللمسة
  useEffect(() => {
    if (!mobile || !pages || !fontsReady) return;
    setPdf(null); setPrintImgs(null);
    const t = setTimeout(() => { capture().catch((e) => console.error("rasterSheets:", e)); }, 1500);
    return () => clearTimeout(t);
  }, [mobile, pages, fontsReady, capture]);

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
        if (e?.name !== "AbortError") setMsg(`${android ? "نزّل الملف من رابط «تنزيل ملف PDF» ثم افتحه" : "افتح الملف من رابط «فتح ملف PDF»"} واطبعه.`);
      });
    } else setMsg(`${android ? "نزّل الملف من رابط «تنزيل ملف PDF» ثم افتحه" : "افتح الملف من رابط «فتح ملف PDF»"} واطبعه.`);
  };

  return (
    <div className="space-y-3">
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <div className="flex gap-1.5">
            <button className={pill(theme === "light")} onClick={() => setTheme("light")}>ملوّنة</button>
            <button className={pill(theme === "official")} onClick={() => setTheme("official")}>رسمية موفّرة للحبر</button>
          </div>
          <button className="btn-primary mr-auto px-4 py-1.5 text-xs" disabled={!pages || busy} onClick={printNow}>
            {busy ? "جارٍ تجهيز الملف…" : "طباعة / حفظ PDF"}
          </button>
        </div>
        {/* على أندرويد تنزيل لا فتح في تبويب (كما في الاستوديو): كروم لا يفتح رابط blob لملف PDF
            في تبويب جديد («فشل تحميل مستند PDF»)، والتنزيل يفتحه عارض الملفات في الجهاز */}
        {mobile && pdf && <a href={pdf.url} target="_blank" rel="noopener noreferrer" download={android ? pdf.name : undefined}
                             className="block text-xs text-mint-deep underline">{linkText}</a>}
        {msg && <p className="text-xs text-mint-deep">{msg}</p>}
        {children}
      </div>

      {!pages || !fontsReady ? <Loader /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p, i) => (
            <div key={i}>
              <Scaled w={A4.w} h={A4.h}>{p}</Scaled>
              <p className="mt-1.5 text-center text-[11px] text-muted">صفحة <span className="num">{i + 1}</span></p>
            </div>
          ))}
        </div>
      )}

      {/* نسخة حيّة خارج الشاشة تُلتقط منها صور ملف PDF على الجوال */}
      {mobile && pages && (
        <div ref={liveRef} aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>{pages}</div>
      )}

      {pages && (
        <PrintPortal id={id}
          extraCss={`#${id} .sheet { break-after: page; } #${id} .sheet:last-child { break-after: auto; }
            #${id} img.ios-print { zoom: 1 !important; margin: 0 auto !important; break-inside: avoid; }`}>
          {printImgs
            ? printImgs.map((src, i) => <img key={i} className="sheet ios-print" src={src} alt="" style={{ display: "block", margin: "0 auto", ...iosFit(A4) }} />)
            : pages}
        </PrintPortal>
      )}
    </div>
  );
}
