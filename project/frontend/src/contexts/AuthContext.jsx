import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { login as apiLogin, getMe } from '../api/auth'
import { tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  // 'loading' while restoring a saved token, then 'authenticated' | 'anonymous'
  const [status, setStatus] = useState(tokenStore.get() ? 'loading' : 'anonymous')

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [queryClient])

  // Restore session from a saved token on first load.
  useEffect(() => {
    if (status !== 'loading') return
    getMe()
      .then((me) => { setUser(me); setStatus('authenticated') })
      .catch(() => logout())
  }, [status, logout])

  // Any 401 from the API (expired/revoked token) signs the user out.
  useEffect(() => {
    window.addEventListener('pantheon:unauthorized', logout)
    return () => window.removeEventListener('pantheon:unauthorized', logout)
  }, [logout])

  // Sign in, then load the account (role + permissions) from the server. The role always
  // comes from the backend; the caller routes to that role's workspace.
  const login = useCallback(async (email, password) => {
    const { access_token } = await apiLogin(email, password)
    tokenStore.set(access_token)
    let me
    try {
      me = await getMe()
    } catch (err) {
      tokenStore.clear()
      throw err
    }
    setUser(me)
    setStatus('authenticated')
    return me
  }, [])

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
