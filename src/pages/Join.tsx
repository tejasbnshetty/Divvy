import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { InviteCodeError, redeemInviteCode } from '../lib/firestoreActions'
import { Button, Card, PageShell, TextInput } from '../components/ui'

export default function Join() {
  const { code } = useParams<{ code: string }>()
  const { user, profile, loading, joinAnonymously } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code) return
    setSubmitting(true)
    setError(null)
    try {
      const displayName = user ? (profile?.displayName ?? 'Friend') : name.trim()
      const uid = user ? user.uid : await joinAnonymously(displayName)
      const groupId = await redeemInviteCode(code, uid, displayName)
      navigate(`/groups/${groupId}`)
    } catch (err) {
      setError(err instanceof InviteCodeError ? err.message : "Couldn't join that group — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div>
          <h1 className="text-3xl">You're invited! 🎈</h1>
          <p className="mt-2 text-ink-soft">Join this group to start splitting bills together.</p>
        </div>
        <Card className="w-full text-left">
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            {!user && (
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Your name</label>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" required />
              </div>
            )}
            {error && <p className="text-sm text-coral-deep">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Joining…' : 'Join group'}
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  )
}
