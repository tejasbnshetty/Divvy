import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebaseClient'
import type { Group, GroupMember } from '../types/models'

export function useGroup(groupId: string | undefined) {
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const unsubscribe = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      setGroup(snap.exists() ? ({ id: snap.id, ...snap.data() } as Group) : null)
      setLoading(false)
    })
    return unsubscribe
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    const membersQuery = query(collection(db, 'groups', groupId, 'members'), orderBy('joinedAt', 'asc'))
    const unsubscribe = onSnapshot(membersQuery, (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupMember))
    })
    return unsubscribe
  }, [groupId])

  return { group, members, loading }
}
