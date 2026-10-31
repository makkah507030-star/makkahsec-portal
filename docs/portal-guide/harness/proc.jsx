// الدليل الإجرائي: إجراءات البوابة كلها بخطواتها من «دليل الاستخدام» نفسه (PROCS في src/pages/Help.jsx)،
// مجموعة بفئاتها، لكل إجراء: المسؤول، والمسار في البوابة، والخطوات، والملاحظة. وملحق بما أُضيف بعد الإصدار الأول.
import { PROCS } from "../../../src/pages/Help.jsx";
import { Kpis } from "../../../src/components/report/ReportKit.jsx";
import { P, OL, Card, Note, tableBlocks, txt } from "./blocks.jsx";

const ICON = { "الدخول والحساب": "user", "المعلم": "book", "الأنشطة والألعاب": "star", "الطالب وولي الأمر": "cap", "الاختبارات القصيرة": "doc",
  "شؤون الطلاب": "users", "التوجيه الطلابي": "chat", "الشؤون التعليمية": "calendar", "النتائج": "chart", "النماذج والشهادات": "pen",
  "المحتوى والإشعارات": "megaphone", "استوديو البوابة": "spark", "الأحداث والمناسبات": "award", "معمل الحاسب الآلي": "grid",
  "الحسابات والصلاحيات": "lock", "الدعم الفني": "shield", "التقويم والاعتماد المدرسي": "award", "البرامج الطلابية": "globe" };

export const cats = () => { const out = []; PROCS.forEach((p) => { if (!out.includes(p.cat)) out.push(p.cat); }); return out; };

const Proc = ({ p, n }) => (
  <Card icon={ICON[p.cat] ?? "list"} title={<><span className="num">{n}.</span> {txt(p.title)}{p.after && <span className="g-new">مضاف بعد الإصدار الأول</span>}</>}
        aside={<span className="g-who">{p.who.map((w) => <span key={w}>{w}</span>)}</span>}>
    <div className="g-path">المسار: <b>{txt(p.path)}</b></div>
    <OL items={p.steps} />
    {p.note && <Note>{txt(p.note)}</Note>}
  </Card>
);

export function procSections() {
  const cs = cats();
  const added = PROCS.filter((p) => p.after);
  const intro = { title: "طريقة استخدام الدليل", sub: "بنية الإجراء وفهرس الفئات", blocks: [
    <Kpis cols={4} items={[
      { ic: "doc", t: "الإجراءات", v: PROCS.length, s: "بخطواتها" },
      { ic: "grid", t: "الفئات", v: cs.length, s: "مرتبة بمجال العمل" },
      { ic: "users", t: "المستفيدون", v: 4, s: "الإدارة والمعلم والطالب وولي الأمر" },
      { ic: "star", t: "بعد الإصدار الأول", v: added.length, s: "إجراءً مضافًا" },
    ]} />,
    <Card icon="list" title="بنية كل إجراء">
      <P>لكل إجراء: <b>اسمه</b>، و<b>المسؤول عنه</b> (الشارات بجانب الاسم)، و<b>المسار</b> إليه في البوابة، و<b>خطواته</b> مرقّمة بترتيب تنفيذها، و<b>ملاحظة</b> بما يلزم معرفته إن وُجدت. والإجراء المضاف بعد الإصدار الأول عليه شارة ذهبية.</P>
    </Card>,
    <Card icon="grid" title="فهرس الفئات">
      <div className="g-toc">{cs.map((c, i) => <div key={c}><b className="num">{i + 1}</b><span>{c}</span><span>{PROCS.filter((p) => p.cat === c).length} إجراء</span></div>)}</div>
    </Card>,
    <Note>{txt("هذا الدليل مولَّد من «دليل الاستخدام» داخل البوابة (القائمة ← المساعدة)، وفيه البحث والتصفية بالدور. أي تعديل في إجراء يُحدَّث هناك ثم يُعاد توليد الدليل.")}</Note>,
  ] };
  let n = 0;
  const body = cs.map((c) => ({ title: c, sub: `${PROCS.filter((p) => p.cat === c).length} إجراء`, blocks: PROCS.filter((p) => p.cat === c).map((p) => <Proc p={p} n={++n} />) }));
  const appendix = { no: "أ", title: "ملحق: الإجراءات المضافة بعد الإصدار الأول", sub: "حتى 31 أكتوبر 2026م", blocks:
    tableBlocks([["الإجراء", 220], ["الفئة", 150], ["المسؤول"]], added.map((p) => [p.title, p.cat, p.who.join("، ")]), 14) };
  return [intro, ...body, appendix];
}
