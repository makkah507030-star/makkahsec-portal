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

// أيقونات البطاقة بخط رفيع
const ICONS = {
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z",
  leaf: "M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  home: "M3.5 11 12 4l8.5 7M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-3-6-3-6 0M12 7c2-3 6-3 6 0",
};
const hijri = () => { try { return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date()); } catch { return ""; } };

export const CultCard = forwardRef(function CultCard({ c }, ref) {
  const p = PALETTES[c.pal] ?? PALETTES.mint;
  const len = (c.body ?? "").length;
  const fs = len > 300 ? 15.5 : len > 220 ? 17 : len > 140 ? 18 : 19.5;
  const pid = `cc-${c.pal}`;
  return (
    <div ref={ref} dir="rtl" style={{ width: W, height: H, color: p.deep, position: "relative", overflow: "hidden",
      background: `linear-gradient(165deg, ${p.bg} 0%, #FFFFFF 52%, ${p.bg} 100%)`,
      fontFamily: '"IBM Plex Sans Arabic", Tahoma, sans-serif', display: "flex", flexDirection: "column", padding: "34px 40px 30px" }}>
      {/* الزخرفة: نقش النجمة الثمانية خافتًا، ودوائر هادئة، وإطار داخلي رفيع */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden>
        <defs>
          <pattern id={pid} width="44" height="44" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={p.accent} strokeWidth="1">
              <rect x="13" y="13" width="18" height="18" />
              <rect x="13" y="13" width="18" height="18" transform="rotate(45 22 22)" />
              <circle cx="22" cy="22" r="3" />
            </g>
          </pattern>
          <radialGradient id={`${pid}-f`} cx="0" cy="0" r="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <mask id={`${pid}-m`}><rect width={W} height={H} fill="black" /><circle cx="0" cy="0" r="260" fill={`url(#${pid}-f)`} /></mask>
        </defs>
        <rect width={W} height={H} fill={`url(#${pid})`} opacity=".16" mask={`url(#${pid}-m)`} />
        <circle cx={W + 30} cy={H - 30} r={200} fill={p.soft} opacity=".75" />
        <circle cx={W - 80} cy={H - 130} r={74} fill="none" stroke={p.accent} strokeOpacity=".22" strokeWidth="1.5" />
        <circle cx={W - 80} cy={H - 130} r={92} fill="none" stroke={p.accent} strokeOpacity=".1" strokeWidth="1" strokeDasharray="2 6" />
        <rect x="14" y="14" width={W - 28} height={H - 28} rx="22" fill="none" stroke={p.accent} strokeOpacity=".22" strokeWidth="1.2" />
      </svg>

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,.07)" }}>
            <img src={iconMint} alt="" style={{ width: 28 }} />
          </div>
          <div style={{ lineHeight: 1.35 }}>
            <b style={{ display: "block", fontSize: 15.5, fontWeight: 700 }}>مدرسة مكة الثانوية</b>
            <span style={{ fontSize: 11.5, opacity: 0.7 }}>الثقافة المؤسسية · سفير الثقافة</span>
          </div>
        </div>
        <img src={moeLogo} alt="" style={{ height: 38, opacity: 0.9 }} />
      </div>

      {/* المحتوى في الوسط بسطور متوازنة: العنوان والاسم والنص تتوسط البطاقة وتتقارب أطوال سطورها */}
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <span style={{ width: 50, height: 50, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center",
          boxShadow: `0 0 0 6px ${p.soft}, 0 8px 16px -10px ${p.accent}` }}>
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke={p.accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[c.ic] ?? ICONS.star} /></svg>
        </span>
        <span style={{ marginTop: 14, color: p.accent, fontSize: 14.5, fontWeight: 700, letterSpacing: ".3px" }}>{c.chip}</span>
        {c.title && <h2 style={{ margin: "8px 0 0", fontSize: c.title.length > 18 ? 35 : 46, fontWeight: 700, lineHeight: 1.22, color: p.deep, textWrap: "balance" }}>{c.title}</h2>}
        {/* فاصل زخرفي متناظر: خطان ومعيّن */}
        <svg width="132" height="14" viewBox="0 0 132 14" style={{ margin: "14px 0 14px" }} aria-hidden>
          <line x1="4" y1="7" x2="22" y2="7" stroke={p.accent} strokeOpacity=".4" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="30" y1="7" x2="56" y2="7" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="61" y="2" width="10" height="10" transform="rotate(45 66 7)" fill={p.accent} />
          <line x1="76" y1="7" x2="102" y2="7" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="110" y1="7" x2="128" y2="7" stroke={p.accent} strokeOpacity=".4" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        {c.name && <p style={{ margin: "0 0 12px", lineHeight: 1.3 }}>
          <span style={{ display: "block", fontSize: 13, color: p.deep, opacity: 0.6 }}>إلى الأستاذ</span>
          <b style={{ display: "block", marginTop: 3, fontSize: 23, fontWeight: 700, color: p.accent }}>{c.name}</b></p>}
        {c.body && <p style={{ margin: 0, maxWidth: 420, fontSize: fs, lineHeight: 1.95, whiteSpace: "pre-line", textWrap: "balance" }}>{c.body}</p>}
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `1px solid ${p.accent}33`, paddingTop: 12 }}>
        <div style={{ lineHeight: 1.4 }}>
          <b style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>أسرة مدرسة مكة الثانوية</b>
          <span style={{ fontSize: 11.5, opacity: 0.65 }}>قيم نعيشها وتجسّد هويتنا المؤسسية</span>
        </div>
        <div style={{ textAlign: "left", lineHeight: 1.4 }}>
          <span style={{ display: "block", fontSize: 11.5, opacity: 0.65 }}>{hijri()}</span>
          <b dir="ltr" style={{ fontSize: 13.5, fontWeight: 700, color: p.accent }}>makkahsec.com</b>
        </div>
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
