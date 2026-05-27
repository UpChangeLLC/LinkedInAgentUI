import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck, User } from 'lucide-react'
import type { OAuthProvider } from '../lib/signup'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LinkedInNav } from '../components/ui/LinkedInNav'

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
  /** 'mid-onboarding' hides the deferred profile fields (phone/company/role)
   * to minimize friction at the post-survey signup gate (spec 01 §5). */
  variant?: 'standard' | 'mid-onboarding'
}

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
  const isMidOnboarding = variant === 'mid-onboarding'
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [returningEmail, setReturningEmail] = useState('')
  const [returningPassword, setReturningPassword] = useState('')
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setMode(initialMode)
    setLocalError('')
  }, [initialMode])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    if (fullName.trim().length < 2) {
      setLocalError('Please enter your name.')
      return
    }
    if (!emailOk) {
      setLocalError('Please enter a valid email address.')
      return
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setLocalError('Password must be at least 8 characters and include a letter and a number.')
      return
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.')
      return
    }
    setLocalError('')
    onSubmit({
      fullName,
      email,
      password,
      phone,
      company,
      roleTitle,
      marketingOptIn,
    })
  }

  const visibleError = localError || errorMessage
  const handleRestore = () => {
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(returningEmail.trim())
    if (!emailOk) {
      setLocalError('Enter the email you used previously.')
      return
    }
    if (!returningPassword) {
      setLocalError('Enter your password.')
      return
    }
    setLocalError('')
    onRestore(returningEmail.trim(), returningPassword)
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef]">
      <LinkedInNav />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="py-10 px-4"
      >
        <div className="max-w-6xl mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
            <Card className="min-h-[420px] p-8 md:p-10 shadow-[0_18px_50px_rgba(15,23,42,0.08)] border border-gray-200 bg-white rounded-3xl flex flex-col justify-center">
              <div className="w-14 h-14 rounded-2xl bg-[#E8F3FF] flex items-center justify-center mb-6 shadow-sm">
                <LockKeyhole className="w-6 h-6 text-linkedin" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4">
                Welcome to your AI Resilience account
              </h1>
              <p className="text-gray-600 text-base leading-relaxed mb-8 max-w-md">
                Access your dashboard, subscription, and Career Mentor from one secure account.
              </p>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex gap-3 rounded-2xl bg-gray-50 p-3">
                  <ShieldCheck className="w-5 h-5 text-linkedin shrink-0 mt-0.5" />
                  <span>Pick up where you left off with your latest career insights.</span>
                </div>
                <div className="flex gap-3 rounded-2xl bg-gray-50 p-3">
                  <ShieldCheck className="w-5 h-5 text-linkedin shrink-0 mt-0.5" />
                  <span>Keep your recommendations and mentor conversations connected.</span>
                </div>
              </div>
            </Card>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] md:p-8">
              <div className="mb-7">
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setLocalError('')
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    mode === 'login'
                      ? 'border-linkedin/40 bg-[#E8F3FF] text-linkedin shadow-sm'
                      : 'border-transparent bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setLocalError('')
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    mode === 'signup'
                      ? 'border-linkedin/40 bg-[#E8F3FF] text-linkedin shadow-sm'
                      : 'border-transparent bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Create account
                </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => onOAuth('google')}
                  className="h-12 rounded-xl border-gray-300 bg-white hover:bg-gray-50"
                >
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => onOAuth('linkedin')}
                  className="h-12 rounded-xl border-linkedin/30 bg-linkedin/5 hover:bg-linkedin/10 text-linkedin"
                >
                  Continue with LinkedIn
                </Button>
              </div>

              <div className="relative mb-7">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400">or use email</span>
                </div>
              </div>

              {visibleError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">
                  {visibleError}
                </div>
              )}

              {mode === 'login' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={returningEmail}
                        onChange={(e) => setReturningEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={returningPassword}
                      onChange={(e) => setReturningPassword(e.target.value)}
                      className="block w-full px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                      placeholder="Enter password"
                      autoComplete="current-password"
                    />
                  </div>
                  <Button
                    type="button"
                    fullWidth
                    size="lg"
                    disabled={submitting}
                    onClick={handleRestore}
                    className="bg-[#0A66C2] hover:bg-[#004182] disabled:opacity-60"
                  >
                    {submitting ? 'Signing in...' : 'Log in and continue'}
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    If a saved assessment exists, we’ll show it before recalculating.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                        placeholder="Jane Doe"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                        placeholder="jane@example.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Confirm password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                        placeholder="Repeat password"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {!isMidOnboarding && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Current role
                          </label>
                          <input
                            value={roleTitle}
                            onChange={(e) => setRoleTitle(e.target.value)}
                            className="block w-full px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                            placeholder="Product Manager"
                            autoComplete="organization-title"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Company
                          </label>
                          <input
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="block w-full px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                            placeholder="Acme Inc."
                            autoComplete="organization"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Phone <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="block w-full px-3 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                          placeholder="+1 555 000 0000"
                          autoComplete="tel"
                        />
                      </div>
                    </>
                  )}

                  <label className="flex items-start gap-3 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(e) => setMarketingOptIn(e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-linkedin focus:ring-linkedin"
                    />
                    <span>Send me occasional career insights and product updates.</span>
                  </label>

                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    disabled={submitting}
                    className="bg-[#0A66C2] hover:bg-[#004182] disabled:opacity-60"
                  >
                    {submitting ? 'Creating account...' : 'Create account and continue'}
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    One account can be created per email address.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
