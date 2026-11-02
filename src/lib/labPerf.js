// src/lib/labPerf.js
import { LESSONS } from "../lab-content/index.js";

/* حجم المعمل الرقمي من ملفات الدروس نفسها — لقسم المعمل في الملف الرقمي.
   شواهد أداء محضر المعمل بنظام ملف أداء المعلم (supabase/lab_perf_*.sql، src/lib/performance.js). */

/** حجم المعمل الرقمي من ملفات الدروس نفسها */
export function lessonStats() {
  let stations = 0, slides = 0, tasks = 0, questions = 0;
  const types = {}, widgets = new Set();
  LESSONS.forEach((l) => l.stations.forEach((s) => {
    stations++; types[s.type] = (types[s.type] ?? 0) + 1;
    if (s.widget) widgets.add(s.widget);
    slides += s.slides?.length ?? 0;
    tasks += (s.tasks?.length ?? 0) + (s.steps?.length ?? 0);
    questions += (s.questions?.length ?? 0) + (s.check ? 1 : 0);
  }));
  const objectives = LESSONS.reduce((a, l) => a + (l.objectives?.length ?? 0), 0);
  const units = new Set(LESSONS.map((l) => `${l.grade}|${l.unit.no}`)).size;
  return { lessons: LESSONS.length, units, stations, slides, tasks, questions, objectives, types, widgets: widgets.size, list: LESSONS };
}
