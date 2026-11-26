import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useRealtime } from '../../contexts/WebSocketContext'
import { formatDateTime } from '../../utils/format'

export default function NotificationBell() {
  const { notifications, markAllRead } = useRealtime()
  const { roleSlug } = useParams()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const toggle = () => {
    if (!open) markAllRead()
    setOpen((o) => !o)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-md p-2 transition hover:bg-cream-deep"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-orange px-1 font-mono text-[10px] font-semibold text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border-2 border-ink bg-cream shadow-[4px_4px_0_0_#111111]">
          <p className="border-b border-ink/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink/60">Notifications</p>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink/55">Nothing yet. Workflow and review updates appear here live.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-ink/10 overflow-y-auto">
              {notifications.map((n) => {
                // Officers go straight to the review; everyone else to the shipment.
                const reviewId = n.event.event === 'review.created' && roleSlug === 'customs' ? n.event.data?.review_id : null
                const to = reviewId
                  ? `/app/${roleSlug}/review-queue/${reviewId}`
                  : n.event.shipment_id ? `/app/${roleSlug}/shipments/${n.event.shipment_id}` : null
                const body = (
                  <div className="flex gap-3 px-4 py-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.attention ? 'bg-orange' : 'bg-ink/30'}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-sm text-ink/70">{n.body}</p>
                      <time className="mt-0.5 block font-mono text-[11px] text-ink/45">{formatDateTime(n.event.timestamp)}</time>
                    </div>
                  </div>
                )
                return (
                  <li key={n.id}>
                    {to ? <Link to={to} onClick={() => setOpen(false)} className="block hover:bg-cream-deep/60">{body}</Link> : body}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
