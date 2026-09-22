import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { createTestEnv } from './setup'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'

// End-to-end coverage for leave/remove-member/archive, exercising the real
// exported functions from firestoreActions.ts against the emulator, using
// the same per-persona mocked-firebaseClient pattern established in
// inviteLifecycle.rules.test.ts.

function firestoreHostPort(): { host: string; port: number } {
  const raw = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080'
  const [host, port] = raw.split(':')
  return { host, port: Number(port) }
}

function authEmulatorUrl(): string {
  const raw = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'
  return `http://${raw}`
}

let personaCounter = 0

interface Persona {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  uid: string
  actions: typeof import('../../src/lib/firestoreActions')
}

async function createPersona(): Promise<Persona> {
  personaCounter += 1
  const app = initializeApp({ projectId: 'demo-divvy', apiKey: 'demo-api-key' }, `grouplifecycle-persona-${personaCounter}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, authEmulatorUrl(), { disableWarnings: true })
  const db = getFirestore(app)
  const { host, port } = firestoreHostPort()
  connectFirestoreEmulator(db, host, port)

  const credential = await signInAnonymously(auth)

  vi.resetModules()
  vi.doMock('../../src/lib/firebaseClient', () => ({ app, auth, db }))
  const actions = await import('../../src/lib/firestoreActions')

  return { app, auth, db, uid: credential.user.uid, actions }
}

describe('group lifecycle (end-to-end against the emulator)', () => {
  let testEnv: RulesTestEnvironment
  const personas: Persona[] = []

  beforeAll(async () => {
    testEnv = await createTestEnv()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  afterEach(async () => {
    vi.doUnmock('../../src/lib/firebaseClient')
    vi.resetModules()
    await Promise.all(personas.splice(0).map((p) => deleteApp(p.app)))
  })

  async function newPersona(): Promise<Persona> {
    const persona = await createPersona()
    personas.push(persona)
    return persona
  }

  /** Seeds a group owned by `owner`, plus one member doc per entry in `members`. */
  async function seedGroup(groupId: string, owner: Persona, members: Persona[]) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore()
      await setDoc(doc(adminDb, 'groups', groupId), {
        name: 'Trip',
        baseCurrency: 'USD',
        createdBy: owner.uid,
        createdAt: new Date(),
      })
      await setDoc(doc(adminDb, 'groups', groupId, 'members', owner.uid), {
        uid: owner.uid,
        placeholderName: null,
        displayName: 'Owner',
        role: 'owner',
        joinedAt: new Date(),
      })
      for (const [i, member] of members.entries()) {
        await setDoc(doc(adminDb, 'groups', groupId, 'members', member.uid), {
          uid: member.uid,
          placeholderName: null,
          displayName: `Member ${i + 1}`,
          role: 'member',
          joinedAt: new Date(),
        })
      }
    })
  }

  describe('group creation', () => {
    // Every other test in this suite seeds its group via
    // withSecurityRulesDisabled, bypassing the rules entirely — this is the
    // one test that calls the real createGroup() against the real rules.
    // It caught a genuine bug during manual smoke-testing: an earlier,
    // transaction-based version of createGroup had its own member-doc write
    // rejected, because that write's create rule re-reads the group doc's
    // *committed* createdBy via isGroupOwner(), which can't see the same
    // transaction's still-pending write to the group doc.
    it('the creator can immediately read the new group and their own owner member doc', async () => {
      const owner = await newPersona()
      const groupId = await owner.actions.createGroup({
        name: 'Fresh Group',
        baseCurrency: 'USD',
        ownerUid: owner.uid,
        ownerDisplayName: 'Owner',
      })

      const groupSnap = await getDoc(doc(owner.db, 'groups', groupId))
      expect(groupSnap.exists()).toBe(true)
      expect(groupSnap.data()?.createdBy).toBe(owner.uid)

      const memberSnap = await getDoc(doc(owner.db, 'groups', groupId, 'members', owner.uid))
      expect(memberSnap.exists()).toBe(true)
      expect(memberSnap.data()?.role).toBe('owner')
    })
  })

  describe('leaving', () => {
    it('a member can leave the group', async () => {
      const owner = await newPersona()
      const member = await newPersona()
      await seedGroup('g1', owner, [member])

      await member.actions.leaveGroup('g1', member.uid, false)

      const snap = await getDoc(doc(owner.db, 'groups', 'g1', 'members', member.uid))
      expect(snap.data()?.leftAt).toBeTruthy()
    })

    it('the owner cannot leave the group', async () => {
      const owner = await newPersona()
      await seedGroup('g1', owner, [])

      await expect(owner.actions.leaveGroup('g1', owner.uid, true)).rejects.toThrow(/owner/i)

      const snap = await getDoc(doc(owner.db, 'groups', 'g1', 'members', owner.uid))
      expect(snap.data()?.leftAt ?? null).toBeNull()
    })

    it('the rule itself blocks the owner from leaving, not just the client check', async () => {
      const owner = await newPersona()
      await seedGroup('g1', owner, [])

      // Bypasses leaveGroup()'s own isOwner guard, going straight at the rule.
      await expect(
        updateDoc(doc(owner.db, 'groups', 'g1', 'members', owner.uid), { leftAt: serverTimestamp() }),
      ).rejects.toThrow()
    })
  })

  describe('removing a member', () => {
    it('the owner can remove another member', async () => {
      const owner = await newPersona()
      const member = await newPersona()
      await seedGroup('g1', owner, [member])

      await owner.actions.removeMember('g1', member.uid)

      const snap = await getDoc(doc(owner.db, 'groups', 'g1', 'members', member.uid))
      expect(snap.data()?.leftAt).toBeTruthy()
    })

    it('a non-owner member cannot remove another member', async () => {
      const owner = await newPersona()
      const member1 = await newPersona()
      const member2 = await newPersona()
      await seedGroup('g1', owner, [member1, member2])

      await expect(member1.actions.removeMember('g1', member2.uid)).rejects.toThrow()
    })

    it("a member cannot set someone else's leftAt directly", async () => {
      const owner = await newPersona()
      const member1 = await newPersona()
      const member2 = await newPersona()
      await seedGroup('g1', owner, [member1, member2])

      await expect(
        updateDoc(doc(member1.db, 'groups', 'g1', 'members', member2.uid), { leftAt: serverTimestamp() }),
      ).rejects.toThrow()
    })

    it('leftAt cannot be un-set once set', async () => {
      const owner = await newPersona()
      const member = await newPersona()
      await seedGroup('g1', owner, [member])
      await member.actions.leaveGroup('g1', member.uid, false)

      await expect(updateDoc(doc(member.db, 'groups', 'g1', 'members', member.uid), { leftAt: null })).rejects.toThrow()
    })
  })

  describe('a left member', () => {
    it('can still read the group and its history, but cannot write', async () => {
      const owner = await newPersona()
      const member = await newPersona()
      await seedGroup('g1', owner, [member])
      await member.actions.leaveGroup('g1', member.uid, false)

      const groupSnap = await getDoc(doc(member.db, 'groups', 'g1'))
      expect(groupSnap.exists()).toBe(true)
      const rosterSnap = await getDocs(collection(member.db, 'groups', 'g1', 'members'))
      expect(rosterSnap.docs.length).toBeGreaterThan(0)

      await expect(
        member.actions.addExpense('g1', {
          description: 'Should fail',
          category: null,
          amount: 10,
          originalCurrency: 'USD',
          fxRateToBase: 1,
          paidByMemberId: member.uid,
          splitType: 'equal',
          date: '2026-01-01',
          createdBy: member.uid,
          splits: [{ memberId: member.uid, shareAmount: 10, shareRaw: null }],
        }),
      ).rejects.toThrow()

      await expect(member.actions.addPlaceholderMember('g1', 'Someone')).rejects.toThrow()

      const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })
      await expect(member.actions.revokeInviteCode(code)).rejects.toThrow()
    })

    it('still resolves correctly in a historical expense after leaving', async () => {
      const owner = await newPersona()
      const member = await newPersona()
      await seedGroup('g1', owner, [member])

      await owner.actions.addExpense('g1', {
        description: 'Dinner',
        category: 'food',
        amount: 20,
        originalCurrency: 'USD',
        fxRateToBase: 1,
        paidByMemberId: member.uid,
        splitType: 'equal',
        date: '2026-01-01',
        createdBy: owner.uid,
        splits: [
          { memberId: owner.uid, shareAmount: 10, shareRaw: null },
          { memberId: member.uid, shareAmount: 10, shareRaw: null },
        ],
      })

      await member.actions.leaveGroup('g1', member.uid, false)

      const expensesSnap = await getDocs(collection(owner.db, 'groups', 'g1', 'expenses'))
      expect(expensesSnap.docs).toHaveLength(1)
      expect(expensesSnap.docs[0].data().paidByMemberId).toBe(member.uid)

      const memberSnap = await getDoc(doc(owner.db, 'groups', 'g1', 'members', member.uid))
      expect(memberSnap.exists()).toBe(true)
      expect(memberSnap.data()?.leftAt).toBeTruthy()
    })
  })

  describe('an archived group', () => {
    it('rejects a new expense write', async () => {
      const owner = await newPersona()
      await seedGroup('g1', owner, [])
      await owner.actions.archiveGroup('g1')

      await expect(
        owner.actions.addExpense('g1', {
          description: 'Should fail',
          category: null,
          amount: 10,
          originalCurrency: 'USD',
          fxRateToBase: 1,
          paidByMemberId: owner.uid,
          splitType: 'equal',
          date: '2026-01-01',
          createdBy: owner.uid,
          splits: [{ memberId: owner.uid, shareAmount: 10, shareRaw: null }],
        }),
      ).rejects.toThrow()
    })

    it('rejects a new settlement write', async () => {
      const owner = await newPersona()
      const member = await newPersona()
      await seedGroup('g1', owner, [member])
      await owner.actions.archiveGroup('g1')

      await expect(
        owner.actions.recordSettlement('g1', {
          fromMemberId: owner.uid,
          toMemberId: member.uid,
          amount: 5,
          note: null,
          createdBy: owner.uid,
        }),
      ).rejects.toThrow()
    })

    it('rejects creating a new invite code', async () => {
      const owner = await newPersona()
      await seedGroup('g1', owner, [])
      await owner.actions.archiveGroup('g1')

      await expect(owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })).rejects.toThrow()
    })

    it('keeps reads available (roster, history)', async () => {
      const owner = await newPersona()
      await seedGroup('g1', owner, [])
      await owner.actions.addExpense('g1', {
        description: 'Before archiving',
        category: null,
        amount: 5,
        originalCurrency: 'USD',
        fxRateToBase: 1,
        paidByMemberId: owner.uid,
        splitType: 'equal',
        date: '2026-01-01',
        createdBy: owner.uid,
        splits: [{ memberId: owner.uid, shareAmount: 5, shareRaw: null }],
      })

      await owner.actions.archiveGroup('g1')

      const groupSnap = await getDoc(doc(owner.db, 'groups', 'g1'))
      expect(groupSnap.data()?.archived).toBe(true)
      const expensesSnap = await getDocs(collection(owner.db, 'groups', 'g1', 'expenses'))
      expect(expensesSnap.docs).toHaveLength(1)
    })

    it('the owner can unarchive, restoring writes', async () => {
      const owner = await newPersona()
      await seedGroup('g1', owner, [])
      await owner.actions.archiveGroup('g1')
      await owner.actions.unarchiveGroup('g1')

      await expect(
        owner.actions.addExpense('g1', {
          description: 'After unarchiving',
          category: null,
          amount: 5,
          originalCurrency: 'USD',
          fxRateToBase: 1,
          paidByMemberId: owner.uid,
          splitType: 'equal',
          date: '2026-01-01',
          createdBy: owner.uid,
          splits: [{ memberId: owner.uid, shareAmount: 5, shareRaw: null }],
        }),
      ).resolves.toBeUndefined()
    })
  })
})
