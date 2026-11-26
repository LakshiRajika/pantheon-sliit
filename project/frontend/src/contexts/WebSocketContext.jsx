import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { tokenStore } from '../api/client'
import { rememberWorkflow, recallWorkflow, isRememberedWorkflow } from '../utils/workflowMemory'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/api/v1/ws'
const MAX_NOTIFICATIONS = 30
const PING_MS = 25_000

const WebSocketContext = createContext(null)

// Human-readable lines for events worth notifying about.
function describe(evt, reference) {
  const ref = reference ? `Shipment ${reference}` : 'A shipment'
  switch (evt.event) {
    case 'workflow.started': return { title: 'AI analysis started', body: `${ref} is being processed.` }
    case 'workflow.completed': return { title: 'AI analysis completed', body: `${ref} finished processing.` }
    case 'workflow.failed': return { title: 'AI analysis failed', body: `${ref} could not be processed.`, attention: true }
    case 'review.created':
      return { title: 'Review required', body: `${ref}: ${evt.data?.reason ?? 'needs an officer decision.'}`, attention: true }
    case 'review.completed': return { title: 'Review decided', body: `${ref}: ${evt.data?.decision ?? 'decision recorded'}.` }
    default: return null
  }
}

/**
 * One authenticated WebSocket per signed-in user.
 * - Events are hints: they invalidate TanStack Query caches, and REST stays the source of truth.
 * - Reconnects with backoff; after reconnecting, refetches everything to resync (architecture §24).
 * - The server filters events by role only, so we additionally ignore events about shipments
 *   this user can't see (not in their shipment list and not started from this browser).
 */
export function WebSocketProvider({ children }) {
  const { status, user } = useAuth()
  const queryClient = useQueryClient()
  const [connection, setConnection] = useState('offline') // 'connecting' | 'live' | 'reconnecting' | 'offline'
  const [notifications, setNotifications] = useState([])
  const listeners = useRef(new Set())

  const isRelevant = useCallback((evt) => {
    if (!evt.shipment_id) return !!evt.workflow_id && isRememberedWorkflow(evt.workflow_id)
    if (recallWorkflow(evt.shipment_id)) return true
    // Customs officers and admins receive review events by design; reviews are their job.
    if (evt.event.startsWith('review.') && ['customs_officer', 'admin'].includes(user?.role)) return true
    const list = queryClient.getQueryData(['shipments'])
    return !!list?.some((s) => s.id === evt.shipment_id)
  }, [queryClient, user?.role])

  const handleEvent = useCallback((evt) => {
    const relevant = isRelevant(evt)

    // Cache invalidation is harmless even for irrelevant events: REST re-checks access.
    if (evt.workflow_id) queryClient.invalidateQueries({ queryKey: ['workflows', evt.workflow_id] })
    if (evt.shipment_id) {
      queryClient.invalidateQueries({ queryKey: ['shipments', evt.shipment_id] })
      if (evt.event === 'workflow.started' && relevant) rememberWorkflow(evt.shipment_id, evt.workflow_id)
      queryClient.invalidateQueries({ queryKey: ['workflow-ref', evt.shipment_id] })
    }
    if (evt.event.startsWith('review.')) queryClient.invalidateQueries({ queryKey: ['reviews'] })
    if (evt.event.startsWith('workflow.') || evt.event.startsWith('shipment.')) {
      queryClient.invalidateQueries({ queryKey: ['shipments'], exact: true })
    }

    listeners.current.forEach((fn) => fn(evt))
    if (!relevant) return

    const reference = queryClient.getQueryData(['shipments', evt.shipment_id])?.shipment_reference
      ?? queryClient.getQueryData(['shipments'])?.find((s) => s.id === evt.shipment_id)?.shipment_reference
    const text = describe(evt, reference)
    if (!text) return
    setNotifications((prev) => [
      { id: `${evt.event}-${evt.timestamp}-${Math.random().toString(36).slice(2, 7)}`, ...text, event: evt, read: false, fresh: true },
      ...prev,
    ].slice(0, MAX_NOTIFICATIONS))
  }, [queryClient, isRelevant])

  // Keep the latest handler without re-opening the socket when it changes.
  const handlerRef = useRef(handleEvent)
  useEffect(() => { handlerRef.current = handleEvent }, [handleEvent])

  useEffect(() => {
    if (status !== 'authenticated') {
      setConnection('offline')
      setNotifications([])
      return
    }

    let ws, pingTimer, retryTimer
    let attempt = 0
    let stopped = false
    let hasConnectedBefore = false

    const connect = () => {
      const token = tokenStore.get()
      if (!token || stopped) return
      setConnection(attempt === 0 ? 'connecting' : 'reconnecting')
      ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)

      ws.onopen = () => {
        attempt = 0
        setConnection('live')
        if (hasConnectedBefore) queryClient.invalidateQueries() // resync after a gap
        hasConnectedBefore = true
        pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS)
      }
      ws.onmessage = (msg) => {
        try { handlerRef.current(JSON.parse(msg.data)) } catch { /* ignore malformed frames */ }
      }
      ws.onclose = () => {
        clearInterval(pingTimer)
        if (stopped) return
        setConnection('reconnecting')
        const delay = Math.min(30_000, 1000 * 2 ** attempt) // 1s, 2s, 4s … 30s
        attempt += 1
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      stopped = true
      clearInterval(pingTimer)
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [status, queryClient])

  const markAllRead = useCallback(() => setNotifications((n) => n.map((x) => ({ ...x, read: true }))), [])
  const dismissToast = useCallback((id) => setNotifications((n) => n.map((x) => (x.id === id ? { ...x, fresh: false } : x))), [])
  const subscribe = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn) }, [])

  const value = useMemo(
    () => ({ connection, notifications, markAllRead, dismissToast, subscribe }),
    [connection, notifications, markAllRead, dismissToast, subscribe],
  )
  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export function useRealtime() {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error('useRealtime must be used inside <WebSocketProvider>')
  return ctx
}
