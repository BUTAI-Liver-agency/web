import type { MessageRecord, TemplateId } from './types'
import { canApprove, type ApprovalTarget } from './ageGuard'

/** テンプレBは1候補者につき1回まで（設計書 7.6）。 */
const TEMPLATE_B_MAX_USES = 1

/**
 * この候補者に対していま選べるテンプレートを返す。
 *
 * 年齢ガードを通らない候補者には、そもそも使えるテンプレートが存在しない。
 * 17歳以下・年齢未確認向けのテンプレートは設計上作らないため空配列になる。
 *
 * @param sentMessages **この候補者宛てのメッセージのみ**を渡すこと。絞り込みは呼び出し側の責務。
 *   ApprovalTarget は候補者IDを持たないため関数側では検証できない。他の候補者のメッセージが
 *   混ざると、テンプレBの「1候補者につき1回まで」の制限が静かに壊れる。
 */
export function availableTemplates(
  candidate: ApprovalTarget,
  sentMessages: MessageRecord[],
): TemplateId[] {
  if (!canApprove(candidate).allowed) return []

  const available: TemplateId[] = ['A']
  if (canUseTemplateB(sentMessages)) available.push('B')
  return available
}

/**
 * 指定したテンプレートをこの候補者に使えるかを返す。
 *
 * @param sentMessages **この候補者宛てのメッセージのみ**を渡すこと（availableTemplates と同じ責務）。
 */
export function canUseTemplate(
  candidate: ApprovalTarget,
  sentMessages: MessageRecord[],
  templateId: TemplateId,
): boolean {
  return availableTemplates(candidate, sentMessages).includes(templateId)
}

function canUseTemplateB(sentMessages: MessageRecord[]): boolean {
  const sentA = sentMessages.some((m) => m.templateId === 'A')
  const sentBCount = sentMessages.filter((m) => m.templateId === 'B').length
  return sentA && sentBCount < TEMPLATE_B_MAX_USES
}
