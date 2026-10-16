import { useEffect, useRef, useState } from "react";
import { openDoc } from "../../lib/dfile.js";
import { loadPdfjs } from "../../lib/pdfjs.js";

/* =====================================================================
   عارض شاهد المعلم داخل الصفحة: PDF صفحاتٍ مرسومة بـ pdfjs، والصورة كما هي.
   النافذة الجديدة لا تكفي: كروم أندرويد ينزّل ملف PDF بدل عرضه، فلا يراه الزائر.
   الرابط مؤقت (5 دقائق) من netlify/functions/dfile-doc.js.
   ===================================================================== */

const MAX_PAGES = 30;

/* صورة الشاهد مدوّرة بربع دورة لكل ضغطة: صور البطاقات والشهادات تُلتقط كثيرًا والجوال بالعرض */
function RotImage({ src, alt, rot }) {
  const ref = useRef(null);
  const [img, setImg] = useState(null);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !img) return;
    const side = rot % 180 !== 0;
    c.width = side ? img.naturalHeight : img.naturalWidth;
    c.height = side ? img.naturalWidth : img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  }, [img, rot]);
  return <canvas ref={ref} role="img" aria-label={alt} className="df-viewer-img" />;
}

export default function DfileDocViewer({ code, doc, onClose }) {
  const [state, setState] = useState({ busy: true, err: "", url: "", pdf: false });
  const pages = useRef(null);
  const [rot, setRot] = useState(0);

  useEffect(() => {
    let off = false;
    let task = null;
    (async () => {
      try {
        const url = await openDoc(code, doc.id);
        // نوع الملف من امتداد مساره في التخزين (pdf أو jpg/png)
        const pdf = /\.pdf$/i.test(new URL(url).pathname);
        if (off) return;
        setState({ busy: pdf, err: "", url, pdf });
        if (!pdf) return;
        const pdfjs = await loadPdfjs();
        task = pdfjs.getDocument({ url });
        const file = await task.promise;
        const box = pages.current;
        if (off || !box) return;
        const width = box.clientWidth;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 1; i <= Math.min(file.numPages, MAX_PAGES); i++) {
          const page = await file.getPage(i);
          if (off) return;
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * ratio });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.width = "100%";
          c.setAttribute("aria-label", `الصفحة ${i}`);
          box.appendChild(c);
          await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
          if (i === 1) setState((s) => ({ ...s, busy: false }));
        }
        if (file.numPages > MAX_PAGES) {
          const p = document.createElement("p");
          p.className = "df-sub";
          p.textContent = `عُرضت أول ${MAX_PAGES} صفحة من ${file.numPages}. افتح الملف كاملًا من الزر أعلاه.`;
          box.appendChild(p);
        }
      } catch (e) {
        if (!off) setState((s) => ({ ...s, busy: false, err: e?.message || "تعذّر عرض الشاهد" }));
      }
    })();
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { off = true; task?.destroy(); window.removeEventListener("keydown", esc); };
  }, [code, doc, onClose]);

  return (
    <div className="df-viewer" role="dialog" aria-modal="true" aria-label={doc.title} onClick={onClose}>
      <div className="df-viewer-box" onClick={(e) => e.stopPropagation()}>
        <header>
          <b>{doc.title}</b>
          {state.url && !state.pdf && <button type="button" className="df-rot" onClick={() => setRot((r) => (r + 90) % 360)}>تدوير</button>}
          {state.url && <a href={state.url} target="_blank" rel="noreferrer">فتح الملف</a>}
          <button type="button" onClick={onClose} aria-label="إغلاق">✕</button>
        </header>
        <div className="df-viewer-body">
          {state.busy && <p className="df-sub">جارٍ عرض الشاهد…</p>}
          {state.err && <p className="df-sub" style={{ color: "var(--warn)" }}>{state.err}</p>}
          {state.url && !state.pdf && <RotImage src={state.url} alt={doc.title} rot={rot} />}
          <div ref={pages} className="df-viewer-pages" />
        </div>
      </div>
    </div>
  );
}
