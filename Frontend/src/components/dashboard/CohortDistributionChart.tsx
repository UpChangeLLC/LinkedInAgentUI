import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

interface CohortDistributionChartProps {
  distribution: Array<{ bucket: number; count: number }>
  userPercentile: number
}

/** Small histogram of the cohort's scores with the user's position marked. */
export function CohortDistributionChart({ distribution, userPercentile }: CohortDistributionChartProps) {
  const data = distribution.map((d) => ({ bucket: d.bucket, count: d.count }))
  // The user sits at roughly their percentile along the 0-100 axis.
  const userBucket = Math.min(95, Math.max(0, Math.round(userPercentile / 5) * 5))

  return (
    <div
      className="h-40 w-full"
      role="img"
      aria-label={`You are in the ${userPercentile}th percentile of your cohort.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="bucket" stroke="rgba(128,128,128,0.7)" fontSize={11} tickLine={false} interval={3} />
          <ReferenceLine x={userBucket} stroke="#0a66c2" strokeWidth={2} label={{ value: 'You', fill: '#0a66c2', fontSize: 11, position: 'top' }} />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={d.bucket === userBucket ? '#0a66c2' : 'rgba(128,128,128,0.4)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
