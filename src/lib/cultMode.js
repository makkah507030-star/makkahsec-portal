// src/lib/cultMode.js
// مساحة «سفير الثقافة» لسفير الثقافة المؤسسية في حسابه معلمًا: يتنقّل بزر بين حساب المعلم ومساحة السفير،
// فتصير القائمة أعمال الثقافة المؤسسية وحدها والرئيسية لوحة تنفيذها. تبديل للعرض فقط، والصلاحيات لا تتغير.
import { useEffect, useState } from "react";

const KEY = (uid) => `mk_cult_mode_${uid ?? ""}`;
const EVT = "mk-cult-mode";
export const getCultMode = (uid) => { try { return localStorage.getItem(KEY(uid)) === "1"; } catch { return false; } };
export function setCultMode(uid, on) {
  try { if (on) localStorage.setItem(KEY(uid), "1"); else localStorage.removeItem(KEY(uid)); } catch { /* تخزين محجوب */ }
  window.dispatchEvent(new Event(EVT));
}
/** هل مساحة السفير مفتوحة الآن (تتحدّث مع التبديل في أي مكون) */
export function useCultMode(uid) {
  const [on, setOn] = useState(() => getCultMode(uid));
  useEffect(() => {
    const f = () => setOn(getCultMode(uid));
    f(); window.addEventListener(EVT, f); return () => window.removeEventListener(EVT, f);
  }, [uid]);
  return on;
}
