import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { generateIntro, parseIntroRequest } from '../src/domain/introGeneration'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 300

/**
 * 呼び出し元がログイン済みの担当者かを確認する。
 *
 * このエンドポイントは有料のモデルを呼ぶ。デプロイすれば誰でも到達できるため、
 * 認証がないと第三者が事務所の費用でAPIを叩けてしまう。
 */
async function isSignedIn(authorization: string | undefined): Promise<boolean> {
  const token = authorization?.replace(/^Bearer /, '')
  if (!token) return false

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return false

  const { data, error } = await createClient(url, anonKey).auth.getUser(token)
  return !error && data.user !== null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST のみ受け付けます' })
  }

  if (!(await isSignedIn(req.headers.authorization))) {
    return res.status(401).json({ error: 'ログインが必要です' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' })
  }

  const parsed = parseIntroRequest(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.message })
  }

  const client = new Anthropic({ apiKey })

  const callModel = async (prompt: string): Promise<string> => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })
    const firstBlock = response.content[0]
    if (!firstBlock || firstBlock.type !== 'text') {
      // 想定外の応答形。空文字を返すと generateIntro が empty_output として再試行する。
      // 原因追跡のためサーバー側にだけ記録する（利用者には出さない）
      console.warn('想定外の応答ブロック形式:', firstBlock?.type ?? '(空)')
      return ''
    }
    return firstBlock.text
  }

  try {
    const result = await generateIntro(parsed.request, callModel)
    // 違反が残った場合も 200 で返し、UI側で担当者に警告を出す
    return res.status(200).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(502).json({ error: `生成に失敗しました: ${message}` })
  }
}
