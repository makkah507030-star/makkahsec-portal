// src/pages/lab/LabScanner.jsx
// ماسح رموز QR بكاميرا الجوال الخلفية (jsQR، يعمل في iPhone وأندرويد). يستدعي onCode
// لكل رمز جديد، ولا يكرر الرمز نفسه قبل 4 ثوانٍ.
import { useEffect, useRef, useState } from "react";

export default function LabScanner({ onCode }) {
  const video = useRef(null);
  const cb = useRef(onCode);
  const [err, setErr] = useState(null);
  useEffect(() => { cb.current = onCode; }, [onCode]);

  useEffect(() => {
    let alive = true, timer, stream;
    const last = { text: "", at: 0 };
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        const tick = () => {
          if (!alive) return;
          const v = video.current;
          if (v?.readyState >= 2 && v.videoWidth) {
            const w = Math.min(720, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w);
            canvas.width = w; canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (r?.data && (r.data !== last.text || Date.now() - last.at > 4000)) {
              last.text = r.data; last.at = Date.now();
              cb.current(r.data);
            }
          }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        if (alive) setErr(e?.name === "NotAllowedError"
          ? "لم يُسمح باستخدام الكاميرا. اسمح بها من إعدادات المتصفح، أو امسح الرمز بكاميرا الجوال فيفتح رابط الرصد."
          : "تعذّر تشغيل الكاميرا: " + (e?.message ?? e));
      }
    })();
    return () => { alive = false; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  if (err) return <p className="rounded-card bg-danger-light px-3 py-3 text-sm text-absent">{err}</p>;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card bg-black">
      <video ref={video} playsInline muted className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-[15%] rounded-card border-4 border-white/80" />
    </div>
  );
}
