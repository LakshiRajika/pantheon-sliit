import { useAuth } from '../contexts/AuthContext'

// Hides/shows UI based on permissions the server granted. UX only — the backend re-checks every call.
export function usePermission(permission) {
  const { user } = useAuth()
  return !!user?.permissions?.includes(permission)
}
