import type { ExpenseSplit, SplitType } from '../types/models'

export interface SplitEntryInput {
  memberId: string
  included: boolean
  /** Raw text input for exact/percentage/shares modes; ignored for 'equal'. */
  rawValue: string
}

export interface ResolvedSplits {
  splits: ExpenseSplit[]
  error: string | null
}

const EPSILON = 0.005

/** Distributes `totalCents` across `weights` (largest-remainder method) so the parts always sum exactly to the total. */
function distributeByWeight(totalCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0) return weights.map(() => 0)

  const raw = weights.map((w) => (w / totalWeight) * totalCents)
  const floors = raw.map(Math.floor)
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0)

  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)

  const result = [...floors]
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
    result[order[k].i] += 1
  }
  return result
}

export function resolveSplits(splitType: SplitType, totalAmount: number, entries: SplitEntryInput[]): ResolvedSplits {
  const included = entries.filter((e) => e.included)
  if (included.length === 0) {
    return { splits: [], error: 'Pick at least one person to split with.' }
  }

  const totalCents = Math.round(totalAmount * 100)

  if (splitType === 'equal') {
    const cents = distributeByWeight(totalCents, included.map(() => 1))
    return {
      splits: included.map((e, i) => ({ memberId: e.memberId, shareAmount: cents[i] / 100, shareRaw: null })),
      error: null,
    }
  }

  if (splitType === 'exact') {
    const values = included.map((e) => Number(e.rawValue) || 0)
    const sum = values.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - totalAmount) > EPSILON) {
      return { splits: [], error: `Exact amounts add up to ${sum.toFixed(2)}, but the total is ${totalAmount.toFixed(2)}.` }
    }
    return {
      splits: included.map((e, i) => ({ memberId: e.memberId, shareAmount: values[i], shareRaw: values[i] })),
      error: null,
    }
  }

  if (splitType === 'percentage') {
    const values = included.map((e) => Number(e.rawValue) || 0)
    const sum = values.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 100) > EPSILON) {
      return { splits: [], error: `Percentages add up to ${sum.toFixed(1)}%, but should total 100%.` }
    }
    const cents = distributeByWeight(totalCents, values)
    return {
      splits: included.map((e, i) => ({ memberId: e.memberId, shareAmount: cents[i] / 100, shareRaw: values[i] })),
      error: null,
    }
  }

  // shares
  const values = included.map((e) => Number(e.rawValue) || 0)
  if (values.every((v) => v <= 0)) {
    return { splits: [], error: 'Enter at least one share.' }
  }
  const cents = distributeByWeight(totalCents, values)
  return {
    splits: included.map((e, i) => ({ memberId: e.memberId, shareAmount: cents[i] / 100, shareRaw: values[i] })),
    error: null,
  }
}
