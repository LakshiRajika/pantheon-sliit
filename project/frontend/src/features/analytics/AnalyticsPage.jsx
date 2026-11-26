import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalyticsDashboard } from '../../api/analytics'
import { useShipments } from '../../hooks/useShipments'
import StatTile from '../../components/cards/StatTile'
import Card from '../../components/common/Card'
import BarList, { toItems, countBy } from '../../components/charts/BarList'
import { ErrorState } from '../../components/common/QueryStates'
import { parseDate } from '../../utils/format'

const DAYS = 14
const keepLabel = (k) => k

// Management analytics: aggregate KPIs from /analytics/dashboard plus breakdowns
// computed from the shipment list (management may read all shipments).
export default function AnalyticsPage() {
  const analytics = useQuery({ queryKey: ['analytics', 'dashboard'], queryFn: getAnalyticsDashboard })
  const shipments = useShipments()
  const data = shipments.data ?? []

  const daily = useMemo(() => {
    const days = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      days.push({ date: d, value: 0 })
    }
    for (const s of data) {
      const c = parseDate(s.created_at)
      if (!c) continue
      c.setHours(0, 0, 0, 0)
      const slot = days.find((d) => d.date.getTime() === c.getTime())
      if (slot) slot.value += 1
    }
    return days
  }, [data])

  if (analytics.error) return <ErrorState error={analytics.error} onRetry={analytics.refetch} />
  const a = analytics.data
  const perRun = a?.total_shipments ? (a.total_workflows_run / a.total_shipments).toFixed(1) : '—'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total shipments" value={a?.total_shipments ?? 0} loading={analytics.isLoading} />
        <StatTile label="Workflow runs" value={a?.total_workflows_run ?? 0} loading={analytics.isLoading} />
        <StatTile label="Runs per shipment" value={perRun} loading={analytics.isLoading} hint="includes re-runs" />
        <StatTile label={`New in last ${DAYS} days`} value={daily.reduce((s, d) => s + d.value, 0)} loading={shipments.isLoading} />
      </div>

      <Card title={`Shipments created per day · last ${DAYS} days`}>
        <DailyColumns days={daily} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By status"><BarList items={toItems(a?.by_status)} /></Card>
        <Card title="By risk level"><BarList items={toItems(a?.by_risk_level)} /></Card>
        <Card title="By destination port"><BarList items={countBy(data, (s) => s.destination_port)} formatLabel={keepLabel} /></Card>
        <Card title="By origin port"><BarList items={countBy(data, (s) => s.origin_port)} formatLabel={keepLabel} /></Card>
      </div>
    </div>
  )
}

// Single-series column chart (change over time). One hue, baseline-anchored, value on hover,
// with the busiest day direct-labeled. A visually hidden table carries the same data.
function DailyColumns({ days }) {
  const max = Math.max(1, ...days.map((d) => d.value))
  const peak = days.reduce((p, d) => (d.value > p.value ? d : p), days[0])
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div>
      <div className="flex h-40 items-end gap-1.5 border-b border-ink/20" aria-hidden>
        {days.map((d) => (
          <div key={d.date.toISOString()} className="group relative flex h-full flex-1 items-end" title={`${fmt(d.date)}: ${d.value}`}>
            <div
              className="w-full rounded-t bg-ink transition group-hover:bg-orange"
              style={{ height: d.value ? `${(d.value / max) * 100}%` : '2px', opacity: d.value ? 1 : 0.15 }}
            />
            {d === peak && d.value > 0 && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-xs tabular-nums">{d.value}</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink/50" aria-hidden>
        <span>{fmt(days[0].date)}</span>
        <span>{fmt(days[days.length - 1].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Shipments created per day</caption>
        <thead><tr><th>Date</th><th>Shipments</th></tr></thead>
        <tbody>{days.map((d) => <tr key={d.date.toISOString()}><td>{fmt(d.date)}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
