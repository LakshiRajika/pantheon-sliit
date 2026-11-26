import { apiFetch } from './client'

export const listVessels = () => apiFetch('/vessels')
export const getVesselPositions = (id) => apiFetch(`/vessels/${id}/positions`)
