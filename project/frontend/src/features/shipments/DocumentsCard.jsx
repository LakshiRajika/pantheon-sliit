import { useRef, useState } from 'react'
import { FileText, Upload, CircleAlert, Check } from 'lucide-react'
import { useDocuments, useUploadDocument } from '../../hooks/useShipments'
import { usePermission } from '../../hooks/usePermission'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { LoadingState, ErrorState, EmptyState } from '../../components/common/QueryStates'
import { formatBytes, formatDateTime, humanize } from '../../utils/format'

// Types the backend's document validator knows how to check (REQUIRED_FIELDS_BY_TYPE).
const DOCUMENT_TYPES = ['bill_of_lading', 'certificate_of_origin', 'commercial_invoice']
// Mirrors backend safety/input_validation.py. The server re-validates.
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg']
const MAX_MB = 20

export default function DocumentsCard({ shipmentId }) {
  const canUpload = usePermission('document:upload')
  const { data, isLoading, error, refetch } = useDocuments(shipmentId)

  return (
    <Card title="Documents" action={data?.length ? <span className="font-mono text-xs text-ink/50">{data.length}</span> : null}>
      {canUpload && <Uploader shipmentId={shipmentId} />}

      <div className={canUpload ? 'mt-5' : ''}>
        {isLoading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data.length ? (
          <EmptyState icon={FileText} title="No documents uploaded">
            {canUpload ? 'Upload the bill of lading and certificates before starting analysis.' : null}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink/10">
            {data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded bg-ink text-cream">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.original_filename}</p>
                  <p className="text-xs text-ink/55">
                    {humanize(d.document_type)} · {formatBytes(d.size_bytes)} · {formatDateTime(d.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function Uploader({ shipmentId }) {
  const inputRef = useRef(null)
  const upload = useUploadDocument(shipmentId)
  const [file, setFile] = useState(null)
  const [type, setType] = useState(DOCUMENT_TYPES[0])
  const [localError, setLocalError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [justUploaded, setJustUploaded] = useState(null)

  const pick = (f) => {
    upload.reset()
    setJustUploaded(null)
    if (!f) return
    const problem = !ALLOWED_MIME.includes(f.type)
      ? 'Only PDF, PNG or JPEG files are accepted.'
      : f.size > MAX_MB * 1024 * 1024 ? `File is larger than ${MAX_MB} MB.` : null
    setLocalError(problem)
    setFile(problem ? null : f)
  }

  const submit = () =>
    upload.mutate({ file, documentType: type }, {
      onSuccess: () => {
        setJustUploaded(file.name)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ''
      },
    })

  const err = localError ?? upload.error?.message

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]) }}
        className={`rounded-lg border-2 border-dashed p-5 text-center transition ${dragging ? 'border-orange bg-orange/5' : 'border-ink/20'}`}
      >
        <Upload className="mx-auto size-5 text-ink/50" aria-hidden />
        <p className="mt-2 text-sm">
          {file ? <span className="font-medium">{file.name} <span className="text-ink/50">({formatBytes(file.size)})</span></span> : 'Drag a file here, or'}
        </p>
        <label className="mt-1 inline-block cursor-pointer text-sm font-semibold underline decoration-orange decoration-2 underline-offset-4">
          {file ? 'choose another file' : 'browse your files'}
          <input
            ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="sr-only" onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        <p className="mt-1 text-xs text-ink/50">PDF, PNG or JPEG · up to {MAX_MB} MB</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm">
          <span className="mb-1.5 block font-semibold">Document type</span>
          <select
            value={type} onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border-2 border-ink/15 bg-white/60 px-3 py-2.5 focus:border-ink focus:outline-none"
          >
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
        </label>
        <Button variant="dark" icon={Upload} onClick={submit} disabled={!file} loading={upload.isPending}>Upload</Button>
      </div>

      {err && (
        <p role="alert" className="flex items-center gap-2 text-sm"><CircleAlert className="size-4 text-orange" aria-hidden /> {err}</p>
      )}
      {justUploaded && !err && (
        <p role="status" className="flex items-center gap-2 text-sm text-ink/70"><Check className="size-4" aria-hidden /> Uploaded {justUploaded}</p>
      )}
    </div>
  )
}
