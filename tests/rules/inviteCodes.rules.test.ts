import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { createTestEnv } from './setup'

// Regression + new-behavior coverage for the invite-code model. Phase 1A
// judged this section well-designed and left it untouched; Phase 1B (this
// change) adds create-time validation, scoped listing for the management UI,
// and a revoke path, so both the untouched and the new behavior are covered.
describe('/inviteCodes rules', () => {
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
      const db = ctx.firestore()
      await setDoc(doc(db, 'groups', 'g1'), {
        name: 'Trip',
        baseCurrency: 'USD',
        createdBy: 'owner1',
        createdAt: new Date(),
      })
      await setDoc(doc(db, 'groups', 'g1', 'members', 'owner1'), {
        uid: 'owner1',
        placeholderName: null,
        displayName: 'Owner',
        role: 'owner',
        joinedAt: new Date(),
      })
      await setDoc(doc(db, 'groups', 'g2', 'members', 'other1'), {
        uid: 'other1',
        placeholderName: null,
        displayName: 'Other',
        role: 'owner',
        joinedAt: new Date(),
      })
      await setDoc(doc(db, 'inviteCodes', 'CODE123'), {
        groupId: 'g1',
        createdBy: 'owner1',
        expiresAt: null,
        maxUses: null,
        useCount: 0,
        revoked: false,
        createdAt: new Date(),
      })
    })
  })

  it('a signed-in user can look up a code by its exact value', async () => {
    const db = testEnv.authenticatedContext('someone').firestore()
    await assertSucceeds(getDoc(doc(db, 'inviteCodes', 'CODE123')))
  })

  describe('create', () => {
    function validPayload(overrides: Record<string, unknown> = {}) {
      return {
        groupId: 'g1',
        createdBy: 'owner1',
        expiresAt: null,
        maxUses: null,
        useCount: 0,
        revoked: false,
        createdAt: new Date(),
        ...overrides,
      }
    }

    it('an existing group member can create a valid invite for that group', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertSucceeds(setDoc(doc(db, 'inviteCodes', 'NEWCODE1'), validPayload()))
    })

    it('an existing member can create an invite with an expiration and a use limit', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertSucceeds(
        setDoc(
          doc(db, 'inviteCodes', 'NEWCODE2'),
          validPayload({ expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000), maxUses: 5 }),
        ),
      )
    })

    it('a non-member of the target group cannot create an invite for it', async () => {
      const db = testEnv.authenticatedContext('outsider1').firestore()
      await assertFails(setDoc(doc(db, 'inviteCodes', 'NEWCODE3'), validPayload({ createdBy: 'outsider1' })))
    })

    it('cannot manufacture an invite that claims someone else as its creator', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(setDoc(doc(db, 'inviteCodes', 'NEWCODE4'), validPayload({ createdBy: 'someone-else' })))
    })

    it('cannot manufacture an already-revoked invite', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(setDoc(doc(db, 'inviteCodes', 'NEWCODE5'), validPayload({ revoked: true })))
    })

    it('cannot manufacture an invite with a pre-incremented useCount', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(setDoc(doc(db, 'inviteCodes', 'NEWCODE6'), validPayload({ useCount: 3 })))
    })

    it('cannot manufacture an invite that is already expired', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(
        setDoc(
          doc(db, 'inviteCodes', 'NEWCODE7'),
          validPayload({ expiresAt: Timestamp.fromMillis(Date.now() - 60 * 60 * 1000) }),
        ),
      )
    })

    it('cannot manufacture an invite with a non-positive max-use limit', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(setDoc(doc(db, 'inviteCodes', 'NEWCODE8'), validPayload({ maxUses: 0 })))
      await assertFails(setDoc(doc(db, 'inviteCodes', 'NEWCODE9'), validPayload({ maxUses: -5 })))
    })
  })

  describe('list (invite management)', () => {
    it('a group member can list their own group\'s invites', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertSucceeds(getDocs(query(collection(db, 'inviteCodes'), where('groupId', '==', 'g1'))))
    })

    it('a non-member cannot list another group\'s invites', async () => {
      const db = testEnv.authenticatedContext('other1').firestore()
      await assertFails(getDocs(query(collection(db, 'inviteCodes'), where('groupId', '==', 'g1'))))
    })

    it('an unscoped query (no groupId filter) is rejected even for a real member', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(getDocs(collection(db, 'inviteCodes')))
    })
  })

  describe('redemption (useCount)', () => {
    it('redemption can only ever increment useCount, never touch other fields', async () => {
      const db = testEnv.authenticatedContext('joiner1').firestore()
      await assertSucceeds(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { useCount: 1 }))
      await assertFails(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { revoked: true }))
      await assertFails(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { useCount: 1, maxUses: 5 }))
    })
  })

  describe('revocation', () => {
    it('a member of the invite\'s group can revoke it', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertSucceeds(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { revoked: true }))
    })

    it('a member of a different group cannot revoke this invite', async () => {
      const db = testEnv.authenticatedContext('other1').firestore()
      await assertFails(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { revoked: true }))
    })

    it('a signed-in non-member cannot revoke it either', async () => {
      const db = testEnv.authenticatedContext('outsider1').firestore()
      await assertFails(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { revoked: true }))
    })

    it('revoking cannot be combined with changing any other field', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { revoked: true, maxUses: 1 }))
    })

    it('a revoked invite cannot be un-revoked', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'inviteCodes', 'CODE123'), { revoked: true })
      })
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { revoked: false }))
    })
  })

  it('only a member of the invite\'s group can delete it', async () => {
    const outsiderDb = testEnv.authenticatedContext('outsider1').firestore()
    await assertFails(deleteDoc(doc(outsiderDb, 'inviteCodes', 'CODE123')))

    const memberDb = testEnv.authenticatedContext('owner1').firestore()
    await assertSucceeds(deleteDoc(doc(memberDb, 'inviteCodes', 'CODE123')))
  })

  it('an unauthenticated client cannot read or write invite codes', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'inviteCodes', 'CODE123')))
    await assertFails(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { useCount: 1 }))
  })
})
