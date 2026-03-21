'use client'

import { useEffect, useRef } from 'react'

export default function InteractiveBackground() {
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = glowRef.current
    if (!el) return

    const onMouseMove = (e: MouseEvent) => {
      el.style.background = `radial-gradient(500px circle at ${e.clientX}px ${e.clientY}px, rgba(124,58,237,0.25), rgba(109,40,217,0.08) 40%, transparent 70%)`
    }

    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  return (
    <div
      ref={glowRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99, mixBlendMode: 'screen' }}
    />
  )
}
