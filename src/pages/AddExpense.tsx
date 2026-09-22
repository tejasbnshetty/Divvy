import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { ExpenseForm } from '../components/ExpenseForm'
import { PageShell } from '../components/ui'

export default function AddExpense() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const { group, members } = useGroup(groupId)
  const navigate = useNavigate()

  if (!group || !user) return null

  return (
    <PageShell>
      <h1 className="mb-4 text-2xl">Add expense</h1>
      <ExpenseForm
        groupId={group.id}
        members={members}
        baseCurrency={group.baseCurrency}
        currentUid={user.uid}
        onSaved={() => navigate(`/groups/${group.id}`)}
      />
    </PageShell>
  )
}
