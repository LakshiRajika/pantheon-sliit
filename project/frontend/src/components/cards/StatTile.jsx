// Headline number. `attention` adds an orange rule for values that need action (e.g. pending reviews > 0).
export default function StatTile({ label, value, hint, attention = false, loading = false }) {
  return (
    <div className={`rounded-lg border-2 bg-cream p-5 ${attention ? 'border-orange' : 'border-ink/10'}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">{label}</p>
      <p className="mt-2 font-sans text-4xl font-semibold tabular-nums tracking-[-0.02em]">
        {loading ? <span className="inline-block h-9 w-16 animate-pulse rounded bg-cream-deep align-middle" /> : value}
      </p>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
    </div>
  )
}
