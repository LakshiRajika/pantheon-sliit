import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useRealtime } from '../../contexts/WebSocketContext'

const TOAST_MS = 6000

// Briefly shows newly arrived notifications. They stay listed in the bell afterwards.
export default function Toaster() {
  const { notifications, dismissToast } = useRealtime()
  const fresh = notifications.filter((n) => n.fresh).slice(0, 3)

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {fresh.map((n) => <Toast key={n.id} n={n} dismiss={dismissToast} />)}
    </div>
  )
}

function Toast({ n, dismiss }) {
  const onClose = () => dismiss(n.id)
  // dismiss is stable, so the timer isn't reset when other notifications arrive.
  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), TOAST_MS)
    return () => clearTimeout(t)
  }, [n.id, dismiss])

  return (
    <div className={`pointer-events-auto flex gap-3 rounded-lg border-2 bg-ink px-4 py-3 text-cream shadow-lg ${n.attention ? 'border-orange' : 'border-ink'}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{n.title}</p>
        <p className="text-sm text-cream/75">{n.body}</p>
      </div>
      <button onClick={onClose} className="self-start rounded p-0.5 text-cream/60 hover:text-cream" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  )
}
