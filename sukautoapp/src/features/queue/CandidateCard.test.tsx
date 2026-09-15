import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CandidateCard } from './CandidateCard'
import type { Candidate } from '../../domain/types'

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: 'c1',
  tiktokHandle: 'yuki_live',
  refCode: 'BT-4X7K',
  displayName: 'ゆき',
  commentText: 'ライバー気になります！',
  sourceVideoId: 'v1',
  ageStatus: 'adult',
  ageVerifiedBy: 'u1',
  ageVerifiedAt: '2026-09-13T00:00:00.000Z',
  stage: 'prospect',
  assigneeId: null,
  optedOut: false,
  createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z',
  ...overrides,
})

const noop = vi.fn()
const props = {
  videoTitle: '募集動画1',
  sentMessages: [],
  quotaRemaining: 5,
  body: '本文',
  onBodyChange: noop,
  selectedTemplate: 'A' as const,
  onSelectTemplate: noop,
  generating: false,
  busy: false,
  onApprove: noop,
  onMarkUnder18: noop,
  onVerifyAdult: noop,
  onSkip: noop,
}

describe('CandidateCard の年齢ガード', () => {
  it('18歳以上と確認済みなら承認ボタンを押せる', () => {
    render(<CandidateCard candidate={candidate()} {...props} />)
    expect(screen.getByRole('button', { name: /承認/ })).toBeEnabled()
  })

  it('年齢未確認では承認ボタンが無効になる', () => {
    render(<CandidateCard candidate={candidate({ ageStatus: 'unverified' })} {...props} />)
    expect(screen.getByRole('button', { name: /承認/ })).toBeDisabled()
  })

  it('年齢未確認では赤いバッジで警告する', () => {
    render(<CandidateCard candidate={candidate({ ageStatus: 'unverified' })} {...props} />)
    expect(screen.getByText('年齢未確認')).toBeInTheDocument()
  })

  it('17歳以下では承認ボタンが無効になる', () => {
    render(<CandidateCard candidate={candidate({ ageStatus: 'under18' })} {...props} />)
    expect(screen.getByRole('button', { name: /承認/ })).toBeDisabled()
  })

  it('オプトアウト済みでは承認ボタンが無効になる', () => {
    render(<CandidateCard candidate={candidate({ optedOut: true })} {...props} />)
    expect(screen.getByRole('button', { name: /承認/ })).toBeDisabled()
  })

  it('本日の残り枠が0なら承認ボタンが無効になる', () => {
    render(<CandidateCard candidate={candidate()} {...props} quotaRemaining={0} />)
    expect(screen.getByRole('button', { name: /承認/ })).toBeDisabled()
  })

  it('相手のコメント全文と合言葉コードと取得元動画を表示する', () => {
    render(<CandidateCard candidate={candidate()} {...props} />)
    expect(screen.getByText('ライバー気になります！')).toBeInTheDocument()
    expect(screen.getByText(/BT-4X7K/)).toBeInTheDocument()
    expect(screen.getByText(/募集動画1/)).toBeInTheDocument()
  })

  it('文面の最終責任が担当者にある旨を明示する', () => {
    render(<CandidateCard candidate={candidate()} {...props} />)
    expect(screen.getByText(/送信内容の最終確認は担当者の責任です/)).toBeInTheDocument()
  })

  it('文面を生成している間は承認できない', () => {
    render(<CandidateCard candidate={candidate()} {...props} generating />)
    expect(screen.getByRole('button', { name: /承認/ })).toBeDisabled()
  })

  it('保存処理の実行中は承認できない', () => {
    render(<CandidateCard candidate={candidate()} {...props} busy />)
    expect(screen.getByRole('button', { name: /承認/ })).toBeDisabled()
  })
})
