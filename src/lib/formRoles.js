// src/lib/formRoles.js
import { ASSIGNABLE_ROLES, ADMIN_ROLE_LABEL } from "./session.jsx";

/* =====================================================================
   صلاحيات النماذج — من يُصدر كل نموذج.
   تُحفظ في form_templates.allowed_roles، وتقبل:
   • أدوارًا إدارية بعينها (deputy_students، counselor_1، …)
   • admin: كل الإداريين (للتوافق مع ما ضُبط سابقًا)
   • teacher: المعلمون
   والمدير والدعم الفني يصلان لكل النماذج دائمًا.
   ===================================================================== */

export const ALWAYS_ROLES = ["principal", "tech_support"];

export const GENERAL_ROLES = [
  { key: "admin",   label: "كل الإداريين" },
  { key: "teacher", label: "المعلمون" },
];

export const SPECIFIC_ROLES = ASSIGNABLE_ROLES
  .filter((r) => !ALWAYS_ROLES.includes(r))
  .map((r) => ({ key: r, label: ADMIN_ROLE_LABEL[r] ?? r }));

export const roleLabel = (key) =>
  GENERAL_ROLES.find((g) => g.key === key)?.label ?? ADMIN_ROLE_LABEL[key] ?? key;

// الأدوار المقترحة لكل قسم عند إنشاء نموذج جديد
export const DEPT_ROLES = {
  school_admin:    [],
  academic:        ["deputy_academic"],
  school_affairs:  ["deputy_school"],
  student_affairs: ["deputy_students", "clerk", "clerk_2", "clerk_3"],
  guidance:        ["counselor_1", "counselor_2", "counselor_3"],
  activity:        ["activity_leader"],
  health:          ["health_counselor"],
  gifted:          ["gifted_program"],
  globe:           ["globe_program"],
  sport:           ["makkah_sport"],
};

export const suggestRoles = (dept) => [...ALWAYS_ROLES, ...(DEPT_ROLES[dept] ?? [])];

/* هل يحق للمستخدم إصدار هذا النموذج؟ */
export function canUseTemplate(t, { adminRoles = [], isAdmin = false, isTeacher = false }) {
  if (adminRoles.some((r) => ALWAYS_ROLES.includes(r))) return true;
  const allowed = t.allowed_roles ?? [];
  if (isAdmin && allowed.includes("admin")) return true;
  if (isTeacher && allowed.includes("teacher")) return true;
  return adminRoles.some((r) => allowed.includes(r));
}
