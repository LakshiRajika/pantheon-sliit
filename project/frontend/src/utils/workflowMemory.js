// The backend has no "workflows for this shipment" endpoint yet, so the browser remembers
// the workflow id returned when a workflow is started. Other browsers/users won't have it.
// Replace with an API call once GET /shipments/{id}/workflows exists.
const KEY = 'pantheon.workflowByShipment'

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {} } catch { return {} }
}

export const rememberWorkflow = (shipmentId, workflowId) =>
  localStorage.setItem(KEY, JSON.stringify({ ...read(), [shipmentId]: workflowId }))

export const recallWorkflow = (shipmentId) => read()[shipmentId] ?? null

export const isRememberedWorkflow = (workflowId) => Object.values(read()).includes(workflowId)
