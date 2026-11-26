import StatusBadge from '../common/StatusBadge'
import { humanize } from '../../utils/format'

// Renders an agent's structured output generically (shapes differ per agent).
export default function ResultView({ value, depth = 0 }) {
  if (value === null || value === undefined || value === '') return <span className="text-ink/40">—</span>
  if (typeof value !== 'object') {
    const s = String(value)
    return /^[A-Z][A-Z_]+$/.test(s) ? <StatusBadge value={s} /> : <span className="break-words">{s}</span>
  }
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-ink/40">None</span>
    return (
      <ul className="list-disc space-y-0.5 pl-5">
        {value.map((v, i) => <li key={i}><ResultView value={v} depth={depth + 1} /></li>)}
      </ul>
    )
  }
  return (
    <dl className={`grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr] ${depth ? 'mt-1' : ''}`}>
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink/55">{humanize(k)}</dt>
          <dd><ResultView value={v} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  )
}
