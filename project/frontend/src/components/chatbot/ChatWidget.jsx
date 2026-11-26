import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, X, SendHorizontal, SquarePen, ChevronDown, CircleAlert, RotateCw } from 'lucide-react'
import * as chatApi from '../../api/chat'
import { formatDateTime } from '../../utils/format'

const MAX_CHARS = 4000 // mirrors backend MAX_CHAT_MESSAGE_CHARS

/**
 * Floating role assistant. Mounted by AppLayout only for roles with an assistant (never admin);
 * the backend independently refuses chat for roles without chat:use.
 *
 * Messages live in memory for this session: the backend has no endpoint to load a
 * conversation's history yet, so earlier conversations can be listed but not reopened.
 */
export default function ChatWidget({ roleConfig }) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState(null) // null = new, unsaved conversation
  const [threads, setThreads] = useState({}) // conversationId -> messages[]
  const [draftThread, setDraftThread] = useState([]) // messages before the conversation exists
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null) // { message, retryText }
  const [showHistory, setShowHistory] = useState(false)
  const qc = useQueryClient()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const buttonRef = useRef(null)

  const { data: conversations } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: chatApi.listConversations,
    enabled: open,
  })

  const messages = activeId ? threads[activeId] : draftThread
  const known = activeId ? Array.isArray(threads[activeId]) : true // false = earlier conversation, no history

  useEffect(() => { if (open) inputRef.current?.focus() }, [open, activeId])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const append = (convId, msg) => {
    if (convId) setThreads((t) => ({ ...t, [convId]: [...(t[convId] ?? []), msg] }))
    else setDraftThread((d) => [...d, msg])
  }

  const send = async (raw) => {
    const text = raw.trim()
    if (!text || sending) return
    if (text.length > MAX_CHARS) return setError({ message: `Messages are limited to ${MAX_CHARS} characters.` })
    setError(null)
    setInput('')
    setSending(true)

    let convId = activeId
    const userMsg = { role: 'user', content: text, created_at: new Date().toISOString() }
    try {
      if (!convId) {
        // Create the conversation lazily on the first message, titled from it.
        const convo = await chatApi.createConversation(text.slice(0, 60))
        convId = convo.id
        setThreads((t) => ({ ...t, [convId]: [...draftThread, userMsg] }))
        setDraftThread([])
        setActiveId(convId)
        qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      } else {
        append(convId, userMsg)
      }
      const reply = await chatApi.sendMessage(convId, text)
      append(convId, reply)
    } catch (err) {
      setError({ message: err.message || 'The message could not be sent.', retryText: text })
      // Drop the optimistic user message so retrying doesn't duplicate it.
      if (convId) setThreads((t) => ({ ...t, [convId]: (t[convId] ?? []).filter((m) => m !== userMsg) }))
    } finally {
      setSending(false)
    }
  }

  const newChat = () => {
    setActiveId(null)
    setDraftThread([])
    setError(null)
    setShowHistory(false)
  }

  const openConversation = (id) => {
    setActiveId(id)
    setError(null)
    setShowHistory(false)
  }

  const title = `${roleConfig.label} Assistant`
  const activeConvo = conversations?.find((c) => c.id === activeId)

  return (
    <>
      {/* Launcher */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        aria-expanded={open}
        className={`fixed bottom-6 right-6 z-40 grid size-14 place-items-center rounded-full bg-ink text-orange shadow-[4px_4px_0_0_#D9541E] transition hover:-translate-y-0.5 ${open ? 'max-sm:hidden' : ''}`}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>

      {/* Panel */}
      {open && (
        <section
          role="dialog" aria-label={title}
          className="fixed inset-0 z-50 flex flex-col bg-cream sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100vh-8rem))] sm:w-[400px] sm:rounded-xl sm:border-2 sm:border-ink sm:shadow-[6px_6px_0_0_#111111]"
        >
          <header className="flex items-center gap-2 bg-ink px-4 py-3 text-cream sm:rounded-t-[10px]">
            <Bot className="size-5 text-orange" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="flex max-w-full items-center gap-1 text-xs text-cream/60 hover:text-cream"
                aria-expanded={showHistory}
              >
                <span className="truncate">{activeConvo?.title || (activeId ? 'Conversation' : 'New conversation')}</span>
                <ChevronDown className="size-3 shrink-0" aria-hidden />
              </button>
            </div>
            <button onClick={newChat} className="rounded p-1.5 text-cream/70 hover:bg-ink-soft hover:text-cream" aria-label="New conversation" title="New conversation">
              <SquarePen className="size-4" />
            </button>
            <button onClick={() => { setOpen(false); buttonRef.current?.focus() }} className="rounded p-1.5 text-cream/70 hover:bg-ink-soft hover:text-cream" aria-label="Close assistant">
              <X className="size-4" />
            </button>
          </header>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-ink/55">Your conversations</p>
              {!conversations?.length ? (
                <p className="px-1 text-sm text-ink/60">No conversations yet.</p>
              ) : (
                <ul className="space-y-1">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => openConversation(c.id)}
                        className={`w-full rounded-md px-3 py-2 text-left hover:bg-cream-deep ${c.id === activeId ? 'bg-cream-deep' : ''}`}
                      >
                        <span className="block truncate text-sm font-medium">{c.title || 'Untitled conversation'}</span>
                        <span className="block font-mono text-[11px] text-ink/50">{formatDateTime(c.created_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {!known && (
                <p className="rounded-md border border-ink/15 bg-cream-deep/50 px-3 py-2 text-xs text-ink/65">
                  Earlier messages in this conversation can’t be loaded yet. New messages will continue it.
                </p>
              )}

              {known && messages.length === 0 && (
                <div className="space-y-3 pt-4">
                  <p className="text-sm text-ink/70">
                    Ask about your work in Pantheon. Answers only use data your role can access.
                  </p>
                  {roleConfig.suggestedQuestions?.length > 0 && (
                    <ul className="space-y-2">
                      {roleConfig.suggestedQuestions.map((q) => (
                        <li key={q}>
                          <button
                            onClick={() => send(q)}
                            className="w-full rounded-md border-2 border-ink/15 px-3 py-2 text-left text-sm hover:border-ink"
                          >
                            {q}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {(messages ?? []).map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user' ? 'rounded-br-sm bg-ink text-cream' : 'rounded-bl-sm bg-cream-deep text-ink'
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start" role="status" aria-label="Assistant is typing">
                  <span className="flex gap-1 rounded-lg rounded-bl-sm bg-cream-deep px-4 py-3">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-ink/50" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                </div>
              )}

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-md border-l-4 border-orange bg-cream-deep px-3 py-2 text-sm">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden />
                  <span className="flex-1">{error.message}</span>
                  {error.retryText && (
                    <button onClick={() => send(error.retryText)} className="flex items-center gap-1 font-semibold hover:underline">
                      <RotateCw className="size-3.5" aria-hidden /> Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); send(input) }}
            className="border-t border-ink/10 p-3"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">Message</label>
              <textarea
                id="chat-input" ref={inputRef} rows={1} value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder="Ask a question…"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-md border-2 border-ink/15 bg-white/60 px-3 py-2 text-sm focus:border-ink focus:outline-none"
              />
              <button
                type="submit" disabled={!input.trim() || sending}
                className="grid size-10 shrink-0 place-items-center rounded-md bg-orange text-ink transition hover:bg-orange-deep disabled:opacity-50"
                aria-label="Send message"
              >
                <SendHorizontal className="size-4" />
              </button>
            </div>
            <p className="mt-1.5 flex justify-between text-[11px] text-ink/50">
              <span>AI answers can be wrong. Decisions stay with authorised staff.</span>
              {input.length > MAX_CHARS * 0.8 && <span className={input.length > MAX_CHARS ? 'font-semibold text-ink' : ''}>{input.length}/{MAX_CHARS}</span>}
            </p>
          </form>
        </section>
      )}
    </>
  )
}
