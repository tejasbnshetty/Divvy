import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button, Card, PageShell, TextInput } from '../components/ui'

export default function Signup() {
  const { user, loading, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (user && !user.isAnonymous) return <Navigate to="/groups" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signUpWithEmail(email, password, name.trim())
      navigate('/groups')
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === 'auth/email-already-in-use' ? 'That email is already registered — try signing in instead.' : "Couldn't create your account — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-3xl">Join Divvy 🎉</h1>
        <Card className="w-full">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextInput placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextInput type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextInput
              type="password"
              placeholder="Password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-coral-deep">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </Card>
        <p className="text-sm text-ink-soft">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-coral-deep">
            Sign in
          </Link>
        </p>
      </div>
    </PageShell>
  )
}
