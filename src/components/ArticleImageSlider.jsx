import { useEffect, useState } from "react";

// سلايدر بسيط لصور المقال — بلا تقليب تلقائي، يتحكم به الزائر بنفسه.
// الصورة تظهر مصغّرة كاملة بلا قصّ داخل إطار ثابت، وبالضغط عليها تُفتح بحجمها الأصلي.
export default function ArticleImageSlider({ images }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === "Escape") setZoom(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  if (!Array.isArray(images) || images.length === 0) return null;

  const go = (i) => setIdx((i + images.length) % images.length);

  return (
    <div className="mx-auto mt-7 max-w-md">
      <div className="relative overflow-hidden rounded-card border border-line bg-mint-tint">
        <button type="button" onClick={() => setZoom(true)} aria-label="عرض الصورة بحجمها الأصلي"
                className="block w-full cursor-zoom-in">
          <img
            src={images[idx]}
            alt=""
            className="aspect-[4/3] w-full object-contain"
          />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(idx - 1)}
              aria-label="الصورة السابقة"
              className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-sm text-ink shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(idx + 1)}
              aria-label="الصورة التالية"
              className="absolute top-1/2 left-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-sm text-ink shadow hover:bg-white"
            >
              ›
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`الصورة ${i + 1}`}
              className={`h-1.5 rounded-pill transition-all ${
                i === idx ? "w-5 bg-mint-deep" : "w-1.5 bg-[#CCF2DB] hover:bg-[#89D7AD]"
              }`}
            />
          ))}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
             onClick={() => setZoom(false)}>
          <img src={images[idx]} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
