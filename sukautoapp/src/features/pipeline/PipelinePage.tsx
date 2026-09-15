import { useEffect, useState } from 'react'
import { listCandidates, updateCandidate } from '../../data/candidates'
import { ACTIVE_STAGES, CLOSED_STAGES, STAGE_LABELS } from '../../domain/stageLabels'
import { canChangeStage, stageChangeDenialMessage } from '../../domain/stageFlow'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { TERMINAL_STAGES } from '../../domain/types'
import type { Candidate, Stage } from '../../domain/types'

/**
 * かんばんに並べる列。終端も含めて全ステージを出す。
 * 表示しないと、誤って終端に移した候補者が画面から消えて確認もできなくなる。
 */
const ALL_STAGES: Stage[] = [...ACTIVE_STAGES, ...CLOSED_STAGES]

/**
 * ドロップダウンで選べるステージ。
 *
 * 「対象外」は送信キューの年齢確認から、「連絡不要」は専用ボタンから設定する。
 * ドロップダウンに含めると、対応する記録（age_status / opted_out フラグ）が
 * 立たないままステージだけ変わり、状態が食い違う。
 */
const SELECTABLE_STAGES: Stage[] = ALL_STAGES.filter((s) => s !== 'excluded' && s !== 'opted_out')

export function PipelinePage() {
  const { userId } = useCurrentUser()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [mineOnly, setMineOnly] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    reload().catch((e) => {
      setNotice(`候補者一覧の読み込みに失敗しました。再読み込みしてください: ${String(e)}`)
    })
  }, [])

  const reload = async () => setCandidates(await listCandidates())

  const changeStage = async (candidate: Candidate, stage: Stage) => {
    if (busyId) return

    const decision = canChangeStage(candidate.stage, stage)
    if (!decision.allowed) {
      setNotice(stageChangeDenialMessage(decision.reason))
      return
    }

    setBusyId(candidate.id)
    setNotice(null)
    try {
      await updateCandidate(candidate.id, { stage })
      await reload()
    } catch (e) {
      setNotice(`ステージの変更に失敗しました: ${String(e)}`)
    } finally {
      setBusyId(null)
    }
  }

  const markOptedOut = async (id: string) => {
    if (busyId) return
    if (!window.confirm('この候補者を「連絡不要」にします。取り消せません。よろしいですか？')) return
    setBusyId(id)
    setNotice(null)
    try {
      // ステージとフラグの両方を立てる。取り込み時の除外はフラグを見るため、
      // 片方だけだと同じ人が再びキューに現れる
      await updateCandidate(id, { opted_out: true, stage: 'opted_out' })
      await reload()
    } catch (e) {
      setNotice(`連絡不要への変更に失敗しました: ${String(e)}`)
    } finally {
      setBusyId(null)
    }
  }

  const assignToMe = async (id: string) => {
    if (!userId || busyId) return
    setBusyId(id)
    setNotice(null)
    try {
      await updateCandidate(id, { assignee_id: userId })
      await reload()
    } catch (e) {
      setNotice(`担当の割り当てに失敗しました: ${String(e)}`)
    } finally {
      setBusyId(null)
    }
  }

  const visible = mineOnly ? candidates.filter((c) => c.assigneeId === userId) : candidates

  return (
    <section>
      <h2>パイプライン</h2>
      <label>
        <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
        自分の担当だけ表示
      </label>

      {notice && <p style={{ color: '#b45309' }}>{notice}</p>}

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', marginTop: 16 }}>
        {ALL_STAGES.map((stage) => {
          const inStage = visible.filter((c) => c.stage === stage)
          const isTerminalColumn = TERMINAL_STAGES.includes(stage)
          return (
            <div key={stage} style={{ minWidth: 220, border: '1px solid #ddd', padding: 8 }}>
              <h3>
                {STAGE_LABELS[stage]}（{inStage.length}）
              </h3>
              {inStage.map((c) => (
                <div key={c.id} style={{ border: '1px solid #eee', padding: 8, marginBottom: 8 }}>
                  <p>
                    <strong>@{c.tiktokHandle}</strong>
                  </p>
                  <p style={{ fontSize: 12 }}>{c.refCode}</p>

                  {isTerminalColumn ? (
                    <p style={{ fontSize: 12, color: '#666' }}>
                      {STAGE_LABELS[stage]}にした候補者は画面から元に戻せません。
                    </p>
                  ) : (
                    <>
                      <select
                        value={c.stage}
                        onChange={(e) => changeStage(c, e.target.value as Stage)}
                        disabled={busyId === c.id}
                      >
                        {SELECTABLE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => markOptedOut(c.id)} disabled={busyId === c.id}>
                        連絡不要にする
                      </button>
                    </>
                  )}

                  <button onClick={() => assignToMe(c.id)} disabled={busyId === c.id}>
                    自分が担当
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
