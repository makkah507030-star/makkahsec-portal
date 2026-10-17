/** لون من متغيرات CSS بقنوات RGB، مع دعم الشفافية */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  // الوضع الداكن بصنف dark على html (src/lib/theme.js)، للطلاب حاليًا
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // مطابق لبوابة الدعم الفني
        sans: ['"IBM Plex Sans Arabic"', "Tahoma", "sans-serif"],
      },
      // الألوان متغيرات CSS (src/index.css)، فتتبدّل في الوضع الداكن (html.dark) دون تعديل الصفحات.
      // القيم الفاتحة كما كانت تمامًا، و<alpha-value> يُبقي الشفافية مثل bg-present/10 تعمل.
      colors: {
        // ——— هوية بوابة الدعم الفني ———
        ink:   v("ink"),
        muted: v("muted"),
        faint: v("faint"),
        line:  v("line"),
        canvas:v("canvas"),      // gray-tint
        paper: v("paper"),

        mint: {
          DEFAULT: v("mint"),
          hover:   v("mint-hover"),
          deep:    v("mint-deep"),
          light:   v("mint-light"),
          tint:    v("mint-tint"),
        },

        danger:  { DEFAULT: v("absent"), light: v("danger-light") },
        warning: { DEFAULT: v("late"), light: v("warning-light") },
        success: { DEFAULT: v("mint-deep"), light: v("mint-light") },

        // ——— ألوان الحالة في التحضير ———
        // "حاضر" أفتح قليلًا من mint-deep ليتمايز عن لون الهوية
        present: v("present"),
        absent:  v("absent"),   // danger
        late:    v("late"),     // warning
        excused: v("excused"),
      },
      borderRadius: {
        sm2: "8px",    // radius-s
        card: "14px",  // radius-m
        xl2: "22px",   // radius-l
        pill: "999px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
}
