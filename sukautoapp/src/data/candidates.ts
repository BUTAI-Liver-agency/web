// candidates テーブルへの読み書き。判断は行わない（フィルタ・採番の判断は domain 層の責務）。
import { supabase } from './supabase'
import { mapCandidateRow, type CandidateRow } from './mappers'
import { fetchAllRows } from './paginate'
import { generateUniqueRefCode, normalizeRefCode } from '../domain/refCode'
import type { AgeStatus, Candidate, ImportRow, Stage } from '../domain/types'
import type { ExistingCandidate } from '../domain/importFilter'

export async function listCandidates(): Promise<Candidate[]> {
  const rows = await fetchAllRows<CandidateRow>((from, to) =>
    supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to),
  )
  return rows.map(mapCandidateRow)
}

/** 取り込みフィルタに渡すための最小限の既存情報。 */
export async function listExistingForImport(): Promise<ExistingCandidate[]> {
  const rows = await fetchAllRows<{
    tiktok_handle: string
    opted_out: boolean
    age_status: AgeStatus
    stage: Stage
  }>((from, to) =>
    supabase
      .from('candidates')
      .select('tiktok_handle, opted_out, age_status, stage')
      .range(from, to),
  )
  return rows.map((r) => ({
    tiktokHandle: r.tiktok_handle,
    optedOut: r.opted_out,
    ageStatus: r.age_status,
    stage: r.stage,
  }))
}

/** 既に使われている合言葉コードを取得する。採番時の衝突回避に使う。 */
async function listUsedRefCodes(): Promise<Set<string>> {
  const rows = await fetchAllRows<{ ref_code: string }>((from, to) =>
    supabase.from('candidates').select('ref_code').range(from, to),
  )
  return new Set(rows.map((r) => r.ref_code))
}

/**
 * 候補者を一括登録する。合言葉コードは既存のものを避けて採番する。
 * 4桁のコードは候補者1000人規模で約38%の確率で衝突し、一意制約違反で
 * 取り込みバッチ全体が失敗するため、挿入前に回避しておく。
 */
export async function insertCandidates(
  rows: ImportRow[],
  sourceVideoId: string,
): Promise<number> {
  if (rows.length === 0) return 0

  const usedRefCodes = await listUsedRefCodes()

  const payload = rows.map((row) => ({
    tiktok_handle: row.tiktokHandle,
    ref_code: generateUniqueRefCode(usedRefCodes),
    display_name: row.displayName,
    comment_text: row.commentText,
    source_video_id: sourceVideoId,
  }))

  const { data, error } = await supabase.from('candidates').insert(payload).select('id')
  if (error) throw error
  return data?.length ?? 0
}

export async function updateCandidate(
  id: string,
  patch: Partial<{
    age_status: AgeStatus
    age_verified_by: string | null
    age_verified_at: string | null
    stage: Stage
    assignee_id: string | null
    opted_out: boolean
  }>,
): Promise<void> {
  const { error } = await supabase.from('candidates').update(patch).eq('id', id)
  if (error) throw error
}

/** 合言葉コードから候補者を特定する。LINE到達の記録に使う。 */
export async function findByRefCode(refCode: string): Promise<Candidate | null> {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('ref_code', normalizeRefCode(refCode))
    .maybeSingle()
  if (error) throw error
  return data ? mapCandidateRow(data as CandidateRow) : null
}
