import { useState } from 'react'
import { createInviteCode, revokeInviteCode } from '../lib/firestoreActions'
import { useGroupInvites } from '../hooks/useGroupInvites'
import {
  classifyInviteStatus,
  EXPIRATION_OPTIONS,
  expirationOffsetMs,
  MAX_USES_OPTIONS,
  maxUsesValue,
  type ExpirationOption,
  type InviteStatus,
  type MaxUsesOption,
} from '../lib/invites'
import { Button, Card } from './ui'

const selectClassName =
  'flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20'

const STATUS_LABEL: Record<InviteStatus, string> = {
  active: 'Active',
  revoked: 'Revoked',
  expired: 'Expired',
  exhausted: 'Fully used',
}

function inviteLink(code: string) {
  return `${window.location.origin}/join/${code}`
}

export function InviteLinkCard({ groupId, uid }: { groupId: string; uid: string }) {
  const { invites, loading } = useGroupInvites(groupId)
  const [expiration, setExpiration] = useState<ExpirationOption>('never')
  const [maxUses, setMaxUses] = useState<MaxUsesOption>('unlimited')
  const [creating, setCreating] = useState(false)
  const [justCreatedCode, setJustCreatedCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = Date.now()

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const code = await createInviteCode(groupId, uid, {
        expiresInMs: expirationOffsetMs(expiration),
        maxUses: maxUsesValue(maxUses),
      })
      setJustCreatedCode(code)
    } catch {
      setError("Couldn't create an invite link — please try again.")
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy(code: string) {
    await navigator.clipboard.writeText(inviteLink(code))
    setCopiedCode(code)
    setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000)
  }

  async function handleRevoke(code: string) {
    if (!confirm('Revoke this invite? Anyone with the link will no longer be able to join.')) return
    setError(null)
    try {
      await revokeInviteCode(code)
    } catch {
      setError("Couldn't revoke that invite — please try again.")
    }
  }

  return (
    <Card>
      <p className="mb-3 font-semibold">Invite friends</p>

      <div className="mb-3 flex gap-2">
        <select
          value={expiration}
          onChange={(e) => setExpiration(e.target.value as ExpirationOption)}
          className={selectClassName}
        >
          {EXPIRATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={maxUses} onChange={(e) => setMaxUses(e.target.value as MaxUsesOption)} className={selectClassName}>
          {MAX_USES_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <Button variant="secondary" onClick={handleCreate} disabled={creating} className="w-full">
        {creating ? 'Creating…' : 'Create invite link'}
      </Button>

      {error && <p className="mt-2 text-sm text-coral-deep">{error}</p>}

      {justCreatedCode && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint/15 px-3 py-2">
          <p className="flex-1 truncate text-sm text-ink-soft">{inviteLink(justCreatedCode)}</p>
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => handleCopy(justCreatedCode)}>
            {copiedCode === justCreatedCode ? 'Copied! ✓' : 'Copy'}
          </Button>
        </div>
      )}

      {!loading && invites.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-black/5 pt-3">
          <p className="text-xs font-semibold text-ink-soft">Invite links</p>
          {invites.map((invite) => {
            const status = classifyInviteStatus(
              {
                revoked: invite.revoked,
                expiresAtMillis: invite.expiresAt ? invite.expiresAt.toMillis() : null,
                maxUses: invite.maxUses,
                useCount: invite.useCount,
              },
              now,
            )
            return (
              <div key={invite.code} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink-soft">{inviteLink(invite.code)}</p>
                  <p className="text-xs text-ink-soft">
                    <span className={`font-semibold ${status === 'active' ? 'text-mint-deep' : 'text-ink-soft'}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    {' · '}
                    {invite.maxUses === null ? `${invite.useCount} uses` : `${invite.useCount}/${invite.maxUses} uses`}
                    {invite.expiresAt && ` · expires ${invite.expiresAt.toDate().toLocaleDateString()}`}
                  </p>
                </div>
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => handleCopy(invite.code)}>
                  {copiedCode === invite.code ? '✓' : 'Copy'}
                </Button>
                {status === 'active' && (
                  <Button variant="ghost" className="px-2 py-1 text-xs !text-coral-deep" onClick={() => handleRevoke(invite.code)}>
                    Revoke
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
