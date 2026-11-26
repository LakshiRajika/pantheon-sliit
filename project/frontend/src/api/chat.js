import { apiFetch } from './client'

// The assistant's role is resolved server-side from the token; it is never sent from here.
export const listConversations = () => apiFetch('/chat/conversations')
export const createConversation = (title) => apiFetch('/chat/conversations', { method: 'POST', body: { title } })
export const sendMessage = (conversationId, content) =>
  apiFetch(`/chat/conversations/${conversationId}/messages`, { method: 'POST', body: { content } })
