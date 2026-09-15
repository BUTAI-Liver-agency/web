import type { Candidate, MessageRecord, Stage, TemplateId } from './types'

/** LINE到達より先に進んだ候補者も到達済みとして数える。 */
const REACHED_OR_BEYOND: Stage[] = ['line_reached', 'meeting_set', 'contracted']
const MEETING_OR_BEYOND: Stage[] = ['meeting_set', 'contracted']
/** 反応あり以降。返信率の分子に使う。 */
const RESPONDED_OR_BEYOND: Stage[] = ['responded', 'line_reached', 'meeting_set', 'contracted']

export interface VideoFunnel {
  videoId: string
  title: string
  commentsCollected: number
  candidates: number
  sent: number
  replied: number
  lineReached: number
  meetingSet: number
  contracted: number
  /** 送信数に対する返信ありの割合。 */
  replyRate: number
  /** 主要指標。送信数に対するLINE到達数の割合（設計書 11）。 */
  lineReachRate: number
}

export interface TemplateFunnel {
  templateId: TemplateId
  sent: number
  replied: number
  lineReached: number
  replyRate: number
  lineReachRate: number
}

export interface AssigneeFunnel {
  assigneeId: string
  sent: number
  replied: number
  lineReached: number
  meetingSet: number
  replyRate: number
  lineReachRate: number
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * DMを送った候補者のIDを集める。
 *
 * この集合が全ての歩留まりの母集団になる。ステージだけを手で進めた候補者
 * （パイプライン画面で 見込み → LINE到達 と直接変更した場合など）は
 * DM経由ではないため数えない。母集団に入れると到達数が送信数を上回り、
 * 到達率が100%を超えて表示される。
 */
function messagedCandidateIds(messages: MessageRecord[]): Set<string> {
  return new Set(messages.map((m) => m.candidateId))
}

/**
 * 候補者ごとに「最初にDMを送った担当者」を求める。
 *
 * 1人の候補者に複数の担当者が関わった場合（テンプレAとBを別の人が送るなど）、
 * 送った全員に到達を計上すると、担当者別の合計が実際の成約数を上回る。
 * 関係を開いた担当者に一意に紐づける。
 */
function firstSenderByCandidate(messages: MessageRecord[]): Map<string, string> {
  const ordered = [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt))
  const firstSender = new Map<string, string>()
  for (const m of ordered) {
    if (!firstSender.has(m.candidateId)) firstSender.set(m.candidateId, m.sentBy)
  }
  return firstSender
}

export function funnelByVideo(
  candidates: Candidate[],
  messages: MessageRecord[],
  videos: { id: string; title: string; commentCountCollected: number }[],
): VideoFunnel[] {
  const messaged = messagedCandidateIds(messages)

  return videos.map((video) => {
    const forVideo = candidates.filter((c) => c.sourceVideoId === video.id)
    // 歩留まりはDMを送った候補者だけで数える。送っていない人は母集団に入らない
    const sentCohort = forVideo.filter((c) => messaged.has(c.id))
    const lineReached = sentCohort.filter((c) => REACHED_OR_BEYOND.includes(c.stage)).length
    const replied = sentCohort.filter((c) => RESPONDED_OR_BEYOND.includes(c.stage)).length

    return {
      videoId: video.id,
      title: video.title,
      commentsCollected: video.commentCountCollected,
      candidates: forVideo.length,
      sent: sentCohort.length,
      replied,
      lineReached,
      meetingSet: sentCohort.filter((c) => MEETING_OR_BEYOND.includes(c.stage)).length,
      contracted: sentCohort.filter((c) => c.stage === 'contracted').length,
      replyRate: rate(replied, sentCohort.length),
      lineReachRate: rate(lineReached, sentCohort.length),
    }
  })
}

export function funnelByTemplate(
  candidates: Candidate[],
  messages: MessageRecord[],
): TemplateFunnel[] {
  const byId = new Map(candidates.map((c) => [c.id, c]))

  return (['A', 'B'] as TemplateId[]).map((templateId) => {
    const sentCandidateIds = new Set(
      messages.filter((m) => m.templateId === templateId).map((m) => m.candidateId),
    )
    const lineReached = [...sentCandidateIds].filter((id) => {
      const candidate = byId.get(id)
      return candidate ? REACHED_OR_BEYOND.includes(candidate.stage) : false
    }).length
    const replied = [...sentCandidateIds].filter((id) => {
      const candidate = byId.get(id)
      return candidate ? RESPONDED_OR_BEYOND.includes(candidate.stage) : false
    }).length

    return {
      templateId,
      sent: sentCandidateIds.size,
      replied,
      lineReached,
      replyRate: rate(replied, sentCandidateIds.size),
      lineReachRate: rate(lineReached, sentCandidateIds.size),
    }
  })
}

export function funnelByAssignee(
  candidates: Candidate[],
  messages: MessageRecord[],
): AssigneeFunnel[] {
  const firstSender = firstSenderByCandidate(messages)
  const byId = new Map(candidates.map((c) => [c.id, c]))

  const grouped = new Map<string, string[]>()
  for (const [candidateId, sentBy] of firstSender) {
    const list = grouped.get(sentBy) ?? []
    list.push(candidateId)
    grouped.set(sentBy, list)
  }

  return [...grouped.entries()].map(([assigneeId, candidateIds]) => {
    const reached = candidateIds.filter((id) => {
      const candidate = byId.get(id)
      return candidate ? REACHED_OR_BEYOND.includes(candidate.stage) : false
    })
    const meetings = candidateIds.filter((id) => {
      const candidate = byId.get(id)
      return candidate ? MEETING_OR_BEYOND.includes(candidate.stage) : false
    })
    const replied = candidateIds.filter((id) => {
      const candidate = byId.get(id)
      return candidate ? RESPONDED_OR_BEYOND.includes(candidate.stage) : false
    })

    return {
      assigneeId,
      sent: candidateIds.length,
      replied: replied.length,
      lineReached: reached.length,
      meetingSet: meetings.length,
      replyRate: rate(replied.length, candidateIds.length),
      lineReachRate: rate(reached.length, candidateIds.length),
    }
  })
}
