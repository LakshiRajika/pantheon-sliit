import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ProtectedRoute from './ProtectedRoute'
import RoleGuard from './RoleGuard'
import { dashboardPathFor } from './roleRoutes'
import AppLayout from '../layouts/AppLayout'
import IndexPage from '../features/landing/IndexPage'
import LoginPage from '../features/auth/LoginPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import WorkspacePlaceholder from '../features/dashboard/WorkspacePlaceholder'
import ShipmentsListPage from '../features/shipments/ShipmentsListPage'
import ShipmentDetailPage from '../features/shipments/ShipmentDetailPage'
import SubmitShipmentPage from '../features/shipments/SubmitShipmentPage'
import ReviewQueuePage from '../features/reviews/ReviewQueuePage'
import ReviewDetailPage from '../features/reviews/ReviewDetailPage'
import VesselsPage from '../features/tracking/VesselsPage'
import AnalyticsPage from '../features/analytics/AnalyticsPage'
import { UsersPage, WorkflowsPage, AgentRunsPage, AuditPage, SystemHealthPage } from '../features/admin/AdminPages'

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={dashboardPathFor(user.role)} replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<HomeRedirect />} />
        <Route path="/app/:roleSlug" element={<RoleGuard />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="shipments" element={<ShipmentsListPage />} />
            <Route path="shipments/:shipmentId" element={<ShipmentDetailPage />} />
            <Route path="submit" element={<SubmitShipmentPage />} />
            <Route path="review-queue" element={<ReviewQueuePage />} />
            <Route path="review-queue/:reviewId" element={<ReviewDetailPage />} />
            <Route path="vessels" element={<VesselsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="agent-runs" element={<AgentRunsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="system-health" element={<SystemHealthPage />} />
            {/* Unknown sections redirect to the dashboard. Pages are reachable by URL only within the user's own workspace (RoleGuard); the backend authorizes the data. */}
            <Route path=":section" element={<WorkspacePlaceholder />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
