import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useSession } from "./session.jsx";

/**
 * شواهد الأداء الوظيفي: ما يصلح النموذج شاهدًا عليه بحسب فئة الموظف.
 * المصدر جدول evidence_links (supabase/performance_evidence.sql).
 * التقدير يبقى للمقيِّم؛ البوابة تقدّم الشاهد فقط.
 */
export const LEVEL_LABEL = { direct: "شاهد مباشر", support: "شاهد داعم" };
export const EVIDENCE_LEAD = "يمكنك الاستفادة من هذا النموذج شاهدًا على";
export const EVIDENCE_NOTE = "البوابة تقدّم الشاهد، والتقدير يبقى للمقيِّم وفق الدليل.";

const LEADERSHIP = ["principal", "deputy_academic", "deputy_school", "deputy_students", "deputy"];
const LABS = ["science_labs", "science_labs_2", "science_labs_3", "computer_lab"];

/** فئات الموظف الوظيفية؛ قد تتعدد (معلم ورائد نشاط مثلًا) */
export function categoriesOf({ isTeacher, adminRoles = [] }) {
  const cats = new Set();
  if (isTeacher) cats.add("teacher");
  for (const r of adminRoles) {
    if (r === "activity_leader") cats.add("activity");
    else if (r === "health_counselor") cats.add("health");
    else if (LABS.includes(r)) cats.add("lab");
    else if (r === "counselor" || r.startsWith("counselor_")) cats.add("guide");
    else if (LEADERSHIP.includes(r)) cats.add("leadership");
  }
  return cats;
}

let cache = null;   // يُجلب مرة واحدة لكل جلسة صفحة
const load = () => {
  if (!cache) {
    cache = supabase.from("evidence_links")
      .select("template_key, category, element, level, note, sort_order")
      .eq("kind", "job").eq("is_active", true).order("sort_order")
      .then(({ data }) => data ?? [], () => []);
  }
  return cache;
};

/** عناصر الشواهد لنموذج بعينه، مدموجة بلا تكرار، والمباشر مقدَّم على الداعم */
export function useEvidence(templateKey) {
  const { isTeacher, adminRoles, profile } = useSession();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let live = true;
    if (!templateKey) { setRows([]); return undefined; }
    load().then((all) => { if (live) setRows(all.filter((r) => r.template_key === templateKey)); });
    return () => { live = false; };
  }, [templateKey]);

  const cats = categoriesOf({ isTeacher: isTeacher || profile?.role === "teacher", adminRoles });
  if (cats.size === 0) return [];
  const best = new Map();
  for (const r of rows) {
    if (r.category !== "all" && !cats.has(r.category)) continue;
    const cur = best.get(r.element);
    if (!cur || (cur.level === "support" && r.level === "direct")) best.set(r.element, r);
  }
  return [...best.values()].sort((a, b) =>
    (a.level === b.level ? 0 : a.level === "direct" ? -1 : 1) || a.sort_order - b.sort_order);
}
