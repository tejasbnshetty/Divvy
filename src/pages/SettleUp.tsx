import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useGroupExpenses } from '../hooks/useGroupExpenses'
import { useGroupSettlements } from '../hooks/useGroupSettlements'
import { useBalances } from '../hooks/useBalances'
import { recordSettlement } from '../lib/firestoreActions'
import { formatCurrency } from '../lib/currency'
import { MemberAvatar } from '../components/MemberAvatar'
import { ConfettiBurst } from '../components/ConfettiBurst'
import { Button, Card, EmptyState, PageShell, TextInput } from '../components/ui'
import type { SuggestedTransaction } from '../types/models'

export default function SettleUp() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const { group, members } = useGroup(groupId)
  const { expenses } = useGroupExpenses(groupId)
  const { settlements } = useGroupSettlements(groupId)
  const { suggestedTransactions } = useBalances(members, expenses, settlements)

  const [manualFrom, setManualFrom] = useState('')
  const [manualTo, setManualTo] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  if (!group || !user) return null

  // A left member's balance should already be ~0 (leaving is blocked
  // otherwise), so they shouldn't be offered for a new manual settlement.
  const activeMembers = members.filter((m) => !m.leftAt)

  function nameFor(id: string) {
    return members.find((m) => m.id === id)?.displayName ?? 'Someone'
  }

  async function confirmSettlement(t: SuggestedTransaction) {
    setSubmitting(true)
    try {
      await recordSettlement(group!.id, {
        fromMemberId: t.fromMemberId,
        toMemberId: t.toMemberId,
        amount: t.amount,
        note: null,
        createdBy: user!.uid,
      })
      if (suggestedTransactions.length === 1) {
        setCelebrate(true)
        setTimeout(() => setCelebrate(false), 1300)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(manualAmount)
    if (!manualFrom || !manualTo || manualFrom === manualTo || amount <= 0) return
    setSubmitting(true)
    try {
      await recordSettlement(group!.id, {
        fromMemberId: manualFrom,
        toMemberId: manualTo,
        amount,
        note: null,
        createdBy: user!.uid,
      })
      setManualFrom('')
      setManualTo('')
      setManualAmount('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <div className="relative">
        <ConfettiBurst active={celebrate} />
        <Link to={`/groups/${group.id}`} className="mb-2 block text-sm text-ink-soft">
          ← Back
        </Link>
        <h1 className="mb-4 text-2xl">Settle up</h1>

        {suggestedTransactions.length === 0 ? (
          <EmptyState emoji="🎉" title="Everyone's squared up!" subtitle="No payments needed right now." />
        ) : (
          <div className="mb-6 flex flex-col gap-2">
            {suggestedTransactions.map((t, i) => (
              <Card key={i} className="flex items-center gap-3">
                <MemberAvatar id={t.fromMemberId} name={nameFor(t.fromMemberId)} size={32} />
                <p className="flex-1 text-sm">
                  <span className="font-semibold">{nameFor(t.fromMemberId)}</span> owes{' '}
                  <span className="font-semibold">{nameFor(t.toMemberId)}</span>{' '}
                  <span className="font-semibold text-coral-deep">{formatCurrency(t.amount, group.baseCurrency)}</span>
                </p>
                <Button variant="secondary" className="px-4 py-2 text-sm" onClick={() => confirmSettlement(t)} disabled={submitting}>
                  Mark paid
                </Button>
              </Card>
            ))}
          </div>
        )}

        <h2 className="mb-2 text-lg">Record a payment manually</h2>
        <Card>
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <select
                value={manualFrom}
                onChange={(e) => setManualFrom(e.target.value)}
                className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm outline-none focus:border-coral"
              >
                <option value="">From…</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
              <span className="text-ink-soft">→</span>
              <select
                value={manualTo}
                onChange={(e) => setManualTo(e.target.value)}
                className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-3 text-sm outline-none focus:border-coral"
              >
                <option value="">To…</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            <TextInput
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder={`Amount (${group.baseCurrency})`}
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              required
            />
            <Button type="submit" disabled={submitting}>
              Record payment
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  )
}
