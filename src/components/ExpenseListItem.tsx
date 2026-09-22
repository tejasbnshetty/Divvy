import { Link } from 'react-router-dom'
import { emojiForCategory } from '../lib/categories'
import { formatCurrency } from '../lib/currency'
import type { Expense, GroupMember } from '../types/models'

export function ExpenseListItem({
  expense,
  groupId,
  members,
  baseCurrency,
}: {
  expense: Expense
  groupId: string
  members: GroupMember[]
  baseCurrency: string
}) {
  const payer = members.find((m) => m.id === expense.paidByMemberId)

  return (
    <Link
      to={`/groups/${groupId}/expenses/${expense.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[var(--shadow-soft)] transition hover:shadow-lg"
    >
      <span className="text-2xl">{emojiForCategory(expense.category)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{expense.description}</p>
        <p className="text-sm text-ink-soft">
          {payer?.displayName ?? 'Someone'} paid · {expense.date}
        </p>
      </div>
      <p className="shrink-0 font-semibold">{formatCurrency(expense.amountInBase, baseCurrency)}</p>
    </Link>
  )
}
