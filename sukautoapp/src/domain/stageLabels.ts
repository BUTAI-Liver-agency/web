import type { Stage } from './types'

export const STAGE_LABELS: Record<Stage, string> = {
  prospect: '見込み',
  dm_sent: 'DM送信済み',
  responded: '反応あり',
  line_reached: 'LINE到達',
  meeting_set: 'MTG設定',
  contracted: '契約',
  undeliverable: '送信不可',
  excluded: '対象外',
  no_response: '無反応',
  declined: '辞退',
  opted_out: '連絡不要',
}

/** かんばんに列として並べる進行中のステージ。 */
export const ACTIVE_STAGES: Stage[] = [
  'prospect',
  'dm_sent',
  'responded',
  'line_reached',
  'meeting_set',
  'contracted',
]

/** 終端として別枠にまとめるステージ。 */
export const CLOSED_STAGES: Stage[] = [
  'undeliverable',
  'excluded',
  'no_response',
  'declined',
  'opted_out',
]
