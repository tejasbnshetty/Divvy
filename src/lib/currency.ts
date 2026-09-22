/** Currencies supported by Frankfurter (ECB reference rates), the free FX API this app uses. */
export const SUPPORTED_CURRENCIES = [
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export function isRateCacheStale(fetchedAt: Date | null): boolean {
  if (!fetchedAt) return true
  return Date.now() - fetchedAt.getTime() > STALE_AFTER_MS
}

/**
 * Derives the rate to convert `from` -> `to`, given a cache of USD-based
 * rates (`rates[X]` = how many units of X one USD buys). Keeping every cached
 * rate relative to USD means a single daily fetch covers every currency pair
 * in use, at the cost of one extra division here.
 */
export function deriveCrossRate(usdRates: Record<string, number>, from: string, to: string): number | null {
  if (from === to) return 1
  const rateFromUsd = from === 'USD' ? 1 : usdRates[from]
  const rateToUsd = to === 'USD' ? 1 : usdRates[to]
  if (!rateFromUsd || !rateToUsd) return null
  return rateToUsd / rateFromUsd
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}
