import { apiFetch } from './client'

export const listShipments = () => apiFetch('/shipments')
export const getShipment = (id) => apiFetch(`/shipments/${id}`)
export const createShipment = (payload) => apiFetch('/shipments', { method: 'POST', body: payload })
export const getTimeline = (id) => apiFetch(`/shipments/${id}/timeline`)

export const listDocuments = (shipmentId) => apiFetch(`/shipments/${shipmentId}/documents`)
export const uploadDocument = (shipmentId, file, documentType) => {
  const form = new FormData()
  form.append('document_type', documentType)
  form.append('file', file)
  return apiFetch(`/shipments/${shipmentId}/documents`, { method: 'POST', body: form })
}

export const startWorkflow = (shipmentId) => apiFetch(`/shipments/${shipmentId}/workflow`, { method: 'POST' })
export const getWorkflow = (workflowId) => apiFetch(`/workflows/${workflowId}`)
