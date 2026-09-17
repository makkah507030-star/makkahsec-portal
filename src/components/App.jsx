import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./lib/session.jsx";
import { useTeacherHiddenTabs } from "./lib/useTeacherHiddenTabs.js";
import { useTeacherGrantedTabs } from "./lib/useTeacherGrantedTabs.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
// شاشة الاستيراد تُحمّل عند فتحها فقط (مكتبة Excel ثقيلة)
const Import = lazy(() => import("./pages/admin/Import.jsx"));
import Students from "./pages/admin/Students.jsx";
import Accounts from "./pages/admin/Accounts.jsx";
import Attendance from "./pages/teacher/Attendance.jsx";
import TeacherRecords from "./pages/teacher/TeacherRecords.jsx";
import TeacherPermissions from "./pages/admin/TeacherPermissions.jsx";
import TeacherNotify from "./pages/teacher/TeacherNotify.jsx";
import MySchedule from "./pages/teacher/MySchedule.jsx";
import StudentHome from "./pages/StudentHome.jsx";
import GuardianHome from "./pages/GuardianHome.jsx";
import PermissionRequestPage from "./pages/PermissionRequestPage.jsx";
import AdminStaff from "./pages/admin/AdminStaff.jsx";
import Landing from "./pages/Landing.jsx";
import NewsList from "./pages/NewsList.jsx";
import Guides from "./pages/Guides.jsx";
import GuidesAdmin from "./pages/admin/GuidesAdmin.jsx";
import NewsArticle from "./pages/NewsArticle.jsx";
import NewsAdmin from "./pages/admin/NewsAdmin.jsx";
import NotificationsAdmin from "./pages/admin/NotificationsAdmin.jsx";
import AttendanceOverview from "./pages/admin/AttendanceOverview.jsx";
import PeriodAttendance from "./pages/admin/PeriodAttendance.jsx";
import GeneralScheduleMaster from "./pages/admin/GeneralScheduleMaster.jsx";
import TeacherSchedules from "./pages/admin/TeacherSchedules.jsx";
import StudentSchedules from "./pages/admin/StudentSchedules.jsx";
import ScheduleImport from "./pages/admin/ScheduleImport.jsx";
import PasswordReset from "./pages/admin/PasswordReset.jsx";
import SeasonSwitch from "./pages/admin/SeasonSwitch.jsx";
import Reports from "./pages/Reports.jsx";
import Feedback from "./pages/Feedback.jsx";
import FeedbackAdmin from "./pages/admin/FeedbackAdmin.jsx";
import AnnouncementsAdmin from "./pages/admin/AnnouncementsAdmin.jsx";
import MaintenanceAdmin from "./pages/admin/MaintenanceAdmin.jsx";
import MaintenanceScreen from "./components/MaintenanceScreen.jsx";
import { useMaintenance } from "./lib/useMaintenance.js";

export default function App() {
  const { session, profile, loading, can, adminRoles } = useSession();
  const { hidden: hiddenTabs } = useTeacherHiddenTabs();
  const { granted: grantedTabs } = useTeacherGrantedTabs();
  const maintenance = useMaintenance(session);

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
        <Route path="/" element={<Landing />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/guides" element={<Guides />} />
        <Route path="/news/:slug" element={<NewsArticle />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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

  // وضع الصيانة: يحجب البوابة عن الجميع ما عدا الدعم الفني
  if (maintenance.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">جارٍ التحميل…</p>
      </div>
    );
  }
  const isTechSupport = adminRoles.includes("tech_support");
  if (maintenance.enabled && !isTechSupport) {
    return <MaintenanceScreen message={maintenance.message} />;
  }

  // إجبار تغيير كلمة المرور قبل أي استخدام
  if (profile.must_change_pw) {
    return <ChangePassword />;
  }

  const teacherHome = hiddenTabs.has("attendance") ? (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold text-ink">تبويب التحضير غير متاح لحسابك</p>
      <p className="mt-1.5 text-sm text-muted">اختر تبويبًا آخر من القائمة الجانبية.</p>
    </div>
  ) : (
    <Attendance />
  );

  const home = {
    admin: <Dashboard />,
    teacher: teacherHome,
    student: <StudentHome />,
    guardian: <GuardianHome />,
  }[profile.role] ?? <p>دور غير معروف</p>;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={home} />
        {profile.role === "admin" && (
          <>
            {can("import") && <Route path="/season" element={<SeasonSwitch />} />}
            {can("import") && (
              <Route
                path="/import"
                element={
                  <Suspense fallback={<p className="text-sm text-muted">جارٍ التحميل…</p>}>
                    <Import />
                  </Suspense>
                }
              />
            )}
            {can("students") && <Route path="/students" element={<Students />} />}
            {can("accounts") && <Route path="/accounts" element={<Accounts />} />}
            {can("staff") && <Route path="/staff" element={<AdminStaff />} />}
            {can("staff") && <Route path="/teacher-permissions" element={<TeacherPermissions />} />}
            {can("news") && <Route path="/news-admin" element={<NewsAdmin />} />}
            {can("notifications") && <Route path="/notifications" element={<NotificationsAdmin />} />}
            {can("notifications") && <Route path="/announcements" element={<AnnouncementsAdmin />} />}
            {isTechSupport && <Route path="/maintenance" element={<MaintenanceAdmin />} />}
            {can("reports") && <Route path="/attendance-overview" element={<AttendanceOverview />} />}
            {can("reports") && <Route path="/period-attendance" element={<PeriodAttendance />} />}
            {can("import") && (
              <>
                <Route path="/general-schedule" element={<GeneralScheduleMaster />} />
                <Route path="/teacher-schedules" element={<TeacherSchedules />} />
                <Route path="/student-schedules" element={<StudentSchedules />} />
                <Route path="/schedule-import" element={<ScheduleImport />} />
              </>
            )}
            {can("guides") && <Route path="/guides-admin" element={<GuidesAdmin />} />}
            {can("password_reset") && <Route path="/password-reset" element={<PasswordReset />} />}
            {can("feedback") && <Route path="/feedback-admin" element={<FeedbackAdmin />} />}
          </>
        )}
        {profile.role === "teacher" && (
          <>
            {!hiddenTabs.has("attendance") && (
              <Route path="/attendance" element={<Attendance />} />
            )}
            {!hiddenTabs.has("records") && (
              <Route path="/records" element={<TeacherRecords />} />
            )}
            {!hiddenTabs.has("notify") && (
              <Route path="/notify" element={<TeacherNotify />} />
            )}
            {!hiddenTabs.has("schedule") && (
              <Route path="/schedule" element={<MySchedule />} />
            )}
          </>
        )}
        {((profile.role === "teacher" && !hiddenTabs.has("reports")) ||
          (profile.role === "admin" && can("reports"))) && (
          <Route path="/reports" element={<Reports />} />
        )}
        {/* الاستئذان: متاح للإدارة وللمعلمين المخوّلين — الصفحة نفسها تتحقق من الصلاحية */}
        {(profile.role === "admin" && can("permissions")) ||
         (profile.role === "teacher" && grantedTabs.has("permissions")) ? (
          <Route path="/permissions" element={<PermissionRequestPage />} />
        ) : null}
        {/* الأخبار للمعلمين المخوّلين — مسودات فقط، الصفحة نفسها تفرض هذا القيد */}
        {profile.role === "teacher" && grantedTabs.has("news") ? (
          <Route path="/news-admin" element={<NewsAdmin />} />
        ) : null}
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/guides" element={<Guides />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
