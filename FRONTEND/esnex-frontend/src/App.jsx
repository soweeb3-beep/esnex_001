import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useState, useEffect } from "react";
import "./App.css";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const Payment = lazy(() => import("./pages/Payment"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Result = lazy(() => import("./pages/Result"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const StudentMessages = lazy(() => import("./pages/StudentMessages"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminHomepage = lazy(() => import("./pages/admin/AdminHomepage"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminEnrollUser = lazy(() => import("./pages/admin/AdminEnrollUser"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const AdminLecturers = lazy(() => import("./pages/admin/AdminLecturers"));
const AdminStudents = lazy(() => import("./pages/admin/AdminStudents"));
const AdminAssessments = lazy(() => import("./pages/admin/AdminAssessments"));
const AdminAssessmentBuilder = lazy(() => import("./pages/admin/AdminAssessmentBuilder"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminCertificates = lazy(() => import("./pages/admin/AdminCertificates"));
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminSectionQuizzes = lazy(() => import("./pages/admin/AdminSectionQuizzes"));
const QuizExam = lazy(() => import("./pages/QuizExam"));
const UnifiedAssessment = lazy(() => import("./pages/UnifiedAssessment"));
const OralSelection = lazy(() => import("./pages/OralSelection"));
const OralWassce = lazy(() => import("./pages/OralWassce"));
const OralPrivate = lazy(() => import("./pages/OralPrivate"));
const OralAssessment = lazy(() => import("./pages/OralAssessment"));
const ResultReview = lazy(() => import("./pages/ResultReview"));
const GlobalAssessments = lazy(() => import("./pages/GlobalAssessments"));
const AssessmentExam = lazy(() => import("./pages/AssessmentExam"));
const NewAssessmentFlow = lazy(() => import("./pages/NewAssessmentFlow"));
const AssessmentPartSelector = lazy(() => import("./pages/AssessmentPartSelector"));
const UserProgress = lazy(() => import("./pages/UserProgress"));

import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import PremiumSidebar from "./components/PremiumSidebar";
import AdminLayout from "./components/AdminLayout";
import { useAuth } from "./context/AuthContext";
import BackToTop from "./components/BackToTop";

function AppContent() {
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isStudentDashboard = location.pathname.startsWith("/dashboard");
  const authPages = ["/login", "/register", "/forgot-password", "/reset-password"];
  const allowSidebar =
    user &&
    !location.pathname.startsWith("/admin") &&
    !isStudentDashboard &&
    !authPages.includes(location.pathname) &&
    location.pathname !== "/";

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const isAuthPage = authPages.includes(location.pathname);
    document.body.classList.toggle("auth-page", isAuthPage);
    return () => {
      if (isAuthPage) {
        document.body.classList.remove("auth-page");
      }
    };
  }, [location.pathname]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  // Hide navbar on admin and student dashboard pages
  const showNavbar = !location.pathname.startsWith("/admin") && !isStudentDashboard;

  return (
    <>
      {!location.pathname.startsWith("/admin") && (
        <a href="#main-content" className="sr-only sr-only-focusable">
          Skip to main content
        </a>
      )}
      {showNavbar && <Navbar onUserClick={allowSidebar ? toggleSidebar : undefined} />}
      {allowSidebar && <PremiumSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <main id="main-content" tabIndex={-1} className={sidebarOpen ? "with-sidebar" : ""}>
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div></div>}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route
            path="/payment/:productId"
            element={
              <ProtectedRoute role="student">
                <Payment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment/return"
            element={
              <ProtectedRoute role="student">
                <PaymentReturn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment-payment/:productId"
            element={
              <ProtectedRoute role="student">
                <Payment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes"
            element={
              <ProtectedRoute role="student">
                <Quiz />
              </ProtectedRoute>
            }
          />
          <Route path="/assessments" element={<GlobalAssessments />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route
            path="/results"
            element={
              <ProtectedRoute role="student">
                <Result />
              </ProtectedRoute>
            }
          />

          {/* STUDENT */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="student">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/:id"
            element={
              <ProtectedRoute role="student">
                <UnifiedAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/subject/:subject"
            element={
              <ProtectedRoute role="student">
                <UnifiedAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/subject/:subject/new"
            element={
              <ProtectedRoute role="student">
                <NewAssessmentFlow />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/subject/:subject/:part/*"
            element={
              <ProtectedRoute role="student">
                <UnifiedAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment-exam/:attemptId"
            element={
              <ProtectedRoute role="student">
                <AssessmentExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/:id"
            element={
              <ProtectedRoute role="student">
                <UnifiedAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/:assessmentId/oral"
            element={
              <ProtectedRoute role="student">
                <OralSelection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/:assessmentId/oral/wassce"
            element={
              <ProtectedRoute role="student">
                <OralWassce />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/:assessmentId/oral/private"
            element={
              <ProtectedRoute role="student">
                <OralPrivate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/:assessmentId/oral/run"
            element={
              <ProtectedRoute role="student">
                <OralAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/:assessmentId/:part/*"
            element={
              <ProtectedRoute role="student">
                <UnifiedAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/assessments/:assessmentId"
            element={
              <ProtectedRoute role="student">
                <AssessmentPartSelector />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attempt/:id"
            element={
              <ProtectedRoute>
                <ResultReview />
              </ProtectedRoute>
            }
          />

          <Route
            path="/messages"
            element={
              <ProtectedRoute role="student">
                <StudentMessages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute role="student">
                <UserProgress />
              </ProtectedRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="homepage" element={<AdminHomepage />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="enroll" element={<AdminEnrollUser />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="lecturers" element={<AdminLecturers />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="assessments" element={<AdminAssessments />} />
            <Route path="assessments/create" element={<AdminAssessmentBuilder />} />
            <Route path="assessments/edit/:id" element={<AdminAssessmentBuilder />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="certificates" element={<AdminCertificates />} />
            <Route path="roles" element={<AdminRoles />} />
            <Route path="section-quizzes" element={<AdminSectionQuizzes />} />
            <Route path="messages" element={<StudentMessages />} />
          </Route>
        </Routes>
        </Suspense>
      </main>
      <BackToTop />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
