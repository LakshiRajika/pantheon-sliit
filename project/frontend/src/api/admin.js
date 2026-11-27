import { apiFetch } from './client'

export const getHealth = () => apiFetch('/admin/health')
export const listUsers = () => apiFetch('/admin/users')
export const createUser = (payload) => apiFetch('/admin/users', { method: 'POST', body: payload })
export const assignRole = (userId, role) => apiFetch(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role } })
export const setUserStatus = (userId, isActive) => apiFetch(`/admin/users/${userId}/status`, { method: 'PATCH', body: { is_active: isActive } })
export const getWorkflowCounts = () => apiFetch('/admin/workflows')
export const listAgentRuns = () => apiFetch('/admin/agent-runs')
export const listAudit = () => apiFetch('/admin/audit')
