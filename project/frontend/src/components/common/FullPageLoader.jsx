import { LoaderCircle } from 'lucide-react'

export default function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-ink/70">
        <LoaderCircle className="size-5 animate-spin text-orange" aria-hidden />
        <span>Loading your workspace…</span>
      </div>
    </div>
  )
}
