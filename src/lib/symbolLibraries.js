// src/lib/symbolLibraries.js
// مكتبات الرموز في «اختباراتي»: كل مادة لها مكتبتها، وتظهر للمعلم بحسب مادة الاختبار.
import { MATH_SYMBOL_GROUPS, isMathSubject } from "./mathSymbols.js";
import { CHEM_SYMBOL_GROUPS, PHYSICS_SYMBOL_GROUPS } from "./scienceSymbols.js";

const withSet = (lib) => ({ ...lib, symbols: new Set(lib.groups.flatMap((g) => g.items.map((it) => it.sym))) });

export const SYMBOL_LIBRARIES = {
  math: withSet({
    key: "math",
    title: "مكتبة الرموز الرياضية",
    audience: "لمعلمي الرياضيات",
    icon: "Σ",
    groups: MATH_SYMBOL_GROUPS,
    recentKey: "makkah_math_symbols_recent",
    searchHint: "مثل: جذر، مثلث، تكامل، ≤",
  }),
  chemistry: withSet({
    key: "chemistry",
    title: "مكتبة رموز الكيمياء",
    audience: "لمعلمي الكيمياء",
    icon: "⇌",
    groups: CHEM_SYMBOL_GROUPS,
    recentKey: "makkah_chem_symbols_recent",
    searchHint: "مثل: راسب، اتزان، أيون، mol",
    formula: true,
  }),
  physics: withSet({
    key: "physics",
    title: "مكتبة رموز الفيزياء",
    audience: "لمعلمي الفيزياء",
    icon: "Ω",
    groups: PHYSICS_SYMBOL_GROUPS,
    recentKey: "makkah_physics_symbols_recent",
    searchHint: "مثل: الطول الموجي، نيوتن، ثابت، m/s²",
  }),
};

// تطبيع يتجاهل التشكيل وصور الألف، كما في isMathSubject
const norm = (name) => String(name ?? "").replace(/[ً-ٰٟ]/g, "").replace(/[إأآا]/g, "ا");

/** مكتبة الرموز المناسبة لمادة الاختبار، أو null إن لم تكن لها مكتبة. */
export function symbolLibraryFor(subjectName) {
  if (!subjectName) return null;
  if (isMathSubject(subjectName)) return SYMBOL_LIBRARIES.math;
  const n = norm(subjectName);
  if (/كيمياء/.test(n) || /\bchem/i.test(n)) return SYMBOL_LIBRARIES.chemistry;
  if (/فيزياء/.test(n) || /\bphysic/i.test(n)) return SYMBOL_LIBRARIES.physics;
  return null;
}
