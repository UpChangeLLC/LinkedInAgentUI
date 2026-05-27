interface RepetitiveSliderProps {
  value: number | undefined
  onChange: (value: number) => void
  ariaLabel: string
}

/** 0–100 slider with a live "% repetitive / % novel" label (Q-AE-1). */
export function RepetitiveSlider({ value, onChange, ariaLabel }: RepetitiveSliderProps) {
  const v = value ?? 50
  return (
    <div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        aria-label={ariaLabel}
        aria-valuetext={`${v}% repetitive, ${100 - v}% novel`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-linkedin"
      />
      <div className="mt-2 flex justify-between text-xs text-white/60">
        <span>{v}% repetitive</span>
        <span>{100 - v}% novel / judgment work</span>
      </div>
    </div>
  )
}
