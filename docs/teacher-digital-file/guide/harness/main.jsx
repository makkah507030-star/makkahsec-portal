import { createRoot } from "react-dom/client";
import DfileReport from "../../../../src/components/dfile/DfileReport.jsx";
const d = {
  year: "1448", name: "فيصل بن سالم القرشي", spec: "رياضيات", subjects: ["رياضيات 2-1", "رياضيات 2-2"],
  classes: [1,2,3,4,5].map((i) => ({ id: i, label: String(200 + i) })), students: 142, weekly: 24,
  lessons: 412, ontime: 98, subs: 28, plc: 6, plc_led: 1, xvisits: 2, hours_train: 2, hours_conf: 5, guardian_msgs: 57,
  quizzes: [
    ...Array(5).fill(0).map((_, i) => ({ title: `اختبار قصير ${i + 1}`, mode: "online", period: "period1", q: 20 + i })),
    ...Array(4).fill(0).map((_, i) => ({ title: `اختبار ورقي ${i + 1}`, mode: "omr", period: i ? "period2" : "diagnostic", q: 30 })),
    ...Array(3).fill(0).map((_, i) => ({ title: `ورقة عمل ${i + 1}`, mode: "paper", period: "period1", q: 10 })),
    ...Array(2).fill(0).map((_, i) => ({ title: `اختبار الدوال ${i + 1}`, mode: "external", period: "period2", q: 0 })),
  ],
  visits: [{ date: "2026-10-02", cls: "فصل 203، الحصة الثالثة، رياضيات", by: "وكيل الشؤون التعليمية", strengths: "إدارة صفية فاعلة\nتقويم مستمر" },
           { date: "2026-09-14", cls: "فصل 201", by: "مدير المدرسة", strengths: "تنويع الاستراتيجيات" }],
  events: [{ title: "أولمبياد الرياضيات", date: "2026-09-12", n: 3 }, { title: "مبادرة دقيقة رياضيات", date: "2026-09-20", n: 60 }],
  evidence_auto: { e03: 14, e05: 6, e07: 3, e10: 4, e11: 9 },
  evidence: { e02: 9, e03: 7, e04: 6, e05: 8, e06: 5, e07: 6, e08: 3, e09: 4, e10: 7, e11: 9 },
  docs: [{ id: 1, title: "ملف الإنجاز", name: "a.pdf" }, { id: 2, title: "شهادة برنامج التقويم البنائي", date: "2026-09-01" }],
  grades: { n: 142, avg: 81.4, bands: { b5: 45, b4: 46, b3: 31, b2: 14, b1: 6 },
    classes: [{ label: "201", bands: { b5: 10, b4: 9, b3: 6, b2: 3, b1: 1 } }, { label: "202", bands: { b5: 8, b4: 9, b3: 7, b2: 3, b1: 1 } },
              { label: "203", bands: { b5: 4, b4: 7, b3: 9, b2: 6, b1: 3 } }, { label: "204", bands: { b5: 10, b4: 10, b3: 6, b2: 2, b1: 1 } },
              { label: "205", bands: { b5: 13, b4: 11, b3: 3, b2: 0, b1: 0 } }],
    improve: [{ label: "201", first: 80, last: 87 }, { label: "202", first: 77, last: 83 }, { label: "203", first: 61, last: 73 }, { label: "204", first: 74, last: 80 }, { label: "205", first: 82, last: 88 }],
    support: { used: 3, need: 16, planned: 14, plans: 3, plans_done: 3, top: 48, honored: 48, enrich: 2 } },
};
const s = { color: new URLSearchParams(location.search).get("c") || "science", hidden: [], sentences: null, appoint_year: 1434, perf_rating: 4.62, perf_year: 1447, rank: "معلم متقدم", madrasati: { lessons: 64, homework: 38, tests: 12, enrich: 9, weekly_plan: true, at: "2026-10-14" }, activities: { class: [{ t: "التعلم التعاوني", n: 14 }, { t: "العصف الذهني", n: 9 }, { t: "الألعاب التعليمية", n: 6 }], extra: [{ t: "الإذاعة المدرسية", n: 3 }, { t: "الأولمبياد", n: 1 }] },
  other_wins: [{ t: "المركز الثاني في أولمبياد الرياضيات على مستوى المنطقة", d: "تأهل أحد طلابه للمرحلة الوطنية" }, { t: "شكر من مكتب التعليم", d: "1447هـ" }] };
createRoot(document.getElementById("r")).render(<DfileReport data={d} settings={s} code="MS-7Q4K" />);
