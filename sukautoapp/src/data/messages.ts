// messages テーブルへの読み書き。送信可否や日次上限の判断は domain 層の責務。
import { supabase } from './supabase'
import { mapMessageRow, type MessageRow } from './mappers'
import { fetchAllRows } from './paginate'
import type { MessageRecord, TemplateId } from '../domain/types'

export async function listMessages(): Promise<MessageRecord[]> {
  const rows = await fetchAllRows<MessageRow>((from, to) =>
    supabase.from('messages').select('*').range(from, to),
  )
  return rows.map(mapMessageRow)
}

export async function listMessagesForCandidate(candidateId: string): Promise<MessageRecord[]> {
  const { data, error } = await supabase.from('messages').select('*').eq('candidate_id', candidateId)
  if (error) throw error
  return (data as MessageRow[]).map(mapMessageRow)
}

// sent_by は呼び出し元がログイン中ユーザーのIDを渡す。DB側のRLS（sent_by = auth.uid()）が最終防衛線。
export async function insertMessage(params: {
  candidateId: string
  templateId: TemplateId
  body: string
  sentBy: string
}): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    candidate_id: params.candidateId,
    template_id: params.templateId,
    body: params.body,
    sent_by: params.sentBy,
  })
  if (error) throw error
}
