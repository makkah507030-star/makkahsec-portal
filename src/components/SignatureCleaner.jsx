// src/components/SignatureCleaner.jsx
import { useEffect, useState } from "react";
import { cleanSignature, SIGNATURE_WEIGHTS } from "../lib/signatureClean.js";

/* =====================================================================
   نافذة تحسين التوقيع — تعرض الصورة الأصلية بجانب التوقيع بعد تنظيفه
   (أسود عريض على خلفية شفافة)، مع اختيار السماكة، ثم تُسلّم الملف
   المعالَج لـ onSave. المعالجة كلها في المتصفح.
   ===================================================================== */

// مربعات رمادية تُظهر أن الخلفية شفافة فعلًا
const CHECKER = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%)," +
    "linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

export default function SignatureCleaner({ file, onSave, onCancel, busy = false }) {
  const [weight, setWeight] = useState(1);
  const [result, setResult] = useState(null);   // { file, url }
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(true);
  const [origUrl, setOrigUrl] = useState(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setOrigUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    let alive = true, made = null;
    setWorking(true); setError(null);
    // مهلة قصيرة حتى تظهر حالة "جارٍ" قبل انشغال المتصفح بالمعالجة
    const t = setTimeout(async () => {
      try {
        const r = await cleanSignature(file, weight);
        made = r.url;
        if (alive) setResult(r); else URL.revokeObjectURL(r.url);
      } catch (e) {
        if (alive) { setResult(null); setError(e.message); }
      } finally {
        if (alive) setWorking(false);
      }
    }, 30);
    return () => { alive = false; clearTimeout(t); if (made) URL.revokeObjectURL(made); };
  }, [file, weight]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl2 bg-paper p-5 shadow-card">
        <h2 className="text-base font-bold text-ink">تحسين التوقيع</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أُزيلت الخلفية وصار الخط أسود. اختر السماكة المناسبة ثم احفظ.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <figure>
            <figcaption className="mb-1.5 text-xs text-muted">الصورة الأصلية</figcaption>
            <div className="grid h-40 place-items-center overflow-hidden rounded-card border border-line bg-canvas p-2">
              {origUrl && <img src={origUrl} alt="الأصل" className="max-h-full max-w-full object-contain" />}
            </div>
          </figure>
          <figure>
            <figcaption className="mb-1.5 text-xs text-muted">بعد التحسين</figcaption>
            <div className="grid h-40 place-items-center overflow-hidden rounded-card border border-line p-2" style={CHECKER}>
              {working
                ? <span className="text-xs text-muted">جارٍ المعالجة…</span>
                : result
                  ? <img src={result.url} alt="التوقيع المحسّن" className="max-h-full max-w-full object-contain" />
                  : <span className="px-3 text-center text-xs text-absent">{error}</span>}
            </div>
          </figure>
        </div>

        <div className="mt-4">
          <span className="text-xs text-muted">سماكة الخط</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SIGNATURE_WEIGHTS.map((w) => (
              <button key={w.key} type="button" disabled={working || busy}
                      onClick={() => setWeight(w.key)}
                      className={`rounded-pill border px-4 py-1.5 text-sm ${
                        weight === w.key ? "border-mint-deep bg-mint-tint font-semibold text-mint-deep"
                                         : "border-line text-ink hover:bg-canvas"}`}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
                  className="rounded-sm2 border border-line px-4 py-2 text-sm text-ink hover:bg-canvas">
            إلغاء
          </button>
          <button type="button" className="btn-primary" disabled={working || busy || !result}
                  onClick={() => result && onSave(result.file)}>
            {busy ? "جارٍ الحفظ…" : "حفظ التوقيع"}
          </button>
        </div>
      </div>
    </div>
  );
}
