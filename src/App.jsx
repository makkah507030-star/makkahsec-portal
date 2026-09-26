// src/App.jsx
import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "./lib/session.jsx";
import { useTeacherHiddenTabs } from "./lib/useTeacherHiddenTabs.js";
import { useTeacherGrantedTabs } from "./lib/useTeacherGrantedTabs.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
const ChangePassword = lazy(() => import("./pages/ChangePassword.jsx"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard.jsx"));
// شاشة الاستيراد تُحمّل عند فتحها فقط (مكتبة Excel ثقيلة)
const Import = lazy(() => import("./pages/admin/Import.jsx"));
const Records = lazy(() => import("./pages/admin/Records.jsx"));
const Students = lazy(() => import("./pages/admin/Students.jsx"));
const Accounts = lazy(() => import("./pages/admin/Accounts.jsx"));
const Attendance = lazy(() => import("./pages/teacher/Attendance.jsx"));
const SubstitutePeriod = lazy(() => import("./pages/teacher/SubstitutePeriod.jsx"));
const TeacherRecords = lazy(() => import("./pages/teacher/TeacherRecords.jsx"));
const FollowUpLog = lazy(() => import("./pages/teacher/FollowUpLog.jsx"));
const TeacherPermissions = lazy(() => import("./pages/admin/TeacherPermissions.jsx"));
const NotificationsReview = lazy(() => import("./pages/admin/NotificationsReview.jsx"));
const TeacherNotify = lazy(() => import("./pages/teacher/TeacherNotify.jsx"));
const MySchedule = lazy(() => import("./pages/teacher/MySchedule.jsx"));
const StudentHome = lazy(() => import("./pages/StudentHome.jsx"));
const GuardianHome = lazy(() => import("./pages/GuardianHome.jsx"));
const PermissionRequestPage = lazy(() => import("./pages/PermissionRequestPage.jsx"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff.jsx"));
import EnableNotifications from "./components/EnableNotifications.jsx";
import { ensureServiceWorker } from "./lib/push.js";
const NotificationView = lazy(() => import("./pages/NotificationView.jsx"));
const NotificationsList = lazy(() => import("./pages/NotificationsList.jsx"));
const NotifyGuide = lazy(() => import("./pages/NotifyGuide.jsx"));
import Landing from "./pages/Landing.jsx";
const NewsList = lazy(() => import("./pages/NewsList.jsx"));
const Guides = lazy(() => import("./pages/Guides.jsx"));
const GuidesAdmin = lazy(() => import("./pages/admin/GuidesAdmin.jsx"));
const NewsArticle = lazy(() => import("./pages/NewsArticle.jsx"));
const NewsAdmin = lazy(() => import("./pages/admin/NewsAdmin.jsx"));
const NotificationsAdmin = lazy(() => import("./pages/admin/NotificationsAdmin.jsx"));
const AttendanceOverview = lazy(() => import("./pages/admin/AttendanceOverview.jsx"));
const PeriodAttendance = lazy(() => import("./pages/admin/PeriodAttendance.jsx"));
const SubstituteReport = lazy(() => import("./pages/admin/SubstituteReport.jsx"));
const ResultsAdmin = lazy(() => import("./pages/admin/ResultsAdmin.jsx"));
const GeneralScheduleMaster = lazy(() => import("./pages/admin/GeneralScheduleMaster.jsx"));
const TeacherSchedules = lazy(() => import("./pages/admin/TeacherSchedules.jsx"));
const StudentSchedules = lazy(() => import("./pages/admin/StudentSchedules.jsx"));
const ScheduleImport = lazy(() => import("./pages/admin/ScheduleImport.jsx"));
const PasswordReset = lazy(() => import("./pages/admin/PasswordReset.jsx"));
const SeasonSwitch = lazy(() => import("./pages/admin/SeasonSwitch.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Feedback = lazy(() => import("./pages/Feedback.jsx"));
const TicketDetail = lazy(() => import("./pages/TicketDetail.jsx"));
const FeedbackAdmin = lazy(() => import("./pages/admin/FeedbackAdmin.jsx"));
const SupportReport = lazy(() => import("./pages/admin/SupportReport.jsx"));
const LoginLogAdmin = lazy(() => import("./pages/admin/LoginLogAdmin.jsx"));
const AnnouncementsAdmin = lazy(() => import("./pages/admin/AnnouncementsAdmin.jsx"));
const CalendarAdmin = lazy(() => import("./pages/admin/CalendarAdmin.jsx"));
const SiteMetrics = lazy(() => import("./pages/admin/SiteMetrics.jsx"));
const Forms = lazy(() => import("./pages/admin/Forms.jsx"));
const FormsAdmin = lazy(() => import("./pages/admin/FormsAdmin.jsx"));
const MySignature = lazy(() => import("./pages/MySignature.jsx"));
const DocumentView = lazy(() => import("./pages/DocumentView.jsx"));
const MyDocuments = lazy(() => import("./pages/MyDocuments.jsx"));
const Help = lazy(() => import("./pages/Help.jsx"));
const DutyCard = lazy(() => import("./components/DutyCard.jsx"));
const DutyAdmin = lazy(() => import("./pages/admin/DutyAdmin.jsx"));
const Referrals = lazy(() => import("./pages/Referrals.jsx"));
const ExamSchedules = lazy(() => import("./pages/ExamSchedules.jsx"));
const Events = lazy(() => import("./pages/Events.jsx"));
const EventsReports = lazy(() => import("./pages/EventsReports.jsx"));
const MyQuizzes = lazy(() => import("./pages/teacher/MyQuizzes.jsx"));
const QuizMarks = lazy(() => import("./pages/teacher/QuizMarks.jsx"));
const QuizResults = lazy(() => import("./components/QuizResults.jsx"));
const OnlineQuizzesCard = lazy(() => import("./components/OnlineQuizzesCard.jsx"));
const QuizTake = lazy(() => import("./pages/QuizTake.jsx"));
const ExamsAdmin = lazy(() => import("./pages/admin/ExamsAdmin.jsx"));
const ReferralView = lazy(() => import("./pages/ReferralView.jsx"));
const MaintenanceAdmin = lazy(() => import("./pages/admin/MaintenanceAdmin.jsx"));
import MaintenanceScreen from "./components/MaintenanceScreen.jsx";
import { useMaintenance } from "./lib/useMaintenance.js";
import { useHolidays } from "./lib/useHolidays.js";
const ExamCountdown = lazy(() => import("./components/ExamCountdown.jsx"));
import HolidayBanner from "./components/HolidayBanner.jsx";

// الصفحات تُحمَّل عند فتحها فقط (lazy) لتخفيف التحميل الأول، وهذا ما يظهر لحظة جلبها
const pageFallback = (
  <div className="flex min-h-[40vh] items-center justify-center">
    <p className="text-sm text-muted">جارٍ التحميل…</p>
  </div>
);

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
      <Suspense fallback={pageFallback}>
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
      </Suspense>
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
    return <Suspense fallback={pageFallback}><ChangePassword /></Suspense>;
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
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/news" element={<NewsList />} />
          <Route path="/news/:slug" element={<NewsArticle />} />
        </Routes>
      </Suspense>
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
    student: (
      <div className="space-y-5">
        <OnlineQuizzesCard />
        <StudentHome />
        <QuizResults compact />
      </div>
    ),
    guardian: (
      <div className="space-y-5">
        <GuardianHome />
        <QuizResults compact />
      </div>
    ),
  }[effectiveRole] ?? <p>دور غير معروف</p>;

  return (
    <Layout>
      <Suspense fallback={pageFallback}>
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
              {can("students") && <Route path="/exams-admin" element={<ExamsAdmin />} />}
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
          {/* إحالة الطالب — الشاشة للمعلم والإدارة، والملف لصاحبه وولي أمره */}
          <Route path="/referrals" element={<Referrals />} />
          {/* جداول الاختبارات: العرض للجميع، والإدارة بصلاحية */}
          <Route path="/exams" element={<ExamSchedules />} />
          {/* الأحداث والمناسبات — لكل معلم وإداري */}
          <Route path="/events" element={<Events />} />
          <Route path="/events-reports" element={<EventsReports />} />
          {/* اختباراتي — للمعلم */}
          <Route path="/quizzes" element={<MyQuizzes />} />
          <Route path="/quiz-marks" element={<QuizMarks />} />
          {/* الاختبار الإلكتروني — يؤدّيه الطالب المُسند إليه (الصفحة تتحقق) */}
          <Route path="/quiz/:id" element={<QuizTake />} />
          <Route path="/referral/:id" element={<ReferralView />} />
          {/* دليل الاستخدام — يعرض لكل مستخدم ما يخصّ دوره */}
          <Route path="/help" element={<Help />} />
          <Route path="/notify-guide" element={<NotifyGuide />} />
          <Route path="/ticket/:id" element={<TicketDetail />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
