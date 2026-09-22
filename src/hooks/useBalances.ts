import { useMemo } from 'react'
import { computeBalances, simplifyDebts } from '../lib/debtSimplification'
import type { Expense, GroupMember, Settlement } from '../types/models'

export function useBalances(members: GroupMember[], expenses: Expense[], settlements: Settlement[]) {
  return useMemo(() => {
    const memberIds = members.map((m) => m.id)
    const balances = computeBalances(memberIds, expenses, settlements)
    const suggestedTransactions = simplifyDebts(balances)
    return { balances, suggestedTransactions }
  }, [members, expenses, settlements])
}
