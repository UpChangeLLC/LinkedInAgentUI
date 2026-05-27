import { Clock, X } from 'lucide-react'

interface RerunLockModalProps {
  nextRerunAt: string | null
  onClose: () => void
  onSeePremium: () => void
  onSetReminder?: () => void
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

/** Shown when a free user attempts a re-run inside the 30-day window. */
export function RerunLockModal({ nextRerunAt, onClose, onSeePremium, onSetReminder }: RerunLockModalProps) {
  const days = daysUntil(nextRerunAt)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" data-test="rerun-lock-modal">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-dark-card p-6 text-center shadow-2xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-white/40 hover:text-white/70">
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Clock className="h-6 w-6 text-linkedin" />
        </div>
        <h2 className="text-lg font-semibold text-white">
          {days != null ? `Your next free re-run is in ${days} day${days === 1 ? '' : 's'}` : 'Re-run not available yet'}
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Premium tracks your trajectory whenever you want — every course, project, or new role.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onSeePremium} className="rounded-lg bg-linkedin px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            See premium
          </button>
          {onSetReminder && (
            <button onClick={onSetReminder} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:border-white/30">
              Set a reminder
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
