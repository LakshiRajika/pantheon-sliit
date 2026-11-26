import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useShipments } from '../../hooks/useShipments'
import { useReviewQueue } from '../../hooks/useReviews'
import { getAnalyticsDashboard } from '../../api/analytics'
import { listVessels } from '../../api/tracking'
import * as adminApi from '../../api/admin'
import { useRealtime } from '../../contexts/WebSocketContext'
import StatTile from '../../components/cards/StatTile'
import Card from '../../components/common/Card'
import BarList, { toItems, countBy } from '../../components/charts/BarList'
import StatusBadge from '../../components/common/StatusBadge'
import { ErrorState } from '../../components/common/QueryStates'
import { formatDate, parseDate, timeAgo, humanize } from '../../utils/format'
import { ROLES } from '../../routes/roleRoutes'

// Each role's overview uses only endpoints that role is permitted to call.
export default function RoleOverview({ role, slug }) {
  switch (role) {
    case 'shipping_agent': return <ShipmentsOverview slug={slug} own />
    case 'importer_exporter': return <ShipmentsOverview slug={slug} own />
    case 'customs_officer': return <CustomsOverview slug={slug} />
    case 'port_operations': return <PortOverview slug={slug} />
    case 'management': return <ManagementOverview />
    case 'admin': return <AdminOverview slug={slug} />
    default: return null
  }
}

const weekAgo = () => Date.now() - 7 * 24 * 3600 * 1000
const keepLabel = (k) => k

function ShipmentsOverview({ slug, own }) {
  const { data = [], isLoading, error, refetch } = useShipments()
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const recent = data.filter((s) => parseDate(s.created_at) > weekAgo()).length
  const flagged = data.filter((s) => s.risk_level === 'HIGH').length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={own ? 'My shipments' : 'Shipments'} value={data.length} loading={isLoading} />
        <StatTile label="Created in last 7 days" value={recent} loading={isLoading} />
        <StatTile label="High risk" value={flagged} loading={isLoading} attention={flagged > 0} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By status"><BarList items={countBy(data, (s) => s.status)} emptyText="No shipments yet." /></Card>
        <RecentShipments shipments={data} slug={slug} />
      </div>
    </div>
  )
}

function RecentShipments({ shipments, slug }) {
  const rows = [...shipments].sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at)).slice(0, 5)
  return (
    <Card
      title="Recent shipments"
      action={<Link to={`/app/${slug}/shipments`} className="text-sm font-semibold underline decoration-orange decoration-2 underline-offset-4">View all</Link>}
    >
      {!rows.length ? <p className="py-6 text-center text-sm text-ink/55">No shipments yet.</p> : (
        <ul className="divide-y divide-ink/10">
          {rows.map((s) => (
            <li key={s.id}>
              <Link to={`/app/${slug}/shipments/${s.id}`} className="group flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium group-hover:underline" title={s.shipment_reference}>{s.shipment_reference}</span>
                <span className="hidden text-xs text-ink/50 sm:inline">{formatDate(s.created_at)}</span>
                <StatusBadge value={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function CustomsOverview({ slug }) {
  const queue = useReviewQueue()
  const shipments = useShipments()
  const pending = queue.data ?? []
  const high = pending.filter((r) => ['HIGH', 'CRITICAL'].includes(r.priority)).length
  const oldest = [...pending].sort((a, b) => parseDate(a.created_at) - parseDate(b.created_at))[0]
  const refById = Object.fromEntries((shipments.data ?? []).map((s) => [s.id, s.shipment_reference]))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Pending reviews" value={pending.length} loading={queue.isLoading} attention={pending.length > 0} />
        <StatTile label="High priority" value={high} loading={queue.isLoading} attention={high > 0} />
        <StatTile label="Longest waiting" value={oldest ? timeAgo(oldest.created_at).replace(' ago', '') : '—'} loading={queue.isLoading} hint={oldest ? 'oldest pending case' : 'queue is clear'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Next in queue"
          action={<Link to={`/app/${slug}/review-queue`} className="text-sm font-semibold underline decoration-orange decoration-2 underline-offset-4">Open queue</Link>}
        >
          {queue.error ? <ErrorState error={queue.error} /> : !pending.length ? (
            <p className="py-6 text-center text-sm text-ink/55">No cases waiting.</p>
          ) : (
            <ul className="divide-y divide-ink/10">
              {pending.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link to={`/app/${slug}/review-queue/${r.id}`} className="group flex items-center gap-3 py-2.5">
                    <StatusBadge value={r.priority} />
                    <span className="min-w-0 flex-1 truncate text-sm group-hover:underline">{refById[r.shipment_id] ?? humanize(r.review_type)}</span>
                    <span className="text-xs text-ink/50">{timeAgo(r.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="All shipments by status">
          <BarList items={countBy(shipments.data, (s) => s.status)} emptyText="No shipments yet." />
        </Card>
      </div>
    </div>
  )
}

function PortOverview({ slug }) {
  const shipments = useShipments()
  const vessels = useQuery({ queryKey: ['vessels'], queryFn: listVessels })
  const data = shipments.data ?? []
  const withEta = data.filter((s) => s.estimated_arrival).length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Shipments" value={data.length} loading={shipments.isLoading} />
        <StatTile label="Vessels tracked" value={vessels.data?.length ?? '—'} loading={vessels.isLoading} hint={vessels.data?.length === 0 ? 'no vessel records yet' : undefined} />
        <StatTile label="With ETA" value={withEta} loading={shipments.isLoading} hint="shipments with an arrival estimate" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Shipments by destination port">
          <BarList items={countBy(data, (s) => s.destination_port)} formatLabel={keepLabel} emptyText="No shipments yet." />
        </Card>
        <RecentShipments shipments={data} slug={slug} />
      </div>
    </div>
  )
}

function ManagementOverview() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['analytics', 'dashboard'], queryFn: getAnalyticsDashboard })
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const high = data?.by_risk_level?.HIGH ?? 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total shipments" value={data?.total_shipments ?? 0} loading={isLoading} />
        <StatTile label="Workflow runs" value={data?.total_workflows_run ?? 0} loading={isLoading} hint="AI analyses run in total" />
        <StatTile label="High-risk shipments" value={high} loading={isLoading} attention={high > 0} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Shipments by status"><BarList items={toItems(data?.by_status)} /></Card>
        <Card title="Shipments by risk level"><BarList items={toItems(data?.by_risk_level)} /></Card>
      </div>
    </div>
  )
}

function AdminOverview({ slug }) {
  const { connection } = useRealtime()
  const health = useQuery({ queryKey: ['admin', 'health'], queryFn: adminApi.getHealth, refetchInterval: 30_000 })
  const workflows = useQuery({ queryKey: ['admin', 'workflows'], queryFn: adminApi.getWorkflowCounts })
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.listUsers })

  const awaiting = workflows.data?.AWAITING_REVIEW ?? 0
  const failed = workflows.data?.FAILED ?? 0
  const inactive = (users.data ?? []).filter((u) => !u.is_active).length
  const allOk = health.data && Object.values(health.data).every((v) => v === 'ok')

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="System" value={health.error ? 'Error' : allOk ? 'Healthy' : health.data ? 'Degraded' : '—'} loading={health.isLoading} attention={!!health.error || (health.data && !allOk)} hint={connection === 'live' ? 'live updates connected' : 'live updates disconnected'} />
        <StatTile label="Users" value={users.data?.length ?? '—'} loading={users.isLoading} hint={inactive ? `${inactive} inactive` : 'all active'} />
        <StatTile label="Awaiting review" value={awaiting} loading={workflows.isLoading} attention={awaiting > 0} />
        <StatTile label="Failed workflows" value={failed} loading={workflows.isLoading} attention={failed > 0} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Workflows by status"
          action={<Link to={`/app/${slug}/workflows`} className="inline-flex items-center gap-1 text-sm font-semibold underline decoration-orange decoration-2 underline-offset-4">Details <ArrowRight className="size-3.5" aria-hidden /></Link>}
        >
          <BarList items={toItems(workflows.data)} emptyText="No workflows have run yet." />
        </Card>
        <Card title="Users by role">
          <BarList items={countBy(users.data, (u) => u.role)} formatLabel={(k) => ROLES[k]?.label ?? humanize(k)} emptyText="No users." />
        </Card>
      </div>
    </div>
  )
}
