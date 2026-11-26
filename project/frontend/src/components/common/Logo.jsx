// Pantheon wordmark. `tone` = 'dark' for use on cream, 'light' for use on the ink nav.
export default function Logo({ tone = 'dark', className = '' }) {
  const text = tone === 'light' ? 'text-cream' : 'text-ink'
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="6" fill={tone === 'light' ? '#F3EEE3' : '#111111'} />
        <path d="M8 24V9h9a5 5 0 0 1 0 10h-5v5" fill="none" stroke="#D9541E" strokeWidth="3" />
      </svg>
      <span className={`font-display text-xl font-semibold tracking-tight ${text}`}>Pantheon</span>
    </span>
  )
}
