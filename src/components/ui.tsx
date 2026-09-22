import { Link, type LinkProps } from 'react-router-dom'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] p-5 ${className}`}>
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-coral text-white hover:brightness-105',
  secondary: 'bg-mint text-ink hover:brightness-105',
  ghost: 'bg-transparent text-ink-soft hover:bg-black/5',
}

const tapClasses = 'transition active:scale-95'

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`rounded-[var(--radius-pill)] px-5 py-3 font-semibold text-[15px] disabled:opacity-50 disabled:pointer-events-none ${tapClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function LinkButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: LinkProps & { variant?: ButtonVariant }) {
  return (
    <Link
      className={`inline-flex items-center justify-center rounded-[var(--radius-pill)] px-5 py-3 text-center font-semibold text-[15px] ${tapClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 ${props.className ?? ''}`}
    />
  )
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-6 sm:max-w-lg">
      {children}
    </div>
  )
}

export function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-black/10 py-10 text-center text-ink-soft">
      <span className="text-4xl">{emoji}</span>
      <p className="font-semibold text-ink">{title}</p>
      {subtitle && <p className="text-sm">{subtitle}</p>}
    </div>
  )
}
