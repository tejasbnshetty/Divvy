import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { createTestEnv } from './setup'

describe('group membership rules', () => {
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
        displayName: 'Member One',
        role: 'member',
        joinedAt: new Date(),
      })
      await setDoc(doc(db, 'groups', 'g1', 'members', 'member2'), {
        uid: 'member2',
        placeholderName: null,
        displayName: 'Member Two',
        role: 'member',
        joinedAt: new Date(),
      })
      await setDoc(doc(db, 'groups', 'g1', 'members', 'placeholder1'), {
        uid: null,
        placeholderName: 'Casey',
        displayName: 'Casey',
        role: 'member',
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

  it('a group member can read legitimate group membership data', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertSucceeds(getDoc(doc(db, 'groups', 'g1', 'members', 'owner1')))
    await assertSucceeds(getDocs(collection(db, 'groups', 'g1', 'members')))
  })

  it('a non-member cannot read group membership data', async () => {
    const db = testEnv.authenticatedContext('outsider1').firestore()
    await assertFails(getDoc(doc(db, 'groups', 'g1', 'members', 'owner1')))
  })

  it('an ordinary member cannot change another member\'s role', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertFails(updateDoc(doc(db, 'groups', 'g1', 'members', 'owner1'), { role: 'member' }))
    await assertFails(updateDoc(doc(db, 'groups', 'g1', 'members', 'member2'), { role: 'owner' }))
  })

  it('an ordinary member cannot delete another member', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertFails(deleteDoc(doc(db, 'groups', 'g1', 'members', 'member2')))
    await assertFails(deleteDoc(doc(db, 'groups', 'g1', 'members', 'owner1')))
  })

  it('an ordinary member cannot change another member\'s uid', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    // Hijacking a real member's doc by repointing its uid.
    await assertFails(updateDoc(doc(db, 'groups', 'g1', 'members', 'member2'), { uid: 'member1' }))
    // Spoofing group membership for an arbitrary uid via a placeholder.
    await assertFails(updateDoc(doc(db, 'groups', 'g1', 'members', 'placeholder1'), { uid: 'outsider1' }))
  })

  it('a member cannot even self-promote by touching their own role', async () => {
    const db = testEnv.authenticatedContext('member1').firestore()
    await assertFails(updateDoc(doc(db, 'groups', 'g1', 'members', 'member1'), { role: 'owner' }))
  })

  // Removing a real member (owner-initiated) and leaving (self-initiated) no
  // longer happen via delete — they're soft (leftAt, set through update),
  // covered end-to-end in groupLifecycle.rules.test.ts. Deleting a real
  // member's doc directly is no longer possible for anyone, by design: that
  // would leave every expense/settlement referencing them dangling.
  it('a real member\'s doc can no longer be deleted directly, by the owner or by themselves', async () => {
    const ownerDb = testEnv.authenticatedContext('owner1').firestore()
    await assertFails(deleteDoc(doc(ownerDb, 'groups', 'g1', 'members', 'member2')))

    const memberDb = testEnv.authenticatedContext('member1').firestore()
    await assertFails(deleteDoc(doc(memberDb, 'groups', 'g1', 'members', 'member1')))
  })

  describe('legitimate join/invite flow', () => {
    it('a new user can create their own member doc when redeeming a valid invite code', async () => {
      const db = testEnv.authenticatedContext('joiner1').firestore()
      await assertSucceeds(
        setDoc(doc(db, 'groups', 'g1', 'members', 'joiner1'), {
          uid: 'joiner1',
          placeholderName: null,
          displayName: 'Joiner',
          role: 'member',
          joinedViaCode: 'CODE123',
          joinedAt: serverTimestamp(),
        }),
      )
    })

    it('redemption can still increment the invite\'s useCount', async () => {
      const db = testEnv.authenticatedContext('joiner1').firestore()
      await assertSucceeds(updateDoc(doc(db, 'inviteCodes', 'CODE123'), { useCount: 1 }))
    })

    it('a joining user cannot self-assign the owner role via an invite code', async () => {
      const db = testEnv.authenticatedContext('joiner1').firestore()
      await assertFails(
        setDoc(doc(db, 'groups', 'g1', 'members', 'joiner1'), {
          uid: 'joiner1',
          placeholderName: null,
          displayName: 'Joiner',
          role: 'owner',
          joinedViaCode: 'CODE123',
          joinedAt: serverTimestamp(),
        }),
      )
    })

    it('a fresh group creator can create their own owner member doc', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', 'g2'), {
          name: 'New Group',
          baseCurrency: 'USD',
          createdBy: 'creator1',
          createdAt: new Date(),
        })
      })
      const db = testEnv.authenticatedContext('creator1').firestore()
      await assertSucceeds(
        setDoc(doc(db, 'groups', 'g2', 'members', 'creator1'), {
          uid: 'creator1',
          placeholderName: null,
          displayName: 'Creator',
          role: 'owner',
          joinedAt: serverTimestamp(),
        }),
      )
    })
  })

  describe('placeholder members', () => {
    it('an existing member can add a placeholder member', async () => {
      const db = testEnv.authenticatedContext('member1').firestore()
      await assertSucceeds(
        addDoc(collection(db, 'groups', 'g1', 'members'), {
          uid: null,
          placeholderName: 'Sam',
          displayName: 'Sam',
          role: 'member',
          joinedAt: serverTimestamp(),
        }),
      )
    })

    it('a non-member cannot add a placeholder member', async () => {
      const db = testEnv.authenticatedContext('outsider1').firestore()
      await assertFails(
        addDoc(collection(db, 'groups', 'g1', 'members'), {
          uid: null,
          placeholderName: 'Sam',
          displayName: 'Sam',
          role: 'member',
          joinedAt: serverTimestamp(),
        }),
      )
    })

    it('any group member can remove a placeholder as part of merging it into a real member', async () => {
      const db = testEnv.authenticatedContext('member2').firestore()
      await assertSucceeds(deleteDoc(doc(db, 'groups', 'g1', 'members', 'placeholder1')))
    })

    it('a group member can edit a placeholder\'s non-identity fields', async () => {
      const db = testEnv.authenticatedContext('member1').firestore()
      await assertSucceeds(updateDoc(doc(db, 'groups', 'g1', 'members', 'placeholder1'), { displayName: 'Casey J.' }))
    })
  })
})
