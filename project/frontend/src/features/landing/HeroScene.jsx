import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

const reducedMotionQuery = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}

/**
 * Decorative 3D port scene for the landing hero.
 * three.js is downloaded only here, and only when WebGL is available; otherwise a static
 * SVG illustration is shown. Starts on a still frame for reduced-motion users, stops
 * rendering when off-screen or when the tab is hidden, and uses lighter detail on phones.
 */
export default function HeroScene({ className = '' }) {
  const hostRef = useRef(null)
  const [supported] = useState(webglAvailable)
  const [paused, setPaused] = useState(reducedMotionQuery)
  const [failed, setFailed] = useState(false)
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    if (!supported) return undefined
    const host = hostRef.current
    let scene = null
    let raf = 0
    let cancelled = false
    let inView = true
    let ro
    let io

    import('./heroSceneEngine')
      .then(({ createHeroScene }) => {
        if (cancelled) return
        const lowDetail = window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4
        scene = createHeroScene(host, { reducedMotion: reducedMotionQuery(), lowDetail })
        ro = new ResizeObserver(() => scene.resize())
        ro.observe(host)
        io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting })
        io.observe(host)
        let last = performance.now()
        const loop = (now) => {
          raf = requestAnimationFrame(loop)
          const dt = Math.min(0.1, (now - last) / 1000)
          last = now
          if (!inView || document.hidden || pausedRef.current) return
          scene.render(dt)
        }
        raf = requestAnimationFrame(loop)
      })
      .catch(() => { if (!cancelled) setFailed(true) })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      scene?.dispose()
    }
  }, [supported])

  if (!supported || failed) {
    return (
      <div className={`relative ${className}`}>
        <StaticPort />
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={hostRef} className="absolute inset-0" />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="absolute bottom-5 right-5 z-10 inline-flex items-center gap-2 rounded-full border border-ink/20 bg-cream/85 px-3.5 py-2 text-xs font-semibold text-ink backdrop-blur transition hover:border-ink"
      >
        {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
        {paused ? 'Play animation' : 'Pause animation'}
      </button>
    </div>
  )
}

// Static fallback: a ship at the quay under a gantry crane, in brand colours only.
function StaticPort() {
  const boxes = [
    [250, 'var(--color-orange)'], [290, 'var(--color-ink)'], [330, 'var(--color-cream)'], [370, 'var(--color-orange)'],
    [410, 'var(--color-ink)'], [450, 'var(--color-orange)'],
  ]
  return (
    <svg viewBox="0 0 640 420" className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <rect x="0" y="300" width="640" height="120" fill="var(--color-ink)" opacity="0.12" />
      <rect x="0" y="262" width="640" height="38" fill="var(--color-ink)" opacity="0.08" />
      {/* crane */}
      <g fill="var(--color-orange)">
        <rect x="410" y="90" width="10" height="172" />
        <rect x="470" y="90" width="10" height="172" />
        <rect x="200" y="82" width="320" height="10" />
        <rect x="400" y="150" width="90" height="8" />
      </g>
      <line x1="330" y1="92" x2="330" y2="160" stroke="var(--color-ink)" strokeWidth="2" />
      <rect x="312" y="160" width="36" height="16" fill="var(--color-orange)" />
      {/* ship */}
      <path d="M150 300 L520 300 L560 262 L130 262 Z" fill="var(--color-ink)" />
      <rect x="150" y="272" width="380" height="5" fill="var(--color-orange)" />
      <rect x="160" y="214" width="44" height="48" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2" />
      {boxes.map(([x, fill], i) => (
        <g key={x}>
          <rect x={x} y="240" width="36" height="22" fill={fill} stroke="var(--color-ink)" strokeWidth="2" />
          {i % 2 === 0 && <rect x={x} y="218" width="36" height="22" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2" />}
        </g>
      ))}
    </svg>
  )
}
