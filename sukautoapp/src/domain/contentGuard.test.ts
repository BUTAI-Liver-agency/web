import { describe, it, expect } from 'vitest'
import { checkContent, isClean, BANNED_WORDS } from './contentGuard'

describe('checkContent', () => {
  it('問題のない文面では違反を返さない', () => {
    expect(checkContent('動画拝見しました。素敵な雰囲気ですね。')).toEqual([])
  })

  it('報酬に言及したら違反を返す', () => {
    const violations = checkContent('月収30万円も可能です')
    expect(violations.some((v) => v.kind === 'banned_word')).toBe(true)
  })

  it('収入保証を示唆したら違反を返す', () => {
    expect(checkContent('稼げることを保証します').length).toBeGreaterThan(0)
  })

  it('ノルマなど契約条件に言及したら違反を返す', () => {
    expect(checkContent('ノルマはありません').length).toBeGreaterThan(0)
  })

  it('https のURLを違反として検出する', () => {
    const violations = checkContent('詳しくは https://example.com をご覧ください')
    expect(violations.some((v) => v.kind === 'url')).toBe(true)
  })

  it('http のURLを違反として検出する', () => {
    expect(checkContent('http://example.com').some((v) => v.kind === 'url')).toBe(true)
  })

  it('www. から始まる表記を違反として検出する', () => {
    expect(checkContent('www.example.com へどうぞ').some((v) => v.kind === 'url')).toBe(true)
  })

  it('プロトコルなしのドメイン表記を違反として検出する', () => {
    expect(
      checkContent('butai-liver-agency.github.io を見てね').some((v) => v.kind === 'url'),
    ).toBe(true)
  })

  it('日本語の文中の句点をドメインと誤検出しない', () => {
    expect(checkContent('はじめまして。株式会社BUTAIです。')).toEqual([])
  })

  it('複数の違反をすべて返す', () => {
    const violations = checkContent('月収を保証します https://example.com')
    expect(violations.length).toBeGreaterThanOrEqual(2)
  })
})

describe('isClean', () => {
  it('違反がなければ true を返す', () => {
    expect(isClean('コメントありがとうございます。')).toBe(true)
  })

  it('違反があれば false を返す', () => {
    expect(isClean('必ず稼げます')).toBe(false)
  })
})

describe('BANNED_WORDS', () => {
  it('設計書 7.3 の禁止カテゴリを網羅している', () => {
    for (const word of ['報酬', '収入', '月収', '保証', '稼げ', 'ノルマ', '契約期間']) {
      expect(BANNED_WORDS).toContain(word)
    }
  })
})
