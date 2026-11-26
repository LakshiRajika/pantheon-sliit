import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../routes/roleRoutes'

// Catch-all for unknown sections inside a workspace: send the user back to their dashboard.
export default function WorkspacePlaceholder() {
  const { user } = useAuth()
  return <Navigate to={`/app/${ROLES[user.role].slug}/dashboard`} replace />
}
