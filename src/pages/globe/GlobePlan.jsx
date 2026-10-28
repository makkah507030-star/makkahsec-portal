// src/pages/globe/GlobePlan.jsx
import ProgramPlan from "./ProgramPlan.jsx";
import { GLOBE_KIND, GLOBE_PRESETS, GLOBE_SPHERES, GLOBE_BUCKET, sphereOf } from "../../lib/globe.js";

/* خطة برنامج جلوب (supabase/globe_2.sql): برامج العام بنوعها ومجالها البيئي وموعدها،
   وتوثيق تنفيذها — على مكوّن الخطة العام ProgramPlan. */
export const GLOBE_PLAN = {
  table: "globe_programs", bucket: GLOBE_BUCKET, file: "globe_2.sql", field: "sphere",
  title: "خطة برنامج جلوب", sub: "برامج العام بموعدها، وتوثيق تنفيذها بالمستفيدين والأثر والصور.",
  kinds: GLOBE_KIND, presets: GLOBE_PRESETS, domains: GLOBE_SPHERES, domainOf: sphereOf, domainLabel: "المجال البيئي",
  targetHint: "الفئة المستهدفة (مثل: طلاب البرنامج)", emoji: "🌍",
  outcomeHint: "الأثر والملاحظات: ما تحقق من أهداف البرنامج، ومشاركة الطلاب…",
};

export default function GlobePlan(props) {
  return <ProgramPlan cfg={GLOBE_PLAN} {...props} />;
}
