import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { createTestEnv } from './setup'

describe('/users rules', () => {
  let testEnv: RulesTestEnvironment

  beforeAll(async () => {
    testEnv = await createTestEnv()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'alice'), {
        displayName: 'Alice',
        avatarUrl: null,
        isAnonymous: false,
        preferredCurrency: 'USD',
        createdAt: new Date(),
      })
    })
  })

  it('unauthenticated user cannot read a profile', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users', 'alice')))
  })

  it('authenticated user can read their own profile', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'alice')))
  })

  it('authenticated user cannot read a different user\'s profile', async () => {
    const db = testEnv.authenticatedContext('bob').firestore()
    await assertFails(getDoc(doc(db, 'users', 'alice')))
  })

  it('authenticated user cannot enumerate /users', async () => {
    const db = testEnv.authenticatedContext('bob').firestore()
    await assertFails(getDocs(collection(db, 'users')))
  })

  it('anonymous authenticated user cannot enumerate /users', async () => {
    const db = testEnv
      .authenticatedContext('guest1', { firebase: { sign_in_provider: 'anonymous' } })
      .firestore()
    await assertFails(getDocs(collection(db, 'users')))
    // Nor can a guest read someone else's profile by id.
    await assertFails(getDoc(doc(db, 'users', 'alice')))
  })

  it('a user can still create/update their own profile doc', async () => {
    const db = testEnv.authenticatedContext('bob').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'users', 'bob'), {
        displayName: 'Bob',
        avatarUrl: null,
        isAnonymous: true,
        preferredCurrency: 'USD',
        createdAt: new Date(),
      }),
    )
  })

  it('a user cannot write another user\'s profile doc', async () => {
    const db = testEnv.authenticatedContext('bob').firestore()
    await assertFails(setDoc(doc(db, 'users', 'alice'), { displayName: 'Hijacked' }, { merge: true }))
  })
})
