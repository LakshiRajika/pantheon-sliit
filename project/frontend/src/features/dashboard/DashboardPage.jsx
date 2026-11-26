import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../routes/roleRoutes'
import RoleOverview from './RoleOverview'

// Common dashboard. Content adapts to the signed-in role via roleRoutes.js.
export default function DashboardPage() {
  const { user } = useAuth()
  const role = ROLES[user.role]
  const sections = role.nav.filter((n) => n.path !== 'dashboard')
  const firstName = user.full_name.split(' ')[0]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="relative overflow-hidden rounded-xl bg-ink p-8 text-cream">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-cream/50">{role.label} workspace</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome back, <span className="text-orange">{firstName}</span>.
        </h2>
        <p className="mt-2 max-w-xl text-cream/70">{role.tagline}</p>
        <role.icon className="pointer-events-none absolute -bottom-6 right-6 size-40 text-cream/[0.06]" aria-hidden />
      </section>

      <RoleOverview role={user.role} slug={role.slug} />

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink/60">Your workspace</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={`/app/${role.slug}/${path}`}
              className="group flex items-center gap-4 rounded-lg border-2 border-ink/10 bg-cream p-5 transition hover:border-ink"
            >
              <span className="grid size-10 place-items-center rounded-md bg-ink text-orange">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex-1 font-semibold">{label}</span>
              <ArrowRight className="size-4 text-ink/40 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {/* Permission list is a technical view, shown to administrators only. */}
      {user.role === 'admin' && (
        <details className="rounded-lg border border-ink/10 p-6">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-ink/60">Your access</summary>
          <p className="mt-2 text-sm text-ink/60">Permissions granted to your role by the server.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {user.permissions.map((p) => (
              <li key={p} className="rounded border border-ink/15 bg-cream-deep/50 px-2 py-1 font-mono text-xs">{p}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
