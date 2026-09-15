import { canApprove } from '../../domain/ageGuard'
import { availableTemplates } from '../../domain/templateRules'
import type { Candidate, MessageRecord, TemplateId } from '../../domain/types'

export interface CandidateCardProps {
  candidate: Candidate
  /** 取得元の募集動画名。どの動画から来た人かを承認前に見せる。 */
  videoTitle: string | null
  sentMessages: MessageRecord[]
  quotaRemaining: number
  body: string
  onBodyChange: (body: string) => void
  selectedTemplate: TemplateId
  onSelectTemplate: (templateId: TemplateId) => void
  /** 冒頭文の生成中。この間に承認すると生成中のプレースホルダが送信記録に残る。 */
  generating: boolean
  /** 保存処理の実行中。二重送信を防ぐために操作を止める。 */
  busy: boolean
  onApprove: () => void
  onMarkUnder18: () => void
  onVerifyAdult: () => void
  onSkip: () => void
}

const AGE_BADGE: Record<Candidate['ageStatus'], { label: string; color: string }> = {
  unverified: { label: '年齢未確認', color: 'crimson' },
  under18: { label: '17歳以下', color: 'crimson' },
  adult: { label: '18歳以上 確認済み', color: 'seagreen' },
}

export function CandidateCard(props: CandidateCardProps) {
  const { candidate, sentMessages, quotaRemaining, generating, busy } = props
  const decision = canApprove(candidate)
  const templates = availableTemplates(candidate, sentMessages)
  const hasQuota = quotaRemaining > 0
  const canPress = decision.allowed && hasQuota && templates.length > 0 && !generating && !busy
  const badge = AGE_BADGE[candidate.ageStatus]

  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, maxWidth: 560 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>@{candidate.tiktokHandle}</strong>
        <span style={{ color: badge.color, fontWeight: 'bold' }}>{badge.label}</span>
      </header>

      <p style={{ background: '#f6f6f6', padding: 8, borderRadius: 4 }}>{candidate.commentText}</p>
      <p>取得元の動画: {props.videoTitle ?? '(不明)'}</p>
      <p>合言葉コード: {candidate.refCode}</p>
      <p>本日の残り枠: {quotaRemaining}件</p>

      {candidate.ageStatus === 'unverified' && (
        <div style={{ border: '1px solid crimson', padding: 8, borderRadius: 4 }}>
          <p>プロフィールと投稿を確認してください。18歳以上と確認できるまで送信できません。</p>
          <button onClick={props.onVerifyAdult} disabled={busy}>
            18歳以上であることを確認した
          </button>
          <button onClick={props.onMarkUnder18} disabled={busy}>
            17歳以下のため対象外にする
          </button>
        </div>
      )}

      <label>
        送信文面
        <textarea
          rows={14}
          style={{ width: '100%' }}
          value={props.body}
          onChange={(e) => props.onBodyChange(e.target.value)}
          disabled={generating || busy}
        />
      </label>

      <p style={{ fontSize: 12, color: '#666' }}>
        送信内容の最終確認は担当者の責任です。AIが生成するのは冒頭の1〜2文のみです。
      </p>

      <footer style={{ display: 'flex', gap: 8 }}>
        <select
          value={props.selectedTemplate}
          onChange={(e) => props.onSelectTemplate(e.target.value as TemplateId)}
          disabled={templates.length === 0 || busy}
        >
          {templates.map((id) => (
            <option key={id} value={id}>
              テンプレ{id}
            </option>
          ))}
        </select>
        <button onClick={props.onApprove} disabled={!canPress}>
          承認してコピー
        </button>
        <button onClick={props.onSkip} disabled={busy}>
          スキップ
        </button>
      </footer>

      {generating && <p>文面を生成しています。生成が終わるまで承認できません。</p>}
      {!decision.allowed && <p style={{ color: 'crimson' }}>{denialMessage(decision.reason)}</p>}
      {decision.allowed && !hasQuota && (
        <p style={{ color: 'crimson' }}>本日の送信上限に達しました。続きは明日にしてください。</p>
      )}
    </article>
  )
}

function denialMessage(reason: string): string {
  switch (reason) {
    case 'age_not_verified':
      return '18歳以上であることを確認するまで送信できません。'
    case 'under18':
      return '17歳以下のため対象外です。送信できません。'
    case 'opted_out':
      return '今後の連絡を希望されていないため送信できません。'
    case 'terminal_stage':
      return 'この候補者は対象外・辞退・連絡不要のいずれかです。'
    default:
      return '送信できません。'
  }
}
