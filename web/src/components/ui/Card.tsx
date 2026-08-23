import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  style?: CSSProperties
}

export default function Card({ children, style }: Props) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-surface-hover)',
      borderRadius: 8,
      ...style,
    }}>
      {children}
    </div>
  )
}
