import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createGroup } from '../lib/firestoreActions'
import { Button, Card, PageShell, TextInput } from '../components/ui'
import { SUPPORTED_CURRENCIES } from '../lib/currency'

export default function Landing() {
  const { user, loading, joinAnonymously } = useAuth()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return null
  if (user) return <Navigate to="/groups" replace />

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !groupName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const uid = await joinAnonymously(name.trim())
      const groupId = await createGroup({ name: groupName.trim(), baseCurrency, ownerUid: uid, ownerDisplayName: name.trim() })
      navigate(`/groups/${groupId}`)
    } catch {
      setError("Couldn't create your group — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div>
          <h1 className="text-4xl">🍕 Divvy</h1>
          <p className="mt-2 text-ink-soft">Split bills with friends, in any currency.</p>
        </div>

        {!showForm ? (
          <div className="flex w-full flex-col gap-3">
            <Button onClick={() => setShowForm(true)}>Start a group</Button>
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Sign in to an existing account
            </Button>
          </div>
        ) : (
          <Card className="w-full text-left">
            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Your name</label>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Group name</label>
                <TextInput
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Japan Trip 2026"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Currency</label>
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
              </div>
              {error && <p className="text-sm text-coral-deep">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create group 🎉'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </PageShell>
  )
}
