// src/lib/theme.js
/* =====================================================================
   الوضع الداكن — للطلاب حاليًا، بطلبهم.
   • الاختيار محفوظ في الجهاز (localStorage)، ويُطبَّق بصنف dark على <html>.
   • Layout يطبّقه للطالب وحده، ويزيله عند الخروج أو لغير الطالب.
   • سطر في index.html يطبّقه قبل تحميل الصفحة لمن كان مسجّلًا، فلا تومض الشاشة بيضاء.
   • الألوان في src/index.css، والطباعة تبقى فاتحة دائمًا.
   ===================================================================== */

const KEY = "mk-theme";
const BAR = { light: "#3E6350", dark: "#111513" };   // لون شريط المتصفح في الجوال

export function savedTheme() {
  try { return localStorage.getItem(KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

export function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", !!dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? BAR.dark : BAR.light);
}

export function saveTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* المتصفح يمنع التخزين: يبقى للجلسة الحالية */ }
  applyTheme(theme === "dark");
}
