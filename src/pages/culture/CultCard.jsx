// src/pages/culture/CultCard.jsx
import { forwardRef, useEffect, useRef, useState } from "react";
import { PALETTES, cardInit } from "../../lib/culture.js";
import iconMint from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

/* =====================================================================
   بطاقات الثقافة المؤسسية بهوية البوابة: يصممها السفير من القسم نفسه ويرسلها صورةً في واتساب،
   إلى قروب العمل أو على الخاص، دون الانتقال إلى الاستوديو.
   البطاقة 540×675 (4:5) وتُصدَّر 1080×1350.
   ===================================================================== */

const W = 540, H = 675;
const waNumber = (m) => {
  const d = String(m ?? "").replace(/\D/g, "");
  return d.startsWith("05") ? `966${d.slice(1)}` : d.startsWith("5") ? `966${d}` : d;
};

const hijri = () => { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date()); } catch { return ""; } };

export const CultCard = forwardRef(function CultCard({ c }, ref) {
  const p = PALETTES[c.pal] ?? PALETTES.mint;
  const len = (c.body ?? "").length;
  const fs = len > 300 ? 15.5 : len > 220 ? 17 : len > 140 ? 18.5 : 20;
  return (
    <div ref={ref} dir="rtl" style={{ width: W, height: H, background: p.bg, color: p.deep, position: "relative", overflow: "hidden",
      fontFamily: '"IBM Plex Sans Arabic", Tahoma, sans-serif', display: "flex", flexDirection: "column", padding: "30px 36px 26px" }}>
      {/* زخرفة: دوائر هادئة بلون البطاقة */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden>
        <circle cx={W + 20} cy={H - 40} r={190} fill={p.soft} />
        <circle cx={-40} cy={150} r={120} fill={p.soft} opacity=".7" />
        <circle cx={60} cy={H - 70} r={14} fill={p.accent} opacity=".18" />
        <circle cx={95} cy={H - 40} r={7} fill={p.accent} opacity=".3" />
        {Array.from({ length: 4 }, (_, i) => <circle key={i} cx={W - 40} cy={40} r={30 + i * 22} fill="none" stroke={p.accent} strokeOpacity={0.14 - i * 0.025} strokeWidth="1.5" />)}
      </svg>

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <img src={iconMint} alt="" style={{ width: 30 }} />
          </div>
          <div style={{ lineHeight: 1.35 }}>
            <b style={{ display: "block", fontSize: 16, fontWeight: 700 }}>مدرسة مكة الثانوية</b>
            <span style={{ fontSize: 12, opacity: 0.75 }}>الثقافة المؤسسية · سفير الثقافة</span>
          </div>
        </div>
        <img src={moeLogo} alt="" style={{ height: 40, opacity: 0.9 }} />
      </div>

      {/* المحتوى محاذى من اليمين بسطور متوازنة الطول */}
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 10 }}>
        <div style={{ position: "relative" }}>
        <span style={{ alignSelf: "flex-start", background: p.accent, color: "#fff", borderRadius: 99, padding: "5px 16px", fontSize: 14, fontWeight: 700 }}>{c.chip}</span>
        {c.title && <h2 style={{ margin: "16px 0 0", fontSize: c.title.length > 18 ? 34 : 44, fontWeight: 700, lineHeight: 1.25, color: p.deep }}>{c.title}</h2>}
        {c.name && <p style={{ margin: "10px 0 0", fontSize: 21, fontWeight: 600, color: p.accent }}>الأستاذ / {c.name}</p>}
        </div>
        <span style={{ display: "block", width: 64, height: 5, borderRadius: 9, background: p.accent, margin: "18px 0 16px" }} />
        {c.body && <p style={{ margin: 0, fontSize: fs, lineHeight: 1.9, whiteSpace: "pre-line", textAlign: "right", textWrap: "balance" }}>{c.body}</p>}
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.8)",
        borderRadius: 16, padding: "9px 18px", fontSize: 14 }}>
        <b style={{ fontWeight: 700 }}>أسرة مدرسة مكة الثانوية</b>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, opacity: 0.7 }}>{hijri()}</span>
          <i style={{ width: 4, height: 4, borderRadius: 9, background: p.accent, opacity: 0.5 }} />
          <span dir="ltr" style={{ fontWeight: 600, color: p.accent }}>makkahsec.com</span>
        </span>
      </div>
    </div>
  );
});

/** نافذة البطاقة: init = { kind, sub, name, mobile, title?, body? } */
export function CardMaker({ init, onClose }) {
  const base = cardInit(init.kind, init.sub, init.name);
  const [c, setC] = useState({ ...base, name: init.name ?? "", title: init.title ?? base.title, body: init.body ?? base.body });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const card = useRef(null);
  const box = useRef(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (box.current?.offsetWidth ?? 324) / W));
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, []);
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const caption = [c.title, c.name ? `الأستاذ / ${c.name}` : "", "سفير الثقافة المؤسسية · مدرسة مكة الثانوية"].filter(Boolean).join("\n");
  const fileName = `makkahsec-culture-${Date.now()}.png`;

  const blob = async () => {
    const { toBlob } = await import("html-to-image");
    await document.fonts?.ready;
    const opts = { pixelRatio: 2, cacheBust: true, width: W, height: H };
    await toBlob(card.current, opts); // Safari يرسم الصور المضمّنة في المرة الثانية فقط
    return toBlob(card.current, opts);
  };
  const download = (b) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
  };
  // واتساب: في الجوال تُفتح قائمة المشاركة فيُختار قروب العمل أو أي محادثة؛ وفي الحاسب تُنزَّل الصورة ويُفتح واتساب
  const share = async () => {
    setBusy("wa"); setMsg("");
    try {
      const b = await blob();
      const file = new File([b], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.clipboard.writeText(caption); } catch { /* النسخ اختياري */ }
        await navigator.share({ files: [file], text: caption });
      } else {
        download(b);
        window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank", "noopener");
        setMsg("نُزّلت البطاقة؛ اختر قروب العمل أو المحادثة في واتساب وأرفقها.");
      }
    } catch (e) { if (e?.name !== "AbortError") setMsg("تعذّرت المشاركة. جرّب مرة أخرى."); }
    setBusy("");
  };
  // على الخاص برقمه: تُحفظ الصورة وتُفتح محادثته بالنص، ثم تُرفق الصورة
  const privateChat = async () => {
    setBusy("pv"); setMsg("");
    try {
      const b = await blob(); download(b);
      window.open(`https://api.whatsapp.com/send?phone=${waNumber(init.mobile)}&text=${encodeURIComponent(caption)}`, "_blank", "noopener");
      setMsg("حُفظت البطاقة وفُتحت محادثته؛ أرفق الصورة فيها.");
    } catch { setMsg("تعذّر حفظ البطاقة."); }
    setBusy("");
  };
  const save = async () => { setBusy("dl"); try { download(await blob()); } catch { setMsg("تعذّر حفظ البطاقة."); } setBusy(""); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-card bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">بطاقة {c.chip}</h2>
          <button className="text-xs text-muted" onClick={onClose}>إغلاق</button>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_340px]">
          <div className="space-y-2">
            <label className="block text-[11.5px] text-muted">العنوان<input className="field mt-1 w-full text-sm" maxLength={40} value={c.title} onChange={set("title")} /></label>
            <label className="block text-[11.5px] text-muted">اسم الزميل (اختياري)<input className="field mt-1 w-full text-sm" maxLength={40} value={c.name} onChange={set("name")} /></label>
            <label className="block text-[11.5px] text-muted">النص<textarea className="field mt-1 min-h-[120px] w-full text-sm" maxLength={380} value={c.body} onChange={set("body")} /></label>
            <div>
              <p className="mb-1 text-[11.5px] text-muted">لون البطاقة</p>
              <div className="flex flex-wrap gap-2">{Object.entries(PALETTES).map(([k, p]) => (
                <button key={k} title={p.t} onClick={() => setC({ ...c, pal: k })}
                  className={`flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] ${c.pal === k ? "border-ink text-ink" : "border-line text-muted"}`}>
                  <i className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: p.accent, boxShadow: `0 0 0 3px ${p.soft}` }} />{p.t}
                </button>))}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button className="rounded-pill bg-[#25D366] px-4 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={!!busy} onClick={share}>{busy === "wa" ? "…" : "إرسال في واتساب (قروب أو محادثة)"}</button>
              {init.mobile && <button className="rounded-pill border border-[#25D366] px-4 py-2 text-xs font-bold text-[#128C7E] disabled:opacity-60" disabled={!!busy} onClick={privateChat}>{busy === "pv" ? "…" : `على الخاص: ${init.name?.split(" ")[0] ?? ""}`}</button>}
              <button className="btn-ghost px-4 py-2 text-xs" disabled={!!busy} onClick={save}>{busy === "dl" ? "…" : "حفظ الصورة"}</button>
            </div>
            {msg && <p className="text-[11.5px] text-mint-deep">{msg}</p>}
          </div>
          <div ref={box} className="w-full max-w-[340px] justify-self-center">
            <div style={{ width: W * scale, height: H * scale, overflow: "hidden", borderRadius: 14, boxShadow: "0 8px 24px -14px rgba(0,0,0,.4)" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: W, height: H, marginInlineStart: 0 }}>
                <CultCard ref={card} c={c} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** معاينة قبل الإرسال: البطاقة كما تبدو، ونص الإشعار كما يصل الجرس والجوال، ومن يستلمه، ثم التأكيد.
 *  card = قالب CultCard، notif = { title, body }، to = نص المستلمين */
export function SendPreview({ card, notif, to, busy, onConfirm, onClose }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const fit = () => setScale(Math.min(0.62, (box.current?.offsetWidth ?? 300) / W));
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => { const esc = (e) => e.key === "Escape" && !busy && onClose(); window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [busy, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:items-center" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-3xl rounded-card bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">معاينة قبل الإرسال</h2>
          <button className="text-xs text-muted" disabled={busy} onClick={onClose}>إغلاق</button>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11.5px] font-semibold text-muted">المستلم</p>
              <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm font-semibold text-ink">{to}</p>
            </div>
            <div>
              <p className="mb-1 text-[11.5px] font-semibold text-muted">الإشعار كما يصل الجرس والجوال</p>
              <div className="flex gap-3 rounded-card border border-line bg-white p-3 shadow-card">
                <img src={iconMint} alt="" className="h-9 w-9 shrink-0 rounded-sm2 bg-mint-tint p-1.5" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink">{notif.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{notif.body}</p>
                </div>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-faint">راجع الاسم والنص جيدًا: الإشعار يصل فور التأكيد ولا يُسترجع. والبطاقة المجاورة هي صورته لواتساب إن أردت إرسالها أيضًا.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary px-5 py-2 text-xs" disabled={busy} onClick={onConfirm}>{busy ? "جارٍ الإرسال…" : "تأكيد الإرسال"}</button>
              <button className="btn-ghost px-4 py-2 text-xs" disabled={busy} onClick={onClose}>رجوع للتعديل</button>
            </div>
          </div>
          <div ref={box} className="mx-auto w-full max-w-[300px]">
            <div style={{ width: W * scale, height: H * scale, overflow: "hidden", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top right" }}><CultCard c={card} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
