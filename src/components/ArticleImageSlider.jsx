import { useCallback, useEffect, useRef, useState } from "react";

// معرض صور المقال.
// - الصورة تظهر كاملة بلا قصّ داخل إطار تتكيّف نسبته مع الصورة (بين 9:10 و16:9)،
//   والفراغ حولها خلفية ضبابية من الصورة نفسها بدل أشرطة فارغة.
// - شريط مصغّرات للتنقل، وسحب بالإصبع، وأسهم تراعي اتجاه RTL.
// - الضغط على الصورة يفتحها ملء الشاشة، وفيها تبديل بين «ملاءمة الشاشة» و«الحجم الأصلي».
const MIN_RATIO = 0.9;
const MAX_RATIO = 16 / 9;
const SWIPE_PX = 48;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function Arrow({ dir, onClick, className = "" }) {
  // في RTL: «السابقة» يمين الشاشة و«التالية» يسارها
  const prev = dir === "prev";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={prev ? "الصورة السابقة" : "الصورة التالية"}
      className={`grid h-9 w-9 place-items-center rounded-full bg-white/90 text-lg leading-none text-ink shadow transition-colors hover:bg-white ${className}`}
    >
      {prev ? "›" : "‹"}
    </button>
  );
}

function Lightbox({ images, idx, setIdx, onClose }) {
  const [full, setFull] = useState(false);
  const touchX = useRef(null);
  const n = images.length;

  const go = useCallback((i) => { setFull(false); setIdx((i + n) % n); }, [n, setIdx]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      // في RTL السهم الأيمن = السابقة
      else if (e.key === "ArrowRight") go(idx - 1);
      else if (e.key === "ArrowLeft") go(idx + 1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [idx, go, onClose]);

  const onTouchEnd = (e) => {
    if (touchX.current == null || full) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_PX && n > 1) go(dx > 0 ? idx - 1 : idx + 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="عرض الصورة"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span dir="ltr" className="text-sm tabular-nums opacity-80">{idx + 1} / {n}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFull((v) => !v)}
                  className="rounded-pill bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25">
            {full ? "ملاءمة الشاشة" : "الحجم الأصلي"}
          </button>
          <button type="button" onClick={onClose} aria-label="إغلاق"
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-lg leading-none hover:bg-white/25">
            ×
          </button>
        </div>
      </div>

      <div
        className={`relative min-h-0 flex-1 ${full ? "overflow-auto" : "flex items-center justify-center overflow-hidden"}`}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[idx]}
          alt=""
          onClick={(e) => { e.stopPropagation(); setFull((v) => !v); }}
          className={full
            ? "mx-auto block max-w-none cursor-zoom-out"
            : "max-h-full max-w-full cursor-zoom-in object-contain px-2 pb-3"}
        />
        {n > 1 && !full && (
          <>
            <Arrow dir="prev" onClick={() => go(idx - 1)} className="absolute top-1/2 right-3 -translate-y-1/2" />
            <Arrow dir="next" onClick={() => go(idx + 1)} className="absolute top-1/2 left-3 -translate-y-1/2" />
          </>
        )}
      </div>
    </div>
  );
}

export default function ArticleImageSlider({ images }) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [ratios, setRatios] = useState({});
  const touchX = useRef(null);

  const list = Array.isArray(images) ? images : [];
  const n = list.length;
  const i = Math.min(idx, Math.max(n - 1, 0));

  // تحميل مسبق للصورتين المجاورتين كي يكون التنقل فوريًا
  useEffect(() => {
    [i - 1, i + 1].forEach((k) => {
      const u = list[(k + n) % n];
      if (u && n > 1) new Image().src = u;
    });
  }, [i, n]); // eslint-disable-line react-hooks/exhaustive-deps

  if (n === 0) return null;

  const go = (k) => setIdx((k + n) % n);
  const src = list[i];
  const ratio = clamp(ratios[src] ?? 4 / 3, MIN_RATIO, MAX_RATIO);

  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_PX && n > 1) go(dx > 0 ? i - 1 : i + 1);
  };

  return (
    <figure className="mx-auto mt-7 max-w-xl">
      <div
        className="relative w-full overflow-hidden rounded-card border border-line bg-[#0b1f3a]"
        style={{ aspectRatio: ratio, transition: "aspect-ratio .25s ease" }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={onTouchEnd}
      >
        {/* خلفية ضبابية من الصورة نفسها تملأ ما حول الصورة الكاملة */}
        <img src={src} alt="" aria-hidden="true"
             className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl" />

        <button type="button" onClick={() => setOpen(true)} aria-label="عرض الصورة بحجم أكبر"
                className="absolute inset-0 block cursor-zoom-in">
          <img
            key={src}
            src={src}
            alt=""
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w && h) setRatios((r) => (r[src] ? r : { ...r, [src]: w / h }));
            }}
            className="relative h-full w-full object-contain"
          />
        </button>

        <span aria-hidden="true"
              className="pointer-events-none absolute top-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-sm text-white">
          ⤢
        </span>

        {n > 1 && (
          <>
            <Arrow dir="prev" onClick={() => go(i - 1)} className="absolute top-1/2 right-2 -translate-y-1/2" />
            <Arrow dir="next" onClick={() => go(i + 1)} className="absolute top-1/2 left-2 -translate-y-1/2" />
            <span dir="ltr" className="pointer-events-none absolute top-2 right-2 rounded-pill bg-black/55 px-2.5 py-1 text-[11px] tabular-nums text-white">
              {i + 1} / {n}
            </span>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="mt-2.5 flex justify-center gap-2">
          {list.map((u, k) => (
            <button
              key={u + k}
              type="button"
              onClick={() => setIdx(k)}
              aria-label={`الصورة ${k + 1}`}
              aria-current={k === i}
              className={`h-12 w-16 overflow-hidden rounded-sm2 border-2 transition-opacity ${
                k === i ? "border-mint-deep" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && <Lightbox images={list} idx={i} setIdx={setIdx} onClose={() => setOpen(false)} />}
    </figure>
  );
}
