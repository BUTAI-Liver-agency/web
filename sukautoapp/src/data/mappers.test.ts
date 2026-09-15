import { describe, it, expect } from 'vitest'
import { mapCandidateRow, mapMessageRow, type CandidateRow, type MessageRow } from './mappers'

describe('mapCandidateRow', () => {
  it('snake_case の行を camelCase のドメイン型へ変換する', () => {
    const row: CandidateRow = {
      id: 'c1',
      tiktok_handle: 'yuki_live',
      ref_code: 'BT-4X7K',
      display_name: 'ゆき',
      comment_text: '興味あります',
      source_video_id: 'v1',
      age_status: 'unverified',
      age_verified_by: null,
      age_verified_at: null,
      stage: 'prospect',
      assignee_id: null,
      opted_out: false,
      created_at: '2026-09-13T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
    }
    expect(mapCandidateRow(row)).toEqual({
      id: 'c1',
      tiktokHandle: 'yuki_live',
      refCode: 'BT-4X7K',
      displayName: 'ゆき',
      commentText: '興味あります',
      sourceVideoId: 'v1',
      ageStatus: 'unverified',
      ageVerifiedBy: null,
      ageVerifiedAt: null,
      stage: 'prospect',
      assigneeId: null,
      optedOut: false,
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: '2026-09-13T00:00:00.000Z',
    })
  })

  it('source_video_id が null でも変換できる', () => {
    const row: CandidateRow = {
      id: 'c1',
      tiktok_handle: 'a',
      ref_code: 'BT-AAAA',
      display_name: 'a',
      comment_text: 'a',
      source_video_id: null,
      age_status: 'adult',
      age_verified_by: 'u1',
      age_verified_at: '2026-09-13T00:00:00.000Z',
      stage: 'dm_sent',
      assignee_id: 'u1',
      opted_out: false,
      created_at: '2026-09-13T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
    }
    expect(mapCandidateRow(row).sourceVideoId).toBeNull()
  })
})

describe('mapMessageRow', () => {
  it('snake_case の行を camelCase のドメイン型へ変換する', () => {
    const row: MessageRow = {
      id: 'm1',
      candidate_id: 'c1',
      template_id: 'A',
      body: '本文',
      sent_at: '2026-09-13T01:00:00.000Z',
      sent_by: 'u1',
    }
    expect(mapMessageRow(row)).toEqual({
      id: 'm1',
      candidateId: 'c1',
      templateId: 'A',
      body: '本文',
      sentAt: '2026-09-13T01:00:00.000Z',
      sentBy: 'u1',
    })
  })
})
