import type { ImportRow } from './types'

export interface ParseResult {
  rows: ImportRow[]
  /** 解釈できなかった行。取り込み画面で件数と内容を担当者に見せる。 */
  unparsedLines: string[]
}

/** CSVのヘッダ行。完全一致で判定するため定数に切り出している。 */
const CSV_HEADER_LINE = 'handle,display_name,comment'

/** TikTokのハンドルを比較可能な形に正規化する。重複判定のキーになるため必須。 */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}

/**
 * TikTokのコメント欄から貼り付けたテキストを解析する。
 * 想定形式は 1行 = 「@ハンドル 本文」。
 */
export function parsePastedComments(text: string): ParseResult {
  const rows: ImportRow[] = []
  const unparsedLines: string[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue

    if (!line.startsWith('@')) {
      unparsedLines.push(line)
      continue
    }

    const separatorIndex = line.search(/\s/)
    if (separatorIndex === -1) {
      // ハンドルだけで本文がない
      unparsedLines.push(line)
      continue
    }

    const handle = normalizeHandle(line.slice(0, separatorIndex))
    const commentText = line.slice(separatorIndex).trim()
    if (handle === '' || commentText === '') {
      unparsedLines.push(line)
      continue
    }

    rows.push({ tiktokHandle: handle, displayName: handle, commentText })
  }

  return { rows, unparsedLines }
}

/**
 * `handle,display_name,comment` 形式のCSVを解析する。
 * 本文にカンマが含まれうるため、3列目以降は結合して本文として扱う。
 */
export function parseCsv(text: string): ParseResult {
  const rows: ImportRow[] = []
  const unparsedLines: string[] = []

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')
  // ヘッダ行は完全一致で判定する。前方一致にすると、ハンドルが "handle" で始まる
  // 実データ行をヘッダと誤認し、候補者を無言で取りこぼす
  const body =
    lines.length > 0 && lines[0].toLowerCase() === CSV_HEADER_LINE ? lines.slice(1) : lines

  for (const line of body) {
    const parts = line.split(',')
    if (parts.length < 3) {
      unparsedLines.push(line)
      continue
    }

    const handle = normalizeHandle(parts[0])
    const displayName = parts[1].trim()
    const commentText = parts.slice(2).join(',').trim()

    if (handle === '' || commentText === '') {
      unparsedLines.push(line)
      continue
    }

    rows.push({ tiktokHandle: handle, displayName: displayName || handle, commentText })
  }

  return { rows, unparsedLines }
}
