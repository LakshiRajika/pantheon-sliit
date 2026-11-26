// Backend timestamps without a timezone are UTC (datetime.utcnow()); make JS read them as UTC.
export function parseDate(value) {
  if (!value) return null
  const s = String(value)
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`)
}

export function formatDateTime(value) {
  const d = parseDate(value)
  return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

export function formatDate(value) {
  const d = parseDate(value)
  return d ? d.toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'
}

export function formatBytes(n) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

// "bill_of_lading" / "SHIPMENT_CREATED" -> "Bill of lading" / "Shipment created"
export function humanize(s) {
  if (!s) return '—'
  const t = String(s).replace(/[_-]+/g, ' ').toLowerCase().trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function timeAgo(value) {
  const d = parseDate(value)
  if (!d) return '—'
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}
