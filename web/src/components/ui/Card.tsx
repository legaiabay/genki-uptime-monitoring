import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  style?: CSSProperties
}

export default function Card({ children, style }: Props) {
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #252525',
      borderRadius: 8,
      ...style,
    }}>
      {children}
    </div>
  )
}
