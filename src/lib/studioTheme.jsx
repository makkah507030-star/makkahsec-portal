// src/lib/studioTheme.js
/* =====================================================================
   ألوان هوية استوديو البوابة (studio/studio.css: .stu-light و.stu-dark) لبطاقات الواجهة:
   بطاقة الطالب وإعلانات الرئيسية. الاختيار فاتح/غامق واحد للبطاقات كلها، يُحفظ في الجهاز
   ويتزامن بين البطاقات المفتوحة في الصفحة.
   ===================================================================== */
import { useEffect, useState } from "react";
import iconMint from "../assets/icon-mint.png";
import iconWhite from "../assets/icon-white.png";

export const STUDIO = {
  light: { bg: "radial-gradient(ellipse 90% 55% at 95% 0%, #DDF3E6 0%, transparent 60%), linear-gradient(160deg, #F2FAF5 0%, #F8FBF9 45%, #EDF6F0 100%)",
           lines: "rgba(62,99,80,.05)", shape: "rgba(62,99,80,.08)", blob: "rgba(137,215,173,.45)", border: "#D5E7DC",
           text: "#1C3328", sub: "#5E7268", accent: "#3E8A62", gold: "#B8912F", pill: "rgba(255,255,255,.85)", pillB: "#D5E7DC",
           disc: "#3E8A62", discT: "#FFFFFF", logo: iconMint },
  dark:  { bg: "radial-gradient(ellipse 90% 55% at 95% 0%, #2f5240 0%, transparent 60%), linear-gradient(160deg, #284836 0%, #193326 42%, #12261c 72%, #0e1f17 100%)",
           lines: "rgba(255,255,255,.035)", shape: "rgba(120,170,140,.16)", blob: "rgba(96,150,118,.35)", border: "rgba(255,255,255,.14)",
           text: "#FFFFFF", sub: "#A9BCB1", accent: "#89D7AD", gold: "#D9B45A", pill: "rgba(255,255,255,.07)", pillB: "rgba(255,255,255,.22)",
           disc: "#89D7AD", discT: "#193326", logo: iconWhite },
};

const KEY = "student.card";
const read = () => { try { return localStorage.getItem(KEY) === "dark" ? "dark" : "light"; } catch { return "light"; } };

/* [الوضع، ألوانه، التبديل] — يتزامن بين البطاقات في الصفحة */
export function useStudioTheme() {
  const [mode, setMode] = useState(read);
  useEffect(() => {
    const on = () => setMode(read());
    window.addEventListener("studio-theme", on);
    return () => window.removeEventListener("studio-theme", on);
  }, []);
  const flip = () => {
    try { localStorage.setItem(KEY, mode === "dark" ? "light" : "dark"); } catch { /* لا شيء */ }
    setMode(mode === "dark" ? "light" : "dark");
    window.dispatchEvent(new Event("studio-theme"));
  };
  return [mode, STUDIO[mode], flip];
}

/* زخارف الهوية خلف المحتوى: خطوط مائلة، وهالة، ومكعبان */
export function StudioDecor({ t }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(135deg, ${t.lines} 0 1.5px, transparent 1.5px 22px)` }} />
      <div className="absolute h-56 w-56 rounded-full" style={{ background: t.blob, filter: "blur(60px)", left: 30, top: 10 }} />
      <div className="absolute h-44 w-44 rounded-[34px]" style={{ background: t.shape, transform: "rotate(32deg) skewX(-14deg)", left: -70, bottom: -80 }} />
      <div className="absolute h-44 w-44 rounded-[34px] opacity-70" style={{ background: t.shape, transform: "rotate(32deg) skewX(-14deg)", left: -40, bottom: -130 }} />
    </div>
  );
}
