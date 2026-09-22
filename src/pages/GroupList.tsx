import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroups'
import { createGroup } from '../lib/firestoreActions'
import { Button, Card, EmptyState, PageShell, TextInput } from '../components/ui'
import { GroupListItem } from '../components/GroupListItem'
import { SUPPORTED_CURRENCIES } from '../lib/currency'

export default function GroupList() {
  const { user, profile } = useAuth()
  const { groups, loading } = useGroups(user?.uid)
  const navigate = useNavigate()
  const activeGroups = groups.filter((g) => !g.archived)
  const archivedGroups = groups.filter((g) => g.archived)
  const [showForm, setShowForm] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !groupName.trim()) return
    setSubmitting(true)
    try {
      const groupId = await createGroup({
        name: groupName.trim(),
        baseCurrency,
        ownerUid: user.uid,
        ownerDisplayName: profile?.displayName ?? 'Friend',
      })
      navigate(`/groups/${groupId}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl">Your groups</h1>
        <div className="flex items-center gap-3">
          <Link to="/account" className="text-sm font-semibold text-ink-soft">
            Account
          </Link>
          <Button variant="secondary" className="px-4 py-2 text-sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ New group'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-4">
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <TextInput
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create group'}
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {!loading && groups.length === 0 && (
          <EmptyState emoji="🧾" title="No groups yet" subtitle="Create one to start splitting bills with friends." />
        )}
        {user && activeGroups.map((group) => <GroupListItem key={group.id} group={group} uid={user.uid} />)}
      </div>

      {archivedGroups.length > 0 && user && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink-soft">Archived</p>
          <div className="flex flex-col gap-3">
            {archivedGroups.map((group) => (
              <GroupListItem key={group.id} group={group} uid={user.uid} />
            ))}
          </div>
        </div>
      )}
    </PageShell>
  )
}
