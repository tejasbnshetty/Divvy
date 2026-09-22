import { MemberAvatar } from './MemberAvatar'
import { formatCurrency } from '../lib/currency'
import type { SplitType } from '../types/models'

export function SplitInputRow({
  memberId,
  name,
  splitType,
  included,
  onToggleIncluded,
  rawValue,
  onRawValueChange,
  resolvedAmount,
  currency,
}: {
  memberId: string
  name: string
  splitType: SplitType
  included: boolean
  onToggleIncluded: (included: boolean) => void
  rawValue: string
  onRawValueChange: (value: string) => void
  resolvedAmount: number
  currency: string
}) {
  const needsRawInput = splitType === 'exact' || splitType === 'percentage' || splitType === 'shares'
  const suffix = splitType === 'percentage' ? '%' : splitType === 'shares' ? 'x' : ''

  return (
    <div className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        checked={included}
        onChange={(e) => onToggleIncluded(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-coral"
      />
      <MemberAvatar id={memberId} name={name} size={30} />
      <p className="flex-1 truncate text-sm">{name}</p>
      {needsRawInput && included ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={rawValue}
            onChange={(e) => onRawValueChange(e.target.value)}
            className="w-20 rounded-xl border border-black/10 px-2 py-1.5 text-right text-sm outline-none focus:border-coral"
          />
          <span className="text-sm text-ink-soft">{suffix}</span>
        </div>
      ) : (
        <p className="text-sm font-medium text-ink-soft">
          {included ? formatCurrency(resolvedAmount, currency) : '—'}
        </p>
      )}
    </div>
  )
}
