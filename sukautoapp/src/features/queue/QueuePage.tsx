import { useEffect, useState } from 'react'
import { CandidateCard } from './CandidateCard'
import { buildMessage } from '../../domain/messageBuilder'
import { canApprove, markUnder18, verifyAdult } from '../../domain/ageGuard'
import { canSendNow, countSentOn, remainingQuota, todayInJst } from '../../domain/sendingPace'
import { canUseTemplate } from '../../domain/templateRules'
import { checkContent } from '../../domain/contentGuard'
import { isQueueable } from '../../domain/stageFlow'
import { listCandidates, updateCandidate } from '../../data/candidates'
import { listMessages, insertMessage } from '../../data/messages'
import { listVideos, type Video } from '../../data/videos'
import { getDailyLimit } from '../../data/settings'
import { requestIntro } from '../../data/generateIntro'
import { useCurrentUser } from '../../auth/useCurrentUser'
import type { Candidate, MessageRecord, TemplateId } from '../../domain/types'

/** 冒頭文の生成中に文面欄へ入れておく文字列。この間は承認させない。 */
const GENERATING = '（文面を生成しています...）'

export function QueuePage() {
  const { userId } = useCurrentUser()
  const [queue, setQueue] = useState<Candidate[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [dailyLimit, setDailyLimit] = useState(20)
  const [body, setBody] = useState('')
  const [templateId, setTemplateId] = useState<TemplateId>('A')
  const [busy, setBusy] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const current = queue[0]
  const today = todayInJst()
  const quota = remainingQuota({ dailyLimit, sentToday: countSentOn(messages, today) })

  useEffect(() => {
    reload().catch((e) => {
      setLoadFailed(true)
      setNotice(`データの読み込みに失敗しました。再読み込みしてください: ${String(e)}`)
    })
  }, [])

  // 候補者またはテンプレートが変わったら、冒頭文を生成して文面を組み立て直す
  useEffect(() => {
    if (!current) return
    // 候補者の情報をここで固定する。effect の外の current を参照すると、
    // スキップで候補者が変わったあとに前の候補者の生成結果が書き込まれ、
    // 別人の合言葉が入ったDMを送ることになる
    const { displayName, commentText, refCode } = current
    let cancelled = false

    setBody(GENERATING)
    requestIntro({ displayName, commentText })
      .then((result) => {
        if (cancelled) return
        if (result.ok) {
          setBody(buildMessage(templateId, { intro: result.intro, refCode }))
          setNotice(null)
        } else {
          setBody(buildMessage(templateId, { intro: '', refCode }))
          setNotice('冒頭文の自動生成が安全確認を通りませんでした。冒頭は手で書いてください。')
        }
      })
      .catch((error) => {
        if (cancelled) return
        setBody(buildMessage(templateId, { intro: '', refCode }))
        setNotice(`生成に失敗しました: ${String(error)}`)
      })

    return () => {
      cancelled = true
    }
  }, [current?.id, templateId])

  // 候補者が変わったらテンプレート選択を初回用に戻す
  useEffect(() => {
    setTemplateId('A')
  }, [current?.id])

  const reload = async () => {
    const [allCandidates, allMessages, allVideos, limit] = await Promise.all([
      listCandidates(),
      listMessages(),
      listVideos(),
      getDailyLimit(),
    ])
    setMessages(allMessages)
    setVideos(allVideos)
    setDailyLimit(limit)
    setQueue(allCandidates.filter(isQueueable))
    setLoadFailed(false)
  }

  const approve = async () => {
    if (!current || !userId || busy) return

    // 画面の状態は最後の読み込み時点のもの。別の担当者が同じ候補者を
    // 対象外や連絡不要にしている可能性があるため、書き込む直前に判定し直す
    const sentToThisCandidate = messages.filter((m) => m.candidateId === current.id)
    if (!canApprove(current).allowed) {
      setNotice('この候補者には送信できません。画面を再読み込みしてください。')
      return
    }
    if (!canUseTemplate(current, sentToThisCandidate, templateId)) {
      setNotice('このテンプレートは使用できません。画面を再読み込みしてください。')
      return
    }
    if (!canSendNow({ dailyLimit, sentToday: countSentOn(messages, today) })) {
      setNotice('本日の送信上限に達しました。続きは明日にしてください。')
      return
    }

    // 送信直前にもう一度ガードを通す（手編集でURLや禁止ワードが入る可能性があるため）
    const violations = checkContent(body)
    if (violations.length > 0) {
      setNotice(
        `文面に問題があります: ${violations.map((v) => v.matched).join('、')}。修正してください。`,
      )
      return
    }

    setBusy(true)
    setNotice(null)

    try {
      await navigator.clipboard.writeText(body)
    } catch {
      setNotice(
        'クリップボードにコピーできませんでした。文面欄を選択して手でコピーしてください。' +
          '送信記録はまだ残していません。',
      )
      setBusy(false)
      return
    }

    // 記録は担当者が実際に送る前に残す。
    // 「送ったのに記録が無い」状態になると、同じ人へ二度目のDMを送ってしまう。
    // 逆に「記録は残ったが送らなかった」場合、事務所のログが過大になるだけで
    // 候補者に害は及ばない。失敗の向きが非対称なので、安全側に倒している。
    try {
      await insertMessage({ candidateId: current.id, templateId, body, sentBy: userId })
    } catch (e) {
      setNotice(`送信記録の保存に失敗しました。TikTokへは送らないでください: ${String(e)}`)
      setBusy(false)
      return
    }

    try {
      await updateCandidate(current.id, { stage: 'dm_sent' })
    } catch (e) {
      setNotice(
        '送信記録は残りましたが、ステージの更新に失敗しました。' +
          `この候補者がキューに再び現れても、二度目のDMを送らないでください: ${String(e)}`,
      )
      setBusy(false)
      return
    }

    // TikTokアプリを開く。送信ボタンを押すのは人間（自動送信は実装しない）
    window.open(`https://www.tiktok.com/@${current.tiktokHandle}`, '_blank', 'noopener')
    setNotice('文面をコピーしました。TikTokのDM画面に貼り付けて送信してください。')

    try {
      await reload()
    } catch (e) {
      setNotice(`次の候補者の読み込みに失敗しました。再読み込みしてください: ${String(e)}`)
    }
    setBusy(false)
  }

  const handleVerifyAdult = async () => {
    if (!current || !userId || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const transition = verifyAdult(current, userId, new Date().toISOString())
      await updateCandidate(current.id, {
        age_status: transition.ageStatus,
        age_verified_by: transition.ageVerifiedBy,
        age_verified_at: transition.ageVerifiedAt,
      })
      await reload()
    } catch (e) {
      setNotice(`年齢確認の記録に失敗しました: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleMarkUnder18 = async () => {
    if (!current || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const transition = markUnder18(current)
      // age_verified_by / age_verified_at は書き換えない。
      // 誰がいつ確認したかの記録は、後から訂正しても残す必要がある
      await updateCandidate(current.id, {
        age_status: transition.ageStatus,
        stage: transition.stage,
      })
      await reload()
    } catch (e) {
      setNotice(`対象外への変更に失敗しました: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const skip = () => setQueue((q) => q.slice(1))

  if (loadFailed) {
    return (
      <section>
        <h2>送信キュー</h2>
        <p style={{ color: 'crimson' }}>{notice}</p>
      </section>
    )
  }

  if (!current) {
    return (
      <section>
        <h2>送信キュー</h2>
        <p>送信待ちの候補者はいません。取り込み画面から追加してください。</p>
      </section>
    )
  }

  return (
    <section>
      <h2>送信キュー（残り {queue.length}人）</h2>
      {notice && <p style={{ color: '#b45309' }}>{notice}</p>}
      <CandidateCard
        candidate={current}
        videoTitle={videos.find((v) => v.id === current.sourceVideoId)?.title ?? null}
        sentMessages={messages.filter((m) => m.candidateId === current.id)}
        quotaRemaining={quota}
        body={body}
        onBodyChange={setBody}
        selectedTemplate={templateId}
        onSelectTemplate={setTemplateId}
        generating={body === GENERATING}
        busy={busy}
        onApprove={approve}
        onMarkUnder18={handleMarkUnder18}
        onVerifyAdult={handleVerifyAdult}
        onSkip={skip}
      />
    </section>
  )
}
