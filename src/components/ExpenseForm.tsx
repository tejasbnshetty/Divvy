import { useMemo, useState } from 'react'
import { addExpense, getFxRateToBase, updateExpense } from '../lib/firestoreActions'
import { resolveSplits, type SplitEntryInput } from '../lib/splitCalculation'
import { EXPENSE_CATEGORIES } from '../lib/categories'
import { CurrencyPicker } from './CurrencyPicker'
import { SplitInputRow } from './SplitInputRow'
import { Button, Card, TextInput } from './ui'
import type { Expense, GroupMember, SplitType } from '../types/models'

const SPLIT_TYPES: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'exact', label: 'Exact' },
  { value: 'percentage', label: '%' },
  { value: 'shares', label: 'Shares' },
]

export function ExpenseForm({
  groupId,
  members,
  baseCurrency,
  currentUid,
  initial,
  onSaved,
}: {
  groupId: string
  members: GroupMember[]
  baseCurrency: string
  currentUid: string
  initial?: Expense
  onSaved: () => void
}) {
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState(initial?.originalCurrency ?? '')
  const [category, setCategory] = useState<string>(initial?.category ?? 'other')
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [paidByMemberId, setPaidByMemberId] = useState(initial?.paidByMemberId ?? currentUid)
  const [splitType, setSplitType] = useState<SplitType>(initial?.splitType ?? 'equal')
  const [entries, setEntries] = useState<Record<string, { included: boolean; rawValue: string }>>(() => {
    if (!initial) return {}
    const initialEntries: Record<string, { included: boolean; rawValue: string }> = {}
    for (const split of initial.splits) {
      initialEntries[split.memberId] = {
        included: true,
        rawValue: split.shareRaw !== null ? String(split.shareRaw) : '',
      }
    }
    return initialEntries
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectivePaidBy = paidByMemberId || currentUid
  const effectiveCurrency = currency || baseCurrency
  const parsedAmount = Number(amount) || 0

  // A member who's left shouldn't be offered for a *new* expense, but if
  // they're already part of the expense being edited (as payer or in a
  // split), they still need to render — their historical inclusion is valid.
  const selectableMembers = useMemo(
    () =>
      members.filter(
        (m) => !m.leftAt || m.id === initial?.paidByMemberId || initial?.splits.some((s) => s.memberId === m.id),
      ),
    [members, initial],
  )

  const splitEntries: SplitEntryInput[] = useMemo(
    () =>
      selectableMembers.map((m) => ({
        memberId: m.id,
        included: entries[m.id]?.included ?? (initial ? false : true),
        rawValue: entries[m.id]?.rawValue ?? '',
      })),
    [selectableMembers, entries, initial],
  )

  const { splits, error: splitError } = useMemo(
    () => resolveSplits(splitType, parsedAmount, splitEntries),
    [splitType, parsedAmount, splitEntries],
  )

  function updateEntry(memberId: string, patch: Partial<{ included: boolean; rawValue: string }>) {
    setEntries((prev) => ({
      ...prev,
      [memberId]: {
        included: prev[memberId]?.included ?? (initial ? false : true),
        rawValue: prev[memberId]?.rawValue ?? '',
        ...patch,
      },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || parsedAmount <= 0 || splitError) return

    setSubmitting(true)
    setError(null)
    try {
      // Re-snapshot the FX rate at save time — today's rate, not the original — per the design's edit semantics.
      const fxRateToBase = await getFxRateToBase(effectiveCurrency, baseCurrency)
      const payload = {
        description: description.trim(),
        category,
        amount: parsedAmount,
        originalCurrency: effectiveCurrency,
        fxRateToBase,
        paidByMemberId: effectivePaidBy,
        splitType,
        date,
        createdBy: currentUid,
        splits,
      }
      if (initial) {
        await updateExpense(groupId, initial.id, payload)
      } else {
        await addExpense(groupId, payload)
      }
      onSaved()
    } catch {
      setError("Couldn't save this expense — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-8">
      <TextInput
        placeholder="What was it for?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      <div className="flex gap-2">
        <TextInput
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1"
          required
        />
        <CurrencyPicker value={effectiveCurrency} onChange={setCurrency} />
      </div>

      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none focus:border-coral"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" required />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink-soft">Paid by</label>
        <select
          value={effectivePaidBy}
          onChange={(e) => setPaidByMemberId(e.target.value)}
          className="w-full rounded-2xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none focus:border-coral"
        >
          {selectableMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">Split</p>
          <div className="flex gap-1 rounded-[var(--radius-pill)] bg-cream p-1">
            {SPLIT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSplitType(t.value)}
                className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition ${
                  splitType === t.value ? 'bg-coral text-white' : 'text-ink-soft'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-black/5">
          {selectableMembers.map((m) => {
            const entry = splitEntries.find((e) => e.memberId === m.id)!
            const resolved = splits.find((s) => s.memberId === m.id)
            return (
              <SplitInputRow
                key={m.id}
                memberId={m.id}
                name={m.displayName}
                splitType={splitType}
                included={entry.included}
                onToggleIncluded={(included) => updateEntry(m.id, { included })}
                rawValue={entry.rawValue}
                onRawValueChange={(rawValue) => updateEntry(m.id, { rawValue })}
                resolvedAmount={resolved?.shareAmount ?? 0}
                currency={effectiveCurrency}
              />
            )
          })}
        </div>

        {splitError && <p className="mt-2 text-sm text-coral-deep">{splitError}</p>}
      </Card>

      {error && <p className="text-sm text-coral-deep">{error}</p>}

      <Button type="submit" disabled={submitting || !!splitError || parsedAmount <= 0}>
        {submitting ? 'Saving…' : initial ? 'Save changes' : 'Save expense'}
      </Button>
    </form>
  )
}
