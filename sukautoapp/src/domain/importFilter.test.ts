import { describe, it, expect } from 'vitest'
import { filterImport } from './importFilter'
import type { ImportRow } from './types'
import type { ExistingCandidate } from './importFilter'

const row = (handle: string): ImportRow => ({
  tiktokHandle: handle,
  displayName: handle,
  commentText: 'テストコメント',
})

const existing = (
  handle: string,
  overrides: Partial<ExistingCandidate> = {},
): ExistingCandidate => ({
  tiktokHandle: handle,
  optedOut: false,
  ageStatus: 'unverified',
  stage: 'prospect',
  ...overrides,
})

describe('filterImport', () => {
  it('既存に無い候補者はそのまま取り込む', () => {
    const result = filterImport([row('yuki_live')], [])
    expect(result.toInsert).toHaveLength(1)
    expect(result.skipped).toHaveLength(0)
  })

  it('既に登録済みのハンドルは duplicate として除外する', () => {
    const result = filterImport([row('yuki_live')], [existing('yuki_live')])
    expect(result.toInsert).toHaveLength(0)
    expect(result.skipped).toEqual([
      { row: row('yuki_live'), reason: 'duplicate' },
    ])
  })

  it('オプトアウト済みの候補者は opted_out として除外し、復活させない', () => {
    const result = filterImport(
      [row('yuki_live')],
      [existing('yuki_live', { optedOut: true })],
    )
    expect(result.toInsert).toHaveLength(0)
    expect(result.skipped[0].reason).toBe('opted_out')
  })

  it('17歳以下（under18）の候補者は excluded として除外し、復活させない', () => {
    const result = filterImport(
      [row('yuki_live')],
      [existing('yuki_live', { ageStatus: 'under18', stage: 'excluded' })],
    )
    expect(result.toInsert).toHaveLength(0)
    expect(result.skipped[0].reason).toBe('excluded')
  })

  it('対象外ステージの候補者は excluded として除外する', () => {
    const result = filterImport(
      [row('yuki_live')],
      [existing('yuki_live', { stage: 'excluded' })],
    )
    expect(result.skipped[0].reason).toBe('excluded')
  })

  it('取り込むバッチ内の重複も1件にまとめる', () => {
    const result = filterImport([row('yuki_live'), row('yuki_live')], [])
    expect(result.toInsert).toHaveLength(1)
    expect(result.skipped).toEqual([
      { row: row('yuki_live'), reason: 'duplicate' },
    ])
  })

  it('大文字小文字や@の有無が違っても同一人物として重複判定する', () => {
    const result = filterImport([row('@Yuki_LIVE')], [existing('yuki_live')])
    expect(result.toInsert).toHaveLength(0)
    expect(result.skipped[0].reason).toBe('duplicate')
  })

  it('除外理由の内訳を集計して返す', () => {
    const result = filterImport(
      [row('a'), row('b'), row('c')],
      [existing('a'), existing('b', { optedOut: true })],
    )
    expect(result.summary).toEqual({
      inserted: 1,
      duplicate: 1,
      opted_out: 1,
      excluded: 0,
    })
  })

  it('既存側のハンドルが正規化されていなくても重複として除外する', () => {
    const result = filterImport([row('yuki_live')], [existing('@Yuki_LIVE')])
    expect(result.toInsert).toHaveLength(0)
    expect(result.skipped[0].reason).toBe('duplicate')
  })

  it('オプトアウトと対象外が重なった場合はオプトアウトを理由として返す', () => {
    const result = filterImport(
      [row('yuki_live')],
      [existing('yuki_live', { optedOut: true, stage: 'excluded', ageStatus: 'under18' })],
    )
    expect(result.toInsert).toHaveLength(0)
    expect(result.skipped[0].reason).toBe('opted_out')
  })

  it('取り込む行のハンドルを正規化して格納する', () => {
    const result = filterImport([row('@Yuki_LIVE')], [])
    expect(result.toInsert).toEqual([
      { tiktokHandle: 'yuki_live', displayName: '@Yuki_LIVE', commentText: 'テストコメント' },
    ])
  })
})
