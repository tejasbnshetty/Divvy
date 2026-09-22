import type { Timestamp } from 'firebase/firestore'

export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares'
export type MemberRole = 'owner' | 'member'

export interface UserProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  isAnonymous: boolean
  preferredCurrency: string
  createdAt: Timestamp
}

export interface Group {
  id: string
  name: string
  baseCurrency: string
  createdBy: string
  createdAt: Timestamp
  archived?: boolean
  archivedAt?: Timestamp | null
}

export interface GroupMember {
  id: string
  uid: string | null
  placeholderName: string | null
  displayName: string
  role: MemberRole
  /** The invite code this member redeemed to join, if any — checked by Firestore security rules, not otherwise used by the UI. */
  joinedViaCode?: string
  joinedAt: Timestamp
  /** Set once this member leaves (or is removed). The doc is never deleted — see leaveGroup/removeMember — so history stays valid. */
  leftAt?: Timestamp | null
}

export interface ExpenseSplit {
  memberId: string
  shareAmount: number
  shareRaw: number | null
}

export interface Expense {
  id: string
  description: string
  category: string | null
  amount: number
  originalCurrency: string
  fxRateToBase: number
  amountInBase: number
  paidByMemberId: string
  splitType: SplitType
  date: string
  createdBy: string
  createdAt: Timestamp
  splits: ExpenseSplit[]
}

export interface Settlement {
  id: string
  fromMemberId: string
  toMemberId: string
  amount: number
  note: string | null
  settledAt: Timestamp
  createdBy: string
}

export interface InviteCode {
  code: string
  groupId: string
  createdBy: string
  expiresAt: Timestamp | null
  maxUses: number | null
  useCount: number
  revoked: boolean
  createdAt: Timestamp
}

export interface ExchangeRates {
  base: string
  rates: Record<string, number>
  asOf: string
  fetchedAt: Timestamp
}

/** Net balance for one group member, in the group's base currency. Positive = owed money, negative = owes money. */
export interface MemberBalance {
  memberId: string
  net: number
}

/** A suggested minimal-transaction settlement produced by debt simplification. */
export interface SuggestedTransaction {
  fromMemberId: string
  toMemberId: string
  amount: number
}
