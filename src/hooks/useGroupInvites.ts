import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../lib/firebaseClient'
import type { InviteCode } from '../types/models'

/** A group's most recent invite codes (any status), kept live, for the invite-management UI. */
export function useGroupInvites(groupId: string | undefined, max = 5) {
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const invitesQuery = query(
      collection(db, 'inviteCodes'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      limit(max),
    )
    const unsubscribe = onSnapshot(invitesQuery, (snap) => {
      setInvites(snap.docs.map((d) => ({ code: d.id, ...d.data() }) as InviteCode))
      setLoading(false)
    })
    return unsubscribe
  }, [groupId, max])

  return { invites, loading }
}
