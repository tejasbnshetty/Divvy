import { describe, expect, it } from 'vitest'
import { resolveSplits } from '../src/lib/splitCalculation'

function sumOf(splits: { shareAmount: number }[]) {
  return Math.round(splits.reduce((a, s) => a + s.shareAmount, 0) * 100) / 100
}

describe('resolveSplits', () => {
  it('splits an amount evenly and exactly, distributing the odd cent', () => {
    const { splits, error } = resolveSplits('equal', 10, [
      { memberId: 'a', included: true, rawValue: '' },
      { memberId: 'b', included: true, rawValue: '' },
      { memberId: 'c', included: true, rawValue: '' },
    ])
    expect(error).toBeNull()
    expect(sumOf(splits)).toBe(10)
    // 10 / 3 = 3.33, 3.33, 3.34 (largest remainder gets the extra cent)
    const amounts = splits.map((s) => s.shareAmount).sort()
    expect(amounts).toEqual([3.33, 3.33, 3.34])
  })

  it('excludes unchecked members from an equal split', () => {
    const { splits } = resolveSplits('equal', 20, [
      { memberId: 'a', included: true, rawValue: '' },
      { memberId: 'b', included: false, rawValue: '' },
    ])
    expect(splits).toEqual([{ memberId: 'a', shareAmount: 20, shareRaw: null }])
  })

  it('accepts exact amounts that sum to the total', () => {
    const { splits, error } = resolveSplits('exact', 30, [
      { memberId: 'a', included: true, rawValue: '20' },
      { memberId: 'b', included: true, rawValue: '10' },
    ])
    expect(error).toBeNull()
    expect(sumOf(splits)).toBe(30)
  })

  it('rejects exact amounts that do not sum to the total', () => {
    const { error } = resolveSplits('exact', 30, [
      { memberId: 'a', included: true, rawValue: '20' },
      { memberId: 'b', included: true, rawValue: '5' },
    ])
    expect(error).not.toBeNull()
  })

  it('resolves percentage splits and rejects ones that do not sum to 100', () => {
    const ok = resolveSplits('percentage', 50, [
      { memberId: 'a', included: true, rawValue: '60' },
      { memberId: 'b', included: true, rawValue: '40' },
    ])
    expect(ok.error).toBeNull()
    expect(sumOf(ok.splits)).toBe(50)

    const bad = resolveSplits('percentage', 50, [
      { memberId: 'a', included: true, rawValue: '60' },
      { memberId: 'b', included: true, rawValue: '30' },
    ])
    expect(bad.error).not.toBeNull()
  })

  it('resolves share-based splits proportionally', () => {
    const { splits, error } = resolveSplits('shares', 30, [
      { memberId: 'a', included: true, rawValue: '2' },
      { memberId: 'b', included: true, rawValue: '1' },
    ])
    expect(error).toBeNull()
    expect(sumOf(splits)).toBe(30)
    expect(splits.find((s) => s.memberId === 'a')?.shareAmount).toBe(20)
    expect(splits.find((s) => s.memberId === 'b')?.shareAmount).toBe(10)
  })

  it('errors when nobody is selected', () => {
    const { error } = resolveSplits('equal', 10, [{ memberId: 'a', included: false, rawValue: '' }])
    expect(error).not.toBeNull()
  })
})
