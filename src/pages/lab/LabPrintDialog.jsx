// src/pages/lab/LabPrintDialog.jsx
// نافذة طباعة مطبوعات المعمل بطريقة استوديو البوابة نفسها: اختيار النسخة
// (فاتحة/غامقة/رسمية)، ومعاينة، وطباعة من الحاسب، وملف PDF على الجوال، وصورة PNG.
import { useMemo, useRef, useState } from "react";
import PrintPortal from "../../components/PrintPortal.jsx";
import Scaled from "../studio/Scaled.jsx";
import { THEMES, downloadNode } from "../studio/lib";
import { jpegsToPdf } from "../studio/pdf";
import { isTouchDevice, rasterSheets } from "../studio/raster";

const pill = (on) =>
  `rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;

/**
 * render(theme) يعيد الورقة (عنصرًا بصنف sheet بمقاس A4: 794×1123).
 * paper: "A4" أو "A3" (تُكبَّر ورقة A4 نفسها إلى A3 عند الطباعة).
 */
export default function LabPrintDialog({ title, fileName, render, paper = "A4", onClose, children }) {
  const [theme, setTheme] = useState("light");
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [err, setErr] = useState("");
  const mobile = useMemo(isTouchDevice, []);
  const previewRef = useRef(null);
  const liveRef = useRef(null);
  const size = { w: 794, h: 1123 };
  const sheet = render(theme);

  const printNow = async () => {
    setErr("");
    if (!mobile) {
      const prev = document.title;
      document.title = fileName;
      window.print();
      setTimeout(() => { document.title = prev; }, 500);
      return;
    }
    // الجوال: صورة للورقة ثم ملف PDF بالمقاس الصحيح (متصفحات الجوال لا تطبع التصاميم بدقة)
    setBusy(true);
    try {
      const imgs = await rasterSheets(liveRef.current, size);
      const blob = jpegsToPdf(imgs, paper === "A3" ? { w: 297, h: 420 } : { w: 210, h: 297 });
      setPdf({ blob, url: URL.createObjectURL(blob) });
      const file = new File([blob], `${fileName}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: fileName }).catch(() => {});
    } catch (e) {
      setErr(`تعذّر تجهيز ملف PDF: ${e.message ?? e}`);
    } finally { setBusy(false); }
  };

  const png = async () => {
    setBusy(true);
    try {
      const node = previewRef.current?.querySelector(".sheet");
      await downloadNode(node, `${fileName}.png`, 2);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4 print:hidden" dir="rtl"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-card bg-paper p-4 shadow-xl sm:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">{title}</p>
          <button type="button" className="text-sm text-muted" onClick={onClose}>إغلاق</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_15rem]">
          <div className="mx-auto w-full max-w-sm">
            <Scaled w={size.w} h={size.h} innerRef={previewRef}>{sheet}</Scaled>
          </div>
          <div className="space-y-3">
            <div>
              <p className="label">النسخة</p>
              <div className="flex flex-wrap gap-1.5">
                {THEMES.map((t) => <button key={t.key} type="button" className={pill(theme === t.key)} onClick={() => setTheme(t.key)}>{t.label}</button>)}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{THEMES.find((t) => t.key === theme)?.hint}</p>
            </div>
            {children}
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={printNow}>
              {busy && mobile ? "جارٍ تجهيز ملف PDF…" : "طباعة / حفظ PDF"}
            </button>
            {mobile && pdf && (
              <a href={pdf.url} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-semibold text-mint-deep underline underline-offset-4">
                فتح ملف PDF
              </a>
            )}
            <button type="button" className="btn-ghost w-full" disabled={busy} onClick={png}>تنزيل صورة PNG</button>
            {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-xs text-absent">{err}</p>}
            <p className="text-[11px] leading-relaxed text-faint">
              {mobile
                ? `على الجوال يُنشأ ملف PDF بمقاس ${paper} الصحيح — اختر منه «طباعة» أو «حفظ في الملفات».`
                : `في نافذة الطباعة: الورق ${paper} بالطول، والهوامش «بلا»، وفعّل «طباعة الخلفيات».`}
            </p>
          </div>
        </div>
      </div>

      {/* نسخة حيّة خارج الشاشة تُلتقط منها صورة الطباعة على الجوال */}
      {mobile && (
        <div ref={liveRef} aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>{sheet}</div>
      )}
      <PrintPortal id="lab-print"
        extraCss={paper === "A3" ? " @page { size: A3 portrait; margin: 0; } #lab-print .sheet { zoom: 1.4142; }" : ""}>
        {sheet}
      </PrintPortal>
    </div>
  );
}

