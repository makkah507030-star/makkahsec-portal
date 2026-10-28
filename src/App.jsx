// src/App.jsx
// Copyright © 2026 محمد بن حسن الحازمي — جميع الحقوق محفوظة (انظر LICENSE).
// Author: محمد بن حسن الحازمي
import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "./lib/session.jsx";
import { useTeacherHiddenTabs } from "./lib/useTeacherHiddenTabs.js";
import { useTeacherGrantedTabs } from "./lib/useTeacherGrantedTabs.js";
import { LAB_MANAGER_ROLES } from "./lib/lab.js";
import Layout from "./components/Layout.jsx";
import FollowUpTabs from "./components/FollowUpTabs.jsx";
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
const FollowUpLog2 = lazy(() => import("./pages/teacher/FollowUpLog2.jsx"));
const FollowUpLog3 = lazy(() => import("./pages/teacher/FollowUpLog3.jsx"));
const Lab = lazy(() => import("./pages/lab/Lab.jsx"));
const Activities = lazy(() => import("./pages/activities/Activities.jsx"));
const LabGradeLink = lazy(() => import("./pages/lab/LabGradeLink.jsx"));
const OfflineGradeLink = lazy(() => import("./pages/OfflineGradeLink.jsx"));
const OfflineQuizMissing = lazy(() => import("./pages/OfflineQuizMissing.jsx"));
const TeacherPermissions = lazy(() => import("./pages/admin/TeacherPermissions.jsx"));
const NotificationsReview = lazy(() => import("./pages/admin/NotificationsReview.jsx"));
const TeacherNotify = lazy(() => import("./pages/teacher/TeacherNotify.jsx"));
const MySchedule = lazy(() => import("./pages/teacher/MySchedule.jsx"));
const SubjectAbsenceReport = lazy(() => import("./pages/teacher/SubjectAbsenceReport.jsx"));
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
const ScoutsHub = lazy(() => import("./pages/scouts/ScoutsHub.jsx"));
const ScoutReports = lazy(() => import("./pages/scouts/ScoutReports.jsx"));
const MyScouts = lazy(() => import("./pages/scouts/MyScouts.jsx"));
const GlobeTeam = lazy(() => import("./pages/admin/GlobeTeam.jsx"));
const GiftedHub = lazy(() => import("./pages/gifted/GiftedHub.jsx"));
const NotificationsAdmin = lazy(() => import("./pages/admin/NotificationsAdmin.jsx"));
const Circulars = lazy(() => import("./pages/circulars/Circulars.jsx"));
const CircularView = lazy(() => import("./pages/circulars/CircularView.jsx"));
const MyCirculars = lazy(() => import("./pages/circulars/MyCirculars.jsx"));
const AttendanceOverview = lazy(() => import("./pages/admin/AttendanceOverview.jsx"));
const StudentAffairs = lazy(() => import("./pages/student-affairs/index.jsx"));
const PeriodAttendance = lazy(() => import("./pages/admin/PeriodAttendance.jsx"));
const SubstituteReport = lazy(() => import("./pages/admin/SubstituteReport.jsx"));
const NoorGrades = lazy(() => import("./pages/admin/NoorGrades.jsx"));
const QuizCycles = lazy(() => import("./pages/admin/QuizCycles.jsx"));
const SchoolReport = lazy(() => import("./pages/admin/SchoolReport.jsx"));
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
const UsageReport = lazy(() => import("./pages/admin/UsageReport.jsx"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog.jsx"));
const Forms = lazy(() => import("./pages/admin/Forms.jsx"));
const FormsAdmin = lazy(() => import("./pages/admin/FormsAdmin.jsx"));
const Studio = lazy(() => import("./pages/studio/Studio.jsx"));
const MySignature = lazy(() => import("./pages/MySignature.jsx"));
const DocumentView = lazy(() => import("./pages/DocumentView.jsx"));
const MyDocuments = lazy(() => import("./pages/MyDocuments.jsx"));
const MyPerformance = lazy(() => import("./pages/performance/MyPerformance.jsx"));
const MyDfile = lazy(() => import("./pages/performance/MyDfile.jsx"));
const DfilePublic = lazy(() => import("./pages/DfilePublic.jsx"));
const DfilesAdmin = lazy(() => import("./pages/admin/DfilesAdmin.jsx"));
const DfileOpinions = lazy(() => import("./pages/admin/DfileOpinions.jsx"));
const PerformanceAdmin = lazy(() => import("./pages/performance/PerformanceAdmin.jsx"));
const Help = lazy(() => import("./pages/Help.jsx"));
const Legal = lazy(() => import("./pages/Legal.jsx"));
const Qudrat = lazy(() => import("./pages/qudrat/Qudrat.jsx"));
const QudratQuestions = lazy(() => import("./pages/qudrat/QudratQuestions.jsx"));
const QudratAsks = lazy(() => import("./pages/qudrat/QudratAsks.jsx"));
const QudratAdmin = lazy(() => import("./pages/qudrat/QudratAdmin.jsx"));
const QudratReport = lazy(() => import("./pages/qudrat/QudratReport.jsx"));
const DutyCard = lazy(() => import("./components/DutyCard.jsx"));
const DutyAdmin = lazy(() => import("./pages/admin/DutyAdmin.jsx"));
const Referrals = lazy(() => import("./pages/Referrals.jsx"));
const Guidance = lazy(() => import("./pages/Guidance.jsx"));
const StudentRequests = lazy(() => import("./pages/StudentRequests.jsx"));
const MyWeek = lazy(() => import("./pages/MyWeek.jsx"));
const AbsenceExcuses = lazy(() => import("./pages/AbsenceExcuses.jsx"));
const BannersAdmin = lazy(() => import("./pages/banners/BannersAdmin.jsx"));
const StudentFile = lazy(() => import("./pages/student-affairs/StudentFile.jsx"));
const SectionHub = lazy(() => import("./pages/SectionHub.jsx"));
const MonitorScreen = lazy(() => import("./pages/admin/MonitorScreen.jsx"));
const AchievementCenter = lazy(() => import("./pages/achievement/AchievementCenter.jsx"));
import AchGate from "./pages/achievement/AchGate.jsx";
const AchForm = lazy(() => import("./pages/achievement/AchForm.jsx"));
const Qiyas = lazy(() => import("./pages/achievement/Qiyas.jsx"));
const MyQiyas = lazy(() => import("./pages/achievement/MyQiyas.jsx"));
const AchCommittee = lazy(() => import("./pages/achievement/AchCommittee.jsx"));
const AchFormsList = lazy(() => import("./pages/achievement/AchForm.jsx").then((m) => ({ default: m.AchFormsList })));
const Nominations = lazy(() => import("./pages/nominations/Nominations.jsx"));
const Opportunities = lazy(() => import("./pages/nominations/Opportunities.jsx"));
const QuestionBank = lazy(() => import("./pages/teacher/QuestionBank.jsx"));
const StudentNotes = lazy(() => import("./pages/StudentNotes.jsx"));
const StudentDropouts = lazy(() => import("./pages/StudentDropouts.jsx"));
const EthicsCode = lazy(() => import("./pages/EthicsCode.jsx"));
const EthicsReport = lazy(() => import("./pages/EthicsCode.jsx").then((m) => ({ default: m.EthicsReport })));
const ExamSchedules = lazy(() => import("./pages/ExamSchedules.jsx"));
const Events = lazy(() => import("./pages/Events.jsx"));
const Plc = lazy(() => import("./pages/Plc.jsx"));
const PlcDepartments = lazy(() => import("./pages/Plc.jsx").then((m) => ({ default: m.PlcDepartments })));
const PdReports = lazy(() => import("./pages/PdReports.jsx"));
const ExchangeVisits = lazy(() => import("./pages/ExchangeVisits.jsx"));
const Improve = lazy(() => import("./pages/Improve.jsx"));
const PlcFile = lazy(() => import("./pages/Plc.jsx").then((m) => ({ default: m.PlcFile })));
const EventsReports = lazy(() => import("./pages/EventsReports.jsx"));
const MyQuizzes = lazy(() => import("./pages/teacher/MyQuizzes.jsx"));
const QuizMarks = lazy(() => import("./pages/teacher/QuizMarks.jsx"));
const QuizAnalytics = lazy(() => import("./pages/teacher/QuizAnalytics.jsx"));
const Notebook = lazy(() => import("./pages/Notebook.jsx"));
const QuizTake = lazy(() => import("./pages/QuizTake.jsx"));
const ExamsAdmin = lazy(() => import("./pages/admin/ExamsAdmin.jsx"));
const ReferralView = lazy(() => import("./pages/ReferralView.jsx"));
const GuidanceInquiry = lazy(() => import("./pages/GuidanceInquiry.jsx"));
const BehaviorForms = lazy(() => import("./pages/BehaviorForms.jsx"));
const StudentCertificate = lazy(() => import("./pages/StudentCertificate.jsx"));
const BehaviorFormView = lazy(() => import("./pages/BehaviorFormView.jsx"));
const MaintenanceAdmin = lazy(() => import("./pages/admin/MaintenanceAdmin.jsx"));
import MaintenanceScreen from "./components/MaintenanceScreen.jsx";
import { useMaintenance } from "./lib/useMaintenance.js";
import { useHolidays } from "./lib/useHolidays.js";
const ExamDayCard = lazy(() => import("./components/ExamDayCard.jsx"));
const TeacherTodayCard = lazy(() => import("./components/TeacherTodayCard.jsx"));
const TasksBox = lazy(() => import("./components/TasksBox.jsx"));
import HolidayBanner from "./components/HolidayBanner.jsx";
import HomeBanners from "./components/HomeBanners.jsx";
import StaffHeader from "./components/StaffHeader.jsx";
import TeacherDayCard from "./components/TeacherDayCard.jsx";
import Loader from "./components/Loader.jsx";
import { isScoutRole } from "./lib/scoutLeader.js";

// الصفحات تُحمَّل عند فتحها فقط (lazy) لتخفيف التحميل الأول، وهذا ما يظهر لحظة جلبها
const pageFallback = (
  <Loader />
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

  // وجهة محفوظة قبل الدخول (رمز QR لجهاز المعمل) — تُفتح مرة واحدة بعد الدخول
  useEffect(() => {
    if (!session || !profile) return;
    let target = null;
    try { target = sessionStorage.getItem("mk_after_login"); sessionStorage.removeItem("mk_after_login"); } catch { /* تجاهل */ }
    if (target) navigate(target, { replace: true });
  }, [session, profile, navigate]);

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
      <Loader screen />
    );
  }

  // ملف المعلم الرقمي للزائر: صفحة عامة بالكود، تُفتح بدخول أو دونه
  if (location.pathname.startsWith("/f/")) {
    return (
      <Suspense fallback={pageFallback}>
        <Routes><Route path="/f/:code" element={<DfilePublic />} /></Routes>
      </Suspense>
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
          {/* شروط الاستخدام وحقوق الملكية، وسياسة الخصوصية: عامتان قبل الدخول وبعده */}
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          {/* دليل تفعيل الإشعارات صفحة عامة لا تحتاج تسجيل دخول */}
          <Route path="/notify-guide" element={<NotifyGuide />} />
          {/* فتح إشعار قبل استعادة الجلسة → لصفحة الدخول بدل الرئيسية بصمت */}
          <Route path="/notify/:id" element={<Navigate to="/login" replace />} />
          <Route path="/notifications-me" element={<Navigate to="/login" replace />} />
          {/* رمز QR على خلفية جهاز المعمل: يُحفظ البلاغ المطلوب ويُفتح بعد الدخول */}
          <Route path="/lab/r/:seat" element={<LabReportRedirect />} />
          {/* رمز درجة من ملف المعمل: يُرصد بعد الدخول */}
          <Route path="/lab/g/:code" element={<LabGradeLink />} />
          {/* رمز تسليم الاختبار دون إنترنت: يُرصد بعد الدخول */}
          <Route path="/q/g/:code" element={<OfflineGradeLink />} />
          <Route path="/offline-quiz" element={<OfflineQuizMissing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // أثناء جلب بيانات المستخدم لا نحكم بشيء — وإلا ومضت شاشة «الحساب غير مفعّل»
  if (profileLoading) {
    return (
      <Loader screen />
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
      <Loader screen />
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

  // الرئيسية للمعلم ملخص يومه، والتحضير صفحة مستقلة (/attendance) تفتحها بطاقة «يومي» بضغطة
  const teacherHome = (
    <div className="space-y-5">
      <StaffHeader />
      {/* بطاقة يوم الاختبار تظهر في أيامه فقط، فتتقدّم على غيرها */}
      <ExamDayCard />
      {!hiddenTabs.has("attendance") && <TeacherTodayCard />}
      <TasksBox />
      <DutyCard personal />
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
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-4">
                <EnableNotifications />
                {/* واجهة المعلم فقط — لوحة الإدارة وصفحتا الطالب وولي الأمر تعرضها بنفسها */}
                {effectiveRole === "teacher" && <HolidayBanner />}
                {/* بطاقة يوم المعلم لكل حساب له سجل معلم — تظهر في أسبوع المناسبة فقط */}
                <TeacherDayCard />
                {effectiveRole === "teacher" && <HomeBanners />}
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
                    <Suspense fallback={<Loader />}>
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
                    <Suspense fallback={<Loader />}>
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
              {/* الفريق الكشفي: من له الصلاحية والقائد ونائبه (أدوار «كشف»)؛ والبلاغات لوكيل شؤون الطلاب أيضًا */}
              {(can("scouts") || adminRoles.some(isScoutRole)) && <Route path="/scouts" element={<ScoutsHub />} />}
              {(can("scouts") || adminRoles.some(isScoutRole) || adminRoles.some((r) => ["deputy_students", "principal", "tech_support"].includes(r))) &&
                <Route path="/scout-reports" element={<div className="space-y-4"><h1 className="text-lg font-bold text-ink">بلاغات الفريق الكشفي</h1><ScoutReports /></div>} />}
              {can("globe") && <Route path="/globe" element={<GlobeTeam />} />}
              {can("gifted") && <Route path="/gifted" element={<GiftedHub />} />}
              {can("notifications") && <Route path="/notifications" element={<NotificationsAdmin />} />}
              {isTechSupport && <Route path="/notifications-review" element={<NotificationsReview />} />}
              {can("notifications") && <Route path="/announcements" element={<AnnouncementsAdmin />} />}
              {can("banners") && <Route path="/banners-admin" element={<BannersAdmin />} />}
              {isTechSupport && <Route path="/maintenance" element={<MaintenanceAdmin />} />}
              {isTechSupport && <Route path="/site-metrics" element={<SiteMetrics />} />}
              {isTechSupport && <Route path="/usage-report" element={<UsageReport />} />}
              {isTechSupport && <Route path="/audit-log" element={<AuditLog />} />}
              {/* النماذج والشهادات — ما يظهر لكل مستخدم تحدّده سياسات قاعدة البيانات */}
              {/* key مختلف: الانتقال بين الصفحتين يبدأ مكوّنًا جديدًا فلا يبقى تبويب الأخرى مفتوحًا */}
              <Route path="/forms" element={<Forms key="issue" />} />
              <Route path="/forms-review" element={<Forms key="review" view="review" />} />
              {/* قبول طالب — نموذج يُصدره مدير المدرسة، بمدخل مباشر من «شؤون الطلاب» */}
              {(isTechSupport || adminRoles.includes("principal")) &&
                <Route path="/student-admission" element={<Forms key="admission" openKey="student_admission" />} />}
              <Route path="/my-signature" element={<MySignature />} />
              {/* استوديو البوابة — قوالب الهوية البصرية للطباعة والتصدير */}
              <Route path="/studio" element={<Studio />} />
              {(isTechSupport || adminRoles.includes("principal")) && (
                <Route path="/forms-admin" element={<FormsAdmin />} />
              )}
              {/* ملفات الأداء الوظيفي للمعلمين — لمدير المدرسة، وللدعم الفني للمتابعة الفنية */}
              {(isTechSupport || adminRoles.includes("principal")) && <Route path="/performance" element={<PerformanceAdmin />} />}
              {/* ملفات المعلمين الرقمية: إدارتها للدعم الفني، والاطلاع للمدير والوكيلين (teacher_dfile_9.sql) */}
              {(isTechSupport || adminRoles.some((r) => ["principal", "deputy_academic", "deputy_students"].includes(r))) &&
                <Route path="/dfiles-admin" element={<DfilesAdmin manage={isTechSupport} />} />}
              {(adminRoles.includes("principal") || adminRoles.includes("deputy_academic")) && <Route path="/dfile-opinions" element={<DfileOpinions />} />}
              {(isTechSupport || adminRoles.includes("principal")) && <Route path="/school-report" element={<SchoolReport />} />}
              {can("reports") && <Route path="/student-affairs" element={<StudentAffairs />} />}
              {/* الصفحتان السابقتان باقيتان بروابطهما — محتواهما صار داخل مركز تقارير شؤون الطلاب */}
              {can("reports") && <Route path="/attendance-overview" element={<AttendanceOverview />} />}
              {can("reports") && <Route path="/period-attendance" element={<PeriodAttendance />} />}
              {(can("import") || can("reports")) && <Route path="/substitute-report" element={<SubstituteReport />} />}
              {(isTechSupport || adminRoles.includes("principal") || adminRoles.includes("deputy_academic")) &&
                <Route path="/noor-grades" element={<NoorGrades />} />}
              {(isTechSupport || adminRoles.includes("principal") || adminRoles.includes("deputy_academic")) &&
                <Route path="/quiz-cycles" element={<QuizCycles />} />}
              {can("results") && (
                <Route
                  path="/results-admin"
                  element={
                    <Suspense fallback={<Loader />}>
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
              <Route path="/follow-up" element={<><FollowUpTabs /><FollowUpLog /></>} />
              <Route path="/follow-up-2" element={<><FollowUpTabs /><FollowUpLog2 /></>} />
              <Route path="/follow-up-3" element={<><FollowUpTabs /><FollowUpLog3 /></>} />
              {!hiddenTabs.has("notify") && (
                <Route path="/notify" element={<TeacherNotify />} />
              )}
              {!hiddenTabs.has("schedule") && (
                <Route path="/schedule" element={<MySchedule />} />
              )}
              <Route path="/my-absence" element={<SubjectAbsenceReport />} />
              {/* ملف الأداء الوظيفي — المعلم وشواهده، وسياسات القاعدة تقصره عليه وعلى المدير */}
              <Route path="/my-performance" element={<MyPerformance />} />
              {/* ملف المعلم الرقمي — لوحة المعلم ومعاينة تقريره، وسياسات القاعدة تقصرها عليه */}
              <Route path="/my-dfile" element={<MyDfile />} />
              {/* النماذج والشهادات — النماذج المتاحة للمعلم تحدّدها سياسات القاعدة */}
              {/* key مختلف: الانتقال بين الصفحتين يبدأ مكوّنًا جديدًا فلا يبقى تبويب الأخرى مفتوحًا */}
              <Route path="/forms" element={<Forms key="issue" />} />
              <Route path="/forms-review" element={<Forms key="review" view="review" />} />
              <Route path="/my-signature" element={<MySignature />} />
              {/* استوديو البوابة — قوالب الهوية البصرية للطباعة والتصدير */}
              <Route path="/studio" element={<Studio />} />
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
          {/* معمل الحاسب الآلي — لمعلمي التقنية الرقمية المخوّلين ولمسؤولي المعمل */}
          <Route path="/lab/r/:seat" element={<LabReportRedirect />} />
          <Route path="/lab/g/:code" element={<LabGradeLink />} />
          <Route path="/q/g/:code" element={<OfflineGradeLink />} />
          <Route path="/offline-quiz" element={<OfflineQuizMissing />} />
          {(effectiveRole === "admin" && LAB_MANAGER_ROLES.some((r) => adminRoles.includes(r))) ||
           (effectiveRole === "teacher" && grantedTabs.has("computer_lab")) ? (
            <Route path="/lab" element={<Lab />} />
          ) : null}
          {/* الأنشطة: حقيبة الانتظار والأنشطة الصفية وأدوات الصف — للمعلمين، ويديرها وكيل الشؤون التعليمية */}
          {effectiveRole === "teacher" ||
           (effectiveRole === "admin" && ["deputy_academic", "principal", "tech_support"].some((r) => adminRoles.includes(r))) ? (
            <Route path="/activities" element={<Activities />} />
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
          <Route path="/notebook" element={<Notebook />} />
          {/* إحالة الطالب — الشاشة للمعلم والإدارة، والملف لصاحبه وولي أمره */}
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/guidance" element={<Guidance />} />
          {effectiveRole === "admin" && <Route path="/student-requests" element={<StudentRequests />} />}
          {effectiveRole === "admin" && <Route path="/absence-excuses" element={<AbsenceExcuses />} />}
          {/* ملف الطالب الشامل — الصفحة تحصر الطلاب في صفوف المستخدم، والدوال تفرض الصلاحية */}
          {effectiveRole === "admin" && <Route path="/student-file" element={<StudentFile />} />}
          {/* صفحات الأقسام العامة لقائمة الإدارة — تعرض ما تعرضه القائمة للمستخدم فقط */}
          {effectiveRole === "admin" && <Route path="/s/:key" element={<SectionHub />} />}
          {/* شاشة المتابعة اليومية — للمدير والوكيلين والدعم الفني (عنصر القائمة يحصرها، والقاعدة تفرض ما يُقرأ) */}
          {effectiveRole === "admin" && <Route path="/monitor" element={<MonitorScreen />} />}
          {/* مركز تحليل النتائج — الصفحة تتحقق من الدور (وكيل الشؤون التعليمية والموجهون…)
              وبوابة AchGate تُبقيه مغلقًا حتى اكتمال رصد الدرجات */}
          <Route path="/achievement" element={<AchGate><AchievementCenter /></AchGate>} />
          <Route path="/qiyas" element={<Qiyas />} />
          <Route path="/my-qiyas" element={<MyQiyas />} />
          <Route path="/ach-committee" element={<AchCommittee />} />
          {/* نموذج ملاحظة التحصيل — للمعلم نماذجه وللموجه والوكيل؛ القاعدة تفرض الصلاحية */}
          <Route path="/ach-forms" element={<AchGate><AchFormsList /></AchGate>} />
          <Route path="/ach-forms/:id" element={<AchGate><AchForm /></AchGate>} />
          {/* التعاميم: الإدارة لصاحب الصلاحية، وصفحة التعميم وتعاميمي للمنسوبين وأولياء الأمور */}
          {effectiveRole === "admin" && can("circulars") && <Route path="/circulars" element={<Circulars />} />}
          {["admin", "teacher", "guardian"].includes(effectiveRole) && <Route path="/circulars/:id" element={<CircularView />} />}
          {["admin", "teacher", "guardian"].includes(effectiveRole) && <Route path="/my-circulars" element={<MyCirculars />} />}
          {/* الترشيحات: إعلانات التقديم للإدارة، و«فرص المشاركة» للطالب وولي الأمر — القاعدة تفرض الصلاحيات */}
          {effectiveRole === "admin" && <Route path="/nominations" element={<Nominations />} />}
          {effectiveRole === "admin" && <Route path="/nominations/:id" element={<Nominations />} />}
          {(effectiveRole === "student" || effectiveRole === "guardian") && <Route path="/opportunities" element={<Opportunities />} />}
          {effectiveRole === "student" && <Route path="/my-scouts" element={<MyScouts />} />}
          {/* بنك الأسئلة — للمعلمين والإدارة؛ القاعدة تُظهر للمعلم أسئلته والمشارك من غيره */}
          {(effectiveRole === "teacher" || effectiveRole === "admin") && <Route path="/qbank" element={<QuestionBank />} />}
          {/* استمارة توضيح مستوى الطالب — للمعلم سطره، وللتوجيه والوكيل، ولولي الأمر نسخته */}
          <Route path="/inquiry/:id" element={<GuidanceInquiry />} />
          {/* ملاحظات الطلاب — الصفحة تتحقق من الدور، والقاعدة تفرض من يكتب كل نوع */}
          <Route path="/student-notes" element={<StudentNotes />} />
          {/* الطلاب المنقطعون — المعلم يبلّغ عن طلاب فصوله، والوكيل يطوي القيد ويعيد؛ القاعدة تفرض الصلاحية */}
          {(effectiveRole === "teacher" || effectiveRole === "admin") && <Route path="/dropouts" element={<StudentDropouts />} />}
          {/* ميثاق أخلاقيات المهنة — المعلم يطّلع ويقرّ، والتقرير للمدير ووكيل الشؤون التعليمية والدعم الفني */}
          {(effectiveRole === "teacher" || effectiveRole === "admin") && <Route path="/ethics" element={<EthicsCode />} />}
          {effectiveRole === "admin" && ["principal", "deputy_academic", "tech_support"].some((r) => adminRoles.includes(r)) &&
            <Route path="/ethics-report" element={<EthicsReport />} />}
          {/* جداول الاختبارات: العرض للجميع، والإدارة بصلاحية */}
          <Route path="/exams" element={<ExamSchedules />} />
          <Route path="/my-week" element={<MyWeek />} />
          {/* الأحداث والمناسبات — لكل معلم وإداري */}
          <Route path="/events" element={<Events />} />
          <Route path="/events-reports" element={<EventsReports />} />
          {/* التطوير المهني: تقارير جلسات مجتمع التعلم المهني — الصفحة والقاعدة تتحققان من الدور */}
          <Route path="/plc" element={<Plc />} />
          <Route path="/plc/:id" element={<Plc />} />
          <Route path="/plc-departments" element={<PlcDepartments />} />
          <Route path="/plc-file" element={<PlcFile />} />
          <Route path="/xvisits" element={<ExchangeVisits />} />
          <Route path="/xvisits/:id" element={<ExchangeVisits />} />
          {/* خطط التطوير (حلقة التحسين) — للمعلم خططه، وللزائر ما يتابعه، وللمدير اللوحة؛ القاعدة تفرض الصلاحية */}
          {(effectiveRole === "teacher" || effectiveRole === "admin") && <Route path="/improve" element={<Improve />} />}
          <Route path="/pd" element={<PdReports />} />
          <Route path="/pd/:id" element={<PdReports />} />
          {/* اختباراتي — للمعلم */}
          <Route path="/quizzes" element={<MyQuizzes />} />
          <Route path="/quiz-marks" element={<QuizMarks />} />
          <Route path="/quiz-analytics" element={<QuizAnalytics />} />
          {/* الاختبار الإلكتروني — يؤدّيه الطالب المُسند إليه (الصفحة تتحقق) */}
          <Route path="/quiz/:id" element={<QuizTake />} />
          {/* مركز التدريب (القدرات) — لكل الصفوف ولكل حساب عدا ولي الأمر، وأسئلة المعلمين للمعلم والإدارة */}
          {effectiveRole !== "guardian" && <Route path="/qudrat" element={<Qudrat />} />}
          {(effectiveRole === "teacher" || effectiveRole === "admin") && <Route path="/qudrat/questions" element={<QudratQuestions />} />}
          {/* أسئلة الطلاب لمعلم المادة، ولوحة المتابعة للإدارة؛ القاعدة تفرض من يرى ماذا */}
          {(effectiveRole === "teacher" || effectiveRole === "admin") && <Route path="/qudrat/asks" element={<QudratAsks />} />}
          {effectiveRole === "admin" && <Route path="/qudrat/admin" element={<QudratAdmin />} />}
          {effectiveRole === "admin" && <Route path="/qudrat/report" element={<QudratReport />} />}
          <Route path="/referral/:id" element={<ReferralView />} />
          {/* نماذج السلوك والمواظبة — الإصدار للإدارة والموجهين، والنموذج لصاحبه وولي أمره */}
          <Route path="/behavior" element={<BehaviorForms />} />
          {/* شهادة تعريف طالب منتظم — لمن له صلاحية كشوف الطلاب */}
          <Route path="/student-certificate" element={<StudentCertificate />} />
          <Route path="/behavior/:id" element={<BehaviorFormView />} />
          {/* دليل الاستخدام — يعرض لكل مستخدم ما يخصّ دوره */}
          <Route path="/help" element={<Help />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/notify-guide" element={<NotifyGuide />} />
          <Route path="/ticket/:id" element={<TicketDetail />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

// رابط رمز QR على خلفية جهاز المعمل أو ملصقه (/lab/r/5) ← صفحة البلاغ والجهاز محدد.
// قبل الدخول يُحفظ الرابط في الجلسة، ويُفتح بعد تسجيل الدخول مباشرة.
function LabReportRedirect() {
  const { seat } = useParams();
  const { session } = useSession();
  // 0 = لوحة البلاغ العامة في المعمل: يُختار الجهاز من الرسم
  const target = `/lab?report=${Number(seat) || 0}`;
  if (!session) {
    try { sessionStorage.setItem("mk_after_login", target); } catch { /* تجاهل */ }
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={target} replace />;
}
