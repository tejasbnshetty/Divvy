import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button, Card, PageShell, TextInput } from '../components/ui'

export default function Login() {
  const { user, loading, signInWithEmail } = useAuth()
  const navigate = useNavigate()
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
      await signInWithEmail(email, password)
      navigate('/groups')
    } catch {
      setError('Wrong email or password — give it another try.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-3xl">Welcome back 👋</h1>
        <Card className="w-full">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextInput type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextInput
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-coral-deep">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className="text-sm text-ink-soft">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-coral-deep">
            Create an account
          </Link>
        </p>
      </div>
    </PageShell>
  )
}
