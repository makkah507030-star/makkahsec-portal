// بيئة لقطات أدلة المستخدمين: البوابة نفسها (src/main.jsx) ببيانات تجريبية بدل قاعدة البيانات.
// supabase بديل (mock-sb.js) يقرأ fixtures.js، والمستخدم من ?as=teacher|student|guardian|...
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

const here = path.resolve(import.meta.dirname);
const root = path.resolve(here, "../../..");
export default defineConfig({
  root: here,
  publicDir: path.join(root, "public"),
  plugins: [react(), {
    name: "main-entry", transformIndexHtml: (h) => h.replace("%MAIN%", `/@fs${root}/src/main.jsx`),
  }, {
    name: "mock-supabase", enforce: "pre",
    resolveId(src, imp) {
      if (!imp || imp.startsWith(here)) return null;
      if (/(lib\/supabase|^\.\/supabase|^\.\.\/supabase)(\.js)?$/.test(src)) return path.join(here, "mock-sb.js");
      return null;
    },
  }],
  server: { fs: { allow: [root] } },
});
