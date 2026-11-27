import { useQuery } from '@tanstack/react-query'
import { Radar, FileSearch, Waves, Gauge, UserCheck, CalendarClock, Play, RotateCw, CircleAlert, Info } from 'lucide-react'
import { useStartWorkflow, useWorkflow } from '../../hooks/useShipments'
import { usePermission } from '../../hooks/usePermission'
import { recallWorkflow } from '../../utils/workflowMemory'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { LoadingState, ErrorState } from '../../components/common/QueryStates'
import ResultView from '../../components/workflow/ResultView'

// Graph order from the architecture doc (§8). `key` matches final_result keys.
const STAGES = [
  { key: 'tracking', label: 'Tracking Agent', icon: Radar },
  { key: 'document', label: 'Documentation Agent', icon: FileSearch },
  { key: 'congestion', label: 'Congestion Agent', icon: Waves },
  { key: 'risk', label: 'Risk & Inspection Agent', icon: Gauge },
  { key: 'human_decision', label: 'Human Review', icon: UserCheck },
  { key: 'scheduling', label: 'Scheduling Agent', icon: CalendarClock },
]

// Derive each stage's display state from the workflow status. Per-agent live events arrive in step 5;
// until then RUNNING is shown as "in progress" without guessing which agent is active.
function stageState(stageKey, workflow) {
  const { status, final_result: result } = workflow
  if (status === 'COMPLETED') {
    if (stageKey === 'human_decision') return result?.human_decision ? 'COMPLETED' : 'SKIPPED'
    // A rejected review ends the workflow before scheduling runs.
    if (stageKey === 'scheduling' && !result?.scheduling) return 'SKIPPED'
    return 'COMPLETED'
  }
  if (status === 'AWAITING_REVIEW') {
    if (stageKey === 'human_decision') return 'AWAITING_REVIEW'
    if (stageKey === 'scheduling') return 'WAITING'
    return 'COMPLETED'
  }
  if (status === 'FAILED') return 'FAILED'
  return 'RUNNING'
}

export default function WorkflowPanel({ shipmentId, documentCount }) {
  const canStart = usePermission('workflow:start')
  const { data: workflowId } = useQuery({
    queryKey: ['workflow-ref', shipmentId],
    queryFn: () => recallWorkflow(shipmentId),
    staleTime: Infinity,
  })
  const start = useStartWorkflow(shipmentId)

  const noDocuments = documentCount === 0
  const startButton = (label, icon) => canStart && (
    <Button onClick={() => start.mutate()} loading={start.isPending} icon={icon} disabled={noDocuments}>{label}</Button>
  )

  return (
    <Card title="AI workflow">
      {!workflowId ? (
        <div className="space-y-4">
          <p className="text-sm text-ink/70">
            {canStart
              ? 'Run the six-agent analysis on this shipment and its uploaded documents. You can leave this page — the workflow runs on the server.'
              : 'No workflow has been started for this shipment from this browser.'}
          </p>
          {canStart && noDocuments && (
            <p className="flex items-start gap-2 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
              Upload at least one document before starting the workflow.
            </p>
          )}
          {startButton('Start AI analysis', Play)}
        </div>
      ) : (
        <WorkflowStatus workflowId={workflowId} restart={startButton('Run again', RotateCw)} />
      )}
      {start.error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm"><CircleAlert className="size-4 text-orange" aria-hidden /> {start.error.message}</p>
      )}
    </Card>
  )
}

function WorkflowStatus({ workflowId, restart }) {
  const { data: wf, isLoading, error, refetch } = useWorkflow(workflowId)
  if (isLoading) return <LoadingState label="Loading workflow…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const finished = wf.status === 'COMPLETED' || wf.status === 'FAILED'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge value={wf.status} />
          <span className="font-mono text-xs text-ink/45" title={wf.workflow_id}>#{wf.workflow_id.slice(0, 8)}</span>
        </div>
        {finished && restart}
      </div>

      {wf.status === 'AWAITING_REVIEW' && (
        <p className="rounded-md border-l-4 border-orange bg-cream-deep px-4 py-3 text-sm">
          Paused for human review. A customs officer must decide before scheduling continues.
        </p>
      )}
      {wf.status === 'FAILED' && (
        <p className="rounded-md border-l-4 border-orange bg-cream-deep px-4 py-3 text-sm">
          The workflow failed. No partial results are shown. You can run it again.
        </p>
      )}

      <ol className="space-y-2">
        {STAGES.map(({ key, label, icon: Icon }) => {
          const state = stageState(key, wf)
          const result = wf.final_result?.[key]
          return (
            <li key={key} className={`rounded-md border ${state === 'AWAITING_REVIEW' ? 'border-orange' : 'border-ink/10'}`}>
              <details className="group" open={key === 'risk' && !!result}>
                <summary className={`flex items-center gap-3 px-4 py-3 ${result ? 'cursor-pointer' : 'cursor-default list-none'}`}>
                  <Icon className={`size-4 ${state === 'COMPLETED' ? 'text-ink' : 'text-ink/40'}`} aria-hidden />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <StatusBadge value={state} />
                </summary>
                {result && (
                  <div className="border-t border-ink/10 px-4 py-3">
                    <ResultView value={result} />
                  </div>
                )}
              </details>
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-ink/50">Agent outputs are AI-generated recommendations, not final decisions.</p>
    </div>
  )
}
