import { describe, it, expect } from 'vitest'
import { buildMessage } from './messageBuilder'
import { isClean, checkContent } from './contentGuard'
import { TEMPLATES } from '../templates/butai'

describe('buildMessage', () => {
  it('テンプレAの冒頭にAI生成文を差し込む', () => {
    const body = buildMessage('A', { intro: '動画拝見しました。', refCode: 'BT-4X7K' })
    expect(body.startsWith('動画拝見しました。')).toBe(true)
  })

  it('テンプレAに合言葉コードを差し込む', () => {
    const body = buildMessage('A', { intro: 'はい。', refCode: 'BT-4X7K' })
    expect(body).toContain('BT-4X7K')
    expect(body).not.toContain('{ref_code}')
  })

  it('テンプレAに18歳以上である旨の明示を含む', () => {
    const body = buildMessage('A', { intro: 'はい。', refCode: 'BT-4X7K' })
    expect(body).toContain('18歳以上')
  })

  it('テンプレAに会社名と代表者名を含む', () => {
    const body = buildMessage('A', { intro: 'はい。', refCode: 'BT-4X7K' })
    expect(body).toContain('株式会社BUTAI')
    expect(body).toContain('横山')
  })

  it('テンプレAは所属の約束ではない旨を含む', () => {
    const body = buildMessage('A', { intro: 'はい。', refCode: 'BT-4X7K' })
    expect(body).toContain('所属のお約束ではありません')
  })

  it('テンプレBの冒頭にAI生成文を差し込む', () => {
    const body = buildMessage('B', { intro: '以前のコメントを拝見しました。', refCode: 'BT-4X7K' })
    expect(body.startsWith('以前のコメントを拝見しました。')).toBe(true)
    expect(body).toContain('18歳以上')
  })

  it('差し込み後のプレースホルダが残らない', () => {
    for (const id of ['A', 'B'] as const) {
      const body = buildMessage(id, { intro: 'はい。', refCode: 'BT-4X7K' })
      expect(body).not.toMatch(/\{[a-z_]+\}/)
    }
  })

  it('AI生成文に含まれるプレースホルダ様の文字列は置換しない', () => {
    const body = buildMessage('A', { intro: '{ref_code}が気になります。', refCode: 'BT-4X7K' })
    expect(body).toContain('{ref_code}が気になります。')
  })

  it('テンプレBにはAI生成文を経由しても合言葉が混入しない', () => {
    const body = buildMessage('B', { intro: '{ref_code}のことです。', refCode: 'BT-4X7K' })
    expect(body).not.toContain('BT-4X7K')
  })
})

describe('固定文面そのものが安全機構を通る', () => {
  it('テンプレA・Bの固定文面に禁止ワードもURLも含まれない', () => {
    for (const id of ['A', 'B'] as const) {
      const violations = checkContent(TEMPLATES[id].body)
      expect(violations).toEqual([])
    }
  })

  it('組み立て後の全文もURLガードを通る', () => {
    const body = buildMessage('A', { intro: '素敵な動画ですね。', refCode: 'BT-4X7K' })
    expect(isClean(body)).toBe(true)
  })
})
