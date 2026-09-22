import { describe, expect, it } from 'vitest'
import { classifyInviteStatus, expirationOffsetMs, maxUsesValue } from '../src/lib/invites'

describe('expirationOffsetMs', () => {
  it('returns null for "never"', () => {
    expect(expirationOffsetMs('never')).toBeNull()
  })

  it('converts each timed option to the right millisecond offset', () => {
    expect(expirationOffsetMs('1h')).toBe(60 * 60 * 1000)
    expect(expirationOffsetMs('24h')).toBe(24 * 60 * 60 * 1000)
    expect(expirationOffsetMs('7d')).toBe(7 * 24 * 60 * 60 * 1000)
    expect(expirationOffsetMs('30d')).toBe(30 * 24 * 60 * 60 * 1000)
  })
})

describe('maxUsesValue', () => {
  it('returns null for "unlimited"', () => {
    expect(maxUsesValue('unlimited')).toBeNull()
  })

  it('converts each numeric option to a number', () => {
    expect(maxUsesValue('1')).toBe(1)
    expect(maxUsesValue('5')).toBe(5)
    expect(maxUsesValue('10')).toBe(10)
    expect(maxUsesValue('25')).toBe(25)
  })
})

describe('classifyInviteStatus', () => {
  const now = Date.parse('2026-06-15T12:00:00Z')

  it('is active when nothing is set', () => {
    expect(classifyInviteStatus({ revoked: false, expiresAtMillis: null, maxUses: null, useCount: 0 }, now)).toBe(
      'active',
    )
  })

  it('is active with an unused, unexpired, capped invite', () => {
    expect(
      classifyInviteStatus({ revoked: false, expiresAtMillis: now + 1000, maxUses: 5, useCount: 2 }, now),
    ).toBe('active')
  })

  it('is revoked regardless of any other field', () => {
    expect(
      classifyInviteStatus({ revoked: true, expiresAtMillis: now + 1000, maxUses: null, useCount: 0 }, now),
    ).toBe('revoked')
    expect(classifyInviteStatus({ revoked: true, expiresAtMillis: null, maxUses: 5, useCount: 5 }, now)).toBe(
      'revoked',
    )
  })

  it('is expired once past expiresAt, even if uses remain', () => {
    expect(
      classifyInviteStatus({ revoked: false, expiresAtMillis: now - 1, maxUses: 10, useCount: 0 }, now),
    ).toBe('expired')
  })

  it('is not expired exactly at the expiry instant', () => {
    expect(classifyInviteStatus({ revoked: false, expiresAtMillis: now, maxUses: null, useCount: 0 }, now)).toBe(
      'active',
    )
  })

  it('is exhausted once useCount reaches maxUses', () => {
    expect(classifyInviteStatus({ revoked: false, expiresAtMillis: null, maxUses: 3, useCount: 3 }, now)).toBe(
      'exhausted',
    )
  })

  it('is exhausted rather than active even if useCount somehow exceeds maxUses', () => {
    expect(classifyInviteStatus({ revoked: false, expiresAtMillis: null, maxUses: 3, useCount: 4 }, now)).toBe(
      'exhausted',
    )
  })

  it('prioritizes revoked over expired and exhausted', () => {
    expect(
      classifyInviteStatus({ revoked: true, expiresAtMillis: now - 1, maxUses: 1, useCount: 1 }, now),
    ).toBe('revoked')
  })

  it('prioritizes expired over exhausted when both apply', () => {
    expect(
      classifyInviteStatus({ revoked: false, expiresAtMillis: now - 1, maxUses: 1, useCount: 1 }, now),
    ).toBe('expired')
  })
})
