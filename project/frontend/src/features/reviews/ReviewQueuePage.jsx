import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ClipboardCheck, ArrowRight } from 'lucide-react'
import { useReviewQueue } from '../../hooks/useReviews'
import { useShipments } from '../../hooks/useShipments'
import { LoadingState, ErrorState, EmptyState } from '../../components/common/QueryStates'
import StatusBadge from '../../components/common/StatusBadge'
import { humanize, parseDate, timeAgo, formatDateTime } from '../../utils/format'

const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export default function ReviewQueuePage() {
  const { roleSlug } = useParams()
  const { data, isLoading, error, refetch } = useReviewQueue()
  const { data: shipments } = useShipments() // customs can read all shipments; used to show references

  const refById = useMemo(
    () => Object.fromEntries((shipments ?? []).map((s) => [s.id, s.shipment_reference])),
    [shipments],
  )

  // Highest priority first, then oldest first (the longest-waiting case at the top).
  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || parseDate(a.created_at) - parseDate(b.created_at)),
    [data],
  )

  if (isLoading) return <LoadingState label="Loading review queue…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink/70">
          {rows.length
            ? <><span className="font-semibold text-ink">{rows.length}</span> pending {rows.length === 1 ? 'case needs' : 'cases need'} a decision. Updates live.</>
            : 'Cases escalated by the Risk & Inspection Agent appear here.'}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-ink/10">
          <EmptyState icon={ClipboardCheck} title="Queue is clear">No shipments are waiting for review.</EmptyState>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/app/${roleSlug}/review-queue/${r.id}`}
                className={`group flex items-center gap-5 rounded-lg border-2 bg-cream p-5 transition hover:border-ink ${r.priority === 'HIGH' || r.priority === 'CRITICAL' ? 'border-orange/70' : 'border-ink/10'}`}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={r.priority} />
                    <span className="font-mono text-xs uppercase tracking-wider text-ink/55">{humanize(r.review_type)}</span>
                    <span className="text-ink/25">·</span>
                    <span className="font-mono text-sm font-medium">{refById[r.shipment_id] ?? `Shipment ${r.shipment_id.slice(0, 8)}`}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-ink/80">{r.reason}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-medium" title={formatDateTime(r.created_at)}>{timeAgo(r.created_at)}</p>
                  <p className="text-xs text-ink/50">waiting</p>
                </div>
                <ArrowRight className="size-5 shrink-0 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
