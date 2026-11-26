import { Check, LoaderCircle, CircleAlert, X } from 'lucide-react'
import { humanize } from '../../utils/format'

// Progress scale shared by status pills and status bars:
//   neutral (not started) → progress (running) → attention (needs someone) → success / danger (outcome)
const TONES = {
  success: ['COMPLETED', 'COMPLETE', 'CLEARED', 'APPROVED', 'APPROVE_RECOMMENDATION', 'LOW', 'PROCEED', 'VALID', 'ACTIVE', 'SUCCESS'],
  progress: ['RUNNING', 'PROCESSING', 'IN_PROGRESS', 'RESUMED'],
  attention: ['AWAITING_REVIEW', 'REVIEW_REQUIRED', 'PENDING', 'REQUEST_INFORMATION', 'FLAG_FOR_INSPECTION', 'INCONSISTENT', 'MISSING_FIELDS', 'MEDIUM'],
  danger: ['FAILED', 'REJECT', 'REJECTED', 'HIGH', 'CRITICAL', 'INACTIVE'],
}
const TONE_BY_STATUS = Object.fromEntries(Object.entries(TONES).flatMap(([tone, list]) => list.map((s) => [s, tone])))

/** Returns 'success' | 'progress' | 'attention' | 'danger' | 'neutral' for a status value. */
export const statusTone = (value) => TONE_BY_STATUS[String(value ?? '').toUpperCase()] ?? 'neutral'

/** Solid colour class for a status bar of the given tone. */
export const TONE_BAR = {
  success: 'bg-success',
  progress: 'bg-progress',
  attention: 'bg-orange',
  danger: 'bg-danger',
  neutral: 'bg-ink/70',
}

// Opaque tints (mixed into cream) so pills look the same on cream cards and on the dark page headers.
const TONE_PILL = {
  success: 'bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-cream))] border-success/40 text-success-ink',
  progress: 'bg-[color-mix(in_srgb,var(--color-progress)_14%,var(--color-cream))] border-progress/40 text-progress-ink',
  attention: 'bg-[color-mix(in_srgb,var(--color-orange)_18%,var(--color-cream))] border-orange/50 text-attention-ink',
  danger: 'bg-[color-mix(in_srgb,var(--color-danger)_14%,var(--color-cream))] border-danger/40 text-danger-ink',
  neutral: 'bg-[color-mix(in_srgb,var(--color-ink)_5%,var(--color-cream))] border-ink/20 text-ink/80',
}

// An icon per tone so meaning never depends on colour alone (colour-blind safe).
function ToneIcon({ tone }) {
  const cls = 'size-3 shrink-0'
  if (tone === 'success') return <Check className={cls} strokeWidth={3} aria-hidden />
  if (tone === 'progress') return <LoaderCircle className={`${cls} animate-spin motion-reduce:animate-none`} strokeWidth={3} aria-hidden />
  if (tone === 'attention') return <CircleAlert className={cls} strokeWidth={2.5} aria-hidden />
  if (tone === 'danger') return <X className={cls} strokeWidth={3} aria-hidden />
  return <span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
}

export default function StatusBadge({ value, className = '' }) {
  if (!value) return <span className="text-sm text-ink/40">—</span>
  const tone = statusTone(value)
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${TONE_PILL[tone]} ${className}`}
    >
      <ToneIcon tone={tone} />
      {humanize(value)}
    </span>
  )
}
