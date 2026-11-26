import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FilePlus, Package, Search, ArrowRight } from 'lucide-react'
import { useShipments } from '../../hooks/useShipments'
import { usePermission } from '../../hooks/usePermission'
import { LoadingState, ErrorState, EmptyState } from '../../components/common/QueryStates'
import StatusBadge from '../../components/common/StatusBadge'
import { formatDate, parseDate } from '../../utils/format'

export default function ShipmentsListPage() {
  const { roleSlug } = useParams()
  const navigate = useNavigate()
  const canCreate = usePermission('shipment:create')
  const { data, isLoading, error, refetch } = useShipments()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')

  const statuses = useMemo(() => ['ALL', ...new Set((data ?? []).map((s) => s.status))], [data])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? [])
      .filter((s) => status === 'ALL' || s.status === status)
      .filter((s) =>
        !q || [s.shipment_reference, s.origin_port, s.destination_port].some((v) => v?.toLowerCase().includes(q)),
      )
      .sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at))
  }, [data, query, status])

  const open = (id) => navigate(`/app/${roleSlug}/shipments/${id}`)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Search shipments</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" aria-hidden />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by reference or port"
            className="w-full rounded-md border-2 border-ink/15 bg-white/60 py-2 pl-9 pr-3 text-sm focus:border-ink focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink/60">Status</span>
          <select
            value={status} onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border-2 border-ink/15 bg-white/60 px-2.5 py-2 focus:border-ink focus:outline-none"
          >
            {statuses.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All' : s}</option>)}
          </select>
        </label>
        {canCreate && (
          <Link
            to={`/app/${roleSlug}/submit`}
            className="inline-flex items-center gap-2 rounded-md bg-orange px-4 py-2 text-sm font-semibold text-ink hover:bg-orange-deep"
          >
            <FilePlus className="size-4" aria-hidden /> New shipment
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border-2 border-ink/10">
        {isLoading ? (
          <LoadingState label="Loading shipments…" />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Package} title={data?.length ? 'No shipments match your filters' : 'No shipments yet'}>
            {!data?.length && (canCreate
              ? 'Submit your first shipment to start AI processing.'
              : 'Shipments you have access to will appear here.')}
          </EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-ink text-cream">
              <tr>
                <Th>Reference</Th>
                <Th className="hidden md:table-cell">Route</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Risk</Th>
                <Th className="hidden lg:table-cell">Created</Th>
                <Th><span className="sr-only">Open</span></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((s) => (
                <tr
                  key={s.id} onClick={() => open(s.id)}
                  className="group cursor-pointer bg-cream transition hover:bg-cream-deep/60"
                >
                  <td className="px-4 py-3 font-mono font-medium">
                    <Link to={`/app/${roleSlug}/shipments/${s.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                      {s.shipment_reference}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-ink/75 md:table-cell">
                    {s.origin_port || '—'} <span className="text-ink/35">→</span> {s.destination_port || '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={s.status} /></td>
                  <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge value={s.risk_level} /></td>
                  <td className="hidden px-4 py-3 text-ink/65 lg:table-cell">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <ArrowRight className="ml-auto size-4 text-ink/30 transition group-hover:text-ink" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!!data?.length && <p className="text-xs text-ink/50">{rows.length} of {data.length} shipments</p>}
    </div>
  )
}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider ${className}`}>{children}</th>
}
