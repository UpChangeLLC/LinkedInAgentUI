import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageCircle, RotateCcw, Send } from 'lucide-react'
import { LinkedInNav } from '../components/ui/LinkedInNav'
import { Button } from '../components/ui/Button'
import type { CareerChatTurn } from '../lib/careerChat'
import {
    fetchCareerChatHistory,
    getOrCreateCareerChatSessionId,
    postCareerChatMessage,
    resetCareerChatSession,
    rotateCareerChatSessionId,
} from '../lib/careerChat'

export interface CareerChatPageProps {
    seedAssessmentContext?: string
    onBack: () => void
}

export function CareerChatPage({ seedAssessmentContext, onBack }: CareerChatPageProps) {
    const [sessionId, setSessionId] = useState(() => getOrCreateCareerChatSessionId())
    const [messages, setMessages] = useState<CareerChatTurn[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [hydrating, setHydrating] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const seedSentRef = useRef(false)
    const bottomRef = useRef<HTMLDivElement>(null)

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

    const onSend = useCallback(async () => {
        const text = input.trim()
        if (!text || loading) return
        setInput('')
        setLoading(true)
        setError(null)
        const assessmentPayload =
            seedAssessmentContext?.trim() && !seedSentRef.current ? seedAssessmentContext.trim() : undefined
        try {
            const res = await postCareerChatMessage(sessionId, text, assessmentPayload)
            if (assessmentPayload) seedSentRef.current = true
            setMessages(res.history || [])
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Request failed'
            setError(msg)
            setInput(text)
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

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col bg-dark-bg text-dark-textPri"
        >
            <LinkedInNav
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
            />

            <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 pb-28 pt-4 min-h-0">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <div className="flex items-center gap-2 text-dark-accent mb-1">
                            <MessageCircle className="w-5 h-5" />
                            <span className="text-xs font-semibold uppercase tracking-widest">Career Mentor</span>
                        </div>
                        <h1 className="text-2xl font-serif font-bold text-dark-textPri">Analyst chat</h1>
                        <p className="text-sm text-dark-textMuted mt-1">
                            Grounded career guidance. Your thread is remembered for this browser session (server-side
                            when Redis is configured).
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0 text-dark-textSec"
                        onClick={onReset}
                        disabled={loading}
                    >
                        <RotateCcw className="w-4 h-4 mr-1 inline" />
                        New chat
                    </Button>
                </div>

                <div className="flex-1 min-h-[320px] max-h-[calc(100dvh-220px)] overflow-y-auto rounded-lg border border-dark-border bg-dark-card/40 p-4 space-y-4">
                    {hydrating && (
                        <p className="text-sm text-dark-textMuted text-center py-8">Loading conversation…</p>
                    )}
                    {!hydrating && messages.length === 0 && (
                        <div className="text-center py-10 px-4 space-y-2">
                            <p className="text-dark-textPri font-medium">Ask anything about your career path</p>
                            <p className="text-sm text-dark-textMuted">
                                Promotion strategy, skill pivots, interview framing, or how to read your AI resilience
                                results.
                            </p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div
                            key={`${i}-${m.role}`}
                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
                            <div className="bg-dark-card border border-dark-border rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-dark-textMuted">
                                Thinking…
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

                <div className="mt-4 flex gap-2 items-end sticky bottom-0 pt-2 bg-dark-bg pb-safe">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                void onSend()
                            }
                        }}
                        rows={2}
                        placeholder="Message your career mentor…"
                        className="flex-1 resize-none rounded-lg border border-dark-border bg-dark-card px-3 py-2 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                        disabled={loading || hydrating}
                    />
                    <Button
                        type="button"
                        onClick={() => void onSend()}
                        disabled={loading || hydrating || !input.trim()}
                        className="bg-linkedin hover:bg-linkedin/90 shrink-0 h-[44px] px-4"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}
