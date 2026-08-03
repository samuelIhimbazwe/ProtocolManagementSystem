import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './layouts/AppShell'
import LoginPage from './pages/Login'
import ForgotPasswordPage from './pages/ForgotPassword'
import ResetPasswordPage from './pages/ResetPassword'
import DashboardPage from './pages/Dashboard'
import MembersPage from './pages/Members'
import UserAccountsPage from './pages/UserAccounts'
import MemberProfilePage from './pages/MemberProfile'
import AttendanceDashboardPage from './pages/AttendanceDashboard'
import AttendanceRecordPage from './pages/AttendanceRecord'
import SchedulingPage from './pages/Scheduling'
import ReportsPage from './pages/Reports'
import FinancePage from './pages/Finance'
import FinanceReportDetailPage from './pages/FinanceReportDetail'
import SettingsPage from './pages/Settings'
import ActivityPage from './pages/Activity'
import NotificationsPage from './pages/Notifications'
import OfficeReportBuilderPage from './pages/OfficeReportBuilderPage'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/accounts" element={<UserAccountsPage />} />
        <Route path="members/:id" element={<MemberProfilePage />} />
        <Route path="attendance" element={<AttendanceDashboardPage />} />
        <Route path="attendance/record" element={<AttendanceRecordPage />} />
        <Route path="scheduling" element={<SchedulingPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="finance/reports/:reportId" element={<FinanceReportDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="office-reports" element={<OfficeReportBuilderPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
