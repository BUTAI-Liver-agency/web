import { describe, it, expect } from 'vitest'
import { canApprove, markUnder18, verifyAdult } from './ageGuard'
import type { ApprovalTarget } from './ageGuard'

const target = (overrides: Partial<ApprovalTarget> = {}): ApprovalTarget => ({
  ageStatus: 'adult',
  optedOut: false,
  stage: 'prospect',
  ...overrides,
})

describe('canApprove', () => {
  it('18歳以上と確認済みなら承認できる', () => {
    expect(canApprove(target())).toEqual({ allowed: true })
  })

  it('年齢未確認（unverified）では承認できない', () => {
    const decision = canApprove(target({ ageStatus: 'unverified' }))
    expect(decision.allowed).toBe(false)
    expect(decision).toMatchObject({ reason: 'age_not_verified' })
  })

  it('17歳以下（under18）では承認できない', () => {
    const decision = canApprove(target({ ageStatus: 'under18' }))
    expect(decision.allowed).toBe(false)
    expect(decision).toMatchObject({ reason: 'under18' })
  })

  it('18歳以上でもオプトアウト済みなら承認できない', () => {
    const decision = canApprove(target({ optedOut: true }))
    expect(decision.allowed).toBe(false)
    expect(decision).toMatchObject({ reason: 'opted_out' })
  })

  it('対象外ステージなら承認できない', () => {
    const decision = canApprove(target({ stage: 'excluded' }))
    expect(decision.allowed).toBe(false)
    expect(decision).toMatchObject({ reason: 'terminal_stage' })
  })

  it('辞退済みなら承認できない', () => {
    expect(canApprove(target({ stage: 'declined' })).allowed).toBe(false)
  })
})

describe('markUnder18', () => {
  it('17歳以下と判断したら対象外ステージへ移す', () => {
    expect(markUnder18(target())).toEqual({
      ageStatus: 'under18',
      stage: 'excluded',
      ageVerifiedBy: null,
      ageVerifiedAt: null,
    })
  })

  it('移した結果は承認不可になる（キューに復活しない）', () => {
    const after = markUnder18(target())
    expect(canApprove({ ...target(), ...after }).allowed).toBe(false)
  })
})

describe('verifyAdult', () => {
  it('確認者と確認日時を記録して adult にする', () => {
    const now = '2026-09-13T10:00:00.000Z'
    expect(verifyAdult(target({ ageStatus: 'unverified' }), 'user-1', now)).toEqual({
      ageStatus: 'adult',
      stage: 'prospect',
      ageVerifiedBy: 'user-1',
      ageVerifiedAt: now,
    })
  })

  it('一度 under18 にした候補者は adult に戻せない', () => {
    expect(() =>
      verifyAdult(
        target({ ageStatus: 'under18', stage: 'excluded' }),
        'user-1',
        '2026-09-13T10:00:00.000Z',
      ),
    ).toThrow(/under18/)
  })
})
