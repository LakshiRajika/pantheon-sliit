import { LoaderCircle } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-orange text-ink hover:bg-orange-deep',
  dark: 'bg-ink text-cream hover:bg-ink-soft',
  outline: 'border-2 border-ink text-ink hover:bg-ink hover:text-cream',
}

export default function Button({ variant = 'primary', loading = false, icon: Icon, children, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  )
}
