import { apiFetch } from './client'

export const getAnalyticsDashboard = () => apiFetch('/analytics/dashboard')
