import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { updateUserProfile } from '../lib/firestoreActions'
import { CurrencyPicker } from '../components/CurrencyPicker'
import { Button, Card, PageShell, TextInput } from '../components/ui'

export default function Account() {
  const { user, profile, upgradeToEmailAccount, signOut } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [preferredCurrency, setPreferredCurrency] = useState(profile?.preferredCurrency ?? 'USD')
  const [savingProfile, setSavingProfile] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [upgraded, setUpgraded] = useState(false)

  if (!user || !profile) return null

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await updateUserProfile(user!.uid, { displayName: displayName.trim(), preferredCurrency })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault()
    setUpgrading(true)
    setUpgradeError(null)
    try {
      await upgradeToEmailAccount(email, password)
      setUpgraded(true)
    } catch (err) {
      const code = (err as { code?: string }).code
      setUpgradeError(
        code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use'
          ? 'That email is already tied to another account — try signing in there instead.'
          : "Couldn't upgrade your account — please try again.",
      )
    } finally {
      setUpgrading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <PageShell>
      <h1 className="mb-4 text-2xl">Your account</h1>

      <Card className="mb-4">
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-soft">Name</label>
            <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-soft">Preferred currency</label>
            <CurrencyPicker value={preferredCurrency} onChange={setPreferredCurrency} className="w-full" />
          </div>
          <Button type="submit" variant="secondary" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Card>

      {user.isAnonymous && !upgraded && (
        <Card className="mb-4">
          <p className="mb-1 font-semibold">Keep your groups forever ✨</p>
          <p className="mb-3 text-sm text-ink-soft">
            You joined as a guest. Add an email and password to turn this into a permanent account — your groups and
            history come with you.
          </p>
          <form onSubmit={handleUpgrade} className="flex flex-col gap-3">
            <TextInput type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextInput
              type="password"
              placeholder="Password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {upgradeError && <p className="text-sm text-coral-deep">{upgradeError}</p>}
            <Button type="submit" disabled={upgrading}>
              {upgrading ? 'Upgrading…' : 'Create permanent account'}
            </Button>
          </form>
        </Card>
      )}

      {upgraded && (
        <Card className="mb-4">
          <p className="font-semibold text-mint-deep">You're all set! Your account is now permanent. 🎉</p>
        </Card>
      )}

      <Button variant="ghost" onClick={handleSignOut}>
        Sign out
      </Button>
    </PageShell>
  )
}
