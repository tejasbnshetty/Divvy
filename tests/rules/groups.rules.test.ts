import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { createTestEnv } from './setup'

describe('/groups/{groupId} rules', () => {
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
      await setDoc(doc(db, 'groups', 'g1', 'members', 'member1'), {
        uid: 'member1',
        placeholderName: null,
        displayName: 'Member',
        role: 'member',
        joinedAt: new Date(),
      })
    })
  })

  it('a signed-in user can create a group they are the creator of', async () => {
    const db = testEnv.authenticatedContext('newuser1').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'groups', 'g-new'), { name: 'New', baseCurrency: 'USD', createdBy: 'newuser1', createdAt: new Date() }),
    )
  })

  it('a user cannot create a group claiming someone else as the creator', async () => {
    const db = testEnv.authenticatedContext('newuser1').firestore()
    await assertFails(
      setDoc(doc(db, 'groups', 'g-fake'), { name: 'Fake', baseCurrency: 'USD', createdBy: 'someone-else', createdAt: new Date() }),
    )
  })

  it('a group member can perform legitimate currently-supported group operations', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertSucceeds(getDoc(doc(db, 'groups', 'g1')))
    await assertSucceeds(updateDoc(doc(db, 'groups', 'g1'), { name: 'Renamed Trip' }))
  })

  it('a member cannot rename and change another field in the same write', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertFails(updateDoc(doc(db, 'groups', 'g1'), { name: 'Renamed Trip', baseCurrency: 'EUR' }))
  })

  it('an ordinary member cannot delete a group', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertFails(deleteDoc(doc(db, 'groups', 'g1')))
  })

  it('the group owner can delete the group', async () => {
    const db = testEnv.authenticatedContext('owner1').firestore()
    await assertSucceeds(deleteDoc(doc(db, 'groups', 'g1')))
  })

  it('an ordinary member cannot change createdBy', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertFails(updateDoc(doc(db, 'groups', 'g1'), { createdBy: 'member1' }))
  })

  it('even the owner cannot change createdBy', async () => {
    const db = testEnv.authenticatedContext('owner1').firestore()
    await assertFails(updateDoc(doc(db, 'groups', 'g1'), { createdBy: 'someone-else' }))
  })

  it('unauthorized users cannot read, update, or delete a group they are not a member of', async () => {
    const db = testEnv.authenticatedContext('outsider1').firestore()
    await assertFails(getDoc(doc(db, 'groups', 'g1')))
    await assertFails(updateDoc(doc(db, 'groups', 'g1'), { name: 'Hijacked' }))
    await assertFails(deleteDoc(doc(db, 'groups', 'g1')))
  })

  it('a fully unauthenticated client cannot read or write a group', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'groups', 'g1')))
    await assertFails(setDoc(doc(db, 'groups', 'g1'), { name: 'Hacked' }, { merge: true }))
  })

  describe('archiving', () => {
    it('the owner can archive the group', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertSucceeds(updateDoc(doc(db, 'groups', 'g1'), { archived: true, archivedAt: new Date() }))
    })

    it('a non-owner member cannot archive the group', async () => {
      const db = testEnv.authenticatedContext('member1').firestore()
      await assertFails(updateDoc(doc(db, 'groups', 'g1'), { archived: true, archivedAt: new Date() }))
    })

    it('the owner can unarchive an already-archived group', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'groups', 'g1'), { archived: true, archivedAt: new Date() })
      })
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertSucceeds(updateDoc(doc(db, 'groups', 'g1'), { archived: false, archivedAt: null }))
    })

    it('nobody can rename an archived group, not even the owner', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'groups', 'g1'), { archived: true, archivedAt: new Date() })
      })
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(updateDoc(doc(db, 'groups', 'g1'), { name: 'Should not work' }))
    })

    it('archiving cannot be combined with changing name in the same write', async () => {
      const db = testEnv.authenticatedContext('owner1').firestore()
      await assertFails(updateDoc(doc(db, 'groups', 'g1'), { archived: true, archivedAt: new Date(), name: 'Sneaky' }))
    })
  })
})
