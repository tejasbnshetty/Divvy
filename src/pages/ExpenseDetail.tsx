import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useGroupExpenses } from '../hooks/useGroupExpenses'
import { deleteExpense } from '../lib/firestoreActions'
import { emojiForCategory } from '../lib/categories'
import { formatCurrency } from '../lib/currency'
import { ExpenseForm } from '../components/ExpenseForm'
import { MemberAvatar } from '../components/MemberAvatar'
import { Button, Card, PageShell } from '../components/ui'

export default function ExpenseDetail() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>()
  const { user } = useAuth()
  const { group, members } = useGroup(groupId)
  const { expenses } = useGroupExpenses(groupId)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const expense = expenses.find((e) => e.id === expenseId)

  if (!group || !user || !expense) return null

  const payer = members.find((m) => m.id === expense.paidByMemberId)

  async function handleDelete() {
    if (!confirm('Delete this expense? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteExpense(group!.id, expense!.id)
      navigate(`/groups/${group!.id}`)
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <PageShell>
        <h1 className="mb-4 text-2xl">Edit expense</h1>
        <ExpenseForm
          groupId={group.id}
          members={members}
          baseCurrency={group.baseCurrency}
          currentUid={user.uid}
          initial={expense}
          onSaved={() => setEditing(false)}
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Link to={`/groups/${group.id}`} className="mb-2 text-sm text-ink-soft">
        ← Back
      </Link>

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl">{emojiForCategory(expense.category)}</span>
          <div>
            <p className="text-lg font-semibold">{expense.description}</p>
            <p className="text-sm text-ink-soft">{expense.date}</p>
          </div>
        </div>

        <p className="mb-1 text-3xl font-bold">{formatCurrency(expense.amount, expense.originalCurrency)}</p>
        {expense.originalCurrency !== group.baseCurrency && (
          <p className="mb-4 text-sm text-ink-soft">≈ {formatCurrency(expense.amountInBase, group.baseCurrency)}</p>
        )}

        <p className="mb-2 text-sm font-medium text-ink-soft">Paid by {payer?.displayName ?? 'someone'}</p>

        <div className="mt-4 flex flex-col gap-2 border-t border-black/5 pt-4">
          <p className="mb-1 text-sm font-semibold">Split</p>
          {expense.splits.map((s) => {
            const member = members.find((m) => m.id === s.memberId)
            return (
              <div key={s.memberId} className="flex items-center gap-2">
                <MemberAvatar id={s.memberId} name={member?.displayName ?? '?'} size={26} />
                <p className="flex-1 text-sm">{member?.displayName ?? 'Someone'}</p>
                <p className="text-sm font-medium">{formatCurrency(s.shareAmount, group.baseCurrency)}</p>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="mt-4 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="ghost" className="flex-1 !bg-coral/10 !text-coral-deep" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </PageShell>
  )
}
