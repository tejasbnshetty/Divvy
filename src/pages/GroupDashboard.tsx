import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useGroupExpenses } from '../hooks/useGroupExpenses'
import { useGroupSettlements } from '../hooks/useGroupSettlements'
import { useBalances } from '../hooks/useBalances'
import { BalanceCard, WhoOwesWhomList } from '../components/BalanceCard'
import { ExpenseListItem } from '../components/ExpenseListItem'
import { EmptyState, LinkButton, PageShell } from '../components/ui'

export default function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const { group, members, loading } = useGroup(groupId)
  const { expenses } = useGroupExpenses(groupId)
  const { settlements } = useGroupSettlements(groupId)
  const { balances, suggestedTransactions } = useBalances(members, expenses, settlements)

  if (loading || !group || !user) return null

  const myNet = balances.find((b) => b.memberId === user.uid)?.net ?? 0
  const me = members.find((m) => m.uid === user.uid)
  const canWrite = !group.archived && !!me && !me.leftAt

  return (
    <PageShell>
      <div className="flex items-center justify-between py-2">
        <div>
          <Link to="/groups" className="text-sm text-ink-soft">
            ← Your groups
          </Link>
          <h1 className="text-2xl">{group.name}</h1>
        </div>
        <Link to={`/groups/${groupId}/members`} className="text-sm font-semibold text-coral-deep">
          Members
        </Link>
      </div>

      {group.archived && (
        <div className="mb-4 rounded-2xl bg-butter/15 px-4 py-3 text-sm font-semibold">This group is archived — it's read-only.</div>
      )}

      <div className="mb-4">
        <BalanceCard myNet={myNet} baseCurrency={group.baseCurrency} />
      </div>

      {canWrite ? (
        <div className="mb-2 flex gap-3">
          <LinkButton to={`/groups/${groupId}/expenses/new`} className="flex-1">
            + Add expense
          </LinkButton>
          <LinkButton to={`/groups/${groupId}/settle`} variant="secondary" className="flex-1">
            Settle up
          </LinkButton>
        </div>
      ) : (
        !group.archived &&
        me?.leftAt && <p className="mb-2 text-sm text-ink-soft">You've left this group — you can still see its history.</p>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg">Who owes whom</h2>
        <WhoOwesWhomList transactions={suggestedTransactions} members={members} baseCurrency={group.baseCurrency} />
      </section>

      <section className="mt-6 flex-1">
        <h2 className="mb-2 text-lg">Recent expenses</h2>
        {expenses.length === 0 ? (
          <EmptyState emoji="🧾" title="No expenses yet" subtitle="Add your first one!" />
        ) : (
          <div className="flex flex-col gap-2">
            {expenses.map((expense) => (
              <ExpenseListItem key={expense.id} expense={expense} groupId={group.id} members={members} baseCurrency={group.baseCurrency} />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}
