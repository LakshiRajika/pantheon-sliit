import { useRealtime } from '../../contexts/WebSocketContext'

const LABELS = {
  live: 'Live',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
}

// Small "Live" pill. When not live, data falls back to periodic refresh.
export default function ConnectionIndicator() {
  const { connection } = useRealtime()
  const live = connection === 'live'
  return (
    <span
      className="hidden items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink/60 md:inline-flex"
      title={live ? 'Receiving live updates' : 'Live updates unavailable; data refreshes periodically'}
      role="status"
    >
      <span className={`size-2 rounded-full ${live ? 'bg-ink' : 'animate-pulse bg-orange'}`} aria-hidden />
      {LABELS[connection]}
    </span>
  )
}
