import { useState } from "react";

// سلايدر بسيط لصور المقال — بلا تقليب تلقائي، يتحكم به الزائر بنفسه.
export default function ArticleImageSlider({ images }) {
  const [idx, setIdx] = useState(0);

  if (!Array.isArray(images) || images.length === 0) return null;

  const go = (i) => setIdx((i + images.length) % images.length);

  return (
    <div className="mx-auto mt-7 max-w-md">
      <div className="relative overflow-hidden rounded-card border border-line bg-mint-tint">
        <img
          src={images[idx]}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />

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
    </div>
  );
}
