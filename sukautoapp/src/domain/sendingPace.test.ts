import { describe, it, expect } from 'vitest'
import {
  DEFAULT_DAILY_LIMIT,
  countSentOn,
  remainingQuota,
  canSendNow,
  toJstDate,
  todayInJst,
} from './sendingPace'
import type { MessageRecord } from './types'

const msg = (sentAt: string): MessageRecord => ({
  id: `msg-${sentAt}`,
  candidateId: 'cand-1',
  templateId: 'A',
  body: '本文',
  sentAt,
  sentBy: 'user-1',
})

describe('DEFAULT_DAILY_LIMIT', () => {
  it('初期値は20件である', () => {
    expect(DEFAULT_DAILY_LIMIT).toBe(20)
  })
})

describe('countSentOn', () => {
  it('指定日（日本時間）に送った件数だけを数える', () => {
    const messages = [
      msg('2026-09-13T01:00:00.000Z'), // JST 2026-09-13 10:00
      msg('2026-09-13T14:00:00.000Z'), // JST 2026-09-13 23:00
      msg('2026-09-13T15:00:00.000Z'), // JST 2026-09-14 00:00 → 翌日扱い
    ]
    expect(countSentOn(messages, '2026-09-13')).toBe(2)
  })

  it('該当日の送信がなければ0を返す', () => {
    expect(countSentOn([], '2026-09-13')).toBe(0)
  })
})

describe('toJstDate', () => {
  it('UTCの15時は翌日の日本時間になる', () => {
    expect(toJstDate('2026-09-13T15:00:00.000Z')).toBe('2026-09-14')
  })

  it('オフセット付きの表記もZ表記と同じ日に正規化する', () => {
    expect(toJstDate('2026-09-13T10:00:00+09:00')).toBe(toJstDate('2026-09-13T01:00:00.000Z'))
  })

  it('日時として解釈できない文字列は例外にする', () => {
    expect(() => toJstDate('not-a-date')).toThrow(/解釈できません/)
  })
})

describe('todayInJst', () => {
  it('与えた時刻を日本時間の日付に変換する', () => {
    expect(todayInJst(new Date('2026-09-13T15:00:00.000Z'))).toBe('2026-09-14')
  })
})

describe('remainingQuota', () => {
  it('上限から本日の送信数を引いた残り枠を返す', () => {
    expect(remainingQuota({ dailyLimit: 20, sentToday: 7 })).toBe(13)
  })

  it('上限を超えていても負の値を返さない', () => {
    expect(remainingQuota({ dailyLimit: 20, sentToday: 25 })).toBe(0)
  })
})

describe('canSendNow', () => {
  it('残り枠があれば送信できる', () => {
    expect(canSendNow({ dailyLimit: 20, sentToday: 19 })).toBe(true)
  })

  it('上限ちょうどに達したら送信できない', () => {
    expect(canSendNow({ dailyLimit: 20, sentToday: 20 })).toBe(false)
  })

  it('上限を超えていたら送信できない', () => {
    expect(canSendNow({ dailyLimit: 20, sentToday: 21 })).toBe(false)
  })

  it('上限が0なら1件も送信できない', () => {
    expect(remainingQuota({ dailyLimit: 0, sentToday: 0 })).toBe(0)
    expect(canSendNow({ dailyLimit: 0, sentToday: 0 })).toBe(false)
  })
})
