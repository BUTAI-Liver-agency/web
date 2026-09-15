import type { AgeStatus, Stage } from './types'
import { TERMINAL_STAGES } from './types'

export interface ApprovalTarget {
  ageStatus: AgeStatus
  optedOut: boolean
  stage: Stage
}

export type ApprovalDenialReason =
  | 'age_not_verified'
  | 'under18'
  | 'opted_out'
  | 'terminal_stage'

export type ApprovalDecision =
  | { allowed: true }
  | { allowed: false; reason: ApprovalDenialReason }

export interface AgeTransition {
  ageStatus: AgeStatus
  stage: Stage
  ageVerifiedBy: string | null
  ageVerifiedAt: string | null
}

/**
 * 承認（＝DM送信）してよいかを判定する。
 *
 * 事務所方針により対象は18歳以上のみ。年齢の既定値は unverified であり、
 * 担当者が明示的に確認するまで承認できない（設計書 5.4）。
 * この関数が false を返す限りUIの承認ボタンは押せない。
 */
export function canApprove(candidate: ApprovalTarget): ApprovalDecision {
  if (candidate.optedOut) {
    return { allowed: false, reason: 'opted_out' }
  }
  if (candidate.ageStatus === 'under18') {
    return { allowed: false, reason: 'under18' }
  }
  if (TERMINAL_STAGES.includes(candidate.stage)) {
    return { allowed: false, reason: 'terminal_stage' }
  }
  if (candidate.ageStatus !== 'adult') {
    return { allowed: false, reason: 'age_not_verified' }
  }
  return { allowed: true }
}

/**
 * 17歳以下と判断した候補者を対象外へ移す。
 * オプトアウトと同等の恒久除外であり、以後キューに再出現しない。
 */
export function markUnder18(_candidate: ApprovalTarget): AgeTransition {
  return {
    ageStatus: 'under18',
    stage: 'excluded',
    ageVerifiedBy: null,
    ageVerifiedAt: null,
  }
}

/**
 * 担当者が「18歳以上であることを確認した」と明示選択したときの遷移。
 * 誰がいつ確認したかを必ず記録する（設計書 5.4 の仕組み2）。
 */
export function verifyAdult(
  candidate: ApprovalTarget,
  verifierId: string,
  now: string,
): AgeTransition {
  if (candidate.ageStatus === 'under18') {
    throw new Error('under18 と判断済みの候補者を adult に変更することはできません')
  }
  return {
    ageStatus: 'adult',
    stage: candidate.stage,
    ageVerifiedBy: verifierId,
    ageVerifiedAt: now,
  }
}
