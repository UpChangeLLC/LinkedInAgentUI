import React, { useEffect, useState } from 'react'
import { Logo } from '../components/ui/Logo'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

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
  onBack: () => void
  initialMode?: 'login' | 'signup'
  /** 'mid-onboarding' frames as "Your score is ready" (post-survey gate). */
  variant?: 'standard' | 'mid-onboarding'
  /** Forgot-password request (login). Resolves true when the email was sent. */
  onForgotPassword?: (email: string) => Promise<boolean>
  /** When set, the page shows the "set a new password" form (?reset=… link). */
  resetActive?: boolean
  onResetPassword?: (newPassword: string) => Promise<boolean>
  onCancelReset?: () => void
}

/** Email/password signup + login gate, with "forgot password" request and a
 *  reset-from-link form. Social sign-in has been removed — email is the only
 *  path. Keeps the sunk-cost "Your resilience score is ready" mid-onboarding
 *  framing. */
export function SignupPage({
  submitting,
  errorMessage,
  onSubmit,
  onRestore,
  onBack,
  initialMode = 'login',
  variant = 'standard',
  onForgotPassword,
  resetActive = false,
  onResetPassword,
  onCancelReset,
}: SignupPageProps) {
  const isMid = variant === 'mid-onboarding'
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(isMid ? 'signup' : initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [localError, setLocalError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

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

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    if (!emailOk) { setLocalError('Enter a valid email address.'); return }
    setLocalError('')
    const ok = await onForgotPassword?.(email.trim())
    if (ok) setForgotSent(true)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setLocalError('Password must be at least 8 characters and include a letter and a number.')
      return
    }
    setLocalError('')
    await onResetPassword?.(newPassword)
  }

  const inputClass =
    'w-full border border-surface-border rounded-lg px-4 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-linkedin focus:ring-2 focus:ring-linkedin/10 transition'

  const heading = resetActive
    ? 'Set a new password'
    : isMid
      ? 'Your resilience score is ready.'
      : mode === 'signup'
        ? 'Create your account'
        : mode === 'forgot'
          ? 'Reset your password'
          : 'Welcome back'

  const subheading = resetActive
    ? 'Choose a new password for your account.'
    : isMid
      ? 'Sign up to see it — we saved your answers and your profile. Takes 10 seconds.'
      : mode === 'signup'
        ? 'One free account unlocks your dashboard, mentor chat, and re-runs.'
        : mode === 'forgot'
          ? "Enter your email and we'll send you a reset link."
          : 'Pick up where you left off.'

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
        {isMid && !resetActive && (
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
              <CheckCircle className="h-3.5 w-3.5" />
              Survey complete · Score is being computed
            </div>
          </div>
        )}

        <h1 className="mt-4 text-3xl font-bold text-center leading-tight text-gray-900">{heading}</h1>
        <p className="mt-3 text-center text-gray-500">{subheading}</p>

        <div className="mt-8 bg-white rounded-2xl border border-surface-border shadow-sm p-7">
          {resetActive ? (
            <form onSubmit={handleReset} className="space-y-3">
              <input
                type="password" placeholder="New password (8+ chars, letter + digit)" autoComplete="new-password" aria-label="New password"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
              {visibleError && <p className="text-xs text-red-600">{visibleError}</p>}
              <button
                type="submit" disabled={submitting}
                className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg text-[15px] transition-all mt-2 disabled:opacity-50"
              >
                {submitting ? 'Updating…' : 'Set new password'}
              </button>
              <button
                type="button"
                onClick={onCancelReset}
                className="w-full text-xs text-gray-500 hover:text-gray-900 pt-1"
              >
                Cancel
              </button>
            </form>
          ) : mode === 'signup' ? (
            <form onSubmit={handleSignup} className="space-y-3">
              <input
                type="email" placeholder="you@example.com" autoComplete="email" aria-label="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass}
              />
              <input
                type="password" placeholder="Password (8+ chars, letter + digit)" autoComplete="new-password" aria-label="Password"
                value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}
              />
              <input
                type="text" placeholder="Full name" autoComplete="name" aria-label="Full name"
                value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass}
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
          ) : mode === 'forgot' ? (
            forgotSent ? (
              <div className="text-center space-y-3 py-2">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-sm text-gray-700">
                  If an account exists for <span className="font-medium">{email.trim()}</span>, a password-reset
                  link is on its way. Check your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setForgotSent(false); setLocalError('') }}
                  className="text-linkedin hover:underline text-sm"
                >
                  Back to log in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <input
                  type="email" placeholder="you@example.com" autoComplete="email" aria-label="Email address"
                  value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass}
                />
                {visibleError && <p className="text-xs text-red-600">{visibleError}</p>}
                <button
                  type="submit" disabled={submitting}
                  className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg text-[15px] transition-all mt-2 disabled:opacity-50"
                >
                  Send reset link
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setLocalError('') }}
                  className="w-full text-xs text-gray-500 hover:text-gray-900 pt-1"
                >
                  Back to log in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email" placeholder="you@example.com" autoComplete="email" aria-label="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass}
              />
              <input
                type="password" placeholder="Your password" autoComplete="current-password" aria-label="Password"
                value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}
              />

              {visibleError && <p className="text-xs text-red-600">{visibleError}</p>}

              <button
                type="submit" disabled={submitting}
                className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 rounded-lg text-[15px] transition-all mt-2 disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Log in'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('forgot'); setLocalError(''); setForgotSent(false) }}
                className="w-full text-xs text-linkedin hover:underline pt-1"
              >
                Forgot password?
              </button>
            </form>
          )}

          {!resetActive && mode !== 'forgot' && (
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
          )}
        </div>

        <div className="mt-6 text-center text-[11px] text-gray-300">
          We don't share your data. <span className="hover:underline cursor-pointer">Privacy</span> ·{' '}
          <span className="hover:underline cursor-pointer">Terms</span>
        </div>
      </div>
    </motion.div>
  )
}
