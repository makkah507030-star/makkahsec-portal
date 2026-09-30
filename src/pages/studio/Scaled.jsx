// src/pages/studio/Scaled.jsx
import { useLayoutEffect, useRef, useState } from "react";

/* تصغير الورقة لعرض حاويتها */
export default function Scaled({ w, h, children, innerRef, shadow = true }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.3);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={box} className="w-full">
      <div className={`overflow-hidden rounded-card ${shadow ? "shadow-card ring-1 ring-line/60" : ""}`}
           style={{ height: h * scale, width: w * scale }}>
        <div ref={innerRef} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top right" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

