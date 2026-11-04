// src/components/MobileCards.jsx
// جدول يصير بطاقات على الجوال (أقل من 640 بكسل): كل صف بطاقة، وكل خلية سطر يبدأ باسم عمودها،
// فلا يُسحب الجدول أفقيًا وتختفي أعمدته. على الحاسب والطباعة يبقى الجدول كما هو.
// يكفي أن يُلف الجدول به: يقرأ أسماء الأعمدة من رأسه ويضعها على خلايا كل صف (data-l)، ويتابع تغيّر الصفوف.
// أول عمود له اسم (غير الرقم التسلسلي) عنوان البطاقة، والخلية بلا اسم عمود (كأزرار الإجراء) تبقى بلا عنوان.
import { useLayoutEffect, useRef } from "react";

const SEQ = new Set(["م", "#", "ر", "الرقم"]);
const set = (c, k, v) => { if (v == null) { if (c.hasAttribute(k)) c.removeAttribute(k); } else if (c.getAttribute(k) !== v) c.setAttribute(k, v); };

function label(root) {
  root.querySelectorAll("table").forEach((t) => {
    const heads = [...(t.tHead?.rows[t.tHead.rows.length - 1]?.cells ?? [])].map((c) => c.textContent.trim());
    [...t.tBodies].forEach((b) => [...b.rows].forEach((r) => {
      let i = 0, titled = false;
      [...r.cells].forEach((c) => {
        const h = heads[i] ?? "";
        const seq = SEQ.has(h);   // الرقم التسلسلي لا يلزم في البطاقة
        const title = !titled && !seq && !!h && (c.colSpan || 1) === 1;   // أول عمود له اسم: عنوان البطاقة
        if (title) titled = true;
        set(c, "data-l", h && !title && !seq ? h : null);
        set(c, "data-t", title ? "1" : null);
        set(c, "data-seq", seq ? "1" : null);
        i += c.colSpan || 1;
      });
    }));
  });
}

export default function MobileCards({ className = "", children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    label(el);
    const mo = new MutationObserver(() => label(el));
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref} className={`m-cards ${className}`}>{children}</div>;
}
