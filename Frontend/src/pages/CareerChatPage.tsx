import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Bot, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { LinkedInNav } from '../components/ui/LinkedInNav'
import { Button } from '../components/ui/Button'
import type { CareerChatTurn, CareerChatSessionSummary } from '../lib/careerChat'
import {
    createCareerChatSession,
    deleteCareerChatSession,
    fetchCareerChatHistory,
    getOrCreateCareerChatSessionId,
    listCareerChatSessions,
    postCareerChatMessage,
    renameCareerChatSession,
    resetCareerChatSession,
    rotateCareerChatSessionId,
    setLastActiveSessionId,
} from '../lib/careerChat'
import { ChatSessionSidebar } from '../components/chat/ChatSessionSidebar'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const SUGGESTED_PROMPTS = [
    'What should I improve first based on my score?',
    'Create a 30-day career action plan for me.',
    'How do I explain my AI readiness in interviews?',
]

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function chunkText(text: string): string[] {
    const parts = text.match(/\S+\s*/g) || [text]
    const chunks: string[] = []
    for (let i = 0; i < parts.length; i += 3) {
        chunks.push(parts.slice(i, i + 3).join(''))
    }
    return chunks
}

export interface CareerChatPageProps {
    seedAssessmentContext?: string
    onBack?: () => void
    embedded?: boolean
    onClose?: () => void
}

export function CareerChatPage({ seedAssessmentContext, onBack, embedded = false, onClose }: CareerChatPageProps) {
    const [sessionId, setSessionId] = useState(() => getOrCreateCareerChatSessionId())
    const [sessions, setSessions] = useState<CareerChatSessionSummary[]>([])
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const [messages, setMessages] = useState<CareerChatTurn[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [hydrating, setHydrating] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const seedSentRef = useRef(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const renderAssistantInChunks = useCallback(async (content: string) => {
        const chunks = chunkText(content)
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

        let rendered = ''
        for (const chunk of chunks) {
            rendered += chunk
            setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.role === 'assistant') {
                    next[next.length - 1] = { ...last, content: rendered }
                }
                return next
            })
            await sleep(28)
        }
    }, [])

    const updateInput = useCallback((value: string) => {
        setInput(value)
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 128)}px`
    }, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setHydrating(true)
            setError(null)
            try {
                const hist = await fetchCareerChatHistory(sessionId)
                if (!cancelled) setMessages(hist)
            } catch {
                if (!cancelled) setMessages([])
            } finally {
                if (!cancelled) setHydrating(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [sessionId])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    useEffect(() => {
        if (!hydrating && !loading) {
            inputRef.current?.focus()
        }
    }, [hydrating, loading])

    const onSend = useCallback(async (preset?: string) => {
        const text = (preset ?? input).trim()
        if (!text || loading) return
        updateInput('')
        setLoading(true)
        setError(null)
        setMessages((prev) => [...prev, { role: 'user', content: text }])
        const assessmentPayload =
            seedAssessmentContext?.trim() && !seedSentRef.current ? seedAssessmentContext.trim() : undefined
        try {
            const res = await postCareerChatMessage(sessionId, text, assessmentPayload)
            if (assessmentPayload) seedSentRef.current = true
            const history = res.history || []
            const last = history[history.length - 1]
            if (last?.role === 'assistant') {
                setMessages(history.slice(0, -1))
                await renderAssistantInChunks(last.content)
            } else {
                setMessages(history)
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Request failed'
            setError(msg)
            updateInput(text)
            setMessages((prev) => prev.filter((m, idx) => !(idx === prev.length - 1 && m.role === 'user' && m.content === text)))
        } finally {
            setLoading(false)
        }
    }, [input, loading, sessionId, seedAssessmentContext])

    const onReset = useCallback(async () => {
        setError(null)
        setLoading(true)
        try {
            await resetCareerChatSession(sessionId)
        } catch {
            /* still rotate locally */
        }
        const next = rotateCareerChatSessionId()
        seedSentRef.current = false
        setSessionId(next)
        setMessages([])
        setLoading(false)
    }, [sessionId])

    // Saved threads (Pro). Free/anonymous users get an empty list and keep the
    // single-session experience; the rail only renders when threads exist.
    const refreshSessions = useCallback(async () => {
        try {
            setSessions(await listCareerChatSessions())
        } catch {
            setSessions([])
        }
    }, [])

    useEffect(() => {
        void refreshSessions()
    }, [refreshSessions])

    const onSelectSession = useCallback((sid: string) => {
        seedSentRef.current = true // don't re-seed assessment context on an existing thread
        setLastActiveSessionId(sid)
        setSessionId(sid)
    }, [])

    const onNewChatSession = useCallback(async () => {
        try {
            const created = await createCareerChatSession()
            setLastActiveSessionId(created.session_id)
            seedSentRef.current = false
            setSessionId(created.session_id)
            setMessages([])
            await refreshSessions()
        } catch {
            // Free tier (402) or sessions disabled — fall back to the single-thread reset.
            await onReset()
        }
    }, [onReset, refreshSessions])

    const onRenameSession = useCallback(async (sid: string, title: string) => {
        const clean = title.trim()
        if (!clean) return
        try {
            await renameCareerChatSession(sid, clean)
            await refreshSessions()
        } catch {
            /* ignore */
        }
    }, [refreshSessions])

    // Delete is confirmed through an on-brand ConfirmDialog (no native confirm()).
    const onDeleteSession = useCallback((sid: string) => {
        setPendingDeleteId(sid)
    }, [])

    const confirmDeleteSession = useCallback(async () => {
        const sid = pendingDeleteId
        setPendingDeleteId(null)
        if (!sid) return
        try {
            await deleteCareerChatSession(sid)
            if (sid === sessionId) {
                const next = rotateCareerChatSessionId()
                seedSentRef.current = false
                setSessionId(next)
                setMessages([])
            }
            await refreshSessions()
        } catch {
            /* ignore */
        }
    }, [pendingDeleteId, sessionId, refreshSessions])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${embedded ? 'h-full' : 'min-h-screen'} flex flex-col bg-dark-bg text-dark-textPri`}
        >
            {!embedded && <LinkedInNav
                leadingSlot={
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm text-dark-textSec hover:text-dark-accent transition-colors mr-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                }
            />}

            <div className="flex-1 flex min-h-0 w-full">
            {sessions.length > 0 && (
                <ChatSessionSidebar
                    sessions={sessions}
                    activeSessionId={sessionId}
                    onSelect={onSelectSession}
                    onNewChat={onNewChatSession}
                    onRename={onRenameSession}
                    onDelete={onDeleteSession}
                />
            )}
            <div className={`${embedded ? 'h-full px-3 pb-3 pt-3' : (sessions.length > 0 ? 'flex-1 px-4 pb-28 pt-4' : 'flex-1 max-w-3xl mx-auto px-4 pb-28 pt-4')} flex flex-col min-w-0 min-h-0`}>
                <div className="flex items-center justify-between gap-3 border-b border-dark-border pb-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-dark-accent mb-0.5">
                            <Sparkles className="w-5 h-5" />
                            <span className="text-xs font-semibold uppercase tracking-widest">Career Mentor</span>
                        </div>
                        <h1 className="text-lg font-serif font-bold text-dark-textPri">Analyst chat</h1>
                        <div className="mt-1 flex items-center gap-2 text-xs text-dark-textMuted">
                            <span className="inline-flex h-2 w-2 rounded-full bg-green-400" />
                            Personalized to your assessment
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="text-dark-textSec h-8 px-3"
                            onClick={onReset}
                            disabled={loading}
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-1 inline" />
                            New chat
                        </Button>
                        {embedded && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-lg text-dark-textMuted hover:text-dark-textPri hover:bg-dark-card transition-colors"
                                aria-label="Close Career Mentor"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div role="log" aria-live="polite" aria-label="Conversation with your career mentor" className="flex-1 min-h-0 overflow-y-auto px-1 py-4 space-y-4">
                    {hydrating && (
                        <div className="text-center py-10">
                            <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-dark-accent border-t-transparent animate-spin" />
                            <p className="text-sm text-dark-textMuted">Loading your mentor thread...</p>
                        </div>
                    )}
                    {!hydrating && messages.length === 0 && (
                        <div className="py-6 px-2 space-y-5">
                            <div className="text-center space-y-2">
                                <div className="mx-auto h-12 w-12 rounded-2xl bg-dark-accentDim flex items-center justify-center">
                                    <Bot className="h-6 w-6 text-dark-accent" />
                                </div>
                                <p className="text-dark-textPri font-medium">Your AI career mentor is ready</p>
                                <p className="text-sm text-dark-textMuted">
                                    Start with a question or pick one of these prompts.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                {SUGGESTED_PROMPTS.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                        onClick={() => void onSend(prompt)}
                        disabled={loading || hydrating}
                                        className="rounded-xl border border-dark-border bg-dark-card/60 px-3 py-3 text-left text-sm text-dark-textSec hover:border-dark-accent hover:bg-dark-card hover:text-dark-textPri transition-colors"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                            <p className="text-sm text-dark-textMuted">
                                Tip: Ask for specific outputs like “give me a weekly plan” or “rewrite my positioning.”
                            </p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div
                            key={`${i}-${m.role}`}
                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                                    m.role === 'user'
                                        ? 'bg-linkedin text-white rounded-br-md'
                                        : 'bg-dark-card border border-dark-border text-dark-textPri rounded-bl-md'
                                }`}
                            >
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-dark-card border border-dark-border rounded-2xl rounded-bl-md px-4 py-3 text-sm text-dark-textMuted">
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-dark-accent animate-pulse" />
                                    Thinking through your profile...
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {error && (
                    <div className="mt-2 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="mt-2 flex gap-2 items-end border-t border-dark-border pt-3 bg-dark-bg pb-safe">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => updateInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                void onSend()
                            }
                        }}
                        rows={1}
                        placeholder="Ask your mentor for advice, plans, or interview positioning..."
                        className="flex-1 resize-none rounded-2xl border border-dark-border bg-dark-card px-4 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                        disabled={loading || hydrating}
                    />
                    <Button
                        type="button"
                        onClick={() => void onSend()}
                        loading={loading}
                        disabled={hydrating || !input.trim()}
                        aria-label="Send message"
                        className="bg-linkedin hover:bg-linkedin/90 shrink-0 h-[44px] px-4"
                    >
                        {!loading && <Send className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
            </div>
            <ConfirmDialog
                open={pendingDeleteId !== null}
                title="Delete this chat?"
                message="This conversation and its messages will be permanently removed."
                confirmLabel="Delete"
                destructive
                onConfirm={() => void confirmDeleteSession()}
                onCancel={() => setPendingDeleteId(null)}
            />
        </motion.div>
    )
}
