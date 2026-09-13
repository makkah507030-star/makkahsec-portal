/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // مطابق لبوابة الدعم الفني
        sans: ['"IBM Plex Sans Arabic"', "Tahoma", "sans-serif"],
      },
      colors: {
        // ——— هوية بوابة الدعم الفني ———
        ink:   "#101010",
        muted: "#6B6B6B",
        faint: "#A9A9A9",
        line:  "#C3C3C3",
        canvas:"#F4F4F4",      // gray-tint
        paper: "#FFFFFF",

        mint: {
          DEFAULT: "#89D7AD",
          hover:   "#6AA786",
          deep:    "#3E6350",
          light:   "#CCF2DB",
          tint:    "#EDFAF2",
        },

        danger:  { DEFAULT: "#A23B3B", light: "#FBEBEB" },
        warning: { DEFAULT: "#9A7B22", light: "#FBF3DE" },
        success: { DEFAULT: "#3E6350", light: "#CCF2DB" },

        // ——— ألوان الحالة في التحضير ———
        // "حاضر" أفتح قليلًا من mint-deep ليتمايز عن لون الهوية
        present: "#4E7D66",
        absent:  "#A23B3B",   // danger
        late:    "#9A7B22",   // warning
        excused: "#3F6B99",
      },
      borderRadius: {
        sm2: "8px",    // radius-s
        card: "14px",  // radius-m
        xl2: "22px",   // radius-l
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.05), 0 8px 24px -14px rgba(0,0,0,.22)",
      },
    },
  },
  plugins: [],
}
