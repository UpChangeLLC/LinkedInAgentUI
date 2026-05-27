import { Lock } from 'lucide-react'

export type Tier = 'free' | 'premium'

interface PremiumTeaserProps {
  tier: Tier
  /** Section heading shown above the locked preview. */
  title: string
  /** Specific, honest teaser line (e.g. "10 personalized actions waiting"). */
  teaser: string
  /** Section id passed back for conversion attribution. */
  sourceSection?: string
  ctaLabel?: string
  onUnlock?: (sourceSection?: string) => void
  children: React.ReactNode
}

/**
 * Section-level premium gate. For premium users it renders the real section;
 * for free users it blurs the content behind a lock + upgrade CTA. The blur is
 * invisible to screen readers, so the lock state is announced via aria-label
 * (spec 01 §11.4 accessibility).
 */
export function PremiumTeaser({
  tier,
  title,
  teaser,
  sourceSection,
  ctaLabel = 'Unlock Premium',
  onUnlock,
  children,
}: PremiumTeaserProps) {
  if (tier === 'premium') return <>{children}</>

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5"
      aria-label="Premium content — sign up to unlock"
    >
      <div className="px-5 pt-5">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>

      {/* Blurred, non-interactive preview of the real section */}
      <div aria-hidden="true" className="pointer-events-none select-none blur-sm opacity-60 px-5 py-4">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-transparent to-black/40 px-6 text-center">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/60">
          <Lock className="h-3.5 w-3.5" /> Premium
        </span>
        <p className="max-w-xs text-sm text-white/80">{teaser}</p>
        <button
          type="button"
          onClick={() => onUnlock?.(sourceSection)}
          className="rounded-lg bg-linkedin px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {ctaLabel} — $9/mo
        </button>
      </div>
    </section>
  )
}
