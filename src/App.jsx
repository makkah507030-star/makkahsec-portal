// src/App.jsx
import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
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
import NotificationsReview from "./pages/admin/NotificationsReview.jsx";
import TeacherNotify from "./pages/teacher/TeacherNotify.jsx";
import MySchedule from "./pages/teacher/MySchedule.jsx";
import StudentHome from "./pages/StudentHome.jsx";
import GuardianHome from "./pages/GuardianHome.jsx";
import PermissionRequestPage from "./pages/PermissionRequestPage.jsx";
import AdminStaff from "./pages/admin/AdminStaff.jsx";
import EnableNotifications from "./components/EnableNotifications.jsx";
import { ensureServiceWorker } from "./lib/push.js";
import NotificationView from "./pages/NotificationView.jsx";
import NotificationsList from "./pages/NotificationsList.jsx";
import NotifyGuide from "./pages/NotifyGuide.jsx";
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
import CalendarAdmin from "./pages/admin/CalendarAdmin.jsx";
import SiteMetrics from "./pages/admin/SiteMetrics.jsx";
import Forms from "./pages/admin/Forms.jsx";
import FormsAdmin from "./pages/admin/FormsAdmin.jsx";
import MySignature from "./pages/MySignature.jsx";
import DocumentView from "./pages/DocumentView.jsx";
import MyDocuments from "./pages/MyDocuments.jsx";
import Help from "./pages/Help.jsx";
import DutyCard from "./components/DutyCard.jsx";
import DutyAdmin from "./pages/admin/DutyAdmin.jsx";
import MaintenanceAdmin from "./pages/admin/MaintenanceAdmin.jsx";
import MaintenanceScreen from "./components/MaintenanceScreen.jsx";
import { useMaintenance } from "./lib/useMaintenance.js";
import { useHolidays } from "./lib/useHolidays.js";
import ExamCountdown from "./components/ExamCountdown.jsx";
import HolidayBanner from "./components/HolidayBanner.jsx";

export default function App() {
  const { session, profile, loading, profileLoading, can, adminRoles, effectiveRole, signOut } = useSession();
  const { hidden: hiddenTabs } = useTeacherHiddenTabs();
  const { granted: grantedTabs } = useTeacherGrantedTabs();
  const maintenance = useMaintenance(session);
  // الإجازات الرسمية تُحمَّل مرة واحدة لكل الحسابات قبل رسم الشاشات
  const holidaysReady = useHolidays();
  const location = useLocation();
  const navigate = useNavigate();

  // تحديث الـ Service Worker عند فتح التطبيق ليصل أحدث إصدار للجهاز
  useEffect(() => { ensureServiceWorker(); }, []);

  // عند الضغط على إشعار الجوال، يطلب Service Worker فتح صفحة الإشعار عبر رسالة —
  // ننتقل داخليًا (بلا إعادة تحميل) فتبقى الجلسة محفوظة ولا يعود للرئيسية.
  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : null;
    if (!sw) return;
    const onMsg = (e) => {
      if (e.data && e.data.type === "OPEN_URL" && e.data.url) navigate(e.data.url);
    };
    sw.addEventListener("message", onMsg);
    return () => sw.removeEventListener("message", onMsg);
  }, [navigate]);

  if (loading || !holidaysReady) {
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
        {/* دليل تفعيل الإشعارات صفحة عامة لا تحتاج تسجيل دخول */}
        <Route path="/notify-guide" element={<NotifyGuide />} />
        {/* فتح إشعار قبل استعادة الجلسة → لصفحة الدخول بدل الرئيسية بصمت */}
        <Route path="/notify/:id" element={<Navigate to="/login" replace />} />
        <Route path="/notifications-me" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // أثناء جلب بيانات المستخدم لا نحكم بشيء — وإلا ومضت شاشة «الحساب غير مفعّل»
  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">جارٍ التحميل…</p>
      </div>
    );
  }

  // الحساب موجود في Auth لكن لا صف له في users، أو صفه موقوف
  if (!profile || profile.is_active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-tint p-6">
        <div className="card max-w-md p-7 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-warning-light">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-warning"
                 stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" />
            </svg>
          </span>
          <p className="text-lg font-bold text-ink">
            {profile ? "حسابك موقوف" : "الحساب غير مُفعّل"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {profile
              ? "أُوقف حسابك في البوابة. راجع إدارة المدرسة لتفعيله."
              : "حسابك موجود لكنه غير مرتبط بسجل في البوابة. راجع إدارة المدرسة."}
          </p>
          <button onClick={signOut}
                  className="mt-5 rounded-pill border border-line px-5 py-2 text-sm font-semibold text-muted hover:bg-canvas">
            العودة لصفحة الدخول
          </button>
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
    <div className="space-y-5">
      <DutyCard />
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">تبويب الحضور والغياب اليومي غير متاح لحسابك</p>
        <p className="mt-1.5 text-sm text-muted">اختر تبويبًا آخر من القائمة الجانبية.</p>
      </div>
    </div>
  ) : (
    <div className="space-y-5">
      <DutyCard />
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
        <Route
          path="/"
          element={
            <div className="space-y-4">
              <EnableNotifications />
              {/* واجهة المعلم فقط — لوحة الإدارة وصفحتا الطالب وولي الأمر تعرضها بنفسها */}
              {effectiveRole === "teacher" && <HolidayBanner />}
              {home}
            </div>
          }
        />
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
            {can("staff") && <Route path="/duty" element={<DutyAdmin />} />}
            {can("staff") && <Route path="/teacher-permissions" element={<TeacherPermissions />} />}
            {can("news") && <Route path="/news-admin" element={<NewsAdmin />} />}
            {can("notifications") && <Route path="/notifications" element={<NotificationsAdmin />} />}
            {isTechSupport && <Route path="/notifications-review" element={<NotificationsReview />} />}
            {can("notifications") && <Route path="/announcements" element={<AnnouncementsAdmin />} />}
            {isTechSupport && <Route path="/maintenance" element={<MaintenanceAdmin />} />}
            {isTechSupport && <Route path="/site-metrics" element={<SiteMetrics />} />}
            {/* النماذج والشهادات — ما يظهر لكل مستخدم تحدّده سياسات قاعدة البيانات */}
            <Route path="/forms" element={<Forms />} />
            <Route path="/my-signature" element={<MySignature />} />
            {(isTechSupport || adminRoles.includes("principal")) && (
              <Route path="/forms-admin" element={<FormsAdmin />} />
            )}
            {can("reports") && <Route path="/attendance-overview" element={<AttendanceOverview />} />}
            {can("reports") && <Route path="/period-attendance" element={<PeriodAttendance />} />}
            {(can("import") || can("reports")) && <Route path="/substitute-report" element={<SubstituteReport />} />}
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
            {(can("import") || can("schedules")) && (
              <>
                <Route path="/general-schedule" element={<GeneralScheduleMaster />} />
                <Route path="/teacher-schedules" element={<TeacherSchedules />} />
                <Route path="/student-schedules" element={<StudentSchedules />} />
              </>
            )}
            {/* استيراد الجدول الذكي حسّاس — للاستيراد فقط، لا لصلاحية الجداول */}
            {can("import") && <Route path="/schedule-import" element={<ScheduleImport />} />}
            {can("guides") && <Route path="/guides-admin" element={<GuidesAdmin />} />}
            {can("calendar") && <Route path="/calendar-admin" element={<CalendarAdmin />} />}
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
            {/* النماذج والشهادات — النماذج المتاحة للمعلم تحدّدها سياسات القاعدة */}
            <Route path="/forms" element={<Forms />} />
            <Route path="/my-signature" element={<MySignature />} />
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
        <Route path="/notifications-me" element={<NotificationsList />} />
        <Route path="/notify/:id" element={<NotificationView />} />
        {/* عرض مستند صادر — لصاحبه ولولي أمره ولمُصدِره وللإدارة */}
        <Route path="/doc/:id" element={<DocumentView />} />
        {/* نماذجي — ما صدر باسم المستخدم، ولولي الأمر مستندات أبنائه */}
        <Route path="/my-documents" element={<MyDocuments />} />
        {/* دليل الاستخدام — يعرض لكل مستخدم ما يخصّ دوره */}
        <Route path="/help" element={<Help />} />
        <Route path="/notify-guide" element={<NotifyGuide />} />
        <Route path="/ticket/:id" element={<TicketDetail />} />
        <Route path="/guides" element={<Guides />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
