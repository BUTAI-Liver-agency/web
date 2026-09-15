import { supabase } from './supabase'
import type { IntroRequest, IntroResult } from '../domain/introGeneration'

/**
 * サーバーレス関数を呼んで冒頭文を生成する。
 *
 * APIキーはサーバー側にのみ存在する。エンドポイントは有料のモデルを呼ぶため、
 * ログイン中のセッショントークンを添えて本人確認を通す。
 */
export async function requestIntro(request: IntroRequest): Promise<IntroResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('ログインセッションが見つかりません。再度ログインしてください。')
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`冒頭文の生成に失敗しました (${response.status}): ${detail}`)
  }

  return (await response.json()) as IntroResult
}
