import { NavLink } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import Logo from '../common/Logo'

// Left navigation. Items come from the role config, so each role sees its own nav.
export default function Sidebar({ roleConfig, user, onLogout, open, onClose }) {
  const { slug, label, nav } = roleConfig
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={'fixed inset-0 z-30 bg-ink/50 transition lg:hidden ' + (open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink text-cream transition-transform lg:translate-x-0 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between px-5 py-6">
          <Logo tone="light" />
          <button onClick={onClose} className="rounded p-1 text-cream/70 hover:text-cream lg:hidden" aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>

        <p className="px-5 pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cream/45">{label}</p>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ path, label: itemLabel, icon: Icon }) => (
            <NavLink
              key={path}
              to={`/app/${slug}/${path}`}
              onClick={onClose}
              className={({ isActive }) =>
                'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ' +
                (isActive ? 'bg-ink-soft text-cream' : 'text-cream/65 hover:bg-ink-soft/60 hover:text-cream')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={'absolute inset-y-1.5 left-0 w-1 rounded-r bg-orange transition ' + (isActive ? 'opacity-100' : 'opacity-0')} />
                  <Icon className={'size-4.5 ' + (isActive ? 'text-orange' : '')} aria-hidden />
                  {itemLabel}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-cream/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-orange font-semibold text-ink">
              {initials(user.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="truncate text-xs text-cream/50">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="rounded p-2 text-cream/60 transition hover:bg-ink-soft hover:text-orange"
              aria-label="Sign out" title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}
