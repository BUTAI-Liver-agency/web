import { describe, it, expect } from 'vitest'
import { availableTemplates, canUseTemplate } from './templateRules'
import type { ApprovalTarget } from './ageGuard'
import type { MessageRecord, TemplateId } from './types'

const target = (overrides: Partial<ApprovalTarget> = {}): ApprovalTarget => ({
  ageStatus: 'adult',
  optedOut: false,
  stage: 'prospect',
  ...overrides,
})

const sentMessage = (templateId: TemplateId): MessageRecord => ({
  id: `msg-${templateId}`,
  candidateId: 'cand-1',
  templateId,
  body: '本文',
  sentAt: '2026-09-01T00:00:00.000Z',
  sentBy: 'user-1',
})

describe('availableTemplates', () => {
  it('未送信の18歳以上にはテンプレAのみ選べる', () => {
    expect(availableTemplates(target(), [])).toEqual(['A'])
  })

  it('テンプレA送信済みならテンプレBも選べる', () => {
    expect(availableTemplates(target(), [sentMessage('A')])).toEqual(['A', 'B'])
  })

  it('テンプレB送信済みならテンプレBは選べない（1候補者につき1回まで）', () => {
    expect(availableTemplates(target(), [sentMessage('A'), sentMessage('B')])).toEqual(['A'])
  })

  it('テンプレAが未送信ならテンプレBは選べない', () => {
    expect(availableTemplates(target(), [sentMessage('B')])).toEqual(['A'])
  })

  it('年齢未確認ではどのテンプレも選べない', () => {
    expect(availableTemplates(target({ ageStatus: 'unverified' }), [])).toEqual([])
  })

  it('17歳以下ではどのテンプレも選べない', () => {
    expect(availableTemplates(target({ ageStatus: 'under18' }), [])).toEqual([])
  })

  it('オプトアウト済みではどのテンプレも選べない', () => {
    expect(availableTemplates(target({ optedOut: true }), [sentMessage('A')])).toEqual([])
  })
})

describe('canUseTemplate', () => {
  it('テンプレA未送信ではテンプレBを使えない', () => {
    expect(canUseTemplate(target(), [], 'B')).toBe(false)
  })

  it('テンプレA送信済みならテンプレBを使える', () => {
    expect(canUseTemplate(target(), [sentMessage('A')], 'B')).toBe(true)
  })
})
