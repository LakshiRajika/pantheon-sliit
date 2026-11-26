import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLES, dashboardPathFor } from '../routes/roleRoutes'

// Keeps users inside their own workspace URL (/app/<their slug>/...).
// Typing another role's URL just redirects home. UX only; not a security boundary.
export default function RoleGuard() {
  const { user } = useAuth()
  const { roleSlug } = useParams()
  if (ROLES[user.role]?.slug !== roleSlug) return <Navigate to={dashboardPathFor(user.role)} replace />
  return <Outlet />
}
