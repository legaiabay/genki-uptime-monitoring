/**
 * UptimeBars — the bigger inline bar chart in the overview stats card
 */
type Status = 'up' | 'down' | 'degraded'

const colorMap: Record<Status, string> = {
  up:       '#48bb78',
  down:     '#e53e3e',
  degraded: '#ed8936',
}

interface Props {
  data: Status[]
  width?: number
  height?: number
}

export default function UptimeBars({ data, width = 120, height = 28 }: Props) {
  const barW = 3
  const gap = 1
  const count = Math.min(data.length, Math.floor(width / (barW + gap)))
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
          fill={colorMap[s] ?? '#444'}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}
