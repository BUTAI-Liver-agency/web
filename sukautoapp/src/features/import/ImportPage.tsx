import { useEffect, useState } from 'react'
import { parsePastedComments, parseCsv } from '../../domain/commentParser'
import { filterImport, type ImportResult } from '../../domain/importFilter'
import { listExistingForImport, insertCandidates } from '../../data/candidates'
import { listVideos, insertVideo, addCollectedCount, type Video } from '../../data/videos'

/**
 * 確認画面の内容。取得元の動画をここに固定して持つ。
 *
 * 実行時に「現在の選択」を読むと、確認してから実行するまでの間に担当者が動画を
 * 切り替えた場合、別の動画に候補者と件数が紐づく。しかもエラーは出ないため、
 * PoCの最重要指標（動画ごとのコメント数）が静かに壊れる。
 */
interface Preview {
  videoId: string
  videoTitle: string
  result: ImportResult
  unparsedLines: string[]
}

export function ImportPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [videoId, setVideoId] = useState('')
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [newVideoTitle, setNewVideoTitle] = useState('')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'paste' | 'csv'>('paste')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    listVideos()
      .then(setVideos)
      .catch((e) => setMessage(`動画一覧の取得に失敗しました: ${String(e)}`))
  }, [])

  const analyze = async () => {
    setMessage(null)
    setBusy(true)
    try {
      const video = videos.find((v) => v.id === videoId)
      if (!video) {
        setMessage('取得元の動画を選んでください。')
        return
      }
      const parsed = mode === 'paste' ? parsePastedComments(text) : parseCsv(text)
      const existing = await listExistingForImport()
      setPreview({
        videoId: video.id,
        videoTitle: video.title,
        result: filterImport(parsed.rows, existing),
        unparsedLines: parsed.unparsedLines,
      })
    } catch (e) {
      setMessage(`内容の確認に失敗しました: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    if (!preview) return
    setMessage(null)
    setBusy(true)

    let inserted = 0
    try {
      inserted = await insertCandidates(preview.result.toInsert, preview.videoId)
    } catch (e) {
      setMessage(`取り込みに失敗しました。候補者は登録されていません: ${String(e)}`)
      setBusy(false)
      return
    }

    try {
      // 母数には除外分も含める。この動画が実際に何件のコメントを集めたかを測るため
      const total = preview.result.toInsert.length + preview.result.skipped.length
      await addCollectedCount(preview.videoId, total)
    } catch (e) {
      // 候補者の登録は済んでいる。件数だけが未反映であることを隠さず伝える
      setMessage(
        `${inserted}件を取り込みましたが、コメント数の記録に失敗しました。` +
          `ダッシュボードの件数がずれます: ${String(e)}`,
      )
      setPreview(null)
      setText('')
      setBusy(false)
      return
    }

    setMessage(`「${preview.videoTitle}」に${inserted}件を取り込みました`)
    setPreview(null)
    setText('')
    try {
      setVideos(await listVideos())
    } catch {
      // 一覧の再取得に失敗しても取り込み自体は成功している。次回の描画で回復する
    }
    setBusy(false)
  }

  const createVideo = async () => {
    setMessage(null)
    setBusy(true)
    try {
      const id = await insertVideo({ url: newVideoUrl, title: newVideoTitle })
      setVideos(await listVideos())
      setVideoId(id)
      setNewVideoUrl('')
      setNewVideoTitle('')
    } catch (e) {
      setMessage(`動画の追加に失敗しました: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2>候補者の取り込み</h2>

      <fieldset>
        <legend>取得元の募集動画</legend>
        <select value={videoId} onChange={(e) => setVideoId(e.target.value)} disabled={busy}>
          <option value="">選択してください</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}（取込済 {v.commentCountCollected}件）
            </option>
          ))}
        </select>
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="新しい動画のURL"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            disabled={busy}
          />
          <input
            placeholder="動画のタイトル"
            value={newVideoTitle}
            onChange={(e) => setNewVideoTitle(e.target.value)}
            disabled={busy}
          />
          <button onClick={createVideo} disabled={busy || !newVideoUrl || !newVideoTitle}>
            動画を追加
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>コメント</legend>
        <label>
          <input
            type="radio"
            checked={mode === 'paste'}
            onChange={() => setMode('paste')}
            disabled={busy}
          />
          貼り付け（1行 = @ハンドル 本文）
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'csv'}
            onChange={() => setMode('csv')}
            disabled={busy}
          />
          CSV（handle,display_name,comment）
        </label>
        <textarea
          rows={12}
          style={{ width: '100%' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <button onClick={analyze} disabled={busy || !text.trim() || !videoId}>
          内容を確認する
        </button>
      </fieldset>

      {preview && (
        <section>
          <h3>取り込み内容の確認</h3>
          <p>
            取得元: <strong>{preview.videoTitle}</strong>
          </p>
          {preview.videoId !== videoId && (
            <p style={{ color: 'crimson' }}>
              確認したあとに動画の選択が変わっています。この内容は「{preview.videoTitle}
              」に取り込まれます。別の動画に入れたい場合は、選び直してもう一度確認してください。
            </p>
          )}
          <ul>
            <li>新規に追加: {preview.result.summary.inserted}件</li>
            <li>登録済みのため除外: {preview.result.summary.duplicate}件</li>
            <li>連絡不要のため除外: {preview.result.summary.opted_out}件</li>
            <li>対象外のため除外: {preview.result.summary.excluded}件</li>
            {preview.unparsedLines.length > 0 && (
              <li>解釈できなかった行: {preview.unparsedLines.length}件</li>
            )}
          </ul>
          <button onClick={commit} disabled={busy || preview.result.toInsert.length === 0}>
            この内容で取り込む
          </button>
        </section>
      )}

      {message && <p>{message}</p>}
    </section>
  )
}
