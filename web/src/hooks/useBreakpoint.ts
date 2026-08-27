import { useState, useEffect } from 'react'

const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
} as const

export function useBreakpoint() {
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    let raf: number
    function handleResize() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setWidth(window.innerWidth))
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return {
    width,
    isMobile: width < BREAKPOINTS.md,   // < 768px
    isTablet: width < BREAKPOINTS.lg,   // < 1024px
    isSmall:  width < BREAKPOINTS.sm,   // < 480px
  }
}
