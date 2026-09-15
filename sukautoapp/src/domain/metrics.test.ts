import { describe, it, expect } from 'vitest'
import { funnelByVideo, funnelByTemplate, funnelByAssignee } from './metrics'
import type { Candidate, MessageRecord, Stage } from './types'

const candidate = (id: string, stage: Stage, videoId: string): Candidate => ({
  id,
  tiktokHandle: id,
  refCode: `BT-${id}`,
  displayName: id,
  commentText: 'コメント',
  sourceVideoId: videoId,
  ageStatus: 'adult',
  ageVerifiedBy: 'u1',
  ageVerifiedAt: '2026-09-13T00:00:00.000Z',
  stage,
  assigneeId: 'u1',
  optedOut: false,
  createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z',
})

const message = (candidateId: string, templateId: 'A' | 'B'): MessageRecord => ({
  id: `m-${candidateId}-${templateId}`,
  candidateId,
  templateId,
  body: '本文',
  sentAt: '2026-09-13T00:00:00.000Z',
  sentBy: 'u1',
})

/** 送信者を指定したメッセージ。担当者別の集計で使う。 */
const sentByMessage = (
  candidateId: string,
  templateId: 'A' | 'B',
  sentBy: string,
): MessageRecord => ({
  ...message(candidateId, templateId),
  id: `m-${candidateId}-${templateId}-${sentBy}`,
  sentBy,
})

describe('funnelByVideo', () => {
  it('動画ごとにコメント数・送信数・LINE到達数・契約数を集計する', () => {
    const candidates = [
      candidate('a', 'contracted', 'v1'),
      candidate('b', 'line_reached', 'v1'),
      candidate('c', 'prospect', 'v1'),
    ]
    const messages = [message('a', 'A'), message('b', 'A')]
    const videos = [{ id: 'v1', title: '募集動画1', commentCountCollected: 10 }]

    expect(funnelByVideo(candidates, messages, videos)).toEqual([
      {
        videoId: 'v1',
        title: '募集動画1',
        commentsCollected: 10,
        candidates: 3,
        sent: 2,
        replied: 2,
        lineReached: 2,
        meetingSet: 1,
        contracted: 1,
        replyRate: 1,
        lineReachRate: 1,
      },
    ])
  })

  it('反応ありの候補者は返信率には入るがLINE到達率には入らない', () => {
    const candidates = [candidate('a', 'responded', 'v1'), candidate('b', 'dm_sent', 'v1')]
    const messages = [message('a', 'A'), message('b', 'A')]
    const videos = [{ id: 'v1', title: '募集動画1', commentCountCollected: 2 }]

    const row = funnelByVideo(candidates, messages, videos)[0]
    expect(row.replied).toBe(1)
    expect(row.replyRate).toBe(0.5)
    expect(row.lineReached).toBe(0)
    expect(row.lineReachRate).toBe(0)
  })

  it('送信数が0でも到達率の計算で例外を投げない', () => {
    const videos = [{ id: 'v1', title: '募集動画1', commentCountCollected: 0 }]
    expect(funnelByVideo([], [], videos)[0].lineReachRate).toBe(0)
  })
})

describe('funnelByTemplate', () => {
  it('テンプレごとに送信数とLINE到達数を集計する', () => {
    const candidates = [candidate('a', 'line_reached', 'v1'), candidate('b', 'dm_sent', 'v1')]
    const messages = [message('a', 'A'), message('b', 'A'), message('b', 'B')]

    const result = funnelByTemplate(candidates, messages)
    expect(result.find((r) => r.templateId === 'A')).toEqual({
      templateId: 'A',
      sent: 2,
      replied: 1,
      lineReached: 1,
      replyRate: 0.5,
      lineReachRate: 0.5,
    })
    expect(result.find((r) => r.templateId === 'B')).toEqual({
      templateId: 'B',
      sent: 1,
      replied: 0,
      lineReached: 0,
      replyRate: 0,
      lineReachRate: 0,
    })
  })
})

describe('funnelByVideo の母集団', () => {
  it('DMを送っていない候補者は到達数にも送信数にも含めない', () => {
    // b はステージだけ手で進められた想定（パイプライン画面での直接変更）
    const candidates = [
      candidate('a', 'line_reached', 'v1'),
      candidate('b', 'line_reached', 'v1'),
    ]
    const messages = [message('a', 'A')]
    const videos = [{ id: 'v1', title: '募集動画1', commentCountCollected: 5 }]

    const row = funnelByVideo(candidates, messages, videos)[0]
    expect(row.sent).toBe(1)
    expect(row.lineReached).toBe(1)
    expect(row.lineReachRate).toBe(1)
  })

  it('到達率が100%を超えない', () => {
    const candidates = [
      candidate('a', 'contracted', 'v1'),
      candidate('b', 'contracted', 'v1'),
      candidate('c', 'meeting_set', 'v1'),
    ]
    const messages = [message('a', 'A')]
    const videos = [{ id: 'v1', title: '募集動画1', commentCountCollected: 5 }]

    const row = funnelByVideo(candidates, messages, videos)[0]
    expect(row.lineReachRate).toBeLessThanOrEqual(1)
    expect(row.contracted).toBe(1)
  })
})

describe('funnelByAssignee', () => {
  it('送信数・到達数・MTG数を担当者ごとに集計する', () => {
    const candidates = [candidate('a', 'meeting_set', 'v1'), candidate('b', 'dm_sent', 'v1')]
    const messages = [sentByMessage('a', 'A', 'u1'), sentByMessage('b', 'A', 'u1')]

    expect(funnelByAssignee(candidates, messages)).toEqual([
      {
        assigneeId: 'u1',
        sent: 2,
        replied: 1,
        lineReached: 1,
        meetingSet: 1,
        replyRate: 0.5,
        lineReachRate: 0.5,
      },
    ])
  })

  it('複数の担当者が同じ候補者に送っても、最初に送った担当者だけに計上する', () => {
    const candidates = [candidate('a', 'line_reached', 'v1')]
    const messages = [
      { ...sentByMessage('a', 'A', 'u1'), sentAt: '2026-09-13T01:00:00.000Z' },
      { ...sentByMessage('a', 'B', 'u2'), sentAt: '2026-09-13T02:00:00.000Z' },
    ]

    const result = funnelByAssignee(candidates, messages)
    expect(result).toEqual([
      {
        assigneeId: 'u1',
        sent: 1,
        replied: 1,
        lineReached: 1,
        meetingSet: 0,
        replyRate: 1,
        lineReachRate: 1,
      },
    ])
    // 合計が実際の候補者数を超えないこと
    expect(result.reduce((sum, r) => sum + r.lineReached, 0)).toBe(1)
  })

  it('送信がなければ空配列を返す', () => {
    expect(funnelByAssignee([], [])).toEqual([])
  })
})
