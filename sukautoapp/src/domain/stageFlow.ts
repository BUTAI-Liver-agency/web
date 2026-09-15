import type { Stage } from './types'
import { TERMINAL_STAGES } from './types'

/**
 * パイプラインの進行順。後ろほど先に進んでいる。
 * 送信不可・無反応・終端ステージはこの順序に乗らない（行き来しうるため）。
 */
const PROGRESS_ORDER: readonly Stage[] = [
  'prospect',
  'dm_sent',
  'responded',
  'line_reached',
  'meeting_set',
  'contracted',
] as const

export type StageChangeDenialReason = 'terminal' | 'backwards'

export type StageChangeDecision =
  | { allowed: true }
  | { allowed: false; reason: StageChangeDenialReason }

/**
 * 候補者のステージを `from` から `to` へ変更してよいかを判定する。
 *
 * 二つのことを防ぐ。
 *
 * 一つは終端ステージからの復帰。対象外（17歳以下）・辞退・連絡不要は、
 * 画面の操作ひとつで取り消せてはならない。本プロジェクトが守っている
 * 二つの保証がそこにかかっている。
 *
 * もう一つは後退。合言葉の再入力などで、既にMTG設定や契約まで進んだ候補者を
 * LINE到達へ巻き戻すと、歩留まりの集計が静かに壊れる。
 */
export function canChangeStage(from: Stage, to: Stage): StageChangeDecision {
  if (from === to) return { allowed: true }
  if (TERMINAL_STAGES.includes(from)) return { allowed: false, reason: 'terminal' }

  // 見込みへ戻すことは許さない。送信キューは見込みだけを拾うため、
  // 一度DMを送った候補者が見込みに戻ると、二度目のDMを送ってしまう
  if (to === 'prospect') return { allowed: false, reason: 'backwards' }

  const fromRank = PROGRESS_ORDER.indexOf(from)
  const toRank = PROGRESS_ORDER.indexOf(to)
  // 進行順に乗らないステージ（送信不可・無反応・終端）との行き来は制限しない
  if (fromRank === -1 || toRank === -1) return { allowed: true }

  return toRank < fromRank ? { allowed: false, reason: 'backwards' } : { allowed: true }
}

/**
 * 送信キューに出す候補者かどうか。
 *
 * キューは「まだ一度もDMを送っていない人」だけを扱う。この判断が画面側にあると、
 * canApprove との食い違いに誰も気づけないため、ドメイン側に置く。
 */
export function isQueueable(candidate: { stage: Stage; optedOut: boolean }): boolean {
  return candidate.stage === 'prospect' && !candidate.optedOut
}

/** 拒否理由を担当者向けの日本語にする。 */
export function stageChangeDenialMessage(reason: StageChangeDenialReason): string {
  switch (reason) {
    case 'terminal':
      return '対象外・辞退・連絡不要にした候補者は、画面から元に戻せません。'
    case 'backwards':
      return '既に先へ進んでいる候補者を前の段階へ戻すことはできません。'
  }
}
