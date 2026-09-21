import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // خرائط المصدر مفعّلة مؤقتًا لتشخيص خطأ العرض (يُظهر المتصفح اسم الملف
  // والسطر الحقيقي بدل الكود المُصغّر). يمكن إيقافها لاحقًا بحذف السطر.
  build: { sourcemap: true },
})
