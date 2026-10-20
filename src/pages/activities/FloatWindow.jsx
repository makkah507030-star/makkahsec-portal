// src/pages/activities/FloatWindow.jsx
// نافذة عائمة للأنشطة فوق عرض الدرس: في Chrome وEdge تبقى فوق كل النوافذ (Document
// Picture-in-Picture)، وفي غيرهما نافذة صغيرة مستقلة يضعها المعلم حيث يشاء. المحتوى يُرسم
// فيها ببوابة React، فيبقى متصلًا بالصفحة (البيانات والجلسة) دون تحميل جديد.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// نسخ تنسيقات البوابة والخطوط إلى النافذة الجديدة (روابط الخطوط بعناوين كاملة)
function copyStyles(doc) {
  const abs = (css) => css.replace(/url\(\s*(['"]?)\//g, `url($1${location.origin}/`);
  for (const sheet of document.styleSheets) {
    try {
      const style = doc.createElement("style");
      style.textContent = abs([...sheet.cssRules].map((r) => r.cssText).join("\n"));
      doc.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet"; link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
}

export const canPin = () => typeof window !== "undefined" && "documentPictureInPicture" in window;

/** { win, open(title, w, h), close } — تُستدعى open من ضغطة زر */
export function useFloatWindow() {
  const [win, setWin] = useState(null);
  const cur = useRef(null);
  useEffect(() => { cur.current = win; }, [win]);

  const open = useCallback(async (title = "الأنشطة", width = 420, height = 620) => {
    let w = null;
    try {
      if (canPin()) w = await window.documentPictureInPicture.requestWindow({ width, height });
    } catch { w = null; }
    if (!w) w = window.open("", "mk-activities", `popup,width=${width},height=${height}`);
    if (!w) return false;   // منع المتصفح النوافذ المنبثقة
    const doc = w.document;
    doc.title = title;
    doc.documentElement.lang = "ar";
    doc.documentElement.dir = "rtl";
    doc.body.innerHTML = "";
    doc.head.querySelectorAll("style, link").forEach((n) => n.remove());   // النافذة المسمّاة قد تُعاد
    doc.body.style.margin = "0";
    doc.body.className = "bg-canvas";
    copyStyles(doc);
    const root = doc.createElement("div");
    doc.body.appendChild(root);
    // نافذة جديدة تُغلق السابقة؛ فلا يمحو إغلاقُ القديمة الجديدةَ
    w.addEventListener("pagehide", () => setWin((x) => (x?.root === root ? null : x)));
    setWin({ w, root });
    return true;
  }, []);

  const close = useCallback(() => setWin((x) => { try { x?.w.close(); } catch { /* */ } return null; }), []);
  // تُغلق عند مغادرة الصفحة فقط (النافذة المسمّاة نفسها تُعاد عند فتح بطاقة أخرى)
  useEffect(() => () => { try { cur.current?.w.close(); } catch { /* */ } }, []);
  return { win, open, close };
}

/** محتوى النافذة العائمة */
export function FloatPortal({ win, children }) {
  return win ? createPortal(<div dir="rtl" className="min-h-screen bg-canvas p-2 text-ink">{children}</div>, win.root) : null;
}
