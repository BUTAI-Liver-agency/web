import { useEffect, useState } from 'react'
import { funnelByVideo, funnelByTemplate, funnelByAssignee } from '../../domain/metrics'
import { listCandidates } from '../../data/candidates'
import { listMessages } from '../../data/messages'
import { listVideos } from '../../data/videos'
import { getDailyLimit, setDailyLimit } from '../../data/settings'
import type { Candidate, MessageRecord } from '../../domain/types'

const percent = (value: number) => `${Math.round(value * 100)}%`

type LoadState = 'loading' | 'loaded' | 'error'

export function DashboardPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [videos, setVideos] = useState<{ id: string; title: string; commentCountCollected: number }[]>([])
  const [limit, setLimit] = useState(20)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingLimit, setSavingLimit] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  useEffect(() => {
    void reload()
  }, [])

  const reload = async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      const [c, m, v, l] = await Promise.all([
        listCandidates(),
        listMessages(),
        listVideos(),
        getDailyLimit(),
      ])
      setCandidates(c)
      setMessages(m)
      setVideos(v.map((x) => ({ id: x.id, title: x.title, commentCountCollected: x.commentCountCollected })))
      setLimit(l)
      setLoadState('loaded')
    } catch (e) {
      setLoadError(`集計データの読み込みに失敗しました。再読み込みしてください: ${String(e)}`)
      setLoadState('error')
    }
  }

  const saveLimit = async () => {
    if (savingLimit) return
    setSavingLimit(true)
    setSaveNotice(null)
    try {
      await setDailyLimit(limit)
      setSaveNotice('1日の送信上限を更新しました。')
    } catch (e) {
      setSaveNotice(`1日の送信上限の更新に失敗しました: ${String(e)}`)
    } finally {
      setSavingLimit(false)
    }
  }

  const videoFunnel = funnelByVideo(candidates, messages, videos)
  const templateFunnel = funnelByTemplate(candidates, messages)
  const assigneeFunnel = funnelByAssignee(candidates, messages)

  return (
    <section>
      <h2>ダッシュボード</h2>

      {loadState === 'error' && (
        <p style={{ color: '#b91c1c' }}>
          {loadError}
          <button onClick={() => void reload()} style={{ marginLeft: 8 }}>
            再読み込み
          </button>
        </p>
      )}

      <fieldset>
        <legend>送信ペース設定</legend>
        <label>
          1日の送信上限
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={savingLimit}
          />
        </label>
        <button onClick={() => void saveLimit()} disabled={savingLimit}>
          {savingLimit ? '保存中…' : '保存'}
        </button>
        {saveNotice && <p style={{ fontSize: 12 }}>{saveNotice}</p>}
        <p style={{ fontSize: 12, color: '#666' }}>
          初期値は20件です。安全なペースの上限は実測しながら調整してください。
        </p>
      </fieldset>

      {loadState === 'loading' && <p>読み込み中です…</p>}

      {loadState === 'loaded' && (
        <>
          <h3>募集動画別</h3>
          {videoFunnel.length === 0 ? (
            <p>まだ動画が登録されていません。</p>
          ) : (
            <table border={1} cellPadding={6}>
              <thead>
                <tr>
                  <th>動画</th>
                  <th>取込コメント数</th>
                  <th>候補者</th>
                  <th>承認（送信）</th>
                  <th>返信率</th>
                  <th>LINE到達</th>
                  <th>到達率</th>
                  <th>MTG</th>
                  <th>契約</th>
                </tr>
              </thead>
              <tbody>
                {videoFunnel.map((row) => (
                  <tr key={row.videoId}>
                    <td>{row.title}</td>
                    <td>{row.commentsCollected}</td>
                    <td>{row.candidates}</td>
                    <td>{row.sent}</td>
                    <td>{percent(row.replyRate)}</td>
                    <td>{row.lineReached}</td>
                    <td>{percent(row.lineReachRate)}</td>
                    <td>{row.meetingSet}</td>
                    <td>{row.contracted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>テンプレート別</h3>
          <table border={1} cellPadding={6}>
            <thead>
              <tr>
                <th>テンプレ</th>
                <th>承認（送信）</th>
                <th>返信率</th>
                <th>LINE到達</th>
                <th>到達率</th>
              </tr>
            </thead>
            <tbody>
              {templateFunnel.map((row) => (
                <tr key={row.templateId}>
                  <td>{row.templateId}</td>
                  <td>{row.sent}</td>
                  <td>{percent(row.replyRate)}</td>
                  <td>{row.lineReached}</td>
                  <td>{percent(row.lineReachRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>担当者別</h3>
          {assigneeFunnel.length === 0 ? (
            <p>まだ送信履歴がありません。</p>
          ) : (
            <table border={1} cellPadding={6}>
              <thead>
                <tr>
                  <th>担当者ID</th>
                  <th>承認（送信）</th>
                  <th>返信率</th>
                  <th>LINE到達</th>
                  <th>到達率</th>
                  <th>MTG</th>
                </tr>
              </thead>
              <tbody>
                {assigneeFunnel.map((row) => (
                  <tr key={row.assigneeId}>
                    <td>{row.assigneeId}</td>
                    <td>{row.sent}</td>
                    <td>{percent(row.replyRate)}</td>
                    <td>{row.lineReached}</td>
                    <td>{percent(row.lineReachRate)}</td>
                    <td>{row.meetingSet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}
