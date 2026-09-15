/** 候補者の年齢確認状態。既定は unverified で、adult 以外は送信不可。 */
export type AgeStatus = 'unverified' | 'under18' | 'adult'

/** パイプラインのステージ（設計書 4.2）。 */
export type Stage =
  | 'prospect'       // 見込み（コメント検知）
  | 'dm_sent'        // DM送信済み
  | 'responded'      // 反応あり（TikTokでの返信）
  | 'line_reached'   // LINE到達（合言葉で特定）
  | 'meeting_set'    // MTG設定
  | 'contracted'     // 契約
  | 'undeliverable'  // 送信不可
  | 'excluded'       // 対象外（17歳以下・募集条件外）
  | 'no_response'    // 無反応
  | 'declined'       // 辞退
  | 'opted_out'      // オプトアウト

/** 二度とキューに戻さない終端ステージ。 */
export const TERMINAL_STAGES: readonly Stage[] = [
  'excluded',
  'declined',
  'opted_out',
] as const

export type TemplateId = 'A' | 'B'

export interface Candidate {
  id: string
  tiktokHandle: string
  refCode: string
  displayName: string
  commentText: string
  /** 取得元の募集動画。動画が削除された場合は null になる。 */
  sourceVideoId: string | null
  ageStatus: AgeStatus
  ageVerifiedBy: string | null
  ageVerifiedAt: string | null
  stage: Stage
  assigneeId: string | null
  optedOut: boolean
  createdAt: string
  updatedAt: string
}

export interface MessageRecord {
  id: string
  candidateId: string
  templateId: TemplateId
  body: string
  sentAt: string
  sentBy: string
}

/** 取り込み時の1行分。候補者になる前の生データ。 */
export interface ImportRow {
  tiktokHandle: string
  displayName: string
  commentText: string
}
