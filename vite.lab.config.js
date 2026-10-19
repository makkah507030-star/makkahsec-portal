// بناء ملف المعمل: حزمة JavaScript واحدة وملف CSS واحد، والصور مضمّنة فيهما،
// فتُدمج في ملف HTML واحد يعمل دون إنترنت (src/pages/lab/labFile.js).
// يُبنى بعد الموقع في مجلد dist نفسه دون مسحه.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      input: "lab-player.html",
      output: {
        codeSplitting: false,
        entryFileNames: "lab-player/[name]-[hash].js",
        assetFileNames: "lab-player/[name]-[hash][extname]",
      },
    },
  },
});
