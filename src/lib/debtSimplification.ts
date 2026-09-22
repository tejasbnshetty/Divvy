import type { MemberBalance, SuggestedTransaction } from '../types/models'

const CENTS_EPSILON = 0

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Greedily matches the largest creditor with the largest debtor, repeatedly,
 * producing at most n-1 transactions to zero out every balance. Runs in
 * integer cents internally so nets always reach exactly zero, never drifting
 * from float rounding.
 */
export function simplifyDebts(balances: MemberBalance[]): SuggestedTransaction[] {
  const nets = balances
    .map((b) => ({ memberId: b.memberId, cents: toCents(b.net) }))
    .filter((b) => b.cents !== CENTS_EPSILON)

  const creditors = nets.filter((b) => b.cents > 0).sort((a, b) => b.cents - a.cents)
  const debtors = nets.filter((b) => b.cents < 0).sort((a, b) => a.cents - b.cents)

  const transactions: SuggestedTransaction[] = []

  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]
    const debtor = debtors[di]
    const settleCents = Math.min(creditor.cents, -debtor.cents)

    if (settleCents > 0) {
      transactions.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: fromCents(settleCents),
      })
    }

    creditor.cents -= settleCents
    debtor.cents += settleCents

    if (creditor.cents === 0) ci++
    if (debtor.cents === 0) di++
  }

  return transactions
}

/**
 * Computes each member's net balance in the group's base currency from raw
 * expenses and settlements. Positive = they are owed money, negative = they owe money.
 */
export function computeBalances(
  memberIds: string[],
  expenses: { paidByMemberId: string; amountInBase: number; splits: { memberId: string; shareAmount: number }[] }[],
  settlements: { fromMemberId: string; toMemberId: string; amount: number }[],
): MemberBalance[] {
  const net = new Map<string, number>(memberIds.map((id) => [id, 0]))

  for (const expense of expenses) {
    net.set(expense.paidByMemberId, (net.get(expense.paidByMemberId) ?? 0) + expense.amountInBase)
    for (const split of expense.splits) {
      net.set(split.memberId, (net.get(split.memberId) ?? 0) - split.shareAmount)
    }
  }

  // Paying down a debt moves the payer's net toward zero (less negative);
  // receiving a payment moves the recipient's net toward zero (less positive).
  for (const settlement of settlements) {
    net.set(settlement.fromMemberId, (net.get(settlement.fromMemberId) ?? 0) + settlement.amount)
    net.set(settlement.toMemberId, (net.get(settlement.toMemberId) ?? 0) - settlement.amount)
  }

  return memberIds.map((memberId) => ({ memberId, net: net.get(memberId) ?? 0 }))
}
