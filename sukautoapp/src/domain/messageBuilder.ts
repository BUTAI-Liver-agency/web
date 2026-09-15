import type { TemplateId } from './types'
import { TEMPLATES } from '../templates/butai'

export interface BuildParams {
  /** AIが生成した冒頭1〜2文。 */
  intro: string
  /** 候補者ごとの合言葉コード。 */
  refCode: string
}

/**
 * AI生成の冒頭文と固定文面を組み立てて、送信する全文を作る。
 *
 * AIの守備範囲は intro のみ。固定部分は TEMPLATES から逐語で使う（設計書 7.2）。
 */
export function buildMessage(templateId: TemplateId, params: BuildParams): string {
  const template = TEMPLATES[templateId]
  if (!template) {
    throw new Error(`未知のテンプレートID: ${templateId}`)
  }
  const values: Record<string, string> = {
    intro: params.intro.trim(),
    ref_code: params.refCode,
  }
  // テンプレート原文を1回だけ走査して置換する。
  // 置換結果を再走査すると、AI生成文に紛れ込んだプレースホルダ様の文字列まで
  // 置換対象になり、合言葉を持たないはずのテンプレBに合言葉が混入しうる。
  return template.body.replace(/\{(intro|ref_code)\}/g, (_match, key: string) => values[key])
}
