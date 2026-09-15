// app_settings テーブル（単一行）への読み書き。日次上限の既定値は domain 層から取る。
import { supabase } from './supabase'
import { DEFAULT_DAILY_LIMIT } from '../domain/sendingPace'

export async function getDailyLimit(): Promise<number> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('daily_send_limit')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data?.daily_send_limit ?? DEFAULT_DAILY_LIMIT
}

export async function setDailyLimit(limit: number): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({ daily_send_limit: limit, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}
