import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebaseClient'
import { deriveCrossRate, isRateCacheStale } from './currency'
import type { ExchangeRates, SplitType } from '../types/models'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars, exactly 32 = 2^5 symbols

function generateInviteCode(length = 7): string {
  // Math.random() isn't appropriate for an access-control token. The alphabet
  // is exactly 32 symbols, so masking each random byte to 5 bits maps
  // uniformly onto it with no modulo bias and no rejection sampling needed.
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] & 31]
  }
  return code
}

export async function createGroup(params: { name: string; baseCurrency: string; ownerUid: string; ownerDisplayName: string }) {
  // A plain addDoc() for the group followed by a separate setDoc() for the
  // owner's member doc risks leaving an orphaned, permanently-unreadable
  // group if the second write fails (isGroupMember requires that member doc
  // to exist). A single runTransaction() can't fix this here: the member
  // doc's own create rule re-reads the group doc's *committed* createdBy via
  // isGroupOwner(), which can't see this same transaction's still-pending
  // write to the group doc — Firestore rejects it with permission-denied.
  // So instead: write the group first, and if the member write then fails,
  // roll the group back rather than leave it orphaned.
  const groupRef = doc(collection(db, 'groups'))
  await setDoc(groupRef, {
    name: params.name,
    baseCurrency: params.baseCurrency,
    createdBy: params.ownerUid,
    createdAt: serverTimestamp(),
  })

  try {
    await setDoc(doc(db, 'groups', groupRef.id, 'members', params.ownerUid), {
      uid: params.ownerUid,
      placeholderName: null,
      displayName: params.ownerDisplayName,
      role: 'owner',
      joinedAt: serverTimestamp(),
    })
  } catch (err) {
    await deleteDoc(groupRef).catch(() => {})
    throw err
  }

  return groupRef.id
}

export async function renameGroup(groupId: string, name: string) {
  await updateDoc(doc(db, 'groups', groupId), { name })
}

export class LeaveGroupError extends Error {}

/**
 * Marks a member as having left — the doc is never deleted, so every
 * historical expense/settlement that references it keeps resolving and
 * balances stay correct. Ownership transfer doesn't exist yet, so the
 * current owner can't leave; there's nobody to hand the group to.
 */
export async function leaveGroup(groupId: string, memberId: string, isOwner: boolean) {
  if (isOwner) {
    throw new LeaveGroupError("You're the owner — ownership transfer isn't supported yet, so you can't leave this group.")
  }
  await updateDoc(doc(db, 'groups', groupId, 'members', memberId), { leftAt: serverTimestamp() })
}

/** Owner-only: removes another member the same way leaveGroup does — sets leftAt, never deletes the doc. */
export async function removeMember(groupId: string, memberId: string) {
  await updateDoc(doc(db, 'groups', groupId, 'members', memberId), { leftAt: serverTimestamp() })
}

export async function archiveGroup(groupId: string) {
  await updateDoc(doc(db, 'groups', groupId), { archived: true, archivedAt: serverTimestamp() })
}

export async function unarchiveGroup(groupId: string) {
  await updateDoc(doc(db, 'groups', groupId), { archived: false, archivedAt: null })
}

export interface CreateInviteCodeOptions {
  /** Millis from now until the code expires, or null for no expiration. */
  expiresInMs: number | null
  /** Maximum number of redemptions, or null for unlimited. */
  maxUses: number | null
}

export async function createInviteCode(groupId: string, createdBy: string, options: CreateInviteCodeOptions) {
  let code = generateInviteCode()
  // Extremely unlikely to collide, but guard against it anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDoc(doc(db, 'inviteCodes', code))
    if (!existing.exists()) break
    code = generateInviteCode()
  }

  await setDoc(doc(db, 'inviteCodes', code), {
    groupId,
    createdBy,
    expiresAt: options.expiresInMs !== null ? Timestamp.fromMillis(Date.now() + options.expiresInMs) : null,
    maxUses: options.maxUses,
    useCount: 0,
    revoked: false,
    createdAt: serverTimestamp(),
  })

  return code
}

/** Revokes an invite code so it can no longer be redeemed. One-way — there's no un-revoke. */
export async function revokeInviteCode(code: string) {
  await updateDoc(doc(db, 'inviteCodes', code), { revoked: true })
}

export class InviteCodeError extends Error {}

/**
 * Validates and redeems an invite code, adding the current user as a group
 * member, all inside one Firestore transaction so a code can't be used past
 * its limits even if two people redeem it at once.
 */
export async function redeemInviteCode(code: string, uid: string, displayName: string): Promise<string> {
  const inviteRef = doc(db, 'inviteCodes', code)

  const groupId = await runTransaction(db, async (tx) => {
    const inviteSnap = await tx.get(inviteRef)
    if (!inviteSnap.exists()) throw new InviteCodeError('This invite link is not valid.')
    const invite = inviteSnap.data()

    if (invite.revoked) throw new InviteCodeError('This invite link has been revoked.')
    if (invite.expiresAt && (invite.expiresAt as Timestamp).toMillis() < Date.now()) {
      throw new InviteCodeError('This invite link has expired.')
    }
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      throw new InviteCodeError('This invite link has reached its use limit.')
    }

    const memberRef = doc(db, 'groups', invite.groupId, 'members', uid)
    const memberSnap = await tx.get(memberRef)
    if (!memberSnap.exists()) {
      tx.set(memberRef, {
        uid,
        placeholderName: null,
        displayName,
        role: 'member',
        joinedViaCode: code,
        joinedAt: serverTimestamp(),
      })
      tx.update(inviteRef, { useCount: invite.useCount + 1 })
    }

    return invite.groupId as string
  })

  return groupId
}

export async function addPlaceholderMember(groupId: string, placeholderName: string) {
  await addDoc(collection(db, 'groups', groupId, 'members'), {
    uid: null,
    placeholderName,
    displayName: placeholderName,
    role: 'member',
    joinedAt: serverTimestamp(),
  })
}

/**
 * Folds a placeholder member (added before they joined) into the real member
 * they turned out to be, once that person has actually joined the group.
 * Rewrites every expense/settlement that referenced the placeholder so their
 * history follows them, then removes the now-redundant placeholder doc.
 */
export async function mergeMemberInto(groupId: string, placeholderMemberId: string, realMemberId: string) {
  if (placeholderMemberId === realMemberId) return

  const batch = writeBatch(db)
  let writes = 0

  const expensesSnap = await getDocs(collection(db, 'groups', groupId, 'expenses'))
  for (const expenseDoc of expensesSnap.docs) {
    const data = expenseDoc.data()
    const splits = (data.splits ?? []) as { memberId: string; shareAmount: number; shareRaw: number | null }[]
    const touchesPlaceholder =
      data.paidByMemberId === placeholderMemberId || splits.some((s) => s.memberId === placeholderMemberId)
    if (!touchesPlaceholder) continue

    batch.update(expenseDoc.ref, {
      paidByMemberId: data.paidByMemberId === placeholderMemberId ? realMemberId : data.paidByMemberId,
      splits: splits.map((s) => (s.memberId === placeholderMemberId ? { ...s, memberId: realMemberId } : s)),
    })
    writes++
  }

  const settlementsSnap = await getDocs(collection(db, 'groups', groupId, 'settlements'))
  for (const settlementDoc of settlementsSnap.docs) {
    const data = settlementDoc.data()
    const touchesPlaceholder = data.fromMemberId === placeholderMemberId || data.toMemberId === placeholderMemberId
    if (!touchesPlaceholder) continue

    batch.update(settlementDoc.ref, {
      fromMemberId: data.fromMemberId === placeholderMemberId ? realMemberId : data.fromMemberId,
      toMemberId: data.toMemberId === placeholderMemberId ? realMemberId : data.toMemberId,
    })
    writes++
  }

  batch.delete(doc(db, 'groups', groupId, 'members', placeholderMemberId))
  writes++

  // Firestore batches cap at 500 writes; a friend group's history should never get close.
  if (writes > 500) throw new Error('Too much history to merge in one go — this group has grown unusually large.')

  await batch.commit()
}

export interface NewExpenseInput {
  description: string
  category: string | null
  amount: number
  originalCurrency: string
  fxRateToBase: number
  paidByMemberId: string
  splitType: SplitType
  date: string
  createdBy: string
  splits: { memberId: string; shareAmount: number; shareRaw: number | null }[]
}

export async function addExpense(groupId: string, input: NewExpenseInput) {
  const amountInBase = Math.round(input.amount * input.fxRateToBase * 100) / 100
  await addDoc(collection(db, 'groups', groupId, 'expenses'), {
    ...input,
    amountInBase,
    createdAt: serverTimestamp(),
  })
}

export async function updateExpense(groupId: string, expenseId: string, input: NewExpenseInput) {
  const amountInBase = Math.round(input.amount * input.fxRateToBase * 100) / 100
  await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), {
    ...input,
    amountInBase,
  })
}

export async function deleteExpense(groupId: string, expenseId: string) {
  await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId))
}

export async function updateUserProfile(uid: string, patch: { displayName?: string; preferredCurrency?: string }) {
  await setDoc(doc(db, 'users', uid), patch, { merge: true })
}

export async function recordSettlement(
  groupId: string,
  input: { fromMemberId: string; toMemberId: string; amount: number; note: string | null; createdBy: string },
) {
  await addDoc(collection(db, 'groups', groupId, 'settlements'), {
    ...input,
    settledAt: serverTimestamp(),
  })
}

/** Reads the cached USD-based exchange rates, refreshing from Frankfurter if the cache is stale. */
export async function getExchangeRates(): Promise<Record<string, number>> {
  const ref = doc(db, 'exchangeRates', 'latest')
  const snap = await getDoc(ref)
  const cached = snap.exists() ? (snap.data() as ExchangeRates) : null
  const fetchedAt = cached?.fetchedAt ? cached.fetchedAt.toDate() : null

  if (!isRateCacheStale(fetchedAt) && cached) {
    return cached.rates
  }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD')
    if (!res.ok) throw new Error(`Frankfurter responded ${res.status}`)
    const data = (await res.json()) as { base: string; date: string; rates: Record<string, number> }
    await setDoc(ref, {
      base: 'USD',
      rates: data.rates,
      asOf: data.date,
      fetchedAt: serverTimestamp(),
    })
    return data.rates
  } catch {
    // Network hiccup or Frankfurter down — fall back to whatever's cached, even if stale.
    return cached?.rates ?? {}
  }
}

export async function getFxRateToBase(originalCurrency: string, baseCurrency: string): Promise<number> {
  if (originalCurrency === baseCurrency) return 1
  const rates = await getExchangeRates()
  const rate = deriveCrossRate(rates, originalCurrency, baseCurrency)
  return rate ?? 1
}
