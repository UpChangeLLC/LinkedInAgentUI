import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell } from 'lucide-react'
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../lib/retention'

interface SettingsNotificationsPageProps {
  onBack: () => void
}

const TOGGLES: Array<{ key: keyof NotificationPreferences; label: string; help: string }> = [
  { key: 'score_updates', label: 'Score updates', help: 'Welcome email and score explainers.' },
  { key: 'reassessment_reminders', label: 'Re-assessment reminders', help: 'Nudges when your score is getting stale.' },
  { key: 'product_tips', label: 'Product tips & premium offers', help: 'Occasional product updates and offers.' },
]

export function SettingsNotificationsPage({ onBack }: SettingsNotificationsPageProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchNotificationPreferences().then(setPrefs)
  }, [])

  const toggle = async (key: keyof NotificationPreferences) => {
    if (!prefs) return
    const prev = prefs
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    setError('')
    const ok = await updateNotificationPreferences({ [key]: next[key] })
    setSaving(false)
    if (!ok) {
      setPrefs(prev) // revert optimistic change
      setError("Couldn't save that change. Please try again.")
    }
  }

  return (
    <motion.div
      key="settings-notifications"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="min-h-screen bg-dark-bg text-dark-textPri"
    >
      <div className="mx-auto max-w-xl px-4 py-8">
        <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm text-dark-textMuted hover:text-dark-textSec">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mb-6 flex items-center gap-2">
          <Bell className="h-5 w-5 text-linkedin" />
          <h1 className="text-xl font-semibold">Notification settings</h1>
        </div>

        {!prefs ? (
          <p className="text-sm text-dark-textMuted">Loading…</p>
        ) : (
          <div className="space-y-3">
            {TOGGLES.map((t) => (
              <label
                key={t.key}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-dark-border bg-dark-card p-4"
              >
                <span>
                  <span className="block text-sm font-medium text-dark-textPri">{t.label}</span>
                  <span className="block text-xs text-dark-textMuted">{t.help}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={t.label}
                  checked={prefs[t.key]}
                  onChange={() => toggle(t.key)}
                  className="mt-1 h-5 w-5 accent-linkedin"
                />
              </label>
            ))}
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-xs text-dark-textMuted">
              Account &amp; billing emails are always sent and can't be turned off.
            </div>
            {saving && <p className="text-xs text-dark-textMuted">Saving…</p>}
            {error && (
              <p role="alert" className="text-xs text-dark-red">{error}</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
