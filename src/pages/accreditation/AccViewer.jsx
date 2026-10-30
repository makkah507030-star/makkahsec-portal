// src/pages/accreditation/AccViewer.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { loadPdfjs } from "../../lib/pdfjs.js";
import { ACC_BUCKET, fileKind } from "../../lib/accreditation.js";

/* =====================================================================
   عارض الشاهد داخل البوابة بإطار بلون المجال: PDF صفحاتٍ مرسومة بـ pdfjs، والصورة على لوحة رسم،
   مع التكبير والتصغير والتدوير ربع دورة. فتح الملف في نافذة لا يكفي: كروم أندرويد ينزّل ملف
   PDF بدل عرضه. الرابط مؤقت (10 دقائق) من المخزن الخاص.
   ===================================================================== */

const MAX_PAGES = 40;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export default function AccViewer({ ev, color, onClose }) {
  const kind = fileKind(ev.file_path);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);
  const [z, setZ] = useState(2);           // فهرس ZOOMS: 100%
  const [rot, setRot] = useState(0);
  const box = useRef(null);
  const doc = useRef(null);

  useEffect(() => {
    supabase.storage.from(ACC_BUCKET).createSignedUrl(ev.file_path, 600).then(({ data, error }) => {
      if (error || !data?.signedUrl) { setErr("تعذّر فتح الشاهد."); setBusy(false); return; }
      setUrl(data.signedUrl);
      if (kind === "other") setBusy(false);
    });
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); doc.current?.destroy?.(); };
  }, [ev.file_path, kind, onClose]);

  // ترسم الصفحات أو الصورة عند فتح الملف وعند كل تدوير؛ والتكبير عرضٌ فقط فلا يعيد الرسم
  useEffect(() => {
    if (!url || kind === "other") return;
    let off = false;
    const el = box.current;
    el.innerHTML = "";
    setBusy(true);
    (async () => {
      try {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = el.parentElement.clientWidth * 2;   // دقة تكفي للتكبير حتى 200% دون تشويش
        if (kind === "image") {
          const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
          if (off) return;
          const side = rot % 180 !== 0;
          const c = document.createElement("canvas");
          c.width = side ? img.naturalHeight : img.naturalWidth;
          c.height = side ? img.naturalWidth : img.naturalHeight;
          const ctx = c.getContext("2d");
          ctx.translate(c.width / 2, c.height / 2);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
          c.className = "block w-full rounded-sm2 bg-white shadow-card";
          el.appendChild(c);
        } else {
          if (!doc.current) {
            const pdfjs = await loadPdfjs();
            doc.current = await pdfjs.getDocument({ url, disableFontFace: true }).promise;
          }
          const file = doc.current;
          for (let i = 1; i <= Math.min(file.numPages, MAX_PAGES); i++) {
            const page = await file.getPage(i);
            if (off) return;
            const base = page.getViewport({ scale: 1, rotation: (page.rotate + rot) % 360 });
            const vp = page.getViewport({ scale: Math.min(width / base.width, 3) * ratio / 2, rotation: (page.rotate + rot) % 360 });
            const c = document.createElement("canvas");
            c.width = vp.width; c.height = vp.height;
            c.className = "block w-full rounded-sm2 bg-white shadow-card";
            c.setAttribute("aria-label", `الصفحة ${i}`);
            el.appendChild(c);
            await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
            if (i === 1 && !off) setBusy(false);
          }
          if (file.numPages > MAX_PAGES) {
            const p = document.createElement("p");
            p.className = "text-center text-xs text-muted";
            p.textContent = `عُرضت أول ${MAX_PAGES} صفحة من ${file.numPages}. نزّل الملف لعرضه كاملًا.`;
            el.appendChild(p);
          }
        }
        if (!off) setBusy(false);
      } catch {
        if (!off) { setErr("تعذّر عرض الملف. نزّله لفتحه على جهازك."); setBusy(false); }
      }
    })();
    return () => { off = true; };
  }, [url, kind, rot]);

  const btn = "grid h-8 min-w-8 place-items-center rounded-pill bg-white/15 px-2.5 text-sm font-semibold text-white hover:bg-white/25 disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={ev.title} onClick={onClose}>
      <div className="flex h-full max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-card bg-paper shadow-card" style={{ border: `3px solid ${color}` }} onClick={(e) => e.stopPropagation()}>
        <header className="flex flex-wrap items-center gap-2 px-3 py-2 text-white" style={{ background: color }}>
          <span className="num rounded-pill bg-white/20 px-2 py-0.5 text-xs font-bold">{ev.code}</span>
          <b className="min-w-0 flex-1 truncate text-sm">{ev.title}</b>
          {kind !== "other" && <>
            <button className={btn} disabled={z === 0} onClick={() => setZ(z - 1)} aria-label="تصغير">−</button>
            <span className="num w-12 text-center text-xs">{Math.round(ZOOMS[z] * 100)}%</span>
            <button className={btn} disabled={z === ZOOMS.length - 1} onClick={() => setZ(z + 1)} aria-label="تكبير">+</button>
            <button className={btn} onClick={() => setRot((r) => (r + 90) % 360)}>تدوير ↻</button>
          </>}
          {url && <a className={btn} href={url} target="_blank" rel="noreferrer" download>تنزيل</a>}
          <button className={btn} onClick={onClose} aria-label="إغلاق">✕</button>
        </header>
        <div className="flex-1 overflow-auto bg-canvas p-3">
          {busy && !err && <p className="py-6 text-center text-sm text-muted">جارٍ عرض الشاهد…</p>}
          {err && <p className="py-6 text-center text-sm text-absent">{err}</p>}
          {kind === "other" && url && <p className="py-6 text-center text-sm text-muted">هذا النوع من الملفات لا يُعرض داخل البوابة؛ نزّله من الزر أعلاه.</p>}
          <div ref={box} className="mx-auto grid gap-3" style={{ width: `${ZOOMS[z] * 100}%`, maxWidth: "none" }} />
        </div>
      </div>
    </div>
  );
}
