import type { MessageRecord } from './types'

/**
 * 1日の送信上限の初期値。
 * 公式アカウント1つからの安全なペースは公開情報がないため、
 * 保守的に20件から始めてPoCで実測し調整する（設計書 2.6）。
 */
export const DEFAULT_DAILY_LIMIT = 20

export interface PaceState {
  dailyLimit: number
  sentToday: number
}

/** 日本標準時のオフセット（UTC+9）。事務所の営業日はこの時間帯で区切る。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * ISO形式の日時文字列を、日本時間の 'YYYY-MM-DD' に変換する。
 *
 * 文字列の先頭10文字を切り出す方式は使わない。Postgres の timestamptz は
 * `+09:00` のようなオフセット付きで返ることがあり、Z 表記と混在すると
 * 同じ瞬間が別の日に振り分けられて、上限の集計が壊れるため。
 */
export function toJstDate(iso: string): string {
  const epochMs = Date.parse(iso)
  if (Number.isNaN(epochMs)) {
    throw new Error(`日時として解釈できません: ${iso}`)
  }
  return new Date(epochMs + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 現在の日本時間の日付を 'YYYY-MM-DD' で返す。送信キューの当日判定に使う。 */
export function todayInJst(now: Date = new Date()): string {
  return toJstDate(now.toISOString())
}

/** `jstDate` は日本時間の 'YYYY-MM-DD'。`todayInJst()` の戻り値を渡すこと。 */
export function countSentOn(messages: MessageRecord[], jstDate: string): number {
  return messages.filter((m) => toJstDate(m.sentAt) === jstDate).length
}

export function remainingQuota(state: PaceState): number {
  return Math.max(0, state.dailyLimit - state.sentToday)
}

export function canSendNow(state: PaceState): boolean {
  return remainingQuota(state) > 0
}
