// src/components/PrincipalSign.jsx
import { usePrincipalSignature } from "../lib/principalSignature";

/** مكان توقيع مدير المدرسة في الأوراق المطبوعة: صورة التوقيع المعتمد إن وُجدت، وإلا فراغ للتوقيع اليدوي */
export default function PrincipalSign({ height = "h-8" }) {
  const { url } = usePrincipalSignature();
  return (
    <div className={`${url ? "h-14" : height} flex items-end justify-center`}>
      {url && <img src={url} alt="" className="h-full w-auto max-w-[45mm] object-contain" />}
    </div>
  );
}
