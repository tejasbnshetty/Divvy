import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGroup } from '../hooks/useGroup'
import { useGroupExpenses } from '../hooks/useGroupExpenses'
import { useGroupSettlements } from '../hooks/useGroupSettlements'
import { useBalances } from '../hooks/useBalances'
import {
  addPlaceholderMember,
  archiveGroup,
  leaveGroup,
  mergeMemberInto,
  removeMember,
  renameGroup,
  unarchiveGroup,
} from '../lib/firestoreActions'
import { InviteLinkCard } from '../components/InviteLinkCard'
import { MemberAvatar } from '../components/MemberAvatar'
import { Button, Card, PageShell, TextInput } from '../components/ui'
import type { GroupMember } from '../types/models'

const BALANCE_EPSILON = 0.005

function MergeRow({ groupId, placeholder, joinedMembers }: { groupId: string; placeholder: GroupMember; joinedMembers: GroupMember[] }) {
  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState('')
  const [merging, setMerging] = useState(false)

  if (joinedMembers.length === 0) return null

  async function handleMerge() {
    if (!target) return
    setMerging(true)
    try {
      await mergeMemberInto(groupId, placeholder.id, target)
      setPicking(false)
    } finally {
      setMerging(false)
    }
  }

  if (!picking) {
    return (
      <button type="button" onClick={() => setPicking(true)} className="text-xs font-semibold text-coral-deep">
        This is someone who joined
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded-xl border border-black/10 bg-white px-2 py-1.5 text-xs outline-none focus:border-coral"
      >
        <option value="">Who is it?</option>
        {joinedMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName}
          </option>
        ))}
      </select>
      <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={handleMerge} disabled={!target || merging}>
        {merging ? 'Merging…' : 'Merge'}
      </Button>
      <button type="button" onClick={() => setPicking(false)} className="text-xs text-ink-soft">
        Cancel
      </button>
    </div>
  )
}

export default function Members() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { group, members } = useGroup(groupId)
  const { expenses } = useGroupExpenses(groupId)
  const { settlements } = useGroupSettlements(groupId)
  const { balances } = useBalances(members, expenses, settlements)

  const [placeholderName, setPlaceholderName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!group || !user) return null

  const me = members.find((m) => m.uid === user.uid)
  const isOwner = me?.role === 'owner'
  const joinedMembers = members.filter((m) => m.uid && !m.leftAt)

  function balanceFor(memberId: string) {
    return balances.find((b) => b.memberId === memberId)?.net ?? 0
  }
  function isSettled(memberId: string) {
    return Math.abs(balanceFor(memberId)) < BALANCE_EPSILON
  }

  async function handleAddPlaceholder(e: React.FormEvent) {
    e.preventDefault()
    if (!placeholderName.trim()) return
    setAdding(true)
    try {
      await addPlaceholderMember(group!.id, placeholderName.trim())
      setPlaceholderName('')
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!nameDraft.trim()) return
    setSavingName(true)
    setError(null)
    try {
      await renameGroup(group!.id, nameDraft.trim())
      setEditingName(false)
    } catch {
      setError("Couldn't rename this group — please try again.")
    } finally {
      setSavingName(false)
    }
  }

  async function handleLeave() {
    if (!me) return
    if (!confirm('Leave this group? You can only rejoin with a new invite link.')) return
    setLeaving(true)
    setError(null)
    try {
      await leaveGroup(group!.id, me.id, isOwner)
      navigate('/groups')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't leave this group — please try again.")
    } finally {
      setLeaving(false)
    }
  }

  async function handleRemove(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this group?`)) return
    setRemovingId(memberId)
    setError(null)
    try {
      await removeMember(group!.id, memberId)
    } catch {
      setError("Couldn't remove that member — please try again.")
    } finally {
      setRemovingId(null)
    }
  }

  async function handleArchiveToggle() {
    const willArchive = !group!.archived
    if (!confirm(willArchive ? 'Archive this group? It becomes read-only until unarchived.' : 'Unarchive this group?')) return
    setArchiving(true)
    setError(null)
    try {
      if (willArchive) {
        await archiveGroup(group!.id)
      } else {
        await unarchiveGroup(group!.id)
      }
    } catch {
      setError("Couldn't update this group — please try again.")
    } finally {
      setArchiving(false)
    }
  }

  return (
    <PageShell>
      <Link to={`/groups/${group.id}`} className="mb-2 block text-sm text-ink-soft">
        ← Back
      </Link>

      {editingName ? (
        <form onSubmit={handleSaveName} className="mb-4 flex items-center gap-2">
          <TextInput value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="flex-1" required autoFocus />
          <Button type="submit" variant="secondary" className="px-4 py-2 text-sm" disabled={savingName}>
            {savingName ? 'Saving…' : 'Save'}
          </Button>
          <button type="button" onClick={() => setEditingName(false)} className="text-sm text-ink-soft">
            Cancel
          </button>
        </form>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-2xl">{group.name}</h1>
          {!group.archived && (
            <button
              type="button"
              onClick={() => {
                setNameDraft(group.name)
                setEditingName(true)
              }}
              className="text-xs font-semibold text-coral-deep"
            >
              Rename
            </button>
          )}
        </div>
      )}

      {group.archived && (
        <Card className="mb-4 !bg-butter/15">
          <p className="text-sm font-semibold">This group is archived — it's read-only.</p>
        </Card>
      )}

      <div className="mb-4">
        <InviteLinkCard groupId={group.id} uid={user.uid} />
      </div>

      {error && <p className="mb-4 text-sm text-coral-deep">{error}</p>}

      <Card className="mb-4">
        <p className="mb-3 font-semibold">Everyone in this group</p>
        <div className="flex flex-col gap-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <MemberAvatar id={m.id} name={m.displayName} />
              <div className="flex-1">
                <p className={`text-sm ${m.leftAt ? 'text-ink-soft' : ''}`}>{m.displayName}</p>
                {!m.uid && !m.leftAt && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-ink-soft">Hasn't joined yet ·</span>
                    <MergeRow groupId={group.id} placeholder={m} joinedMembers={joinedMembers} />
                  </div>
                )}
                {m.leftAt && <span className="text-xs text-ink-soft">Left the group</span>}
              </div>
              {m.role === 'owner' && <span className="text-xs font-semibold text-butter-deep">Owner</span>}
              {isOwner && m.uid && m.uid !== user.uid && !m.leftAt && (
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs !text-coral-deep"
                  onClick={() => handleRemove(m.id, m.displayName)}
                  disabled={removingId === m.id || !isSettled(m.id) || !!group.archived}
                  title={!isSettled(m.id) ? "This member isn't settled up yet" : undefined}
                >
                  {removingId === m.id ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {!group.archived && (
        <Card className="mb-4">
          <p className="mb-3 font-semibold">Add someone who isn't here yet</p>
          <p className="mb-3 text-sm text-ink-soft">
            You can include them in expense splits right away. Once they join for real via your invite link, come back
            here and merge their placeholder into their real account so the history follows them.
          </p>
          <form onSubmit={handleAddPlaceholder} className="flex gap-2">
            <TextInput
              placeholder="Their name"
              value={placeholderName}
              onChange={(e) => setPlaceholderName(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" disabled={adding}>
              Add
            </Button>
          </form>
        </Card>
      )}

      {me && !me.leftAt && (
        <Card>
          {isOwner ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                Group owners can't leave yet — ownership transfer is coming in a future update.
              </p>
              <Button variant="ghost" className="w-full !text-coral-deep" onClick={handleArchiveToggle} disabled={archiving}>
                {archiving ? 'Working…' : group.archived ? 'Unarchive group' : 'Archive group'}
              </Button>
            </>
          ) : (
            !group.archived && (
              <Button
                variant="ghost"
                className="w-full !text-coral-deep"
                onClick={handleLeave}
                disabled={leaving || !isSettled(me.id)}
                title={!isSettled(me.id) ? 'Settle up before leaving' : undefined}
              >
                {leaving ? 'Leaving…' : 'Leave group'}
              </Button>
            )
          )}
        </Card>
      )}
    </PageShell>
  )
}
