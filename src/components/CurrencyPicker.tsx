import { SUPPORTED_CURRENCIES } from '../lib/currency'

export function CurrencyPicker({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (currency: string) => void
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-2xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 ${className}`}
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}
