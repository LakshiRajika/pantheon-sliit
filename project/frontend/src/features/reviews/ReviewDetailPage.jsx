import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Sparkles, Plus, X } from 'lucide-react'
import { useReview, useSubmitDecision } from '../../hooks/useReviews'
import { useShipment } from '../../hooks/useShipments'
import { usePermission } from '../../hooks/usePermission'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import ResultView from '../../components/workflow/ResultView'
import { LoadingState, ErrorState } from '../../components/common/QueryStates'
import { formatDateTime, humanize, timeAgo } from '../../utils/format'
import DocumentsCard from '../shipments/DocumentsCard'

// Values the workflow's route_after_escalation() understands.
const DECISIONS = [
  {
    value: 'APPROVE_RECOMMENDATION',
    label: 'Approve recommendation',
    effect: 'Accept the AI assessment. The workflow continues to scheduling.',
    commentsRequired: false,
  },
  {
    value: 'REQUEST_INFORMATION',
    label: 'Request more information',
    effect: 'Ask for missing details. The workflow continues to scheduling with your request recorded.',
    commentsRequired: true,
  },
  {
    value: 'REJECT',
    label: 'Reject',
    effect: 'Do not accept the shipment as assessed. The workflow ends without scheduling.',
    commentsRequired: true,
  },
]

export default function ReviewDetailPage() {
  const { roleSlug, reviewId } = useParams()
  const { data: review, isLoading, error, refetch } = useReview(reviewId)

  const back = (
    <Link to={`/app/${roleSlug}/review-queue`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Review queue
    </Link>
  )

  if (isLoading) return <LoadingState label="Loading review…" />
  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {back}
        <ErrorState error={error.status === 404 || error.status === 422 ? { message: 'Review not found.' } : error} onRetry={error.status >= 500 ? refetch : undefined} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {back}

      <header className="rounded-xl bg-ink p-6 text-cream">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={review.priority} />
          <StatusBadge value={review.status} />
          <span className="font-mono text-xs uppercase tracking-wider text-cream/55">{humanize(review.review_type)}</span>
          <span className="ml-auto text-sm text-cream/60" title={formatDateTime(review.created_at)}>
            Raised {timeAgo(review.created_at)}
          </span>
        </div>
        <div className="mt-5 flex gap-3">
          <Sparkles className="mt-1 size-5 shrink-0 text-orange" aria-hidden />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-cream/50">Escalation reason · AI-generated</p>
            <p className="mt-1 text-lg leading-relaxed">{review.reason}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <ShipmentSummary shipmentId={review.shipment_id} roleSlug={roleSlug} />
          <UpstreamContext snapshot={review.context_snapshot} />
          <DocumentsCard shipmentId={review.shipment_id} />
        </div>
        <div className="space-y-6">
          {review.status === 'PENDING'
            ? <DecisionForm reviewId={review.id} />
            : (
              <Card title="Decision">
                <p className="flex items-center gap-2 text-sm"><CircleCheck className="size-4" aria-hidden /> This review has been resolved.</p>
              </Card>
            )}
        </div>
      </div>
    </div>
  )
}

function UpstreamContext({ snapshot }) {
  if (!snapshot) {
    return (
      <Card title="Risk assessment & evidence">
        <p className="text-sm text-ink/55">
          No evidence snapshot was captured for this review (it was raised before this view existed).
        </p>
      </Card>
    )
  }
  const sections = [
    ['risk', 'Risk assessment'],
    ['document', 'Document findings'],
    ['tracking', 'Tracking'],
    ['congestion', 'Congestion forecast'],
  ]
  const available = sections.filter(([key]) => snapshot[key])
  if (!available.length) {
    return (
      <Card title="Risk assessment & evidence">
        <p className="text-sm text-ink/55">No evidence was recorded for this review.</p>
      </Card>
    )
  }
  return (
    <Card title="Risk assessment & evidence">
      <div className="space-y-4">
        {available.map(([key, label]) => (
          <div key={key} className="rounded-md border border-ink/10 p-3">
            <p className="mb-2 text-sm font-semibold">{label}</p>
            <ResultView value={snapshot[key]} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function ShipmentSummary({ shipmentId, roleSlug }) {
  const { data: s, isLoading, error } = useShipment(shipmentId)
  return (
    <Card
      title="Shipment"
      action={s && (
        <Link to={`/app/${roleSlug}/shipments/${shipmentId}`} className="inline-flex items-center gap-1 text-sm font-semibold underline decoration-orange decoration-2 underline-offset-4">
          Full details <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    >
      {isLoading ? <LoadingState /> : error ? <ErrorState error={error} /> : (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Item label="Reference"><span className="font-mono font-medium">{s.shipment_reference}</span></Item>
          <Item label="Status"><StatusBadge value={s.status} /></Item>
          <Item label="Origin">{s.origin_port || '—'}</Item>
          <Item label="Destination">{s.destination_port || '—'}</Item>
          <Item label="ETA">{s.estimated_arrival ? formatDateTime(s.estimated_arrival) : '—'}</Item>
          <Item label="Submitted">{formatDateTime(s.created_at)}</Item>
        </dl>
      )}
    </Card>
  )
}

function Item({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink/50">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function DecisionForm({ reviewId }) {
  const canDecide = usePermission('review:decide')
  const submit = useSubmitDecision(reviewId)
  const [decision, setDecision] = useState(null)
  const [comments, setComments] = useState('')
  const [items, setItems] = useState([])
  const [draftItem, setDraftItem] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [formError, setFormError] = useState(null)

  if (!canDecide) {
    return <Card title="Decision"><p className="text-sm text-ink/65">Your role can view this review but not decide it.</p></Card>
  }

  // Success: show what the resumed workflow produced.
  if (submit.isSuccess) {
    const result = submit.data?.workflow_result
    return (
      <Card title="Decision recorded">
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CircleCheck className="size-5" aria-hidden /> {humanize(submit.variables.decision)}. The workflow has resumed.
          </p>
          {result ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-ink/50">Workflow result</p>
              {result.scheduling && <Section title="Scheduling"><ResultView value={result.scheduling} /></Section>}
              {result.risk && <Section title="Risk"><ResultView value={result.risk} /></Section>}
              {!result.scheduling && <p className="text-sm text-ink/65">The workflow ended without scheduling.</p>}
            </div>
          ) : (
            <p className="text-sm text-ink/65">The workflow ended without scheduling.</p>
          )}
        </div>
      </Card>
    )
  }

  const selected = DECISIONS.find((d) => d.value === decision)
  const conflict = submit.error?.status === 409

  const addItem = () => {
    const v = draftItem.trim()
    if (v && !items.includes(v)) setItems([...items, v])
    setDraftItem('')
  }

  const review = () => {
    if (!selected) return setFormError('Choose a decision.')
    if (selected.commentsRequired && !comments.trim()) return setFormError('Add a comment explaining this decision.')
    if (decision === 'REQUEST_INFORMATION' && items.length === 0 && !draftItem.trim())
      return setFormError('List at least one piece of information you need.')
    if (draftItem.trim()) addItem()
    setFormError(null)
    setConfirming(true)
  }

  const send = () => {
    // The backend currently ignores additional_information_required, so the items are also
    // written into the comments to make sure they're stored with the decision.
    const requested = decision === 'REQUEST_INFORMATION' && items.length ? `\n\nInformation requested:\n- ${items.join('\n- ')}` : ''
    submit.mutate({
      decision,
      comments: (comments.trim() + requested).trim() || null,
      additional_information_required: decision === 'REQUEST_INFORMATION' ? items : [],
    }, { onError: () => setConfirming(false) })
  }

  return (
    <Card title="Your decision">
      <fieldset disabled={confirming || submit.isPending} className="space-y-5">
        <legend className="sr-only">Decision</legend>
        <div className="space-y-2.5">
          {DECISIONS.map((d) => {
            const active = decision === d.value
            return (
              <label
                key={d.value}
                className={`flex cursor-pointer gap-3 rounded-lg border-2 p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-orange ${active ? 'border-ink bg-ink text-cream' : 'border-ink/15 hover:border-ink/50'}`}
              >
                <input
                  type="radio" name="decision" value={d.value} checked={active}
                  onChange={() => { setDecision(d.value); setFormError(null) }}
                  className="mt-1 accent-[#D9541E]"
                />
                <span>
                  <span className="block text-sm font-semibold">{d.label}</span>
                  <span className={`mt-0.5 block text-sm ${active ? 'text-cream/70' : 'text-ink/60'}`}>{d.effect}</span>
                </span>
              </label>
            )
          })}
        </div>

        {decision === 'REQUEST_INFORMATION' && (
          <div>
            <label htmlFor="info-item" className="mb-1.5 block text-sm font-semibold">Information required</label>
            <div className="flex gap-2">
              <input
                id="info-item" value={draftItem} onChange={(e) => setDraftItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                placeholder="e.g. Certificate of origin"
                className="flex-1 rounded-md border-2 border-ink/15 bg-white/60 px-3 py-2 text-sm focus:border-ink focus:outline-none"
              />
              <Button type="button" variant="outline" icon={Plus} onClick={addItem} className="!px-3" aria-label="Add item" />
            </div>
            {items.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {items.map((it) => (
                  <li key={it} className="flex items-center gap-1 rounded border border-ink/20 bg-cream-deep/60 py-0.5 pl-2 pr-1 text-sm">
                    {it}
                    <button type="button" onClick={() => setItems(items.filter((x) => x !== it))} className="rounded p-0.5 hover:bg-ink/10" aria-label={`Remove ${it}`}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-xs text-ink/55">Saved with your comments.</p>
          </div>
        )}

        <div>
          <label htmlFor="comments" className="mb-1.5 block text-sm font-semibold">
            Comments {selected?.commentsRequired ? <span className="text-orange" aria-hidden>*</span> : <span className="font-normal text-ink/50">(optional)</span>}
          </label>
          <textarea
            id="comments" rows={4} value={comments} onChange={(e) => setComments(e.target.value)}
            placeholder="What did you check, and why this decision?"
            className="w-full rounded-md border-2 border-ink/15 bg-white/60 px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
          />
        </div>
      </fieldset>

      {(formError || (submit.error && !conflict)) && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden /> {formError ?? submit.error.message}
        </p>
      )}
      {conflict && (
        <p role="alert" className="mt-4 rounded-md border-l-4 border-orange bg-cream-deep px-4 py-3 text-sm">
          This review was already resolved, possibly by another officer. Your decision was not recorded.
        </p>
      )}

      <div className="mt-5">
        {!confirming ? (
          <Button onClick={review} className="w-full" icon={ArrowRight} disabled={conflict}>Review &amp; submit</Button>
        ) : (
          <div className="space-y-3 rounded-lg border-2 border-ink p-4">
            <p className="text-sm">
              Submit <span className="font-semibold">{selected.label.toLowerCase()}</span>? This resumes the workflow and
              can’t be undone.
            </p>
            <div className="flex gap-2">
              <Button onClick={send} loading={submit.isPending} className="flex-1">
                {submit.isPending ? 'Resuming workflow…' : 'Confirm decision'}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={submit.isPending}>Back</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-md border border-ink/10 p-3">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}
