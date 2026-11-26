export default function Card({ title, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-lg border-2 border-ink/10 bg-cream ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink/70">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
