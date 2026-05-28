interface LikertScaleProps {
  value: number | undefined
  onChange: (value: number) => void
  lowAnchor: string
  highAnchor: string
  ariaLabel: string
}

/** 1–5 dot scale with endpoint anchor labels (Q-LV-2, Q-NR-1). */
export function LikertScale({ value, onChange, lowAnchor, highAnchor, ariaLabel }: LikertScaleProps) {
  const points = [1, 2, 3, 4, 5]
  return (
    <div>
      <div role="radiogroup" aria-label={ariaLabel} className="flex items-center justify-between gap-2">
        {points.map((p) => {
          const selected = value === p
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${p} of 5`}
              onClick={() => onChange(p)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold transition ${
                selected
                  ? 'border-linkedin bg-linkedin text-white'
                  : 'border-dark-border bg-dark-card text-dark-textSec hover:border-dark-borderHov'
              }`}
            >
              {p}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-dark-textMuted">
        <span>{lowAnchor}</span>
        <span>{highAnchor}</span>
      </div>
    </div>
  )
}
