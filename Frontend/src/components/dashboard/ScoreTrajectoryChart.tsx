import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { TrajectoryEntry } from '../../lib/retention'

interface ScoreTrajectoryChartProps {
  history: TrajectoryEntry[]
}

/** Resilience-over-time line chart (free tier shows resilience only). */
export function ScoreTrajectoryChart({ history }: ScoreTrajectoryChartProps) {
  const data = history.map((h) => ({
    date: new Date(h.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    resilience: h.resilience_score,
  }))

  const summary = history
    .map((h) => `${h.resilience_score} on ${new Date(h.computed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`)
    .join(', ')

  return (
    <div className="h-56 w-full" role="img" aria-label={`Your resilience score over time: ${summary}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" />
          <XAxis dataKey="date" stroke="rgba(128,128,128,0.7)" fontSize={12} tickLine={false} />
          <YAxis domain={[0, 100]} stroke="rgba(128,128,128,0.7)" fontSize={12} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: '#1f1f1f', border: '1px solid rgba(128,128,128,0.25)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="resilience"
            stroke="#0a66c2"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#0a66c2' }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
