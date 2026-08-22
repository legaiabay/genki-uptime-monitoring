/**
 * MiniSparkline — the small bar chart shown per-monitor in the table
 * Each bar represents one check result: green=up, red=down, orange=degraded
 */
type Status = 'up' | 'down' | 'degraded' | 'pending'

const colorMap: Record<Status, string> = {
  up:       '#48bb78',
  down:     '#e53e3e',
  degraded: '#ed8936',
  pending:  '#444',
}

interface Props {
  data: Status[]
  width?: number
  height?: number
}

export default function MiniSparkline({ data, width = 60, height = 20 }: Props) {
  const barW = 3
  const gap = 1
  const total = data.length
  const availW = width
  const count = Math.min(total, Math.floor(availW / (barW + gap)))
  const slice = data.slice(-count)

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {slice.map((s, i) => (
        <rect
          key={i}
          x={i * (barW + gap)}
          y={0}
          width={barW}
          height={height}
          rx={1}
          fill={colorMap[s] ?? colorMap.pending}
          opacity={0.85}
        />
      ))}
    </svg>
  )
}
