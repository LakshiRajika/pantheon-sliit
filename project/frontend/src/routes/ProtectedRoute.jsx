import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import FullPageLoader from '../components/common/FullPageLoader'

// Blocks rendering until a session exists. UX only — the backend authorizes every request.
export default function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoader />
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
