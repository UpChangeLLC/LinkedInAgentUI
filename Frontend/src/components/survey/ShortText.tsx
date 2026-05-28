interface ShortTextProps {
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  ariaLabel: string
}

/** Single-line text input with a character counter (Q-AI-2, optional). */
export function ShortText({ value, onChange, placeholder, maxLength = 140, ariaLabel }: ShortTextProps) {
  const v = value ?? ''
  return (
    <div>
      <input
        type="text"
        aria-label={ariaLabel}
        value={v}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-dark-border bg-dark-card px-4 py-3 text-sm text-dark-textPri placeholder:text-dark-textMuted focus:border-linkedin focus:outline-none"
      />
      <div className="mt-1 text-right text-xs text-dark-textMuted">
        {v.length}/{maxLength}
      </div>
    </div>
  )
}
