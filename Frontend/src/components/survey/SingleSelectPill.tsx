interface Option { value: string; label: string }

interface SingleSelectPillProps {
  options: Option[]
  value: string | undefined
  onChange: (value: string) => void
  ariaLabel: string
}

/** Horizontal pill group for single-select questions (Q-GA-1, Q-LV-1, Q-NR-2, Q-RW-*). */
export function SingleSelectPill({ options, value, onChange, ariaLabel }: SingleSelectPillProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              selected
                ? 'border-linkedin bg-linkedin text-white'
                : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
