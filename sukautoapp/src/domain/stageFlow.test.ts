import { describe, it, expect } from 'vitest'
import { canChangeStage, isQueueable, stageChangeDenialMessage } from './stageFlow'

describe('canChangeStage', () => {
  it('前に進む変更は許可する', () => {
    expect(canChangeStage('dm_sent', 'line_reached')).toEqual({ allowed: true })
  })

  it('同じステージへの変更は許可する', () => {
    expect(canChangeStage('contracted', 'contracted')).toEqual({ allowed: true })
  })

  it('後ろへ戻す変更は拒否する', () => {
    expect(canChangeStage('meeting_set', 'line_reached')).toEqual({
      allowed: false,
      reason: 'backwards',
    })
  })

  it('契約から見込みへ戻すことはできない', () => {
    expect(canChangeStage('contracted', 'prospect').allowed).toBe(false)
  })

  it('対象外からは戻せない（17歳以下の除外を取り消せない）', () => {
    expect(canChangeStage('excluded', 'prospect')).toEqual({ allowed: false, reason: 'terminal' })
  })

  it('連絡不要からは戻せない', () => {
    expect(canChangeStage('opted_out', 'dm_sent')).toEqual({ allowed: false, reason: 'terminal' })
  })

  it('辞退からは戻せない', () => {
    expect(canChangeStage('declined', 'responded').allowed).toBe(false)
  })

  it('終端ステージへはどこからでも移せる', () => {
    expect(canChangeStage('contracted', 'declined')).toEqual({ allowed: true })
    expect(canChangeStage('prospect', 'excluded')).toEqual({ allowed: true })
  })

  it('無反応から再開できる', () => {
    expect(canChangeStage('no_response', 'responded')).toEqual({ allowed: true })
  })

  it('送信不可から再開できる', () => {
    expect(canChangeStage('undeliverable', 'dm_sent')).toEqual({ allowed: true })
  })

  it('無反応から見込みへは戻せない（二度目のDMを防ぐ）', () => {
    expect(canChangeStage('no_response', 'prospect')).toEqual({
      allowed: false,
      reason: 'backwards',
    })
  })

  it('送信不可から見込みへは戻せない', () => {
    expect(canChangeStage('undeliverable', 'prospect').allowed).toBe(false)
  })

  it('DM送信済みから見込みへは戻せない', () => {
    expect(canChangeStage('dm_sent', 'prospect').allowed).toBe(false)
  })
})

describe('isQueueable', () => {
  it('見込みで連絡拒否されていない候補者だけをキューに出す', () => {
    expect(isQueueable({ stage: 'prospect', optedOut: false })).toBe(true)
    expect(isQueueable({ stage: 'prospect', optedOut: true })).toBe(false)
    expect(isQueueable({ stage: 'dm_sent', optedOut: false })).toBe(false)
    expect(isQueueable({ stage: 'excluded', optedOut: false })).toBe(false)
  })
})

describe('stageChangeDenialMessage', () => {
  it('終端からの復帰は取り消せない旨を伝える', () => {
    expect(stageChangeDenialMessage('terminal')).toMatch(/元に戻せません/)
  })

  it('後退は前の段階へ戻せない旨を伝える', () => {
    expect(stageChangeDenialMessage('backwards')).toMatch(/前の段階へ戻すことはできません/)
  })
})
