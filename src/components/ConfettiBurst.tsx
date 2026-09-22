import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['#FF8A75', '#7FD8BE', '#FFD166', '#B8A9F0']

interface Particle {
  id: number
  x: number
  y: number
  rotate: number
  color: string
}

/** A brief confetti burst from the center of its container. Mount with `active` true to fire once. */
export function ConfettiBurst({ active }: { active: boolean }) {
  const particles = useMemo<Particle[]>(() => {
    if (!active) return []
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 260,
      y: -Math.random() * 220 - 40,
      rotate: Math.random() * 360,
      color: COLORS[i % COLORS.length],
    }))
  }, [active])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {active &&
          particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
          ))}
      </AnimatePresence>
    </div>
  )
}
