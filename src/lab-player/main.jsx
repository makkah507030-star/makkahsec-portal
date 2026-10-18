// src/lab-player/main.jsx
// مدخل ملف المعمل: يُبنى حزمةً واحدة (vite.lab.config.js)، وتُضمَّن في ملف HTML واحد مع
// بيانات الحصة (window.__LAB__) عند تنزيله من البوابة (src/pages/lab/labFile.js).
import React from "react";
import ReactDOM from "react-dom/client";
import Player from "./Player.jsx";
import "../fonts.css";
import "../index.css";

// بيانات تجريبية لمعاينة الملف أثناء التطوير
const DEMO = {
  code: "DEMO0000", secret: "demo", lesson: "g10-u1-l1", class_no: 101, grade: 1, device_count: 24,
  origin: location.protocol.startsWith("http") ? location.origin : "",
  roster: [{ n: "أحمد علي", s: 1 }, { n: "بندر سالم", s: 1 }, { n: "خالد فهد", s: 2 }, { n: "سعد ناصر", s: null }],
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><Player data={window.__LAB__ ?? DEMO} /></React.StrictMode>,
);
