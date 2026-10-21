// src/components/StudentFileLink.jsx
/* =====================================================================
   رابط مباشر لملف الطالب الشامل (/student-file?id=…): اسم الطالب في الإحالات
   والإنذارات ونماذج السلوك والتوجيه يفتح ملفه بنقرة، بلا بحث.
   يظهر رابطًا لمن يحق له الملف وحده، ولغيره يبقى الاسم نصًا كما هو.
   ===================================================================== */
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";

// مطابقة لعنصر القائمة ولـ sf_can (الموجه لطلاب صفه، والدالة تفرض ذلك)
export const STUDENT_FILE_ROLES = ["principal", "deputy_students", "tech_support", "counselor_1", "counselor_2", "counselor_3"];

export const studentFileUrl = (id) => `/student-file?id=${id}`;

/** children: يلفّ اسم الطالب. pill: زر صغير «ملف الطالب» بدل الاسم. */
export default function StudentFileLink({ id, children, pill = false }) {
  const { adminRoles, effectiveRole } = useSession();
  const ok = id && effectiveRole === "admin" && (adminRoles ?? []).some((r) => STUDENT_FILE_ROLES.includes(r));
  if (!ok) return pill ? null : children;
  if (pill) return (
    <Link to={studentFileUrl(id)} onClick={(e) => e.stopPropagation()}
      className="inline-flex shrink-0 items-center rounded-pill border border-mint-deep/40 px-3 py-1 text-xs font-medium text-mint-deep hover:bg-mint-tint">
      ملف الطالب
    </Link>
  );
  return (
    <Link to={studentFileUrl(id)} onClick={(e) => e.stopPropagation()} title="فتح ملف الطالب"
      className="underline decoration-mint-deep/40 decoration-dotted underline-offset-4 hover:text-mint-deep hover:decoration-solid">
      {children}
    </Link>
  );
}
