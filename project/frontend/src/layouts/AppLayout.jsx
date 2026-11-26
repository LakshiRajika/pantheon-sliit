import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../routes/roleRoutes'
import Sidebar from '../components/navigation/Sidebar'
import ConnectionIndicator from '../components/notifications/ConnectionIndicator'
import NotificationBell from '../components/notifications/NotificationBell'
import Toaster from '../components/notifications/Toaster'
import ChatWidget from '../components/chatbot/ChatWidget'

// The common dashboard shell for every role: left nav + header + routed content.
// What changes per role (nav items, assistant availability) comes from roleRoutes.js.
export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const roleConfig = ROLES[user.role]
  // Assistant only for roles configured with one AND granted chat:use by the server. Never admin.
  const showAssistant = roleConfig.hasAssistant && user.permissions.includes('chat:use')

  const section = location.pathname.split('/')[3]
  const title = roleConfig.nav.find((n) => n.path === section)?.label ?? 'Dashboard'

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <Sidebar
        roleConfig={roleConfig} user={user} onLogout={handleLogout}
        open={navOpen} onClose={() => setNavOpen(false)}
      />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-ink/10 bg-cream/90 px-6 py-4 backdrop-blur">
          <button
            onClick={() => setNavOpen(true)}
            className="-ml-2 rounded p-2 hover:bg-cream-deep lg:hidden" aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-4">
            <ConnectionIndicator />
            <NotificationBell />
          </div>
          <span className="hidden rounded-full border border-ink/20 px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink/70 sm:inline">
            {roleConfig.label}
          </span>
        </header>

        <main className={`px-6 py-8 ${showAssistant ? 'pb-28' : ''}`}>
          <Outlet />
        </main>
      </div>

      <Toaster />
      {showAssistant && <ChatWidget roleConfig={roleConfig} />}
    </div>
  )
}
