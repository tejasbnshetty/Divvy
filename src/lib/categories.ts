export const EXPENSE_CATEGORIES = [
  { value: 'food', label: 'Food', emoji: '🍕' },
  { value: 'transport', label: 'Transport', emoji: '🚕' },
  { value: 'lodging', label: 'Lodging', emoji: '🏠' },
  { value: 'activities', label: 'Activities', emoji: '🎟️' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'other', label: 'Other', emoji: '✨' },
] as const

export function emojiForCategory(category: string | null): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.emoji ?? '✨'
}
