import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, CheckCircle, CreditCard, ExternalLink, Minus, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LinkedInNav } from '../components/ui/LinkedInNav'
import { StripeBuyButton } from '../components/StripeBuyButton'
import { createBillingPortalSession } from '../lib/signup'

const STRIPE_ENV = (import.meta as any).env || {}
const STRIPE_BUY_BUTTON_ID = String(STRIPE_ENV.VITE_STRIPE_BUY_BUTTON_ID || '').trim()
const STRIPE_PUBLISHABLE_KEY = String(STRIPE_ENV.VITE_STRIPE_PUBLISHABLE_KEY || '').trim()
const USE_BUY_BUTTON = Boolean(STRIPE_BUY_BUTTON_ID && STRIPE_PUBLISHABLE_KEY)

// Displayed prices come from env (single source shared with the backend catalog).
// These are labels only — the Buy Button charges the price set in Stripe.
const PRICE_SYMBOL = String(STRIPE_ENV.VITE_PRICE_CURRENCY || '$').trim() || '$'
function priceLabel(envKey: string, fallback: string): string {
  const raw = String(STRIPE_ENV[envKey] || '').trim()
  return raw ? `${PRICE_SYMBOL}${raw.replace(/^\$/, '')}` : fallback
}

/** What each tier unlocks — mirrors services/entitlements.py (Pro = active sub). */
const TIER_FEATURES: { label: string; free: boolean; pro: boolean }[] = [
  { label: 'AI Resilience score & overview', free: true, pro: true },
  { label: 'One free Career Mentor message', free: true, pro: true },
  { label: 'Unlimited Career Mentor messages', free: false, pro: true },
  { label: 'Saved mentor chat sessions', free: false, pro: true },
  { label: 'Full dashboard (skill gaps, pathways, simulator)', free: false, pro: true },
  { label: 'Reassessment / recalculation', free: false, pro: true },
  { label: 'Saved assessment history', free: false, pro: true },
]

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: priceLabel('VITE_PRICE_MONTHLY', '$9'),
    cadence: '/month',
    months: 1,
    badge: 'Flexible',
    description: 'Best if you want to try the full dashboard and mentor first.',
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: priceLabel('VITE_PRICE_QUARTERLY', '$24'),
    cadence: '/3 months',
    months: 3,
    badge: 'Popular',
    description: 'Enough time to follow your roadmap and track progress.',
  },
  {
    id: 'annual',
    name: 'Annual',
    price: priceLabel('VITE_PRICE_ANNUAL', '$79'),
    cadence: '/year',
    months: 12,
    badge: 'Best value',
    description: 'Continuous access for career planning and recalculation.',
  },
] as const

type PlanId = (typeof PLANS)[number]['id']

interface SubscriptionPageProps {
  subscriptionActive?: boolean
  submitting?: boolean
  accountName?: string
  accessToken?: string
  signupId?: string
  email?: string
  errorMessage?: string
  onDashboard?: () => void
  onRecalculate?: () => void
  onLogout?: () => void
  isAuthenticated?: boolean
  onActivate: (planId?: string, paymentMethod?: Record<string, unknown>) => void
  onRedeemPromo?: (code: string) => Promise<{ redeemed: boolean; applyAtCheckout: boolean; message: string }>
  onBack: () => void
}

export function SubscriptionPage({
  subscriptionActive = false,
  submitting = false,
  accountName,
  accessToken,
  signupId,
  email,
  errorMessage,
  onDashboard,
  onRecalculate,
  onLogout,
  isAuthenticated = false,
  onActivate,
  onRedeemPromo,
  onBack,
}: SubscriptionPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('quarterly')
  const selected = PLANS.find((plan) => plan.id === selectedPlan) || PLANS[1]
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [promoSuccess, setPromoSuccess] = useState('')

  const handleApplyPromo = async () => {
    const code = promoCode.trim()
    if (!code || !onRedeemPromo) return
    setPromoError('')
    setPromoSuccess('')
    setPromoLoading(true)
    try {
      const result = await onRedeemPromo(code)
      setPromoSuccess(result.message)
      if (result.redeemed) setPromoCode('')
    } catch (e: any) {
      setPromoError(e?.message || 'Could not apply that code.')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleManageBilling = async () => {
    if (!accessToken) return
    setPortalError('')
    setPortalLoading(true)
    try {
      const url = await createBillingPortalSession(accessToken)
      window.location.assign(url)
    } catch (e: any) {
      setPortalError(e?.message || 'Could not open the billing portal.')
      setPortalLoading(false)
    }
  }

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onActivate(selected.id, {
      name_on_card: String(form.get('name_on_card') || ''),
      card_number: String(form.get('card_number') || ''),
      expiry: String(form.get('expiry') || ''),
      cvc: String(form.get('cvc') || ''),
    })
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <LinkedInNav
        accountName={accountName}
        onDashboard={onDashboard}
        onRecalculate={onRecalculate}
        onLogout={onLogout}
      />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -18 }}
        className="px-4 py-10"
      >
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center text-dark-textMuted hover:text-dark-textPri mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>

          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-widest text-dark-accent font-semibold mb-2">
              Subscriptions
            </p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-dark-textPri mb-3">
              Choose your access plan
            </h1>
            <p className="text-dark-textMuted max-w-2xl mx-auto">
              Keep access to your AI Resilience dashboard, saved assessments, recalculation flow, and Career Mentor.
            </p>
            {subscriptionActive && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-300">
                <CheckCircle className="w-4 h-4" />
                You’re on Pro — subscription active
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {/* Free vs Pro comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-dark-textPri">Free</h2>
                {!subscriptionActive && (
                  <span className="rounded-full bg-dark-elevated px-2.5 py-0.5 text-[11px] text-dark-textSec">Current</span>
                )}
              </div>
              <p className="text-sm text-dark-textMuted mb-4">Your score and a taste of the mentor.</p>
              <ul className="space-y-2.5">
                {TIER_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-sm">
                    {f.free ? (
                      <Check className="w-4 h-4 text-dark-accent shrink-0 mt-0.5" />
                    ) : (
                      <Minus className="w-4 h-4 text-dark-textMuted shrink-0 mt-0.5" />
                    )}
                    <span className={f.free ? 'text-dark-textSec' : 'text-dark-textMuted line-through'}>{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-dark-accent/50 bg-dark-accentDim/30 p-6 ring-1 ring-dark-accent/30">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-dark-textPri">Pro</h2>
                {subscriptionActive && (
                  <span className="rounded-full bg-dark-accent/20 px-2.5 py-0.5 text-[11px] text-dark-accent">Current</span>
                )}
              </div>
              <p className="text-sm text-dark-textMuted mb-4">Everything, unlocked — the full dashboard and unlimited mentor.</p>
              <ul className="space-y-2.5">
                {TIER_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-dark-accent shrink-0 mt-0.5" />
                    <span className="text-dark-textPri">{f.label}</span>
                  </li>
                ))}
              </ul>
              {subscriptionActive && accessToken && (
                <div className="mt-5">
                  <Button
                    type="button"
                    fullWidth
                    variant="secondary"
                    loading={portalLoading}
                    onClick={() => void handleManageBilling()}
                  >
                    {!portalLoading && <ExternalLink className="w-4 h-4 mr-1.5 inline" />}
                    {portalLoading ? 'Opening…' : 'Manage billing'}
                  </Button>
                  {portalError && <p className="mt-2 text-xs text-red-300 text-center">{portalError}</p>}
                </div>
              )}
            </div>
          </div>

          {subscriptionActive && (
            <p className="text-center text-sm text-dark-textMuted mb-8">
              Update your payment method or cancel anytime from the billing portal.
            </p>
          )}

          {!subscriptionActive && (
          <>
          {onRedeemPromo && (
            <div className="mb-8 rounded-2xl border border-dark-accent/30 bg-dark-accentDim/20 p-5">
              <p className="text-sm font-semibold text-dark-textPri mb-1">Have a promo code?</p>
              <p className="text-xs text-dark-textMuted mb-3">
                Launch codes unlock free Pro access. Discount codes are applied at checkout.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleApplyPromo()
                    }
                  }}
                  placeholder="Enter code (e.g. EARLYBIRD)"
                  autoCapitalize="characters"
                  className="flex-1 rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm uppercase tracking-wide text-dark-textPri placeholder:text-dark-textMuted placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                />
                <Button
                  type="button"
                  variant="secondary"
                  loading={promoLoading}
                  disabled={!promoCode.trim()}
                  onClick={() => void handleApplyPromo()}
                >
                  {promoLoading ? 'Applying…' : 'Apply code'}
                </Button>
              </div>
              {promoError && <p className="mt-2 text-xs text-red-300">{promoError}</p>}
              {promoSuccess && (
                <p className="mt-2 text-xs text-green-300 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  {promoSuccess}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {PLANS.map((plan) => {
              const active = selectedPlan === plan.id
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`text-left rounded-2xl border p-5 transition-colors ${
                    active
                      ? 'border-linkedin bg-linkedin/10 ring-1 ring-linkedin'
                      : 'border-dark-border bg-dark-card hover:border-dark-accent/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="font-semibold text-dark-textPri">{plan.name}</span>
                    <span className="rounded-full bg-dark-accentDim px-2 py-0.5 text-[11px] text-dark-accent">
                      {plan.badge}
                    </span>
                  </div>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-4xl font-bold text-dark-textPri">{plan.price}</span>
                    <span className="text-sm text-dark-textMuted mb-1">{plan.cadence}</span>
                  </div>
                  <p className="text-sm text-dark-textMuted">{plan.description}</p>
                </button>
              )
            })}
          </div>

          <Card className="p-6 md:p-8 border border-dark-border bg-dark-card">
            {!isAuthenticated ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-6 items-center">
                <div>
                  <div className="rounded-xl border border-dark-accent/20 bg-dark-accentDim/40 px-4 py-3 text-sm text-dark-textSec mb-5">
                    Create an account or log in before activating a subscription. We’ll bring you back here after sign-in.
                  </div>
                  <h2 className="text-xl font-semibold text-dark-textPri mb-2">Account required</h2>
                  <p className="text-sm text-dark-textMuted">
                    We need an account first so your subscription can be linked to your dashboard, saved assessment, and Career Mentor.
                  </p>
                </div>
                <div className="rounded-2xl border border-dark-border bg-dark-bg p-5">
                  <p className="text-sm text-dark-textMuted mb-2">Selected plan</p>
                  <div className="flex items-end gap-1 mb-4">
                    <span className="text-3xl font-bold text-dark-textPri">{selected.price}</span>
                    <span className="text-sm text-dark-textMuted mb-1">{selected.cadence}</span>
                  </div>
                  <Button type="button" fullWidth onClick={() => onActivate(selected.id)} className="bg-linkedin hover:bg-linkedin/90">
                    Create account to activate
                  </Button>
                </div>
              </div>
            ) : USE_BUY_BUTTON ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-6 items-center">
                <div>
                  <div className="flex items-center gap-2 text-dark-textPri font-semibold mb-3">
                    <CreditCard className="w-4 h-4 text-dark-accent" />
                    Secure checkout with Stripe
                  </div>
                  <p className="text-sm text-dark-textMuted mb-4">
                    You’ll be charged securely by Stripe and your Pro access unlocks automatically once payment completes.
                  </p>
                  <div className="rounded-xl border border-dark-accent/20 bg-dark-accentDim/40 px-4 py-3 text-sm text-dark-textSec">
                    Have a <span className="font-semibold text-dark-textPri">FIFA50</span> code? Enter it on the Stripe
                    checkout page to take 50% off your first payment.
                  </div>
                </div>
                <div className="rounded-2xl border border-dark-border bg-dark-bg p-5 flex flex-col items-center">
                  <div className="space-y-2 text-sm text-dark-textSec mb-5 self-start">
                    <p className="flex gap-2"><ShieldCheck className="w-4 h-4 text-dark-accent shrink-0" /> Dashboard access</p>
                    <p className="flex gap-2"><ShieldCheck className="w-4 h-4 text-dark-accent shrink-0" /> Career Mentor</p>
                    <p className="flex gap-2"><ShieldCheck className="w-4 h-4 text-dark-accent shrink-0" /> Saved assessment history</p>
                  </div>
                  <StripeBuyButton
                    buyButtonId={STRIPE_BUY_BUTTON_ID}
                    publishableKey={STRIPE_PUBLISHABLE_KEY}
                    clientReferenceId={signupId}
                    customerEmail={email}
                  />
                </div>
              </div>
            ) : (
            <form onSubmit={submitPayment} className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-6">
              <div>
                <div className="flex items-center gap-2 text-dark-textPri font-semibold mb-4">
                  <CreditCard className="w-4 h-4 text-dark-accent" />
                  Payment method
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input required name="name_on_card" placeholder="Name on card" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
                  <input required name="card_number" inputMode="numeric" placeholder="Card number" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
                  <input required name="expiry" placeholder="MM / YY" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
                  <input required name="cvc" inputMode="numeric" placeholder="CVC" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
                </div>
              </div>

              <div className="rounded-2xl border border-dark-border bg-dark-bg p-5">
                <p className="text-sm text-dark-textMuted mb-2">Selected plan</p>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-3xl font-bold text-dark-textPri">{selected.price}</span>
                  <span className="text-sm text-dark-textMuted mb-1">{selected.cadence}</span>
                </div>
                <div className="space-y-2 text-sm text-dark-textSec mb-5">
                  <p className="flex gap-2"><ShieldCheck className="w-4 h-4 text-dark-accent shrink-0" /> Dashboard access</p>
                  <p className="flex gap-2"><ShieldCheck className="w-4 h-4 text-dark-accent shrink-0" /> Career Mentor</p>
                  <p className="flex gap-2"><ShieldCheck className="w-4 h-4 text-dark-accent shrink-0" /> Saved assessment history</p>
                </div>
                <Button type="submit" fullWidth loading={submitting} className="bg-linkedin hover:bg-linkedin/90">
                  {submitting ? 'Processing…' : `Pay ${selected.price} and activate`}
                </Button>
                <p className="text-xs text-dark-textMuted text-center mt-3">
                  Secure checkout. You can cancel anytime.
                </p>
              </div>
            </form>
            )}
          </Card>
          </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
