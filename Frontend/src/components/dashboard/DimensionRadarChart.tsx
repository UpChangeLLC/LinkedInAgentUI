import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import type { DimensionRadarRow } from './DimensionRadar'

/** Recharts radar of the 8 resilience dimensions (0–10). Lazy-loaded by
 * DimensionRadar so recharts stays in the split `charts` chunk. */
export function DimensionRadarChart({ data }: { data: DimensionRadarRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="#E0E0E0" />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: '#6B7280' }} />
        <PolarRadiusAxis domain={[0, 10]} angle={90} tick={{ fontSize: 9, fill: '#9CA3AF' }} />
        <Radar name="Score" dataKey="score" stroke="#0A66C2" fill="#0A66C2" fillOpacity={0.25} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
