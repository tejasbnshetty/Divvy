import { Link } from 'react-router-dom'
import { useGroup } from '../hooks/useGroup'
import { useGroupExpenses } from '../hooks/useGroupExpenses'
import { useGroupSettlements } from '../hooks/useGroupSettlements'
import { useBalances } from '../hooks/useBalances'
import { formatCurrency } from '../lib/currency'
import { Card } from './ui'
import type { Group } from '../types/models'

export function GroupListItem({ group, uid }: { group: Group; uid: string }) {
  const { members } = useGroup(group.id)
  const { expenses } = useGroupExpenses(group.id)
  const { settlements } = useGroupSettlements(group.id)
  const { balances } = useBalances(members, expenses, settlements)

  const myNet = balances.find((b) => b.memberId === uid)?.net ?? 0
  const isSettled = Math.abs(myNet) < 0.005

  return (
    <Link to={`/groups/${group.id}`}>
      <Card className="flex items-center justify-between transition hover:shadow-lg">
        <div>
          <p className="font-semibold">{group.name}</p>
          <p className="text-sm text-ink-soft">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
        </div>
        <div className="text-right">
          {isSettled ? (
            <p className="text-sm font-semibold text-mint-deep">Settled up ✓</p>
          ) : myNet > 0 ? (
            <p className="text-sm font-semibold text-mint-deep">You're owed {formatCurrency(myNet, group.baseCurrency)}</p>
          ) : (
            <p className="text-sm font-semibold text-coral-deep">You owe {formatCurrency(-myNet, group.baseCurrency)}</p>
          )}
        </div>
      </Card>
    </Link>
  )
}
