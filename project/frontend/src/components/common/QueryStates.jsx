import { CircleAlert, LoaderCircle, Inbox } from 'lucide-react'

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-14 text-ink/60" role="status">
      <LoaderCircle className="size-5 animate-spin text-orange" aria-hidden /> {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <CircleAlert className="size-7 text-orange" aria-hidden />
      <p className="max-w-md text-sm text-ink/75">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-md border-2 border-ink px-3 py-1.5 text-sm font-semibold hover:bg-ink hover:text-cream">
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon className="size-7 text-ink/30" aria-hidden />
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-ink/60">{children}</div>}
    </div>
  )
}
