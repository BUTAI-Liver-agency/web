export interface GuardViolation {
  kind: 'url' | 'banned_word'
  matched: string
}

/**
 * 文面に含めてはならない語（設計書 7.3）。
 * 事務所HPが「収入額は保証しない」と明記しているため、
 * 文面がHPより踏み込んだ約束をすることを構造的に防ぐ。
 */
export const BANNED_WORDS: readonly string[] = [
  '報酬',
  '収入',
  '月収',
  '年収',
  '時給',
  '日給',
  '収益',
  '保証',
  '稼げ',
  '稼ご',
  'ノルマ',
  '契約期間',
  '絶対',
  '必ず',
] as const

/** スパム判定回避のため、文面にURLを含めない（設計書 7.3 / 8）。 */
const URL_PATTERNS: RegExp[] = [
  /https?:\/\/[^\s]+/gi,
  /\bwww\.[^\s]+/gi,
  // プロトコルなしのドメイン表記。既知のTLDに限定し、日本語の句点を誤検出しない
  /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|jp|io|me|co|link|site|app)\b[^\s]*/gi,
]

/** 文面を検査し、見つかった違反をすべて返す。違反がなければ空配列。 */
export function checkContent(text: string): GuardViolation[] {
  const violations: GuardViolation[] = []

  for (const word of BANNED_WORDS) {
    if (text.includes(word)) {
      violations.push({ kind: 'banned_word', matched: word })
    }
  }

  for (const pattern of URL_PATTERNS) {
    const matches = text.match(pattern)
    if (!matches) continue
    for (const matched of matches) {
      if (!violations.some((v) => v.kind === 'url' && v.matched === matched)) {
        violations.push({ kind: 'url', matched })
      }
    }
  }

  return violations
}

export function isClean(text: string): boolean {
  return checkContent(text).length === 0
}
