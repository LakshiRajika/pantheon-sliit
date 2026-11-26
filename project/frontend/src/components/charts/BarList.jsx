import { humanize } from '../../utils/format'
import { statusTone, TONE_BAR } from '../common/StatusBadge'

/**
 * Horizontal bar list for a single series of counts (magnitude by category).
 * Status categories (Completed, Running, Awaiting review, Failed…) are coloured on the shared
 * progress scale; any other category (ports, roles) stays ink. Every row is direct-labelled,
 * so meaning never depends on colour alone. Hovering a row shows the exact value and share.
 * items: [{ key, value, label? }]
 */
export default function BarList({ items, emptyText = 'No data yet.', sort = true, formatLabel = humanize }) {
  const rows = sort ? [...items].sort((a, b) => b.value - a.value) : items
  const total = rows.reduce((s, r) => s + r.value, 0)
  const max = Math.max(1, ...rows.map((r) => r.value))

  if (!rows.length || total === 0) return <p className="py-6 text-center text-sm text-ink/55">{emptyText}</p>

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0
        const tone = statusTone(r.key)
        const barColor = tone === 'neutral' ? 'bg-ink group-hover:bg-ink-soft' : `${TONE_BAR[tone]} group-hover:opacity-85`
        return (
          <li key={r.key} className="group" title={`${r.label ?? formatLabel(r.key)}: ${r.value} (${pct}%)`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{r.label ?? formatLabel(r.key)}</span>
              <span className="shrink-0 font-mono tabular-nums">
                {r.value}<span className="hidden text-ink/45 group-hover:inline"> · {pct}%</span>
              </span>
            </div>
            <div className="h-2 rounded-r bg-cream-deep/70">
              <div
                className={`h-2 rounded-r transition-[width,opacity] ${barColor}`}
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Helper: turn { STATUS: count } objects into BarList items.
export const toItems = (obj) => Object.entries(obj ?? {}).map(([key, value]) => ({ key, value: Number(value) || 0 }))

// Helper: count an array by a key function.
export function countBy(list, fn) {
  const out = {}
  for (const x of list ?? []) {
    const k = fn(x) || 'Not set'
    out[k] = (out[k] ?? 0) + 1
  }
  return toItems(out)
}
