import { AI_TOOLS } from '../../data/aiTools'
import { FREQUENCY } from '../../lib/survey'

type FreqMap = Record<string, string>

interface MultiSelectFrequencyProps {
  value: FreqMap | undefined
  onChange: (value: FreqMap) => void
}

const FREQ_LABELS: Record<string, string> = {
  none: 'None',
  tried: 'Tried',
  weekly: 'Weekly',
  daily: 'Daily',
}

/** Grid of AI tools × usage frequency (Q-AI-1). Default per-tool is "none";
 * only non-"none" selections are stored. */
export function MultiSelectFrequency({ value, onChange }: MultiSelectFrequencyProps) {
  const current = value ?? {}

  const setFreq = (toolKey: string, freq: string) => {
    const next: FreqMap = { ...current }
    if (freq === 'none') delete next[toolKey]
    else next[toolKey] = freq
    onChange(next)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] bg-white/5 text-[11px] uppercase tracking-wide text-white/50">
        <div className="px-3 py-2">Tool</div>
        {FREQUENCY.map((f) => (
          <div key={f} className="px-1 py-2 text-center">{FREQ_LABELS[f]}</div>
        ))}
      </div>
      {AI_TOOLS.map((tool) => {
        const selected = current[tool.key] ?? 'none'
        return (
          <div
            key={tool.key}
            className="grid grid-cols-[1.4fr_repeat(4,1fr)] items-center border-t border-white/5"
          >
            <div className="px-3 py-2 text-sm text-white/80">{tool.label}</div>
            {FREQUENCY.map((f) => {
              const active = selected === f
              return (
                <button
                  key={f}
                  type="button"
                  aria-label={`${tool.label}: ${FREQ_LABELS[f]}`}
                  aria-pressed={active}
                  onClick={() => setFreq(tool.key, f)}
                  className={`m-1 h-8 rounded-md text-xs font-medium transition ${
                    active
                      ? 'bg-linkedin text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {active ? '✓' : ''}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
