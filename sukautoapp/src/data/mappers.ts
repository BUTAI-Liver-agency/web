// DBの行（snake_case）とドメイン型（camelCase）を相互変換する純粋関数群。
// このファイルは判断を一切行わない。supabase.ts や他のネットワーク処理も import しない。
import type { AgeStatus, Candidate, MessageRecord, Stage, TemplateId } from '../domain/types'

export interface CandidateRow {
  id: string
  tiktok_handle: string
  ref_code: string
  display_name: string
  comment_text: string
  source_video_id: string | null
  age_status: AgeStatus
  age_verified_by: string | null
  age_verified_at: string | null
  stage: Stage
  assignee_id: string | null
  opted_out: boolean
  created_at: string
  updated_at: string
}

export interface MessageRow {
  id: string
  candidate_id: string
  template_id: TemplateId
  body: string
  sent_at: string
  sent_by: string
}

export function mapCandidateRow(row: CandidateRow): Candidate {
  return {
    id: row.id,
    tiktokHandle: row.tiktok_handle,
    refCode: row.ref_code,
    displayName: row.display_name,
    commentText: row.comment_text,
    sourceVideoId: row.source_video_id,
    ageStatus: row.age_status,
    ageVerifiedBy: row.age_verified_by,
    ageVerifiedAt: row.age_verified_at,
    stage: row.stage,
    assigneeId: row.assignee_id,
    optedOut: row.opted_out,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMessageRow(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    templateId: row.template_id,
    body: row.body,
    sentAt: row.sent_at,
    sentBy: row.sent_by,
  }
}
