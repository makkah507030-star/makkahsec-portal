// src/components/PageIntro.jsx
// شرح الصفحة تحت عنوانها: سطران فقط، و«اقرأ المزيد» لمن يريد الشرح كاملًا،
// فلا تبدأ الصفحة بفقرة طويلة يتجاوزها المستعجل. يظهر الزر حين يزيد النص على سطرين فقط.
import { useLayoutEffect, useRef, useState } from "react";

export default function PageIntro({ className = "", children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 2);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [children]);
  return (
    <div>
      <p ref={ref} className={`${className} ${open ? "" : "line-clamp-2"}`}>{children}</p>
      {(long || open) && (
        <button type="button" data-ro-ok onClick={() => setOpen((v) => !v)}
                className="no-print mt-0.5 text-[12px] font-semibold text-mint-deep hover:underline">
          {open ? "إخفاء الشرح" : "اقرأ المزيد"}
        </button>
      )}
    </div>
  );
}
