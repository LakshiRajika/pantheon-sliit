import { apiFetch } from './client'

export const getHealth = () => apiFetch('/admin/health')
export const listUsers = () => apiFetch('/admin/users')
export const getWorkflowCounts = () => apiFetch('/admin/workflows')
export const listAgentRuns = () => apiFetch('/admin/agent-runs')
export const listAudit = () => apiFetch('/admin/audit')
