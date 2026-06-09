import React, { useEffect, useState } from 'react'
import { Logo } from '../components/ui/Logo'
import { motion } from 'framer-motion'
import { CheckCircle, Linkedin } from 'lucide-react'
import type { OAuthProvider } from '../lib/signup'

interface SignupPageProps {
  submitting?: boolean
  errorMessage?: string
  onSubmit: (details: {
    fullName: string
    email: string
    password: string
    phone?: string
    company?: string
    roleTitle?: string
    marketingOptIn: boolean
  }) => void
  onRestore: (email: string, password: string) => void
  onOAuth: (provider: OAuthProvider) => void
  onBack: () => void
  initialMode?: 'login' | 'signup'
  /** 'mid-onboarding' frames as "Your score is ready" (post-survey gate). */
  variant?: 'standard' | 'mid-onboarding'
}

/** Mock-aligned signup gate (Career-AI/onboarding-flow-mock.html §SCREEN 4):
 * OAuth-first (LinkedIn primary), email/password collapsed by default, with
 * the sunk-cost "Your resilience score is ready" framing for the mid-
 * onboarding variant. All existing form logic is preserved. */
export function SignupPage({
  submitting,
  errorMessage,
  onSubmit,
  onRestore,
  onOAuth,
  onBack,
  initialMode = 'login',
  variant = 'standard',
}: SignupPageProps) {
  const isMid = variant === 'mid-onboarding'
  const [mode, setMode] = useState<'login' | 'signup'>(isMid ? 'signup' : initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setMode(isMid ? 'signup' : initialMode)
    setLocalError('')
  }, [initialMode, isMid])

  const visibleError = localError || errorMessage

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    if (fullName.trim().length < 2) { setLocalError('Please enter your name.'); return }
    if (!emailOk) { setLocalError('Please enter a valid email address.'); return }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setLocalError('Password must be at least 8 characters and include a letter and a number.')
      return
    }
    setLocalError('')
    onSubmit({ fullName: fullName.trim(), email: email.trim(), password, marketingOptIn })
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    if (!emailOk) { setLocalError('Enter the email you used previously.'); return }
    if (password.length < 1) { setLocalError('Enter your password.'); return }
    setLocalError('')
    onRestore(email.trim(), password)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen bg-white">
      <header className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo variant="compact" size="md" className="text-gray-900" />
          </div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 pt-12 pb-12">
        {isMid && (
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
              <CheckCircle className="h-3.5 w-3.5" />
              Survey complete · Score is being computed
            </div>
          </div>
        )}

        <h1 className="mt-4 text-3xl font-bold text-center leading-tight text-gray-900">
          {isMid ? 'Your resilience score is ready.' : mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-3 text-center text-gray-500">
          {isMid
            ? 'Sign up to see it — we saved your answers and your profile. Takes 10 seconds.'
            : mode === 'signup'
              ? 'One free account unlocks your dashboard, mentor chat, and re-runs.'
              : 'Pick up where you left off.'}
        </p>

        <div className="mt-8 bg-white rounded-2xl border border-surface-border shadow-sm p-7">
          {/* OAuth primary */}
          <button
            type="button"
            onClick={() => onOAuth('linkedin')}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2.5 bg-linkedin hover:bg-linkedin-dark text-white font-medium py-3 rounded-lg text-[15px] transition-all disabled:opacity-50"
          >
            <Linkedin className="w-5 h-5" />
            Continue with LinkedIn
          </button>

          <button
            type="button"
            onClick={() => onOAuth('google')}
            disabled={submitting}
            className="mt-2.5 w-full flex items-center justify-center gap-2.5 bg-white hover:bg-surface-off border border-surface-border text-gray-900 font-medium py-3 rounded-lg text-[15px] transition-all disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* OR divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <div className="text-xs text-gray-300 uppercase tracking-wider">or use email</div>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          {mode === 'signup' ? (
            <form onSubmit={handleSignup} className="space-y-3">
              <input
                type="email" placeholder="you@example.com" autoComplete="email" aria-label="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-surface-border rounded-lg px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition"
              />
              <input
                type="password" placeholder="Password (8+ chars, letter + digit)" autoComplete="new-password" aria-label="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-surface-border rounded-lg px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition"
              />
              <input
                type="text" placeholder="Full name" autoComplete="name" aria-label="Full name"
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-surface-border rounded-lg px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition"
              />

              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox" className="w-4 h-4 accent-linkedin"
                  checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)}
                />
                <span className="text-xs text-gray-500">Send me product updates (optional)</span>
              </label>

              {visibleError && <p className="text-xs text-red-600">{visibleError}</p>}

              <button
                type="submit" disabled={submitting}
                className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg text-[15px] transition-all mt-2 disabled:opacity-50"
              >
                {submitting ? 'Creating account…' : isMid ? 'Sign up & see my score' : 'Create account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email" placeholder="you@example.com" autoComplete="email" aria-label="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-surface-border rounded-lg px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition"
              />
              <input
                type="password" placeholder="Your password" autoComplete="current-password" aria-label="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-surface-border rounded-lg px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition"
              />

              {visibleError && <p className="text-xs text-red-600">{visibleError}</p>}

              <button
                type="submit" disabled={submitting}
                className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg text-[15px] transition-all mt-2 disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Log in'}
              </button>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-surface-border text-center">
            {mode === 'signup' ? (
              <span className="text-xs text-gray-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setLocalError('') }}
                  className="text-linkedin hover:underline"
                >
                  Log in
                </button>
              </span>
            ) : (
              <span className="text-xs text-gray-500">
                New here?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setLocalError('') }}
                  className="text-linkedin hover:underline"
                >
                  Create an account
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-gray-300">
          We don't share your data. <span className="hover:underline cursor-pointer">Privacy</span> ·{' '}
          <span className="hover:underline cursor-pointer">Terms</span>
        </div>
      </div>
    </motion.div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
