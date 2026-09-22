import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import { createTestEnv } from './setup'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'

// This file exercises the REAL exported functions from firestoreActions.ts
// end-to-end against the emulator (not just the raw Firestore writes they
// produce, which the other rules tests already cover) — specifically the
// client-side rejection logic in redeemInviteCode (expired/revoked/exhausted
// messages), which nothing else in the suite calls.

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

/**
 * Signs in a fresh anonymous user against the Auth emulator and returns the
 * real firestoreActions module re-imported with firebaseClient mocked to use
 * this persona's own emulator-connected app — so each persona genuinely acts
 * as its own authenticated Firestore client, exactly like a real browser tab.
 */
async function createPersona(): Promise<Persona> {
  personaCounter += 1
  const app = initializeApp({ projectId: 'demo-divvy', apiKey: 'demo-api-key' }, `persona-${personaCounter}`)
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

describe('invite lifecycle (end-to-end against the emulator)', () => {
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

  /** Seeds a group owned by `owner`, with `owner` already a member. */
  async function seedGroup(groupId: string, owner: Persona) {
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
    })
  }

  async function newPersona(): Promise<Persona> {
    const persona = await createPersona()
    personas.push(persona)
    return persona
  }

  it('a valid invite lets a new user join the group', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)
    const joiner = await newPersona()

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })
    const groupId = await joiner.actions.redeemInviteCode(code, joiner.uid, 'Joiner')

    expect(groupId).toBe('g1')
    const memberSnap = await getDoc(doc(owner.db, 'groups', 'g1', 'members', joiner.uid))
    expect(memberSnap.exists()).toBe(true)
    expect(memberSnap.data()?.role).toBe('member')
  })

  it('rejects redemption of an expired invite with a clear message', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)
    const joiner = await newPersona()

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })
    // Backdate expiresAt directly (createInviteCode's own validation won't
    // let a client create an already-expired code — see the rules tests).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'inviteCodes', code),
        { expiresAt: Timestamp.fromMillis(Date.now() - 1000) },
        { merge: true },
      )
    })

    await expect(joiner.actions.redeemInviteCode(code, joiner.uid, 'Joiner')).rejects.toThrow(
      'This invite link has expired.',
    )
    const memberSnap = await getDoc(doc(owner.db, 'groups', 'g1', 'members', joiner.uid))
    expect(memberSnap.exists()).toBe(false)
  })

  it('rejects redemption of a revoked invite with a clear message', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)
    const joiner = await newPersona()

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })
    await owner.actions.revokeInviteCode(code)

    await expect(joiner.actions.redeemInviteCode(code, joiner.uid, 'Joiner')).rejects.toThrow(
      'This invite link has been revoked.',
    )
  })

  it('rejects redemption once the max-use limit is reached', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)
    const joiner1 = await newPersona()
    const joiner2 = await newPersona()

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: 1 })
    await joiner1.actions.redeemInviteCode(code, joiner1.uid, 'Joiner One')

    await expect(joiner2.actions.redeemInviteCode(code, joiner2.uid, 'Joiner Two')).rejects.toThrow(
      'This invite link has reached its use limit.',
    )
    const secondMemberSnap = await getDoc(doc(owner.db, 'groups', 'g1', 'members', joiner2.uid))
    expect(secondMemberSnap.exists()).toBe(false)
  })

  it('an unlimited invite keeps working across many redemptions', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })

    for (let i = 0; i < 3; i++) {
      const joiner = await newPersona()
      await expect(joiner.actions.redeemInviteCode(code, joiner.uid, `Joiner ${i}`)).resolves.toBe('g1')
    }

    const inviteSnap = await getDoc(doc(owner.db, 'inviteCodes', code))
    expect(inviteSnap.data()?.useCount).toBe(3)
  })

  it('an anonymous authenticated user can redeem an invite (existing guest flow)', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)
    const guest = await newPersona() // signInAnonymously — same mechanism the app's joinAnonymously() uses

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })
    const groupId = await guest.actions.redeemInviteCode(code, guest.uid, 'Guest')

    expect(groupId).toBe('g1')
  })

  it('redeeming again as an existing member is a no-op, not a duplicate join', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)
    const joiner = await newPersona()

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: null, maxUses: null })
    await joiner.actions.redeemInviteCode(code, joiner.uid, 'Joiner')
    await joiner.actions.redeemInviteCode(code, joiner.uid, 'Joiner') // redeem the same link again

    const inviteSnap = await getDoc(doc(owner.db, 'inviteCodes', code))
    expect(inviteSnap.data()?.useCount).toBe(1)
  })

  it('a revoked invite can be created, listed with its status, and no longer redeemed — full lifecycle', async () => {
    const owner = await newPersona()
    await seedGroup('g1', owner)
    const joiner = await newPersona()

    const code = await owner.actions.createInviteCode('g1', owner.uid, { expiresInMs: 60 * 60 * 1000, maxUses: 5 })

    let snap = await getDoc(doc(owner.db, 'inviteCodes', code))
    expect(snap.data()).toMatchObject({ revoked: false, useCount: 0, maxUses: 5 })

    const groupId = await joiner.actions.redeemInviteCode(code, joiner.uid, 'Joiner')
    expect(groupId).toBe('g1')

    snap = await getDoc(doc(owner.db, 'inviteCodes', code))
    expect(snap.data()?.useCount).toBe(1)

    await owner.actions.revokeInviteCode(code)
    snap = await getDoc(doc(owner.db, 'inviteCodes', code))
    expect(snap.data()?.revoked).toBe(true)

    const secondJoiner = await newPersona()
    await expect(secondJoiner.actions.redeemInviteCode(code, secondJoiner.uid, 'Second Joiner')).rejects.toThrow(
      'This invite link has been revoked.',
    )
  })
})
