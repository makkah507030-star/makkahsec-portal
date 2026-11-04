// src/pages/RegularsPage.jsx
// صفحة «المنتظمون والانضباط» المستقلة: لشؤون الطلاب (الوكيل والمدير والدعم الفني ومن له صلاحية التقارير)
// بالصفوف كلها، ولموجه الصف بصفه وحده (counselor_1..3). المحتوى نفسه في تبويب «المنتظمون» بمركز التقارير.
import { lazy, Suspense } from "react";
import { useSession } from "../lib/session.jsx";
import Loader from "../components/Loader.jsx";
import PageIntro from "../components/PageIntro.jsx";

const Regulars = lazy(() => import("./student-affairs/Regulars.jsx"));

export function regularsGrades({ isSuper, adminRoles = [], can }) {
  const full = isSuper || ["principal", "tech_support", "deputy_students"].some((r) => adminRoles.includes(r)) || can?.("reports");
  return full ? [1, 2, 3] : [1, 2, 3].filter((g) => adminRoles.includes(`counselor_${g}`));
}

export default function RegularsPage() {
  const session = useSession();
  const grades = regularsGrades(session);
  if (!grades.length) return <p className="card px-4 py-8 text-center text-sm text-muted">هذه الصفحة لشؤون الطلاب وموجهي الصفوف.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">المنتظمون والانضباط</h1>
        <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
          {grades.length === 1 ? "طلاب صفك" : "طلاب المدرسة"} بلا أي غياب رسمي في الفصل الحالي، ومن لم يتأخر منهم أيضًا، بالنسب لكل صف وفصل،
          مع كشف للتصدير ولوحة انضباط بهوية الاستوديو للتكريم باسم موجه الصف ومدير المدرسة.
        </PageIntro>
      </div>
      <Suspense fallback={<Loader />}><Regulars grades={grades} /></Suspense>
    </div>
  );
}
