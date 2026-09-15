/**
 * 合言葉コードに使う文字集合。
 * 候補者が手入力・音読する前提のため、紛らわしい 0 O 1 I を除外している。
 */
export const REF_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const CODE_LENGTH = 4

/**
 * 候補者がLINEで名乗る合言葉コードを生成する（例: BT-4X7K）。
 * @param rand 0以上1未満を返す乱数生成器。テストで差し替えられるよう引数化している。
 */
export function generateRefCode(rand: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.floor(rand() * REF_CODE_ALPHABET.length)
    code += REF_CODE_ALPHABET[index]
  }
  return `BT-${code}`
}

/** 採番の再試行上限。これを超えるならコード長そのものを見直すべきなので例外にする。 */
const MAX_ALLOCATION_ATTEMPTS = 50

/**
 * 既に使われているコードを避けて合言葉コードを採番する。
 *
 * 4桁・32文字種は約105万通りしかなく、候補者1000人規模では誕生日問題により
 * 約38%の確率で衝突が起きる。合言葉は一意制約つきの列に入るため、衝突すると
 * 取り込みバッチ全体が失敗する。採番の時点で避けるのが最も単純で確実。
 *
 * @param used 既に使われているコードの集合。採番したコードはこの集合に追加される
 *   （同一バッチ内での重複も防ぐため、呼び出し側は同じ集合を使い回すこと）。
 */
export function generateUniqueRefCode(
  used: Set<string>,
  rand: () => number = Math.random,
): string {
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt++) {
    const code = generateRefCode(rand)
    if (!used.has(code)) {
      used.add(code)
      return code
    }
  }
  throw new Error('合言葉コードを採番できませんでした。コード長の見直しが必要です')
}

/**
 * 入力された合言葉コードを照合できる形に正規化する。
 *
 * 候補者はスマートフォンの日本語IMEでコードを打つため、全角で送られてくることがある
 * （ＢＴ－４Ｘ７Ｋ）。担当者がそれをそのまま貼り付けると照合に失敗し、LINE到達が
 * 記録されない。主要指標が静かに過少計上されるので、入口で吸収する。
 */
export function normalizeRefCode(input: string): string {
  return input
    // 全角英数字を半角へ
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 全角ダッシュ・長音記号をハイフンへ
    .replace(/[−–—ー－]/g, '-')
    .replace(/\s/g, '')
    .toUpperCase()
}
