// src/lab-content/index.js
// دروس المعمل الرقمي: كل درس ملف بيانات يصفه، ولا يُبرمج من الصفر. المشغّل
// (src/pages/lab/lessons) يقرأ الصيغة أدناه ويعرضها، ويصحّح فورًا.
//
// صيغة الدرس:
// {
//   id: "g10-u1-l1", grade: "الأول الثانوي", term: 1,
//   unit: { no, title }, lesson: { no, title }, pages: "13–25",
//   draft: true,                       // اختياري: مسودة لم تُطابَق بعد مع كتاب الوزارة
//   objectives: ["…"],
//   stations: [                        // المحطات بالترتيب، ولكل محطة نسبة إتقان
//     { id, type: "concept", title, slides: [{ title, text, figure? }], check? },
//     { id, type: "practice", widget: "bits" | "convert" | "ascii" | "rgb" | "truth" | "sequence" | "classify" | "html",
//       title, intro, tasks: [...] },      // صيغة مهام كل أداة في lessons/widgets.jsx
//     { id, type: "steps", title, intro, mock: "calculator" | "firewall", start: {...}, steps: [{ say, target, set? }] },
//     { id, type: "quiz", title, pass: 70, questions: [...] },
//   ],
// }
//
// النص: **غامق** و`رمز` فقط. الشكل (figure): { type: "table", head, rows, dir? } أو { type: "note", text }.
// أسئلة الاختبار والتحقق: mcq { q, options, answer } · tf { q, answer } ·
//   input { q, answer: ["…"], hint? } · match { q, pairs: [[يمين, يسار], …] }.

// الوحدة الأولى من كتاب «التقنية الرقمية (1)» للصف الأول الثانوي (طبعة 1448)
import dataRepresentation from "./g10/u1-l1-data-representation.js";
import computerStructure from "./g10/u1-l2-computer-structure.js";
import operatingSystems from "./g10/u1-l3-operating-systems.js";
import networks from "./g10/u1-l4-networks.js";
import ictSociety from "./g10/u1-l5-ict-society.js";
// الوحدة الثانية: العمل عبر الإنترنت
import onlineDocuments from "./g10/u2-l1-online-documents.js";
import onlineMeetings from "./g10/u2-l2-online-meetings.js";
import broadcastPresentation from "./g10/u2-l3-broadcast-presentation.js";
import oneNote from "./g10/u2-l4-onenote.js";
import mindMaps from "./g10/u2-l5-mind-maps.js";
// الوحدة الثالثة: التقنية والحياة
import monitoringControl from "./g10/u3-l1-monitoring-control.js";
import artificialIntelligence from "./g10/u3-l2-artificial-intelligence.js";
import emergingTechnologies from "./g10/u3-l3-emerging-technologies.js";
import healthEnvironment from "./g10/u3-l4-health-environment.js";
// الوحدة الرابعة: البرمجة باستخدام لغة ترميز النص التشعبي
import htmlWebsite from "./g10/u4-l1-html-website.js";
import contentStructure from "./g10/u4-l2-content-structure.js";
import htmlForm from "./g10/u4-l3-html-form.js";

export const LESSONS = [dataRepresentation, computerStructure, operatingSystems, networks, ictSociety,
  onlineDocuments, onlineMeetings, broadcastPresentation, oneNote, mindMaps,
  monitoringControl, artificialIntelligence, emergingTechnologies, healthEnvironment,
  htmlWebsite, contentStructure, htmlForm];

export const lessonById = (id) => LESSONS.find((l) => l.id === id) ?? null;
