import { useEffect, useState } from 'react'
import { collectionGroup, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebaseClient'
import type { Group } from '../types/models'

/** Lists every group the given user belongs to, kept live via their membership docs. */
export function useGroups(uid: string | undefined) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setGroups([])
      setLoading(false)
      return
    }

    const membershipQuery = query(collectionGroup(db, 'members'), where('uid', '==', uid))
    const unsubscribe = onSnapshot(membershipQuery, async (snapshot) => {
      const groupDocs = await Promise.all(
        snapshot.docs.map(async (memberDoc) => {
          const groupRef = memberDoc.ref.parent.parent
          if (!groupRef) return null
          const groupSnap = await getDoc(groupRef)
          if (!groupSnap.exists()) return null
          return { id: groupSnap.id, ...groupSnap.data() } as Group
        }),
      )
      setGroups(groupDocs.filter((g): g is Group => g !== null))
      setLoading(false)
    })

    return unsubscribe
  }, [uid])

  return { groups, loading }
}
