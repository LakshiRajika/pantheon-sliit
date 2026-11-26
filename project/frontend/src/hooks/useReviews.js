import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/reviews'

// review.* WebSocket events invalidate ['reviews'], so the queue updates live.
export const useReviewQueue = () => useQuery({ queryKey: ['reviews', 'queue'], queryFn: api.getReviewQueue })
export const useReview = (id) => useQuery({ queryKey: ['reviews', id], queryFn: () => api.getReview(id) })

export function useSubmitDecision(reviewId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.submitDecision(reviewId, payload),
    // Refresh on success AND on 409 (someone else already decided).
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] })
      qc.invalidateQueries({ queryKey: ['shipments'] })
    },
  })
}
