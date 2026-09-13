import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./lib/session.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
// شاشة الاستيراد تُحمّل عند فتحها فقط (مكتبة Excel ثقيلة)
const Import = lazy(() => import("./pages/admin/Import.jsx"));
import Students from "./pages/admin/Students.jsx";
import Accounts from "./pages/admin/Accounts.jsx";
import Attendance from "./pages/teacher/Attendance.jsx";
import StudentHome from "./pages/StudentHome.jsx";
import GuardianHome from "./pages/GuardianHome.jsx";

export default function App() {
  const { session, profile, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">جارٍ التحميل…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // الحساب موجود في Auth لكن لا صف له في users
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <p className="font-semibold">الحساب غير مُفعّل</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            حسابك موجود لكنه غير مرتبط بسجل في البوابة. راجع إدارة المدرسة.
          </p>
        </div>
      </div>
    );
  }

  const home = {
    admin: <Dashboard />,
    teacher: <Attendance />,
    student: <StudentHome />,
    guardian: <GuardianHome />,
  }[profile.role] ?? <p>دور غير معروف</p>;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={home} />
        {profile.role === "admin" && (
          <>
            <Route
              path="/import"
              element={
                <Suspense fallback={<p className="text-sm text-muted">جارٍ التحميل…</p>}>
                  <Import />
                </Suspense>
              }
            />
            <Route path="/students" element={<Students />} />
            <Route path="/accounts" element={<Accounts />} />
          </>
        )}
        {profile.role === "teacher" && (
          <Route path="/attendance" element={<Attendance />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
