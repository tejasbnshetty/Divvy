import { formatCurrency } from '../lib/currency'
import { MemberAvatar } from './MemberAvatar'
import { Card, EmptyState } from './ui'
import type { GroupMember, MemberBalance, SuggestedTransaction } from '../types/models'

function nameFor(members: GroupMember[], memberId: string) {
  return members.find((m) => m.id === memberId)?.displayName ?? 'Someone'
}

export function BalanceCard({
  myNet,
  baseCurrency,
}: {
  myNet: number
  baseCurrency: string
}) {
  const isSettled = Math.abs(myNet) < 0.005
  return (
    <Card className="text-center">
      {isSettled ? (
        <p className="text-xl font-semibold text-mint-deep">You're all squared up! 🎉</p>
      ) : myNet > 0 ? (
        <>
          <p className="text-sm text-ink-soft">You're owed</p>
          <p className="text-3xl font-bold text-mint-deep">{formatCurrency(myNet, baseCurrency)}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">You owe</p>
          <p className="text-3xl font-bold text-coral-deep">{formatCurrency(-myNet, baseCurrency)}</p>
        </>
      )}
    </Card>
  )
}

export function WhoOwesWhomList({
  transactions,
  members,
  baseCurrency,
}: {
  transactions: SuggestedTransaction[]
  members: GroupMember[]
  baseCurrency: string
}) {
  if (transactions.length === 0) {
    return <EmptyState emoji="✨" title="Nothing to settle" subtitle="Every balance is squared away." />
  }

  return (
    <div className="flex flex-col gap-2">
      {transactions.map((t, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[var(--shadow-soft)]">
          <MemberAvatar id={t.fromMemberId} name={nameFor(members, t.fromMemberId)} size={32} />
          <p className="flex-1 text-sm">
            <span className="font-semibold">{nameFor(members, t.fromMemberId)}</span> owes{' '}
            <span className="font-semibold">{nameFor(members, t.toMemberId)}</span>
          </p>
          <p className="font-semibold text-coral-deep">{formatCurrency(t.amount, baseCurrency)}</p>
        </div>
      ))}
    </div>
  )
}

export function BalanceBreakdown({
  balances,
  members,
  baseCurrency,
}: {
  balances: MemberBalance[]
  members: GroupMember[]
  baseCurrency: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {balances.map((b) => {
        const settled = Math.abs(b.net) < 0.005
        return (
          <div key={b.memberId} className="flex items-center gap-3">
            <MemberAvatar id={b.memberId} name={nameFor(members, b.memberId)} size={28} />
            <p className="flex-1 text-sm">{nameFor(members, b.memberId)}</p>
            <p className={`text-sm font-semibold ${settled ? 'text-ink-soft' : b.net > 0 ? 'text-mint-deep' : 'text-coral-deep'}`}>
              {settled ? 'settled' : formatCurrency(Math.abs(b.net), baseCurrency)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
