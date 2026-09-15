import { useState } from 'react'
import { findByRefCode, updateCandidate } from '../../data/candidates'
import { STAGE_LABELS } from '../../domain/stageLabels'
import { canChangeStage, stageChangeDenialMessage } from '../../domain/stageFlow'
import type { Candidate, Stage } from '../../domain/types'

export function RefCodeLookupPage() {
  const [code, setCode] = useState('')
  const [found, setFound] = useState<Candidate | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setNotice(null)
    setFound(null)
    setBusy(true)
    try {
      const candidate = await findByRefCode(code)
      if (!candidate) {
        setNotice('該当する候補者が見つかりませんでした。コードを確認してください。')
        return
      }
      setFound(candidate)
    } catch (e) {
      setNotice(`検索に失敗しました。もう一度お試しください: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  /**
   * ステージを進める。
   *
   * 既に先へ進んでいる候補者の古いコードを入れ直しても巻き戻さない。
   * 巻き戻すと歩留まりの集計が静かに壊れる（設計書11の主要指標）。
   */
  const record = async (stage: Stage, label: string) => {
    if (!found || busy) return

    const decision = canChangeStage(found.stage, stage)
    if (!decision.allowed) {
      setNotice(
        `@${found.tiktokHandle} は既に「${STAGE_LABELS[found.stage]}」です。` +
          stageChangeDenialMessage(decision.reason),
      )
      return
    }

    setBusy(true)
    setNotice(null)
    try {
      await updateCandidate(found.id, { stage })
      setNotice(`@${found.tiktokHandle} を${label}として記録しました。`)
      setFound(null)
      setCode('')
    } catch (e) {
      setNotice(`${label}の記録に失敗しました。もう一度お試しください: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2>合言葉から候補者を特定する</h2>
      <p>LINEで受け取った合言葉コード（例 BT-4X7K）を入力してください。</p>

      <form onSubmit={lookup}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="BT-4X7K"
          required
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          検索
        </button>
      </form>

      {found && (
        <article style={{ border: '1px solid #ddd', padding: 16, marginTop: 16 }}>
          <p>
            <strong>@{found.tiktokHandle}</strong>（{found.displayName}）
          </p>
          <p>コメント: {found.commentText}</p>
          <p>現在のステージ: {STAGE_LABELS[found.stage]}</p>
          <button onClick={() => record('line_reached', 'LINE到達')} disabled={busy}>
            LINE到達として記録
          </button>
          <button onClick={() => record('meeting_set', 'MTG設定')} disabled={busy}>
            MTG設定として記録
          </button>
        </article>
      )}

      {notice && <p>{notice}</p>}
    </section>
  )
}
