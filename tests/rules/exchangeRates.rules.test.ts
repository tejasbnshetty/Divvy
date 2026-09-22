import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { createTestEnv } from './setup'

describe('/exchangeRates rules', () => {
  let testEnv: RulesTestEnvironment

  beforeAll(async () => {
    testEnv = await createTestEnv()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  it('an authenticated user can read the cache', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 0.9 },
        asOf: '2026-01-01',
        fetchedAt: Timestamp.now(),
      })
    })
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(db, 'exchangeRates', 'latest')))
  })

  it('an unauthenticated user cannot read or write the cache', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'exchangeRates', 'latest')))
    await assertFails(
      setDoc(doc(db, 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 1 },
        asOf: '2026-01-01',
        fetchedAt: serverTimestamp(),
      }),
    )
  })

  it('an authenticated user can create the cache when none exists yet', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 0.91 },
        asOf: '2026-01-01',
        fetchedAt: serverTimestamp(),
      }),
    )
  })

  it('an authenticated user can refresh a genuinely stale cache', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const staleTimestamp = Timestamp.fromMillis(Date.now() - 25 * 60 * 60 * 1000)
      await setDoc(doc(ctx.firestore(), 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 0.9 },
        asOf: 'yesterday',
        fetchedAt: staleTimestamp,
      })
    })
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 0.92 },
        asOf: 'today',
        fetchedAt: serverTimestamp(),
      }),
    )
  })

  it('arbitrary authenticated clients cannot overwrite a fresh cache', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 0.9 },
        asOf: 'today',
        fetchedAt: Timestamp.now(),
      })
    })
    const db = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(
      setDoc(doc(db, 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 999 },
        asOf: 'poisoned',
        fetchedAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a malformed payload even when the cache is stale', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const staleTimestamp = Timestamp.fromMillis(Date.now() - 25 * 60 * 60 * 1000)
      await setDoc(doc(ctx.firestore(), 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 0.9 },
        asOf: 'yesterday',
        fetchedAt: staleTimestamp,
      })
    })
    const db = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(
      setDoc(doc(db, 'exchangeRates', 'latest'), {
        base: 'EUR',
        rates: 'not-a-map',
        asOf: 'today',
        fetchedAt: serverTimestamp(),
      }),
    )
  })

  it('cannot write to any exchangeRates document other than "latest"', async () => {
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertFails(
      setDoc(doc(db, 'exchangeRates', 'other'), {
        base: 'USD',
        rates: { EUR: 0.9 },
        asOf: '2026-01-01',
        fetchedAt: serverTimestamp(),
      }),
    )
  })

  it('the cache document cannot be deleted', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'exchangeRates', 'latest'), {
        base: 'USD',
        rates: { EUR: 0.9 },
        asOf: 'today',
        fetchedAt: Timestamp.now(),
      })
    })
    const db = testEnv.authenticatedContext('alice').firestore()
    await assertFails(deleteDoc(doc(db, 'exchangeRates', 'latest')))
  })
})
