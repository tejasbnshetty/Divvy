export type ExpirationOption = 'never' | '1h' | '24h' | '7d' | '30d'
export type MaxUsesOption = 'unlimited' | '1' | '5' | '10' | '25'

export const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string }[] = [
  { value: 'never', label: 'Never expires' },
  { value: '1h', label: 'Expires in 1 hour' },
  { value: '24h', label: 'Expires in 24 hours' },
  { value: '7d', label: 'Expires in 7 days' },
  { value: '30d', label: 'Expires in 30 days' },
]

export const MAX_USES_OPTIONS: { value: MaxUsesOption; label: string }[] = [
  { value: 'unlimited', label: 'Unlimited uses' },
  { value: '1', label: '1 use' },
  { value: '5', label: '5 uses' },
  { value: '10', label: '10 uses' },
  { value: '25', label: '25 uses' },
]

const EXPIRATION_OFFSET_MS: Record<Exclude<ExpirationOption, 'never'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/** Converts an expiration choice into a millis-from-now offset, or null for "never". */
export function expirationOffsetMs(option: ExpirationOption): number | null {
  if (option === 'never') return null
  return EXPIRATION_OFFSET_MS[option]
}

/** Converts a max-uses choice into the stored `maxUses` value, or null for "unlimited". */
export function maxUsesValue(option: MaxUsesOption): number | null {
  if (option === 'unlimited') return null
  return Number(option)
}

export type InviteStatus = 'active' | 'revoked' | 'expired' | 'exhausted'

export interface InviteLike {
  revoked: boolean
  expiresAtMillis: number | null
  maxUses: number | null
  useCount: number
}

/**
 * Classifies an invite's current display status. This is for the UI only —
 * it mirrors the same checks redeemInviteCode's transaction makes, but
 * Firestore rules and that transaction remain the actual authority over
 * whether a code can be redeemed.
 */
export function classifyInviteStatus(invite: InviteLike, nowMillis: number): InviteStatus {
  if (invite.revoked) return 'revoked'
  if (invite.expiresAtMillis !== null && invite.expiresAtMillis < nowMillis) return 'expired'
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return 'exhausted'
  return 'active'
}
