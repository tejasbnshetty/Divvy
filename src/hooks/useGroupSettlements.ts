import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebaseClient'
import type { Settlement } from '../types/models'

export function useGroupSettlements(groupId: string | undefined) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const settlementsQuery = query(collection(db, 'groups', groupId, 'settlements'), orderBy('settledAt', 'desc'))
    const unsubscribe = onSnapshot(settlementsQuery, (snap) => {
      setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Settlement))
      setLoading(false)
    })
    return unsubscribe
  }, [groupId])

  return { settlements, loading }
}
