import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Ship, FileCheck, Waves, ClipboardCheck, CalendarClock, MessagesSquare } from 'lucide-react'
import Logo from '../../components/common/Logo'
import Card from '../../components/common/Card'
import HeroScene from './HeroScene'

// Public marketing page. It makes no network calls and reads no stored data.

const BENEFITS = [
  { icon: Ship, title: 'Live shipment and vessel tracking', text: 'See where every shipment is and when it will arrive.' },
  { icon: FileCheck, title: 'Paperwork checked early', text: 'Problems with documents surface before they cause delays.' },
  { icon: Waves, title: 'Early warning on port congestion', text: 'Know when the port is getting busy, before it affects you.' },
  { icon: ClipboardCheck, title: 'A clear review queue', text: 'Customs decisions are organised, prioritised and easy to act on.' },
  { icon: CalendarClock, title: 'Berth and schedule planning', text: 'Plan berths and resources around what is actually arriving.' },
  { icon: MessagesSquare, title: 'Answers in plain language', text: 'Ask about your shipments and get a clear answer, any time.' },
]

const STEPS = [
  { title: 'Submit your shipment', text: 'Add the shipment details and upload its documents in one place.' },
  { title: 'Documents are checked', text: 'Missing or inconsistent details are flagged straight away.' },
  { title: 'Customs reviews when needed', text: 'If something needs a closer look, an officer makes the call.' },
  { title: 'Track it to arrival', text: 'Follow status and arrival updates until your cargo is on the dock.' },
]

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Shared link styles. Sign-in actions are links to /login, so they're anchors, not buttons.
const primaryCta =
  'group inline-flex items-center justify-center gap-2 rounded-lg bg-orange px-6 py-3 font-semibold text-ink transition hover:bg-ink hover:text-cream'
const secondaryLink =
  'inline-flex items-center gap-1.5 font-semibold text-ink underline decoration-orange decoration-2 underline-offset-[6px] transition hover:decoration-ink'

export default function IndexPage() {
  const rootRef = useRef(null)
  const [scrolled, setScrolled] = useState(false)

  // Solid header once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Gentle scroll reveal. Reduced-motion users (or browsers without IntersectionObserver) see everything at once.
  useEffect(() => {
    const items = rootRef.current?.querySelectorAll('[data-reveal]') ?? []
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach((el) => { el.dataset.revealed = 'true' })
      return undefined
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.dataset.revealed = 'true'
          io.unobserve(e.target)
        }
      })
    }, { rootMargin: '0px 0px -10% 0px' })
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const scrollToHow = (e) => {
    e.preventDefault()
    const target = document.getElementById('how-it-works')
    target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    target?.querySelector('h2')?.focus({ preventScroll: true })
  }

  const reveal =
    'opacity-0 translate-y-4 transition duration-700 ease-out data-[revealed=true]:translate-y-0 data-[revealed=true]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none'

  return (
    <div ref={rootRef} className="min-h-screen bg-cream text-ink">
      <header
        className={`fixed inset-x-0 top-0 z-30 transition duration-300 ${scrolled ? 'bg-cream shadow-[0_8px_24px_-16px_rgb(17_17_17/0.35)]' : 'bg-transparent'}`}
      >
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6">
          <Link to="/" aria-label="Pantheon home"><Logo /></Link>
          <Link
            to="/login"
            className="rounded-lg border-2 border-ink px-4 py-2 text-sm font-semibold transition hover:bg-ink hover:text-cream"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          className="relative flex flex-col overflow-hidden pt-18 lg:min-h-[100svh]"
          style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--color-orange) 8%, var(--color-cream)) 0%, var(--color-cream) 55%)' }}
        >
          <div className="relative z-10 order-1 mx-auto w-full max-w-6xl px-6 pb-8 pt-12 lg:pointer-events-none lg:flex lg:min-h-[calc(100svh-4.5rem)] lg:items-center lg:py-0">
            <div className="max-w-xl lg:pointer-events-auto">
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-ink/70">Port &amp; customs operations</p>
              <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">
                Clear cargo faster, <span className="text-orange">with every step in view.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/80">
                Pantheon gives everyone on a port call one live picture of each shipment, so cargo clears sooner
                and nothing sits waiting on paperwork.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-6">
                <Link to="/login" className={primaryCta}>
                  Sign in
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <a href="#how-it-works" onClick={scrollToHow} className={secondaryLink}>See how it works</a>
              </div>
            </div>
          </div>

          {/* Keeps the headline readable where the scene runs behind it on wide screens */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-[5] hidden w-[64%] lg:block"
            style={{ background: 'linear-gradient(to right, var(--color-cream) 0%, var(--color-cream) 66%, color-mix(in srgb, var(--color-cream) 70%, transparent) 80%, transparent 100%)' }}
            aria-hidden="true"
          />

          <div className="order-2 lg:contents">
            <HeroScene className="h-[340px] sm:h-[440px] lg:absolute lg:inset-0 lg:h-auto" />
          </div>
        </section>

        {/* What you get */}
        <section aria-labelledby="benefits-title" className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
          <div data-reveal className={`max-w-2xl ${reveal}`}>
            <h2 id="benefits-title" className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              What you get
            </h2>
            <p className="mt-4 text-lg text-ink/80">Everything you need to move cargo through port with fewer surprises.</p>
          </div>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} data-reveal className={reveal} style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
                <Card className="h-full !rounded-xl transition hover:-translate-y-1 hover:border-ink">
                  <div className="p-2">
                    <span className="grid size-12 place-items-center rounded-lg bg-ink text-orange">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                    <p className="mt-2 leading-relaxed text-ink/75">{text}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-18 bg-ink text-cream">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
            <div data-reveal className={`max-w-2xl ${reveal}`}>
              <h2 id="how-title" tabIndex={-1} className="font-display text-4xl font-semibold leading-tight tracking-tight outline-none sm:text-5xl">
                How it works
              </h2>
              <p className="mt-4 text-lg text-cream/80">Four steps from submission to the dock.</p>
            </div>
            <ol className="mt-14 grid gap-px overflow-hidden rounded-xl bg-cream/15 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ title, text }, i) => (
                <li key={title} data-reveal className={`bg-ink p-7 ${reveal}`} style={{ transitionDelay: `${i * 100}ms` }}>
                  <span className="font-display text-5xl font-semibold text-orange" aria-hidden="true">{i + 1}</span>
                  <h3 className="mt-6 text-lg font-semibold">
                    <span className="sr-only">Step {i + 1}: </span>{title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-cream/75">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing call to action */}
        <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
          <div data-reveal className={`flex flex-col items-start justify-between gap-8 md:flex-row md:items-center ${reveal}`}>
            <h2 id="cta-title" className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Ready for your <span className="text-orange">next arrival?</span>
            </h2>
            <Link to="/login" className={`${primaryCta} shrink-0 px-7 py-3.5`}>
              Sign in
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-10">
          <Logo tone="light" />
          <nav aria-label="Footer" className="flex items-center gap-6 text-sm">
            <a href="#" className="text-cream/80 underline-offset-4 transition hover:text-cream hover:underline">Contact</a>
            <p className="text-cream/70">© {new Date().getFullYear()} Pantheon</p>
          </nav>
        </div>
      </footer>
    </div>
  )
}
