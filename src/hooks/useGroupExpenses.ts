import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebaseClient'
import type { Expense } from '../types/models'

export function useGroupExpenses(groupId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const expensesQuery = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(expensesQuery, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense))
      setLoading(false)
    })
    return unsubscribe
  }, [groupId])

  return { expenses, loading }
}
