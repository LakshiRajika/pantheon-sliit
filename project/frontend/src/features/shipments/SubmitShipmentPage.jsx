import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CircleAlert, Lock } from 'lucide-react'
import { useCreateShipment } from '../../hooks/useShipments'
import { usePermission } from '../../hooks/usePermission'
import Button from '../../components/common/Button'
import { EmptyState } from '../../components/common/QueryStates'
import { UUID_RE } from '../../utils/format'

const EMPTY = {
  shipment_reference: '', cargo_description: '', cargo_category: '',
  origin_port: '', destination_port: '', importer_id: '',
}

export default function SubmitShipmentPage() {
  const { roleSlug } = useParams()
  const navigate = useNavigate()
  const canCreate = usePermission('shipment:create')
  const create = useCreateShipment()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  if (!canCreate) {
    return <EmptyState icon={Lock} title="Your role can’t submit shipments" />
  }

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((er) => ({ ...er, [field]: undefined }))
  }

  const validate = () => {
    const er = {}
    if (!form.shipment_reference.trim()) er.shipment_reference = 'A shipment reference is required.'
    else if (form.shipment_reference.trim().length > 50) er.shipment_reference = 'Maximum 50 characters.'
    if (form.importer_id.trim() && !UUID_RE.test(form.importer_id.trim()))
      er.importer_id = 'Must be the importer’s account ID (a UUID), or left empty.'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    // Send only filled-in fields; empty strings become null server-side defaults.
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() || null]),
    )
    create.mutate(payload, {
      onSuccess: (shipment) => navigate(`/app/${roleSlug}/shipments/${shipment.id}?new=1`),
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs uppercase tracking-wider">
        <Step n={1} active>Shipment details</Step>
        <ArrowRight className="size-3.5 text-ink/30" aria-hidden />
        <Step n={2}>Upload documents</Step>
        <ArrowRight className="size-3.5 text-ink/30" aria-hidden />
        <Step n={3}>Start AI analysis</Step>
      </ol>

      <form onSubmit={onSubmit} noValidate className="space-y-6 rounded-lg border-2 border-ink/10 p-6">
        <Field label="Shipment reference" required error={errors.shipment_reference} hint="Your unique reference, e.g. PNT-1042.">
          {(p) => <input {...p} value={form.shipment_reference} onChange={set('shipment_reference')} className={`${inputCls} font-mono`} />}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Origin port">
            {(p) => <input {...p} value={form.origin_port} onChange={set('origin_port')} className={inputCls} placeholder="e.g. Singapore" />}
          </Field>
          <Field label="Destination port">
            {(p) => <input {...p} value={form.destination_port} onChange={set('destination_port')} className={inputCls} placeholder="e.g. Colombo" />}
          </Field>
        </div>

        <Field label="Cargo category">
          {(p) => <input {...p} value={form.cargo_category} onChange={set('cargo_category')} className={inputCls} placeholder="e.g. Electronics" />}
        </Field>

        <Field label="Cargo description">
          {(p) => <textarea {...p} rows={3} value={form.cargo_description} onChange={set('cargo_description')} className={inputCls} />}
        </Field>

        <Field
          label="Importer account ID" error={errors.importer_id}
          hint="Optional. Links the shipment to an importer so it appears in their workspace."
        >
          {(p) => <input {...p} value={form.importer_id} onChange={set('importer_id')} className={`${inputCls} font-mono text-sm`} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />}
        </Field>

        {create.error && (
          <div role="alert" className="flex gap-2.5 rounded-md border-l-4 border-orange bg-cream-deep px-4 py-3 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
            {create.error.status === 409 || /unique|duplicate/i.test(create.error.message)
              ? 'A shipment with this reference already exists.'
              : create.error.status >= 500
                // The backend currently returns a generic 500 for a duplicate reference (unhandled unique constraint).
                ? 'The server couldn’t create this shipment. If this reference has been used before, try a different one.'
                : create.error.message}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={create.isPending} icon={ArrowRight}>Create shipment</Button>
        </div>
      </form>
    </div>
  )
}

function Step({ n, active, children }) {
  return (
    <li className={`flex items-center gap-2 ${active ? 'text-ink' : 'text-ink/40'}`}>
      <span className={`grid size-5 place-items-center rounded-full text-[10px] ${active ? 'bg-orange text-ink' : 'border border-ink/30'}`}>{n}</span>
      {children}
    </li>
  )
}

const inputCls =
  'w-full rounded-md border-2 border-ink/15 bg-white/60 px-3.5 py-2.5 placeholder:text-ink/35 focus:border-ink focus:outline-none'

function Field({ label, required, hint, error, children }) {
  const id = label.toLowerCase().replace(/\W+/g, '-')
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label} {required && <span className="text-orange" aria-hidden>*</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': `${id}-msg` })}
      <p id={`${id}-msg`} className={`mt-1.5 text-xs ${error ? 'font-medium text-ink' : 'text-ink/55'}`}>
        {error ? <span className="border-l-2 border-orange pl-2">{error}</span> : hint}
      </p>
    </div>
  )
}
