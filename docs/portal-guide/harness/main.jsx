// صفحة توليد الدليل: ?doc=org (التنظيمي) أو ?doc=proc (الإجرائي)، و&theme=light|official
import ReactDOM from "react-dom/client";
import "../../../src/fonts.css";
import "../../../src/index.css";
import "./guide.css";
import { Cover, Signs } from "../../../src/components/report/ReportKit.jsx";
import { Page } from "../../../src/components/report/ReportKit.jsx";
import { ADMIN_GROUPS } from "../../../src/components/Layout.jsx";
import { ASSIGNABLE_ROLES, PERMISSIONS } from "../../../src/lib/session.jsx";
import { PROCS } from "../../../src/pages/Help.jsx";
import Paged from "./Paged.jsx";
import { orgSections } from "./org.jsx";
import { procSections, cats, GUIDE_COUNT } from "./proc.jsx";
import { Card, P, UL } from "./blocks.jsx";

const q = new URLSearchParams(location.search);
const kind = q.get("doc") === "proc" ? "proc" : "org";
const theme = q.get("theme") === "official" ? "official" : "light";
const ISSUE = "31 أكتوبر 2026م · 1448هـ";
const VERSION = "الإصدار الأول وما أُضيف بعده";

const META = {
  org: { title: "الدليل التنظيمي", sub: "تنظيم أعمال البوابة وأدوارها وصلاحياتها", tag: ["grid", "الدليل التنظيمي"],
    rows: [["user", "الجهة", "مدرسة مكة الثانوية"], ["doc", "الإصدار", VERSION], ["clock", "تاريخ الإصدار", ISSUE], ["lock", "التصنيف", "للاستخدام الداخلي"]],
    note: ["check", "يحدد غاية البوابة ونطاقها، وأدوار المستخدمين ومسؤولياتهم، واللجان، والصلاحيات، ومسارات العمل والاعتماد، وحماية البيانات."],
    strip: () => [[ASSIGNABLE_ROLES.length, "دورًا إداريًا"], [PERMISSIONS.length, "صلاحية"], [ADMIN_GROUPS.reduce((a, g) => a + g.items.length, 0), "صفحة للإدارة"], [11, "مسار عمل"]] },
  proc: { title: "الدليل الإجرائي", sub: "إجراءات أعمال البوابة بخطواتها", tag: ["doc", "الدليل الإجرائي"],
    rows: [["user", "الجهة", "مدرسة مكة الثانوية"], ["doc", "الإصدار", VERSION], ["clock", "تاريخ الإصدار", ISSUE], ["users", "المستفيدون", "الإدارة والمعلم والطالب وولي الأمر"]],
    note: ["check", "خطوات كل عمل في البوابة، ومن ينفّذه، ومساره فيها، بلغة واضحة لكل مستخدم."],
    strip: () => [[GUIDE_COUNT(), "إجراءً"], [cats().length, "فئة"], [PROCS.filter((p) => p.after).length, "مضافًا بعد الإصدار"], [4, "فئات مستفيدين"]] },
}[kind];

const doc = { title: `${META.title} لبوابة مكة الثانوية الرقمية`, meta: ["الإصدار الأول", "1448هـ"], foot: META.title };
const cover = (pg, total) => (
  <Cover theme={theme} c={{
    year: "1448هـ", tag: META.tag, title: "بوابة مكة الثانوية الرقمية", titleSize: 50, sub: META.sub,
    badge: { main: META.title, sub: "الإصدار الأول" }, side: { main: "1448هـ", sub: "2026م" },
    rows: META.rows, note: META.note, strip: META.strip(), foot: META.title,
  }} />
);
const approve = (pg, total) => (
  <Page theme={theme} doc={doc} page={pg} total={total} sec={{ no: <svg className="g-sym" style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>, title: "الاعتماد", sub: "إقرار الدليل والعمل به" }}>
    <Card icon="check" title="إقرار" tint>
      <P>اعتُمد هذا {META.title} لبوابة مكة الثانوية الرقمية، ويُعمل به من تاريخ اعتماده، ويُحدَّث مع كل تحديث للبوابة يمس ما فيه.</P>
    </Card>
    <Card icon="list" title="المراجعة الدورية">
      <UL items={["يُراجع الدليل مع بداية كل فصل دراسي، وعند كل تحديث للبوابة.", "تُرفع الملاحظات عليه إلى الدعم الفني من «مركز الدعم والمساندة»."]} />
    </Card>
    <Signs people={[{ title: "الدعم الفني · إعداد الدليل" }, { title: "مدير المدرسة · الاعتماد" }]} />
  </Page>
);

const sections = kind === "org" ? orgSections() : procSections();
ReactDOM.createRoot(document.getElementById("root")).render(
  <Paged theme={theme} doc={doc} front={[cover]} sections={sections} back={[approve]} />
);
