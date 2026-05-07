import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, CreditCard, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LinkedInNav } from '../components/ui/LinkedInNav'

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$9',
    cadence: '/month',
    months: 1,
    badge: 'Flexible',
    description: 'Best if you want to try the full dashboard and mentor first.',
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: '$24',
    cadence: '/3 months',
    months: 3,
    badge: 'Popular',
    description: 'Enough time to follow your roadmap and track progress.',
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '$79',
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
  onDashboard?: () => void
  onRecalculate?: () => void
  onLogout?: () => void
  isAuthenticated?: boolean
  onActivate: (months?: number) => void
  onBack: () => void
}

export function SubscriptionPage({
  subscriptionActive = false,
  submitting = false,
  accountName,
  onDashboard,
  onRecalculate,
  onLogout,
  isAuthenticated = false,
  onActivate,
  onBack,
}: SubscriptionPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('quarterly')
  const selected = PLANS.find((plan) => plan.id === selectedPlan) || PLANS[1]

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onActivate(selected.months)
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
                Your subscription is active
              </div>
            )}
          </div>

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
                  <Button type="button" fullWidth onClick={() => onActivate(selected.months)} className="bg-linkedin hover:bg-linkedin/90">
                    Create account to activate
                  </Button>
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
                  <input required placeholder="Name on card" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
                  <input required inputMode="numeric" placeholder="Card number" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
                  <input required placeholder="MM / YY" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
                  <input required inputMode="numeric" placeholder="CVC" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40" />
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
                <Button type="submit" fullWidth disabled={submitting} className="bg-linkedin hover:bg-linkedin/90">
                  {submitting ? 'Processing...' : `Pay ${selected.price} and activate`}
                </Button>
                <p className="text-xs text-dark-textMuted text-center mt-3">
                  Secure checkout. You can cancel anytime.
                </p>
              </div>
            </form>
            )}
          </Card>
        </div>
      </motion.div>
    </div>
  )
}
