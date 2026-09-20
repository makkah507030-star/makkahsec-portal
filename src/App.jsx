import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSession } from "./lib/session.jsx";
import { useTeacherHiddenTabs } from "./lib/useTeacherHiddenTabs.js";
import { useTeacherGrantedTabs } from "./lib/useTeacherGrantedTabs.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
// شاشة الاستيراد تُحمّل عند فتحها فقط (مكتبة Excel ثقيلة)
const Import = lazy(() => import("./pages/admin/Import.jsx"));
const Records = lazy(() => import("./pages/admin/Records.jsx"));
import Students from "./pages/admin/Students.jsx";
import Accounts from "./pages/admin/Accounts.jsx";
import Attendance from "./pages/teacher/Attendance.jsx";
import SubstitutePeriod from "./pages/teacher/SubstitutePeriod.jsx";
import TeacherRecords from "./pages/teacher/TeacherRecords.jsx";
import FollowUpLog from "./pages/teacher/FollowUpLog.jsx";
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
import SubstituteReport from "./pages/admin/SubstituteReport.jsx";
const ResultsAdmin = lazy(() => import("./pages/admin/ResultsAdmin.jsx"));
import GeneralScheduleMaster from "./pages/admin/GeneralScheduleMaster.jsx";
import TeacherSchedules from "./pages/admin/TeacherSchedules.jsx";
import StudentSchedules from "./pages/admin/StudentSchedules.jsx";
import ScheduleImport from "./pages/admin/ScheduleImport.jsx";
import PasswordReset from "./pages/admin/PasswordReset.jsx";
import SeasonSwitch from "./pages/admin/SeasonSwitch.jsx";
import Reports from "./pages/Reports.jsx";
import Feedback from "./pages/Feedback.jsx";
import TicketDetail from "./pages/TicketDetail.jsx";
import FeedbackAdmin from "./pages/admin/FeedbackAdmin.jsx";
import SupportReport from "./pages/admin/SupportReport.jsx";
import LoginLogAdmin from "./pages/admin/LoginLogAdmin.jsx";
import AnnouncementsAdmin from "./pages/admin/AnnouncementsAdmin.jsx";
import MaintenanceAdmin from "./pages/admin/MaintenanceAdmin.jsx";
import MaintenanceScreen from "./components/MaintenanceScreen.jsx";
import { useMaintenance } from "./lib/useMaintenance.js";
import ExamCountdown from "./components/ExamCountdown.jsx";

export default function App() {
  const { session, profile, loading, can, adminRoles, effectiveRole } = useSession();
  const { hidden: hiddenTabs } = useTeacherHiddenTabs();
  const { granted: grantedTabs } = useTeacherGrantedTabs();
  const maintenance = useMaintenance(session);
  const location = useLocation();

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
        <Route path="/home" element={<Landing />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/guides" element={<Guides />} />
        <Route path="/news/:slug" element={<NewsArticle />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/contact" element={<Feedback />} />
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

  // معاينة الصفحة الرئيسية العامة للبوابة حتى للمستخدم المسجّل دخوله —
  // بدون هذا الاستثناء يُعاد توجيه "/" تلقائيًا للوحة تحكمه بدل الصفحة العامة
  if (location.pathname === "/home") {
    return <Landing />;
  }

  // صفحات الأخبار والمقالات كصفحات مستقلة (بلا غلاف لوحة التحكم) حتى
  // للمستخدم المسجّل — وإلا كان الضغط على خبر من الرئيسية يعيد التوجيه
  // للوحة التحكم لأن المسار غير مسجّل ضمن مسارات اللوحة.
  if (location.pathname === "/news" || location.pathname.startsWith("/news/")) {
    return (
      <Routes>
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/:slug" element={<NewsArticle />} />
      </Routes>
    );
  }

  const teacherHome = hiddenTabs.has("attendance") ? (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold text-ink">تبويب الحضور والغياب اليومي غير متاح لحسابك</p>
      <p className="mt-1.5 text-sm text-muted">اختر تبويبًا آخر من القائمة الجانبية.</p>
    </div>
  ) : (
    <div className="space-y-5">
      <ExamCountdown />
      <Attendance />
    </div>
  );

  const home = {
    admin: <Dashboard />,
    teacher: teacherHome,
    student: <StudentHome />,
    guardian: <GuardianHome />,
  }[effectiveRole] ?? <p>دور غير معروف</p>;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={home} />
        {effectiveRole === "admin" && (
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
            {can("records") && (
              <Route
                path="/records-manual"
                element={
                  <Suspense fallback={<p className="text-sm text-muted">جارٍ التحميل…</p>}>
                    <Records />
                  </Suspense>
                }
              />
            )}
            {can("accounts") && <Route path="/accounts" element={<Accounts />} />}
            {can("staff") && <Route path="/staff" element={<AdminStaff />} />}
            {can("staff") && <Route path="/teacher-permissions" element={<TeacherPermissions />} />}
            {can("news") && <Route path="/news-admin" element={<NewsAdmin />} />}
            {can("notifications") && <Route path="/notifications" element={<NotificationsAdmin />} />}
            {can("notifications") && <Route path="/announcements" element={<AnnouncementsAdmin />} />}
            {isTechSupport && <Route path="/maintenance" element={<MaintenanceAdmin />} />}
            {can("reports") && <Route path="/attendance-overview" element={<AttendanceOverview />} />}
            {can("reports") && <Route path="/period-attendance" element={<PeriodAttendance />} />}
            {can("reports") && <Route path="/substitute-report" element={<SubstituteReport />} />}
            {can("results") && (
              <Route
                path="/results-admin"
                element={
                  <Suspense fallback={<p className="text-sm text-muted">جارٍ التحميل…</p>}>
                    <ResultsAdmin />
                  </Suspense>
                }
              />
            )}
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
            {can("feedback") && <Route path="/support-report" element={<SupportReport />} />}
            {can("login_log") && <Route path="/login-log" element={<LoginLogAdmin />} />}
          </>
        )}
        {effectiveRole === "teacher" && (
          <>
            {!hiddenTabs.has("attendance") && (
              <Route path="/attendance" element={<Attendance />} />
            )}
            {!hiddenTabs.has("substitute") && (
              <Route path="/substitute" element={<SubstitutePeriod />} />
            )}
            {!hiddenTabs.has("records") && (
              <Route path="/records" element={<TeacherRecords />} />
            )}
            <Route path="/follow-up" element={<FollowUpLog />} />
            {!hiddenTabs.has("notify") && (
              <Route path="/notify" element={<TeacherNotify />} />
            )}
            {!hiddenTabs.has("schedule") && (
              <Route path="/schedule" element={<MySchedule />} />
            )}
          </>
        )}
        {((effectiveRole === "teacher" && !hiddenTabs.has("reports")) ||
          (effectiveRole === "admin" && can("reports"))) && (
          <Route path="/reports" element={<Reports />} />
        )}
        {/* الاستئذان: متاح للإدارة وللمعلمين المخوّلين — الصفحة نفسها تتحقق من الصلاحية */}
        {(effectiveRole === "admin" && can("permissions")) ||
         (effectiveRole === "teacher" && grantedTabs.has("permissions")) ? (
          <Route path="/permissions" element={<PermissionRequestPage />} />
        ) : null}
        {/* الأخبار للمعلمين المخوّلين — مسودات فقط، الصفحة نفسها تفرض هذا القيد */}
        {effectiveRole === "teacher" && grantedTabs.has("news") ? (
          <Route path="/news-admin" element={<NewsAdmin />} />
        ) : null}
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/contact" element={<Feedback />} />
        <Route path="/ticket/:id" element={<TicketDetail />} />
        <Route path="/guides" element={<Guides />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
