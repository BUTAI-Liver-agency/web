import type { AgeStatus, ImportRow, Stage } from './types'
import { TERMINAL_STAGES } from './types'
import { normalizeHandle } from './commentParser'

/** 重複判定に必要な最小限の既存候補者情報。 */
export interface ExistingCandidate {
  tiktokHandle: string
  optedOut: boolean
  ageStatus: AgeStatus
  stage: Stage
}

export type SkipReason = 'duplicate' | 'opted_out' | 'excluded'

export interface ImportResult {
  toInsert: ImportRow[]
  skipped: { row: ImportRow; reason: SkipReason }[]
  summary: {
    inserted: number
    duplicate: number
    opted_out: number
    excluded: number
  }
}

/**
 * 取り込み対象の行から、登録済み・オプトアウト済み・対象外を除外する。
 *
 * 同一人物への重複スカウトは事務所の信用を直接損なうため、
 * ここでの除外に加えてDB側の一意制約でも二重に担保している（設計書 5.1）。
 */
export function filterImport(
  rows: ImportRow[],
  existing: ExistingCandidate[],
): ImportResult {
  const byHandle = new Map<string, ExistingCandidate>()
  for (const candidate of existing) {
    byHandle.set(normalizeHandle(candidate.tiktokHandle), candidate)
  }

  const toInsert: ImportRow[] = []
  const skipped: { row: ImportRow; reason: SkipReason }[] = []
  const seenInBatch = new Set<string>()

  for (const row of rows) {
    const handle = normalizeHandle(row.tiktokHandle)

    if (seenInBatch.has(handle)) {
      skipped.push({ row, reason: 'duplicate' })
      continue
    }

    const found = byHandle.get(handle)
    if (found) {
      skipped.push({ row, reason: skipReasonFor(found) })
      continue
    }

    seenInBatch.add(handle)
    toInsert.push({ ...row, tiktokHandle: handle })
  }

  return {
    toInsert,
    skipped,
    summary: {
      inserted: toInsert.length,
      duplicate: skipped.filter((s) => s.reason === 'duplicate').length,
      opted_out: skipped.filter((s) => s.reason === 'opted_out').length,
      excluded: skipped.filter((s) => s.reason === 'excluded').length,
    },
  }
}

function skipReasonFor(candidate: ExistingCandidate): SkipReason {
  if (candidate.optedOut) return 'opted_out'
  if (candidate.ageStatus === 'under18') return 'excluded'
  if (TERMINAL_STAGES.includes(candidate.stage)) return 'excluded'
  return 'duplicate'
}
