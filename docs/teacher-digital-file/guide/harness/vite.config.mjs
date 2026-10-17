// بيئة عرض شاشات ملف المعلم الرقمي ببيانات تجريبية (دون قاعدة بيانات) لالتقاط صور الدليل.
// supabase وsession مستبدلتان بنسختين وهميتين هنا. التشغيل من جذر المستودع عبر ../build.mjs.
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const nm = (p) => path.join(root, "node_modules", p);
const { default: react } = await import(nm("@vitejs/plugin-react/dist/index.js"));
export default {
  root: here,
  plugins: [react()],
  server: { fs: { strict: false } },
  css: { postcss: root },
  resolve: { alias: [
    { find: /^react-dom\/client$/, replacement: nm("react-dom/client.js") },
    { find: /^react\/jsx-dev-runtime$/, replacement: nm("react/jsx-dev-runtime.js") },
    { find: /^react\/jsx-runtime$/, replacement: nm("react/jsx-runtime.js") },
    { find: /^(.*\/)?supabase(\.js)?$/, replacement: path.join(here, "sb-stub.js") },
    { find: /^.*session\.jsx$/, replacement: path.join(here, "session-stub.jsx") },
    { find: /^react-router-dom$/, replacement: nm("react-router-dom/dist/index.mjs") },
    { find: /^react$/, replacement: nm("react/index.js") },
    { find: /^@supabase\/supabase-js$/, replacement: nm("@supabase/supabase-js/dist/index.mjs") },
  ] },
};
