// بيئة توليد دليلَي البوابة: تعرض صفحات الدليل بمكوّنات التقارير الرسمية (components/report)
// دون قاعدة بيانات؛ supabase بديل فارغ، فبيانات الدليل من كود البوابة نفسه (الإجراءات والأقسام والأدوار).
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

const here = path.resolve(import.meta.dirname);
const root = path.resolve(here, "../../..");
export default defineConfig({
  root: here,
  // خط البوابة المعتمد (IBM Plex Sans Arabic) في public/fonts بمسار /fonts؛ بدونه يُطبع بخط بديل
  publicDir: path.join(root, "public"),
  plugins: [react(), {
    name: "stub-supabase", enforce: "pre",
    resolveId(src, imp) {
      if (!imp || imp.startsWith(here)) return null;
      if (/(lib\/supabase|^\.\/supabase|^\.\.\/supabase)(\.js)?$/.test(src)) return path.join(here, "sb-stub.js");
      return null;
    },
  }],
  server: { fs: { allow: [root] } },
});
