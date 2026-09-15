// videos テーブルへの読み書き。
import { supabase } from './supabase'

export interface Video {
  id: string
  url: string
  title: string
  postedAt: string | null
  commentCountCollected: number
}

export async function listVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    postedAt: r.posted_at,
    commentCountCollected: r.comment_count_collected,
  }))
}

export async function insertVideo(params: { url: string; title: string }): Promise<string> {
  const { data, error } = await supabase
    .from('videos')
    .insert({ url: params.url, title: params.title })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/**
 * 取り込んだコメント数を加算する。PoCの最重要指標（母数）の記録。
 *
 * 読み取ってから書き戻す方式は使わない。2人が同時に取り込むと片方の件数が
 * 上書きで失われ、しかも誰も気づけない。加算はデータベース側で不可分に行う。
 */
export async function addCollectedCount(videoId: string, delta: number): Promise<void> {
  const { error } = await supabase.rpc('add_collected_count', {
    p_video_id: videoId,
    p_delta: delta,
  })
  if (error) throw error
}
