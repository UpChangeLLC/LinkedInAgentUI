import { useState } from 'react'
import { MailWarning, X } from 'lucide-react'

interface EmailVerificationBannerProps {
  email?: string
  onResend: () => Promise<boolean>
}

/** Soft-nag banner shown to signed-in users whose email isn't verified yet.
 *  The app stays fully usable — this just persistently offers a resend. */
export function EmailVerificationBanner({ email, onResend }: EmailVerificationBannerProps) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleResend = async () => {
    setSending(true)
    try {
      const ok = await onResend()
      if (ok) setSent(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900"
    >
      <MailWarning className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p className="flex-1 leading-snug">
        Please verify your email{email ? <> (<span className="font-medium">{email}</span>)</> : null} to
        secure your account.
      </p>
      {sent ? (
        <span className="text-xs font-medium text-emerald-700">Sent — check your inbox</span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Resend email'}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-amber-700 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default EmailVerificationBanner
