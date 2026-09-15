import { describe, it, expect } from 'vitest'
import { generateRefCode, generateUniqueRefCode, normalizeRefCode, REF_CODE_ALPHABET } from './refCode'

describe('generateRefCode', () => {
  it('BT- で始まり4文字が続く形式を返す', () => {
    expect(generateRefCode()).toMatch(/^BT-[A-Z0-9]{4}$/)
  })

  it('紛らわしい文字（0 O 1 I）を含まない', () => {
    for (const ambiguous of ['0', 'O', '1', 'I']) {
      expect(REF_CODE_ALPHABET).not.toContain(ambiguous)
    }
  })

  it('乱数生成器を差し替えると決定的な値を返す', () => {
    const first = REF_CODE_ALPHABET[0]
    expect(generateRefCode(() => 0)).toBe(`BT-${first.repeat(4)}`)
  })

  it('1000回生成して重複が極端に多くならない', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateRefCode()))
    // 32^4 = 1,048,576 通り。1000件なら重複はほぼ出ない
    expect(codes.size).toBeGreaterThan(995)
  })
})

describe('generateUniqueRefCode', () => {
  it('既に使われているコードは返さない', () => {
    const first = REF_CODE_ALPHABET[0]
    const used = new Set([`BT-${first.repeat(4)}`])
    // 1回目は常に先頭文字、2回目以降は別の文字を返す乱数
    let call = 0
    const rand = () => (call++ < 4 ? 0 : 0.5)
    const code = generateUniqueRefCode(used, rand)
    expect(code).not.toBe(`BT-${first.repeat(4)}`)
  })

  it('採番したコードを used に追加して同一バッチ内の重複を防ぐ', () => {
    const used = new Set<string>()
    const a = generateUniqueRefCode(used)
    const b = generateUniqueRefCode(used)
    expect(a).not.toBe(b)
    expect(used.has(a)).toBe(true)
    expect(used.has(b)).toBe(true)
  })

  it('空き番が見つからない場合は例外にする', () => {
    const first = REF_CODE_ALPHABET[0]
    const used = new Set([`BT-${first.repeat(4)}`])
    // 常に同じコードしか生成しない乱数
    expect(() => generateUniqueRefCode(used, () => 0)).toThrow(/採番できませんでした/)
  })
})

describe('normalizeRefCode', () => {
  it('全角で入力されたコードを半角に正規化する', () => {
    expect(normalizeRefCode('ＢＴ－４Ｘ７Ｋ')).toBe('BT-4X7K')
  })

  it('小文字と前後の空白を吸収する', () => {
    expect(normalizeRefCode('  bt-4x7k  ')).toBe('BT-4X7K')
  })

  it('長音記号もハイフンとして扱う', () => {
    expect(normalizeRefCode('BTー4X7K')).toBe('BT-4X7K')
  })
})
