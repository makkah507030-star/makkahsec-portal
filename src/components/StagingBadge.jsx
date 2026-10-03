// src/components/StagingBadge.jsx
import { useEffect } from "react";

// يظهر على الموقع التجريبي فقط (VITE_STAGING=1 في إعدادات Netlify له)،
// حتى لا يُخلط أبدًا بين النسخة التجريبية والبوابة الحقيقية.
export const IS_STAGING = import.meta.env.VITE_STAGING === "1";

export default function StagingBadge() {
  useEffect(() => {
    if (!IS_STAGING || document.querySelector('meta[name="robots"]')) return;
    document.title = `[تجريبي] ${document.title}`;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
  }, []);

  if (!IS_STAGING) return null;
  return (
    <div dir="rtl"
         className="no-print pointer-events-none fixed bottom-3 left-3 z-[100] rounded-pill bg-warning px-3 py-1.5 text-xs font-bold text-white shadow-card">
      نسخة تجريبية — بيانات وهمية
    </div>
  );
}
