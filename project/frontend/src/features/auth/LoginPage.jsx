import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CircleAlert, LoaderCircle, Lock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { dashboardPathFor } from '../../routes/roleRoutes'
import Logo from '../../components/common/Logo'
import FullPageLoader from '../../components/common/FullPageLoader'

// Email + password only. The server decides the account's role, and the user is sent
// straight to that role's workspace.
export default function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') return <Navigate to={dashboardPathFor(user.role)} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const me = await login(email.trim(), password)
      navigate(dashboardPathFor(me.role), { replace: true })
    } catch (err) {
      if (err.status === 401) setError('Incorrect email or password.')
      else setError(err.message || 'Sign-in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-cream lg:flex">
        <Link to="/" aria-label="Pantheon home"><Logo tone="light" /></Link>
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">
            Welcome back
            <br />
            to the <span className="text-orange">port</span>.
          </p>
          <p className="mt-4 max-w-sm text-cream/65">
            Sign in to pick up where your team left off.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-cream/50">
          <Lock className="size-3.5" aria-hidden /> Secure sign-in
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-[28px] border-orange/90" />
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center bg-cream px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 inline-block lg:hidden" aria-label="Pantheon home"><Logo /></Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-ink/70">Use your Pantheon account.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-6" noValidate>
            <div className="space-y-4">
              <Field label="Email" id="email">
                <input
                  id="email" type="email" autoComplete="username" required autoFocus
                  value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  className={inputCls} placeholder="you@organisation.com"
                />
              </Field>
              <Field label="Password" id="password">
                <input
                  id="password" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  className={inputCls}
                />
              </Field>
            </div>

            {error && (
              <div role="alert" className="flex gap-2.5 rounded-md border-l-4 border-orange bg-cream-deep px-4 py-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-orange px-5 py-3 font-semibold text-ink transition hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              Sign in
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border-2 border-ink/15 bg-white/60 px-3.5 py-2.5 text-ink placeholder:text-ink/40 ' +
  'transition focus:border-ink focus:outline-none'

function Field({ label, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  )
}
