import { describe, expect, it } from 'vitest'
import { computeBalances, simplifyDebts } from '../src/lib/debtSimplification'
import type { MemberBalance } from '../src/types/models'

function netsAfter(balances: MemberBalance[], transactions: { fromMemberId: string; toMemberId: string; amount: number }[]) {
  const net = new Map(balances.map((b) => [b.memberId, b.net]))
  for (const t of transactions) {
    net.set(t.fromMemberId, (net.get(t.fromMemberId) ?? 0) + t.amount)
    net.set(t.toMemberId, (net.get(t.toMemberId) ?? 0) - t.amount)
  }
  return net
}

describe('simplifyDebts', () => {
  it('produces no transactions when everyone is already settled', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', net: 0 },
      { memberId: 'b', net: 0 },
    ]
    expect(simplifyDebts(balances)).toEqual([])
  })

  it('settles a simple two-person debt in one transaction', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', net: 10 },
      { memberId: 'b', net: -10 },
    ]
    const transactions = simplifyDebts(balances)
    expect(transactions).toEqual([{ fromMemberId: 'b', toMemberId: 'a', amount: 10 }])
  })

  it('uses at most n-1 transactions and zeroes every balance for a mixed 4-person case', () => {
    // Alice paid a lot, Bob paid a little, Carol and Dave paid nothing.
    const balances: MemberBalance[] = [
      { memberId: 'alice', net: 30 },
      { memberId: 'bob', net: 10 },
      { memberId: 'carol', net: -15 },
      { memberId: 'dave', net: -25 },
    ]
    const transactions = simplifyDebts(balances)
    expect(transactions.length).toBeLessThanOrEqual(balances.length - 1)

    const finalNets = netsAfter(balances, transactions)
    for (const net of finalNets.values()) {
      expect(net).toBeCloseTo(0, 6)
    }
  })

  it('uses at most n-1 transactions and zeroes every balance for a mixed 6-person case', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', net: 42.5 },
      { memberId: 'b', net: 18.25 },
      { memberId: 'c', net: -5 },
      { memberId: 'd', net: -12.75 },
      { memberId: 'e', net: -30 },
      { memberId: 'f', net: -13 },
    ]
    const transactions = simplifyDebts(balances)
    expect(transactions.length).toBeLessThanOrEqual(balances.length - 1)

    const finalNets = netsAfter(balances, transactions)
    for (const net of finalNets.values()) {
      expect(net).toBeCloseTo(0, 6)
    }
  })

  it('handles balances that do not sum exactly to zero due to float noise from currency conversion', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', net: 33.34 },
      { memberId: 'b', net: -16.67 },
      { memberId: 'c', net: -16.67 },
    ]
    const transactions = simplifyDebts(balances)
    expect(transactions.length).toBeLessThanOrEqual(2)
    const finalNets = netsAfter(balances, transactions)
    for (const net of finalNets.values()) {
      expect(Math.abs(net)).toBeLessThan(0.01)
    }
  })
})

describe('computeBalances', () => {
  it('computes correct nets from an equal-split expense', () => {
    const balances = computeBalances(
      ['alice', 'bob', 'carol'],
      [
        {
          paidByMemberId: 'alice',
          amountInBase: 30,
          splits: [
            { memberId: 'alice', shareAmount: 10 },
            { memberId: 'bob', shareAmount: 10 },
            { memberId: 'carol', shareAmount: 10 },
          ],
        },
      ],
      [],
    )
    expect(balances.find((b) => b.memberId === 'alice')?.net).toBeCloseTo(20)
    expect(balances.find((b) => b.memberId === 'bob')?.net).toBeCloseTo(-10)
    expect(balances.find((b) => b.memberId === 'carol')?.net).toBeCloseTo(-10)
  })

  it('recomputes correctly after a settlement is recorded', () => {
    const balances = computeBalances(
      ['alice', 'bob'],
      [
        {
          paidByMemberId: 'alice',
          amountInBase: 20,
          splits: [
            { memberId: 'alice', shareAmount: 10 },
            { memberId: 'bob', shareAmount: 10 },
          ],
        },
      ],
      [{ fromMemberId: 'bob', toMemberId: 'alice', amount: 10 }],
    )
    expect(balances.find((b) => b.memberId === 'alice')?.net).toBeCloseTo(0)
    expect(balances.find((b) => b.memberId === 'bob')?.net).toBeCloseTo(0)
  })

  it('recomputes correctly after a partial settlement', () => {
    const balances = computeBalances(
      ['alice', 'bob'],
      [
        {
          paidByMemberId: 'alice',
          amountInBase: 20,
          splits: [
            { memberId: 'alice', shareAmount: 10 },
            { memberId: 'bob', shareAmount: 10 },
          ],
        },
      ],
      [{ fromMemberId: 'bob', toMemberId: 'alice', amount: 4 }],
    )
    expect(balances.find((b) => b.memberId === 'alice')?.net).toBeCloseTo(6)
    expect(balances.find((b) => b.memberId === 'bob')?.net).toBeCloseTo(-6)
  })

  it('still nets a departed member correctly and keeps the group summing to zero', () => {
    // Regression test: under the soft-delete model (GroupMember.leftAt),
    // a departed member's doc is never removed from the members list this
    // function is called with — only hard-deleting it (the old, no-longer-
    // used behavior) would make their balance silently vanish. This proves
    // passing the full member list, left or not, keeps the math correct.
    const memberIds = ['alice', 'bob', 'carol'] // carol has since left
    const balances = computeBalances(
      memberIds,
      [
        {
          paidByMemberId: 'carol',
          amountInBase: 30,
          splits: [
            { memberId: 'alice', shareAmount: 10 },
            { memberId: 'bob', shareAmount: 10 },
            { memberId: 'carol', shareAmount: 10 },
          ],
        },
      ],
      [
        { fromMemberId: 'alice', toMemberId: 'carol', amount: 10 },
        { fromMemberId: 'bob', toMemberId: 'carol', amount: 10 },
      ],
    )
    expect(balances.find((b) => b.memberId === 'carol')?.net).toBeCloseTo(0)
    expect(balances.find((b) => b.memberId === 'alice')?.net).toBeCloseTo(0)
    expect(balances.find((b) => b.memberId === 'bob')?.net).toBeCloseTo(0)
    expect(balances.reduce((sum, b) => sum + b.net, 0)).toBeCloseTo(0)
  })
})
