/** Supabase が1リクエストで返す行数の上限（既定値）。 */
const PAGE_SIZE = 1000

/**
 * 条件に合う行を全件取得する。
 *
 * Supabase は1リクエストあたりの行数に上限があり、超えた分はエラーではなく
 * 黙って切り捨てられる。切り捨てに気づけないまま重複判定・送信上限・集計が
 * 狂うため、明示的にページングする。
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
  }
}
