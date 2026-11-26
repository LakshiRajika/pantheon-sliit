import { apiFetch } from './client'

export const getReviewQueue = () => apiFetch('/reviews/queue')
export const getReview = (id) => apiFetch(`/reviews/${id}`)
export const submitDecision = (id, payload) => apiFetch(`/reviews/${id}/decision`, { method: 'POST', body: payload })
