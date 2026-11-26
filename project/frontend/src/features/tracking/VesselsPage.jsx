import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ship, MapPin } from 'lucide-react'
import { listVessels, getVesselPositions } from '../../api/tracking'
import Card from '../../components/common/Card'
import { LoadingState, ErrorState, EmptyState } from '../../components/common/QueryStates'
import { formatDateTime, humanize, parseDate } from '../../utils/format'

export default function VesselsPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['vessels'], queryFn: listVessels })
  const [selected, setSelected] = useState(null)

  if (isLoading) return <LoadingState label="Loading vessels…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  if (!data.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border-2 border-ink/10">
        <EmptyState icon={Ship} title="No vessels recorded yet">
          Vessel and position records appear here once they're stored. The Tracking Agent currently uses
          simulated tracking data inside each workflow, shown on the shipment page.
        </EmptyState>
      </div>
    )
  }

  const current = selected ?? data[0]?.id

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card title={`Vessels · ${data.length}`}>
        <ul className="-mx-2 space-y-1">
          {data.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setSelected(v.id)}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition ${current === v.id ? 'bg-ink text-cream' : 'hover:bg-cream-deep'}`}
                aria-pressed={current === v.id}
              >
                <Ship className={`size-4 ${current === v.id ? 'text-orange' : 'text-ink/50'}`} aria-hidden />
                <span className="flex-1 truncate text-sm font-medium">{v.name}</span>
                <span className={`font-mono text-xs ${current === v.id ? 'text-cream/60' : 'text-ink/50'}`}>IMO {v.imo_number ?? '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {current && <Positions vesselId={current} name={data.find((v) => v.id === current)?.name} />}
    </div>
  )
}

function Positions({ vesselId, name }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vessels', vesselId, 'positions'],
    queryFn: () => getVesselPositions(vesselId),
  })
  const rows = [...(data ?? [])].sort((a, b) => parseDate(b.recorded_at) - parseDate(a.recorded_at))

  return (
    <Card title={`Position history · ${name ?? ''}`}>
      {isLoading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={refetch} /> : !rows.length ? (
        <EmptyState icon={MapPin} title="No positions recorded" />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink/55">
            <tr><th className="pb-2">Recorded</th><th className="pb-2">Latitude</th><th className="pb-2">Longitude</th><th className="pb-2">Source</th></tr>
          </thead>
          <tbody className="divide-y divide-ink/10 font-mono">
            {rows.map((p, i) => (
              <tr key={i}>
                <td className="py-2 font-sans">{formatDateTime(p.recorded_at)}</td>
                <td className="py-2 tabular-nums">{p.lat.toFixed(4)}</td>
                <td className="py-2 tabular-nums">{p.lon.toFixed(4)}</td>
                {/* Freshness/source disclosed per architecture §26 (simulated vs live data). */}
                <td className="py-2 font-sans">{humanize(p.source)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
