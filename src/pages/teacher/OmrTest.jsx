// src/pages/teacher/OmrTest.jsx
import { useEffect, useRef, useState } from "react";

/* =====================================================================
   أداة تجربة قراءة بطاقة التظليل.
   الغرض منها التحقّق قبل بناء النظام الكامل: هل تُقرأ بطاقة ورقنا
   بدقة من كاميرا الجوال؟ وما الحدّ الفاصل بين المظلَّل والفارغ؟

   المعالجة كلها داخل المتصفح — لا تُرفع الصورة لأي خادم.

   المراحل: تحويل للرمادي ← عتبة ← كشف العلامات المرجعية الأربع ←
            تصحيح المنظور ← قياس شدّة كل دائرة ← الحكم.
   ===================================================================== */

const W = 520;   // عرض البطاقة بعد التصحيح (بكسل)
const H = 900;

export default function OmrTest() {
  const [img, setImg] = useState(null);
  const [stage, setStage] = useState("idle");
  const [marks, setMarks] = useState(null);
  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState(4);
  const [rowCount, setRowCount] = useState(10);
  const [threshold, setThreshold] = useState(45);
  const [log, setLog] = useState([]);

  const srcRef = useRef(null);
  const outRef = useRef(null);

  const say = (t) => setLog((l) => [...l, t]);

  const onFile = (file) => {
    if (!file) return;
    setLog([]); setMarks(null); setRows([]);
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => { setImg(im); setStage("loaded"); say(`الصورة: ${im.width}×${im.height}`); };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  };

  /* ——— ① كشف العلامات المرجعية: أكبر أربع كتل سوداء في الأركان ——— */
  const findMarks = (data, w, h) => {
    const dark = (x, y) => {
      const i = (y * w + x) * 4;
      return (data[i] + data[i + 1] + data[i + 2]) / 3 < 110;
    };

    // يفحص كل ربع من الصورة ويبحث عن مركز أغمق تجمّع
    const quad = (x0, y0, x1, y1) => {
      let sx = 0, sy = 0, n = 0;
      const step = Math.max(1, Math.floor(Math.min(w, h) / 400));
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          if (dark(x, y)) { sx += x; sy += y; n++; }
        }
      }
      return n > 20 ? { x: sx / n, y: sy / n, n } : null;
    };

    const mx = Math.floor(w * 0.42), my = Math.floor(h * 0.42);
    const tl = quad(0, 0, mx, my);
    const tr = quad(w - mx, 0, w, my);
    const bl = quad(0, h - my, mx, h);
    const br = quad(w - mx, h - my, w, h);
    return { tl, tr, bl, br };
  };

  /* ——— ② تصحيح المنظور: أربع نقاط إلى مستطيل ——— */
  const warp = (im, pts) => {
    const c = outRef.current;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });

    // تقسيم إلى شرائح أفقية لتقريب التحويل بلا مكتبة خارجية
    const N = 120;
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const l0 = lerp(pts.tl, pts.bl, t0), r0 = lerp(pts.tr, pts.br, t0);
      const l1 = lerp(pts.tl, pts.bl, t1), r1 = lerp(pts.tr, pts.br, t1);

      // شريحة مصدر تقريبية
      const sx = Math.min(l0.x, l1.x);
      const sy = Math.min(l0.y, r0.y);
      const sw = Math.max(r0.x, r1.x) - sx;
      const sh = Math.max(l1.y, r1.y) - sy;
      if (sw <= 0 || sh <= 0) continue;

      ctx.drawImage(im, sx, sy, sw, sh, 0, (H * i) / N, W, H / N + 1);
    }
    return ctx;
  };

  /* ——— ③ قياس شدّة التظليل لكل دائرة ——— */
  const readBubbles = (ctx) => {
    const d = ctx.getImageData(0, 0, W, H).data;
    const padTop = 0.10, padBottom = 0.06, padStart = 0.16, padEnd = 0.06;

    const y0 = H * padTop, y1 = H * (1 - padBottom);
    const x0 = W * padStart, x1 = W * (1 - padEnd);
    const rowH = (y1 - y0) / rowCount;
    const colW = (x1 - x0) / cols;
    const rad = Math.min(rowH, colW) * 0.32;

    const out = [];
    for (let r = 0; r < rowCount; r++) {
      const cy = y0 + rowH * (r + 0.5);
      const vals = [];
      for (let c = 0; c < cols; c++) {
        const cx = x0 + colW * (c + 0.5);
        let dark = 0, total = 0;
        for (let y = cy - rad; y <= cy + rad; y++) {
          for (let x = cx - rad; x <= cx + rad; x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
            const i = ((y | 0) * W + (x | 0)) * 4;
            const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
            total++;
            if (v < 140) dark++;
          }
        }
        vals.push(total ? Math.round((dark / total) * 100) : 0);

        // رسم دائرة القياس للمعاينة
        ctx.strokeStyle = "#3E6350";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }

      const max = Math.max(...vals);
      const second = [...vals].sort((a, b) => b - a)[1] ?? 0;
      const idx = vals.indexOf(max);

      let verdict, tone;
      if (max < threshold) { verdict = "لا تظليل"; tone = "warn"; }
      else if (max - second < 12) { verdict = "تظليل مزدوج أو ملتبس"; tone = "bad"; }
      else if (max < threshold + 15) { verdict = "تظليل باهت"; tone = "warn"; }
      else { verdict = `الخيار ${["أ", "ب", "ج", "د", "هـ"][idx]}`; tone = "ok"; }

      out.push({ n: r + 1, vals, max, second, verdict, tone });
    }
    return out;
  };

  const run = () => {
    if (!img) return;
    setStage("working"); setLog([]);

    const c = srcRef.current;
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);

    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const m = findMarks(d, c.width, c.height);
    setMarks(m);

    const missing = Object.entries(m).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      say(`تعذّر كشف ${missing.length} علامة مرجعية — صوّر البطاقة كاملة بإضاءة متساوية.`);
      setStage("loaded");
      return;
    }
    say("كُشفت العلامات المرجعية الأربع ✓");

    const wctx = warp(c, m);
    say("صُحّح المنظور ✓");

    const res = readBubbles(wctx);
    setRows(res);
    say(`قُرئ ${res.length} صفًّا.`);
    setStage("done");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">تجربة قراءة بطاقة التظليل</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أداة تحقّق قبل تشغيل التصحيح الآلي: صوّر بطاقة الإجابة، فتعرض لك
          ما قرأه النظام من كل دائرة ونسبة تظليلها. والمعالجة داخل جهازك، ولا تُرفع الصورة.
        </p>
      </div>

      <section className="card space-y-3 p-4">
        <div>
          <label className="text-xs text-muted">صورة بطاقة الإجابة</label>
          <input type="file" accept="image/*" capture="environment"
                 className="mt-1 block w-full text-sm"
                 onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted">عدد الأسئلة في البطاقة</label>
            <input className="field num mt-1 w-full" inputMode="numeric" value={rowCount}
                   onChange={(e) => setRowCount(Number(e.target.value.replace(/\D/g, "")) || 1)} />
          </div>
          <div>
            <label className="text-xs text-muted">عدد الخيارات</label>
            <input className="field num mt-1 w-full" inputMode="numeric" value={cols}
                   onChange={(e) => setCols(Number(e.target.value.replace(/\D/g, "")) || 2)} />
          </div>
          <div>
            <label className="text-xs text-muted">
              حدّ التظليل <span className="num">({threshold}%)</span>
            </label>
            <input type="range" min={20} max={80} value={threshold} className="mt-3 w-full"
                   onChange={(e) => setThreshold(Number(e.target.value))} />
          </div>
        </div>

        <button className="btn-primary w-full" onClick={run} disabled={!img || stage === "working"}>
          {stage === "working" ? "جارٍ القراءة…" : "اقرأ البطاقة"}
        </button>
      </section>

      {log.length > 0 && (
        <section className="card p-4">
          <p className="text-xs font-semibold text-faint">سجل المعالجة</p>
          <ul className="mt-1.5 space-y-0.5">
            {log.map((l, i) => (
              <li key={i} className="text-xs text-muted">• {l}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card overflow-hidden p-3">
          <p className="mb-2 text-xs font-semibold text-faint">الصورة كما وصلت</p>
          <canvas ref={srcRef} className="w-full rounded-sm2 border border-line" />
        </section>
        <section className="card overflow-hidden p-3">
          <p className="mb-2 text-xs font-semibold text-faint">
            بعد التصحيح — الدوائر الخضراء مواضع القياس
          </p>
          <canvas ref={outRef} className="w-full rounded-sm2 border border-line" />
        </section>
      </div>

      {rows.length > 0 && (
        <section className="card overflow-hidden">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            نتيجة القراءة
          </p>
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.n} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="num w-6 shrink-0 text-sm font-bold text-muted">{r.n}</span>
                <div className="flex shrink-0 gap-1">
                  {r.vals.map((v, i) => (
                    <span key={i}
                      className={`num grid h-9 w-9 place-items-center rounded-full border text-[11px] ${
                        v === r.max && v >= threshold
                          ? "border-mint-deep bg-mint-deep text-white"
                          : "border-line text-muted"}`}>
                      {v}
                    </span>
                  ))}
                </div>
                <span className={`chip mr-auto shrink-0 ${
                  r.tone === "ok" ? "bg-present/10 text-present"
                  : r.tone === "warn" ? "bg-warning/10 text-warning"
                  : "bg-absent/10 text-absent"}`}>
                  {r.verdict}
                </span>
              </div>
            ))}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-muted">
            الأرقام داخل الدوائر نسبة التظليل. والمطلوب فارق واضح بين المظلَّلة والفارغة:
            المظلَّلة فوق <span className="num">{threshold}%</span> والفارغة تحت
            <span className="num"> 20%</span>. إن تقاربت، اضبط الحدّ أعلاه أو حسّن الإضاءة.
          </p>
        </section>
      )}
    </div>
  );
}
