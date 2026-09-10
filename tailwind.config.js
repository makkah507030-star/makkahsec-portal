/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
      },
      colors: {
        ink:     "#16241F",
        muted:   "#5D6B65",
        canvas:  "#F4F6F4",
        line:    "#DFE4E0",
        brand:   { DEFAULT: "#0F5C4A", dark: "#0A4437", light: "#E6F0EC" },
        gold:    "#B8892B",
        present: "#1F8A5F",
        absent:  "#C4453B",
        late:    "#D08700",
        excused: "#3B6FC4",
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
}
