import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Activity, ScrollText, RefreshCw, CircleCheck, CircleAlert, CircleQuestionMark } from 'lucide-react'
import * as adminApi from '../../api/admin'
import { useRealtime } from '../../contexts/WebSocketContext'
import { ROLES } from '../../routes/roleRoutes'
import Card from '../../components/common/Card'
import StatTile from '../../components/cards/StatTile'
import BarList, { toItems } from '../../components/charts/BarList'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import { LoadingState, ErrorState, EmptyState } from '../../components/common/QueryStates'
import { formatDateTime, humanize } from '../../utils/format'

/* ---------------------------------------------------------------- Users */

export function UsersPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.listUsers })
  const [q, setQ] = useState('')
  const [role, setRole] = useState('ALL')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data ?? [])
      .filter((u) => role === 'ALL' || u.role === role)
      .filter((u) => !needle || u.full_name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [data, q, role])

  if (isLoading) return <LoadingState label="Loading users…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email"
            className="w-full rounded-md border-2 border-ink/15 bg-white/60 py-2 pl-9 pr-3 text-sm focus:border-ink focus:outline-none" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink/60">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="rounded-md border-2 border-ink/15 bg-white/60 px-2.5 py-2 focus:border-ink focus:outline-none">
            <option value="ALL">All roles</option>
            {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border-2 border-ink/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink text-cream">
            <tr>
              <Th>Name</Th><Th className="hidden md:table-cell">Email</Th><Th>Role</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((u) => (
              <tr key={u.id} className="bg-cream">
                <td className="px-4 py-3 font-medium">{u.full_name}<span className="block text-xs font-normal text-ink/55 md:hidden">{u.email}</span></td>
                <td className="hidden px-4 py-3 text-ink/75 md:table-cell">{u.email}</td>
                <td className="px-4 py-3">{ROLES[u.role]?.label ?? humanize(u.role)}</td>
                <td className="px-4 py-3"><StatusBadge value={u.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <EmptyState title="No users match your filters" />}
      </div>
      <p className="text-xs text-ink/50">
        {rows.length} of {data.length} users. Role changes and account activation aren’t available yet: the backend has no
        endpoints for them.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ Workflows */

export function WorkflowsPage() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'workflows'], queryFn: adminApi.getWorkflowCounts, refetchInterval: 15_000,
  })
  if (isLoading) return <LoadingState label="Loading workflows…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const total = Object.values(data).reduce((s, n) => s + n, 0)
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total" value={total} />
        <StatTile label="Running" value={data.RUNNING ?? 0} />
        <StatTile label="Awaiting review" value={data.AWAITING_REVIEW ?? 0} attention={(data.AWAITING_REVIEW ?? 0) > 0} />
        <StatTile label="Failed" value={data.FAILED ?? 0} attention={(data.FAILED ?? 0) > 0} />
      </div>
      <Card title="Workflows by status" action={<span className="font-mono text-xs text-ink/50">updated {new Date(dataUpdatedAt).toLocaleTimeString()}</span>}>
        <BarList items={toItems(data)} emptyText="No workflows have run yet." />
      </Card>
      <p className="text-xs text-ink/50">The backend reports counts only; per-workflow listing and retry aren’t available yet.</p>
    </div>
  )
}

/* ----------------------------------------------------------- Agent runs */

export function AgentRunsPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'agent-runs'], queryFn: adminApi.listAgentRuns })
  if (isLoading) return <LoadingState label="Loading agent runs…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  if (!data.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border-2 border-ink/10">
        <EmptyState icon={Activity} title="No agent runs recorded">
          Agent executions aren’t being written to the <code className="font-mono">agent_runs</code> table yet, so this
          view stays empty even after workflows complete.
        </EmptyState>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border-2 border-ink/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink text-cream"><tr><Th>Agent</Th><Th>Status</Th><Th>Duration</Th><Th>Retries</Th></tr></thead>
        <tbody className="divide-y divide-ink/10">
          {data.map((r, i) => (
            <tr key={i} className="bg-cream">
              <td className="px-4 py-3 font-medium">{humanize(r.agent)}</td>
              <td className="px-4 py-3"><StatusBadge value={r.status} /></td>
              <td className="px-4 py-3 font-mono tabular-nums">{r.duration_ms != null ? `${r.duration_ms} ms` : '—'}</td>
              <td className="px-4 py-3 font-mono tabular-nums">{r.retries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------------------------------------------------------- Audit */

export function AuditPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'audit'], queryFn: adminApi.listAudit })
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.listUsers })
  const nameById = Object.fromEntries((users.data ?? []).map((u) => [u.id, u.full_name]))

  if (isLoading) return <LoadingState label="Loading audit log…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  if (!data.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border-2 border-ink/10">
        <EmptyState icon={ScrollText} title="No audit records">
          Audit logging isn’t wired into backend actions yet (review decisions, role changes). Login history is recorded
          separately.
        </EmptyState>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border-2 border-ink/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink text-cream"><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Outcome</Th></tr></thead>
        <tbody className="divide-y divide-ink/10">
          {data.map((l, i) => (
            <tr key={i} className="bg-cream">
              <td className="px-4 py-3">{formatDateTime(l.at)}</td>
              <td className="px-4 py-3">{nameById[l.actor] ?? <span className="font-mono text-xs">{l.actor.slice(0, 8)}</span>}</td>
              <td className="px-4 py-3">{humanize(l.action)}</td>
              <td className="px-4 py-3">{humanize(l.target)}</td>
              <td className="px-4 py-3"><StatusBadge value={l.success ? 'SUCCESS' : 'FAILED'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------- System health */

export function SystemHealthPage() {
  const { connection } = useRealtime()
  const { data, error, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'health'], queryFn: adminApi.getHealth, refetchInterval: 30_000, retry: false,
  })

  const checks = [
    { name: 'API', state: error ? (error.status === 0 ? 'down' : 'degraded') : data ? toState(data.api) : 'unknown', detail: error ? error.message : 'Responds to authenticated requests' },
    { name: 'Database', state: error ? 'unknown' : data ? toState(data.database) : 'unknown', detail: 'Connectivity probe from the API' },
    { name: 'Live updates (WebSocket)', state: connection === 'live' ? 'ok' : connection === 'offline' ? 'down' : 'degraded', detail: `This browser: ${connection}` },
    { name: 'LLM providers', state: 'unknown', detail: 'Not reported by the backend yet' },
    { name: 'Document storage', state: 'unknown', detail: 'Not reported by the backend yet' },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/60">
          {dataUpdatedAt ? `Last checked ${new Date(dataUpdatedAt).toLocaleTimeString()} · refreshes every 30 s` : 'Checking…'}
        </p>
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()} loading={isFetching}>Check now</Button>
      </div>
      <ul className="divide-y divide-ink/10 overflow-hidden rounded-lg border-2 border-ink/10">
        {checks.map((c) => <HealthRow key={c.name} {...c} />)}
      </ul>
    </div>
  )
}

const toState = (v) => (v === 'ok' ? 'ok' : v ? 'degraded' : 'unknown')

const HEALTH = {
  ok: { icon: CircleCheck, label: 'Operational', cls: 'text-ink' },
  degraded: { icon: CircleAlert, label: 'Degraded', cls: 'text-orange' },
  down: { icon: CircleAlert, label: 'Down', cls: 'text-orange' },
  unknown: { icon: CircleQuestionMark, label: 'Not reported', cls: 'text-ink/40' },
}

function HealthRow({ name, state, detail }) {
  const { icon: Icon, label, cls } = HEALTH[state]
  return (
    <li className="flex items-center gap-4 bg-cream px-5 py-4">
      <Icon className={`size-5 shrink-0 ${cls}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-ink/60">{detail}</p>
      </div>
      <span className={`font-mono text-xs uppercase tracking-wider ${state === 'ok' ? 'text-ink' : state === 'unknown' ? 'text-ink/45' : 'font-semibold text-ink'}`}>{label}</span>
    </li>
  )
}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider ${className}`}>{children}</th>
}
