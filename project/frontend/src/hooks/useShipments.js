import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/shipments'
import { rememberWorkflow } from '../utils/workflowMemory'
import { useRealtime } from '../contexts/WebSocketContext'

export const shipmentKeys = {
  all: ['shipments'],
  detail: (id) => ['shipments', id],
  timeline: (id) => ['shipments', id, 'timeline'],
  documents: (id) => ['shipments', id, 'documents'],
}

export const useShipments = () => useQuery({ queryKey: shipmentKeys.all, queryFn: api.listShipments })
export const useShipment = (id) => useQuery({ queryKey: shipmentKeys.detail(id), queryFn: () => api.getShipment(id) })
export const useTimeline = (id) => useQuery({ queryKey: shipmentKeys.timeline(id), queryFn: () => api.getTimeline(id) })
export const useDocuments = (id) => useQuery({ queryKey: shipmentKeys.documents(id), queryFn: () => api.listDocuments(id) })

export function useCreateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createShipment,
    onSuccess: () => qc.invalidateQueries({ queryKey: shipmentKeys.all }),
  })
}

export function useUploadDocument(shipmentId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, documentType }) => api.uploadDocument(shipmentId, file, documentType),
    onSuccess: () => qc.invalidateQueries({ queryKey: shipmentKeys.documents(shipmentId) }),
  })
}

export function useStartWorkflow(shipmentId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.startWorkflow(shipmentId),
    onSuccess: ({ workflow_id }) => {
      rememberWorkflow(shipmentId, workflow_id)
      qc.invalidateQueries({ queryKey: ['workflow-ref', shipmentId] })
      qc.invalidateQueries({ queryKey: shipmentKeys.timeline(shipmentId) })
    },
  })
}

const ACTIVE = new Set(['RUNNING', 'PENDING'])

// WebSocket events refresh this instantly. Polling stays as a safety net while the workflow runs,
// because the backend never sends shipping agents a "paused for review" event.
// Slow polling when live, faster when the socket is down.
export function useWorkflow(workflowId) {
  const { connection } = useRealtime()
  const interval = connection === 'live' ? 10_000 : 3000
  return useQuery({
    queryKey: ['workflows', workflowId],
    queryFn: () => api.getWorkflow(workflowId),
    enabled: !!workflowId,
    refetchInterval: (q) => (ACTIVE.has(q.state.data?.status) ? interval : false),
  })
}
