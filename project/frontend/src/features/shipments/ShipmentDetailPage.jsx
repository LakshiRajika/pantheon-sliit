import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock, PartyPopper } from 'lucide-react'
import { useShipment, useTimeline, useDocuments } from '../../hooks/useShipments'
import { usePermission } from '../../hooks/usePermission'
import Card from '../../components/common/Card'
import StatusBadge from '../../components/common/StatusBadge'
import { LoadingState, ErrorState, EmptyState } from '../../components/common/QueryStates'
import { formatDateTime, humanize, parseDate } from '../../utils/format'
import DocumentsCard from './DocumentsCard'
import WorkflowPanel from './WorkflowPanel'

export default function ShipmentDetailPage() {
  const { roleSlug, shipmentId } = useParams()
  const [params] = useSearchParams()
  const { data: s, isLoading, error, refetch } = useShipment(shipmentId)
  const { data: docs } = useDocuments(shipmentId)
  const canUpload = usePermission('document:upload')

  const back = (
    <Link to={`/app/${roleSlug}/shipments`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> All shipments
    </Link>
  )

  if (isLoading) return <LoadingState label="Loading shipment…" />
  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {back}
        <ErrorState
          error={error.status === 403 ? { message: 'You don’t have access to this shipment.' }
            : error.status === 404 || error.status === 422 ? { message: 'Shipment not found.' } : error}
          onRetry={error.status >= 500 || error.status === 0 ? refetch : undefined}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {back}

      <header className="rounded-xl bg-ink p-6 text-cream">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-cream/50">Shipment</p>
            <h2 className="mt-1 break-all font-mono text-2xl font-medium sm:text-3xl">{s.shipment_reference}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={s.status} />
            {s.risk_level && <StatusBadge value={s.risk_level} />}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-cream/10 pt-5 text-sm md:grid-cols-4">
          <Meta label="Origin" value={s.origin_port} />
          <Meta label="Destination" value={s.destination_port} />
          <Meta label="ETA" value={s.estimated_arrival ? formatDateTime(s.estimated_arrival) : null} />
          <Meta label="Created" value={formatDateTime(s.created_at)} />
        </dl>
      </header>

      {params.get('new') && canUpload && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-orange px-5 py-4">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-orange" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Shipment created.</span> Next, upload its documents below, then start the
            AI analysis.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <WorkflowPanel shipmentId={shipmentId} documentCount={docs?.length ?? 0} />
          <DocumentsCard shipmentId={shipmentId} />
        </div>
        <TimelineCard shipmentId={shipmentId} />
      </div>
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-cream/45">{label}</dt>
      <dd className="mt-0.5">{value || <span className="text-cream/35">Not set</span>}</dd>
    </div>
  )
}

function TimelineCard({ shipmentId }) {
  const { data, isLoading, error, refetch } = useTimeline(shipmentId)
  const events = [...(data ?? [])].sort((a, b) => parseDate(b.occurred_at) - parseDate(a.occurred_at))

  return (
    <Card title="Timeline" className="self-start">
      {isLoading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={refetch} /> : !events.length ? (
        <EmptyState icon={Clock} title="No events yet" />
      ) : (
        <ol className="relative space-y-5 border-l-2 border-ink/10 pl-5">
          {events.map((e, i) => (
            <li key={`${e.event_type}-${e.occurred_at}-${i}`} className="relative">
              <span className={`absolute -left-[27px] top-1 size-3 rounded-full border-2 border-cream ${i === 0 ? 'bg-orange' : 'bg-ink'}`} aria-hidden />
              <p className="text-sm font-semibold">{humanize(e.event_type)}</p>
              {e.description && <p className="mt-0.5 text-sm text-ink/70">{e.description}</p>}
              <time className="mt-1 block font-mono text-xs text-ink/50">{formatDateTime(e.occurred_at)}</time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
