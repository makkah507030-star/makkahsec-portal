// src/pages/studio/lib.js
import { useEffect, useState } from "react";

/* =====================================================================
   أدوات استوديو البوابة المشتركة.
   ===================================================================== */

// متى تُستخدم كل نسخة — تظهر للمستخدم تحت اختيار النسخة
export const THEMES = [
  { key: "light", label: "فاتحة", hint: "مميّزة وأنيقة، للطباعة الملوّنة وأغلفة الملفات." },
  { key: "dark", label: "غامقة", hint: "للملفات الإلكترونية والاستخدام الرقمي: المشاركة والعرض على الشاشة." },
  { key: "official", label: "رسمية", hint: "كلاسيكية موفّرة للحبر، وتصلح للطابعة غير الملوّنة وللمراسلات الرسمية." },
];

// كل أرقام الاستوديو إنجليزية — أوضح في الطباعة ولا تلتبس بعلامات الترقيم
export const toWestern = (v) =>
  String(v ?? "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g, ".");

/* يُصغّر النص حتى يتسع لعرضه، بقياس عرض الخط الفعلي (canvas) لا بالتخطيط —
   فيعمل أيضًا في نسخة الطباعة المخفية عن الشاشة. */
let ctx;
export function fitSize(text, { max, min, width, weight = 700 }) {
  if (!text) return max;
  ctx ??= document.createElement("canvas").getContext("2d");
  ctx.font = `${weight} ${max}px "IBM Plex Sans Arabic"`;
  const w = ctx.measureText(String(text)).width;
  if (!w || w <= width) return max;
  return Math.max(min, Math.floor((max * width) / w));
}

/* عنوان بسطر أو سطرين: يبقى سطرًا ما دام حجمه لا يقل عن 70% من الأقصى،
   وإلا ينقسم على سطرين بحجم أكبر من تصغيره في سطر واحد. */
export function fitTitle(text, { max, min, width, weight = 700 }) {
  const one = fitSize(text, { max, min: 1, width, weight });
  if (one >= max * 0.7) return { size: Math.max(one, min), wrap: false };
  const two = fitSize(text, { max, min: 1, width: width * 1.8, weight });
  return { size: Math.max(min, Math.min(max, two)), wrap: true };
}

// يعيد الرسم بعد تحميل الخط، لأن القياس قبله يكون بخط بديل
export function useFontsReady() {
  const [ready, setReady] = useState(() => document.fonts?.status === "loaded");
  useEffect(() => {
    let alive = true;
    const fam = '"IBM Plex Sans Arabic"';
    Promise.all([400, 500, 700].map((w) => document.fonts?.load(`${w} 20px ${fam}`, "عربي 123")))
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}

/* العام الدراسي الهجري: يبدأ في أغسطس، فيُؤخذ العام الهجري لتاريخ 20 أغسطس
   من سنة بداية العام الدراسي — مثل «1448 – 1449 هـ». */
export function academicYearLabel(now = new Date()) {
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  let h;
  try {
    const s = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" })
      .format(new Date(startYear, 7, 20));
    h = parseInt(String(s).replace(/\D/g, ""), 10);
  } catch { h = startYear - 578; }
  return `${h} – ${h + 1} هـ`;
}

export const TERM_LABEL = { 1: "الفصل الدراسي الأول", 2: "الفصل الدراسي الثاني", 3: "الفصل الدراسي الثالث" };

/* قسم كل دور إداري ورمزه في ترقيم السجلات الإدارية */
export const ROLE_DEPT = {
  principal:        ["الإدارة المدرسية", "PR"],
  deputy_academic:  ["الشؤون التعليمية", "AC"],
  deputy_school:    ["الشؤون المدرسية", "SC"],
  deputy_students:  ["شؤون الطلاب", "SA"],
  clerk:            ["شؤون الطلاب", "SA"],
  clerk_2:          ["شؤون الطلاب", "SA"],
  clerk_3:          ["شؤون الطلاب", "SA"],
  data_registrar:   ["شؤون الطلاب", "SA"],
  counselor_1:      ["التوجيه الطلابي", "GU"],
  counselor_2:      ["التوجيه الطلابي", "GU"],
  counselor_3:      ["التوجيه الطلابي", "GU"],
  activity_leader:  ["النشاط الطلابي", "AT"],
  health_counselor: ["التوجيه الصحي", "HE"],
  gifted_program:   ["الموهوبين", "GF"],
  globe_program:    ["برنامج جلوب البيئي", "GL"],
  makkah_sport:     ["مكة سبورت", "SP"],
  student_voice:    ["صوت الطالب", "SV"],
  media_portal:     ["البوابة الإعلامية", "MD"],
  safety_security:  ["الأمن والسلامة", "SF"],
  science_labs:     ["مختبرات العلوم", "LB"],
  science_labs_2:   ["مختبرات العلوم", "LB"],
  science_labs_3:   ["مختبرات العلوم", "LB"],
  computer_lab:     ["معمل الحاسب الآلي", "CL"],
  tech_support:     ["الدعم الفني", "IT"],
};

/* ترتيب الفصول المتتالية: [1,2,3,4] ← «1 – 4»، وغير المتتالية بفواصل */
export function classRange(nums) {
  const a = [...new Set(nums)].filter((n) => n != null).sort((x, y) => x - y);
  if (!a.length) return "";
  const contiguous = a.every((n, i) => i === 0 || n === a[i - 1] + 1);
  if (a.length > 2 && contiguous) return `${a[0]} – ${a[a.length - 1]}`;
  return a.join("، ");
}

/* تاريخ اليوم الهجري بأرقام إنجليزية — مثل «1448/04/08 هـ» */
export function hijriToday(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn",
      { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(now);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return `${String(p.year).replace(/\D/g, "")}/${p.month}/${p.day} هـ`;
  } catch { return ""; }
}

/* حجم نص المتن بحسب طوله، ليبقى في صفحة واحدة دون أن يصغر أكثر من اللازم */
export function bodySize(text, { max = 21, min = 15, from = 320, step = 110 } = {}) {
  const len = String(text ?? "").length;
  if (len <= from) return max;
  return Math.max(min, Math.round((max - (len - from) / step) * 2) / 2);
}

/* ----------------------- صلاحيات القوالب -----------------------
   تُحفظ في settings.studio_access نصًّا بصيغة JSON: { "<قالب>": ["teacher", "admin", "deputy_students", …] }
   القالب غير المذكور يتبع قسمه: قوالب المعلمين للمعلمين، وقوالب الإداريين للإداريين.
   والمدير والدعم الفني يصلان لكل القوالب دائمًا. */
export const STUDIO_ACCESS_KEY = "studio_access";

export const defaultAccess = (tpl) => tpl.sections.map((s) => (s === "teacher" ? "teacher" : "admin"));

export function parseAccess(value) {
  try { const v = JSON.parse(value ?? "{}"); return v && typeof v === "object" ? v : {}; }
  catch { return {}; }
}

/* تنزيل عنصر من الصفحة صورةً PNG باسم عربي */
export async function downloadNode(node, name, pixelRatio = 1) {
  const { toBlob } = await import("html-to-image");
  await document.fonts?.ready;
  const blob = await toBlob(node, { pixelRatio, cacheBust: true });
  downloadBlob(blob, name);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // يُضاف للصفحة قبل الضغط ليحترم المتصفح اسم الملف
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
