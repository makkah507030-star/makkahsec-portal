import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { SessionProvider } from "./lib/session.jsx";
import "./index.css";

// شبكة أمان بعد النشر: إن فشل تحميل حزمة مُحمّلة عند الطلب (ملف JS بمُعرّف
// قديم اختفى بعد نشر جديد) نعيد التحميل مرة واحدة لجلب النسخة الجديدة —
// بدل بقاء المستخدم أمام شاشة بيضاء. حارس زمني يمنع أي حلقة إعادة تحميل.
function reloadOnceForStaleChunk() {
  try {
    const last = Number(sessionStorage.getItem("mk_chunk_reload") || 0);
    if (Date.now() - last < 15000) return; // أُعيد التحميل للتو — لا تُكرّر
    sessionStorage.setItem("mk_chunk_reload", String(Date.now()));
  } catch { /* تجاهل */ }
  window.location.reload();
}
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  reloadOnceForStaleChunk();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>
);
